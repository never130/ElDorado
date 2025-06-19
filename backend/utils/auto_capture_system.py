#!/usr/bin/env python3
"""
Sistema de captura automática con detección de movimiento para vagonetas
Integra múltiples cámaras con detección inteligente y filtros anti-ruido
"""

import cv2
import numpy as np
import asyncio
import time
from datetime import datetime, timezone # MODIFIED: Added timezone
from typing import Dict, List, Optional, Tuple, Any 
from utils.image_processing import run_detection_on_frame # Updated import
from crud import create_vagoneta_record
import os
import json # MODIFIED: Ensured json is imported
from pathlib import Path # ADDED: For Path object handling
from schemas import VagonetaCreate # ADDED: For Pydantic model

# Default path relative to the backend directory where main.py is expected to run
DEFAULT_CAMERAS_CONFIG_PATH = Path("cameras_config.json")

def load_cameras_config(config_path: Path = DEFAULT_CAMERAS_CONFIG_PATH) -> List[Dict[str, Any]]:
    """Carga la configuración de las cámaras desde un archivo JSON."""
    try:
        # Ensure the path is resolved correctly if main.py is in backend/
        # and this script is in backend/utils/
        # If main.py's CWD is backend/, then Path("cameras_config.json") is correct.
        # For robustness, one might construct path relative to this file's parent if config is always co-located.
        # However, current setup implies config path is relative to execution dir of main.py
        
        effective_path = config_path
        # If the default path is used and this file is in a subdirectory (e.g. utils)
        # and cameras_config.json is in the parent (e.g. backend),
        # we might need to adjust. But typically Python resolves paths from CWD.
        # Let's assume CWD is 'backend/' when main.py runs.
        
        if not effective_path.is_absolute():
            # This attempts to find the config file relative to the script's parent directory
            # if the initial path (e.g. "cameras_config.json") doesn't exist from CWD.
            # This is a bit heuristic. A more robust way is to set an env var or pass full path.
            # For now, let's assume it's in CWD or one level up from this script's dir.
            # Path(__file__).parent.parent refers to backend/ if this file is backend/utils/auto_capture_system.py
            potential_path_from_script_parent = Path(__file__).parent.parent / config_path.name
            if not effective_path.exists() and potential_path_from_script_parent.exists():
                effective_path = potential_path_from_script_parent
            elif not effective_path.exists(): # If still not found, try CWD (original assumption)
                 # This will be redundant if effective_path was already relative and CWD is the base
                 pass


        with open(effective_path, 'r', encoding='utf-8') as f:
            config_data = json.load(f)
        
        if not isinstance(config_data, list):
            print(f"ERROR: El archivo de configuración de cámaras ({effective_path}) debe contener una lista.")
            return [] # Return empty or raise, depending on desired strictness
        
        # Basic validation for each camera config dictionary
        for i, cam_conf in enumerate(config_data):
            if not isinstance(cam_conf, dict):
                print(f"ERROR: Entrada de configuración de cámara #{i+1} en {effective_path} no es un diccionario.")
                # Decide: skip this entry, or invalidate whole config? For now, let it pass to be caught by SmartCameraCapture init
            # Add more specific key checks if needed, e.g., presence of 'camera_id', 'camera_url'
            # if 'camera_id' not in cam_conf or 'camera_url' not in cam_conf:
            #     print(f"WARN: Entrada de cámara #{i+1} en {effective_path} le faltan campos clave (camera_id, camera_url).")


        print(f"INFO: Configuración de cámaras cargada exitosamente desde {effective_path}")
        return config_data
    except FileNotFoundError:
        print(f"CRITICAL ERROR: Archivo de configuración de cámaras no encontrado en {str(effective_path)} (intentado) ni en ubicaciones alternativas. El sistema de captura automática no funcionará sin configuración.")
        # Depending on requirements, could return a default empty list or raise an error.
        # Raising an error might be better to signal a critical configuration issue.
        # For now, returning empty list to avoid immediate crash on import if file is missing,
        # but this will likely lead to issues later when AutoCaptureManager is initialized.
        # Consider raising an exception: raise FileNotFoundError(f"cameras_config.json not found at expected locations.")
        return [] 
    except json.JSONDecodeError as e:
        print(f"CRITICAL ERROR: Error decodificando JSON del archivo de configuración de cámaras en {str(effective_path)}: {e}. Verifique la sintaxis del archivo.")
        return [] # Or raise
    except Exception as e: # Catch any other unexpected errors during loading
        print(f"CRITICAL ERROR: Error inesperado cargando configuración de cámaras desde {str(effective_path)}: {e}")
        import traceback
        traceback.print_exc()
        return []


class MotionDetector:
    """Detector de movimiento optimizado para vagonetas"""
    
    def __init__(self, sensitivity: float = 0.3, min_area: int = 5000):
        self.sensitivity = sensitivity
        self.min_area = min_area
        self.background_subtractor = cv2.createBackgroundSubtractorMOG2(
            detectShadows=True, varThreshold=16, history=500
        )
        self.kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        
    def detect_motion(self, frame: np.ndarray) -> Tuple[bool, np.ndarray]:
        """
        Detecta movimiento en el frame
        Returns: (has_motion, processed_frame)
        """
        fg_mask = self.background_subtractor.apply(frame)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, self.kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, self.kernel)
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        has_motion = False
        for contour in contours:
            if cv2.contourArea(contour) > self.min_area:
                has_motion = True
                break
        return has_motion, fg_mask

class SmartCameraCapture:
    """Sistema inteligente de captura automática"""

    def __init__(self, config: Dict, ws_manager: Optional[Any], upload_dir: Path): # MODIFIED: Added upload_dir
        self.camera_id = config['camera_id']
        self.camera_url = config['camera_url']
        self.source_type = config.get('source_type', 'camera')
        self.evento = config['evento']
        self.tunel = config['tunel']
        self.roi = config.get('roi', None)
        self.demo_mode = config.get('demo_mode', False)
        self.loop_video = config.get('loop_video', True)
        self.fps_limit = config.get('fps_limit', 20)

        self.motion_detector = MotionDetector(
            sensitivity=config.get('motion_sensitivity', 0.3),
            min_area=config.get('min_motion_area', 5000)
        )

        self.detection_cooldown = config.get('detection_cooldown', 5)
        self.last_detection_time = 0
        self.pre_capture_buffer = []
        self.max_buffer_size = config.get('max_buffer_size', 10) # Made configurable

        self.ws_manager = ws_manager
        self.upload_dir = upload_dir 

        self.is_running = False # Instance variable to track running state
        self.cap = None
        self.video_frame_count = 0
        self.total_frames = 0
        self.stats = {
            'frames_processed': 0,
            'motion_detected': 0,
            'vagonetas_detected': 0,
            'false_positives': 0,
            'video_loops': 0
        }

    async def start(self):
        """Inicia el sistema de captura automática"""
        if self.is_running:
            print(f"Advertencia: Captura ya en ejecución para {self.camera_id}")
            return

        self.is_running = True
        await self._setup_capture_source()
        
        print(f"🎥 Iniciando captura automática en {self.camera_id} ({self.evento})")
        if self.source_type == 'video':
            print(f"📹 Procesando video: {self.camera_url}")
        
        try:
            while self.is_running:
                if not self.cap or not self.cap.isOpened():
                    print(f"Error: Fuente de captura no está abierta para {self.camera_id}. Intentando reabrir...")
                    await self._setup_capture_source() # Try to re-setup
                    if not self.cap or not self.cap.isOpened(): # If still not open, wait and retry loop
                        await asyncio.sleep(5) 
                        continue
                
                ret, frame = self.cap.read()
                
                if not ret:
                    if self.source_type == 'video' and self.loop_video:
                        print(f"🔄 Reiniciando video {self.camera_id} (Loop #{self.stats['video_loops'] + 1})")
                        self.stats['video_loops'] += 1
                        self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        self.video_frame_count = 0
                        continue
                    else:
                        print(f"❌ Error leyendo frame de {self.camera_id} o fin del video (no loop). Deteniendo cámara.")
                        self.is_running = False # Stop if frame read fails and not looping video
                        break 
                
                self.video_frame_count += 1
                await self._process_frame(frame)
                
                sleep_time = 1.0 / self.fps_limit if self.fps_limit > 0 else 0.01 # Min sleep if fps_limit is 0
                await asyncio.sleep(sleep_time)
        except Exception as e:
            print(f"Error catastrófico en el bucle de captura para {self.camera_id}: {e}")
            import traceback
            traceback.print_exc()
        finally:
            self.is_running = False
            if self.cap:
                self.cap.release()
            print(f"Captura detenida para {self.camera_id}")


    async def _setup_capture_source(self):
        """Configura la fuente de captura según el tipo"""
        if self.cap: # Release previous capture if any
            self.cap.release()
            self.cap = None

        if self.source_type == 'video':
            if not os.path.exists(self.camera_url): # Use os.path.exists for paths
                print(f"Error: Video no encontrado: {self.camera_url} para {self.camera_id}")
                self.is_running = False # Stop if video file not found
                return # Critical error, cannot proceed
            self.cap = cv2.VideoCapture(self.camera_url)
            self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            print(f"📊 Video cargado para {self.camera_id}: {self.total_frames} frames, {fps:.1f} FPS")
            
        elif self.source_type == 'camera':
            try:
                camera_index = int(self.camera_url) # Assume URL is an index for local cameras
                self.cap = cv2.VideoCapture(camera_index)
                # Optional: Configure camera properties if needed
                # self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                # self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
            except ValueError:
                print(f"Error: URL de cámara local inválida '{self.camera_url}' para {self.camera_id}. Debe ser un índice numérico.")
                self.is_running = False
                return
        
        elif self.source_type == 'rtsp':
            self.cap = cv2.VideoCapture(self.camera_url)
        
        if not self.cap or not self.cap.isOpened():
            print(f"Error: No se pudo abrir la fuente: {self.camera_url} para {self.camera_id}")
            self.is_running = False # Stop if source cannot be opened
            # Consider adding a retry mechanism here or in the main loop

    async def _process_frame(self, frame: np.ndarray):
        """Procesa un frame individual"""
        self.stats['frames_processed'] += 1
        
        if self.demo_mode and self.source_type == 'video' and self.stats['frames_processed'] % 100 == 0:
            progress = (self.video_frame_count / self.total_frames) * 100 if self.total_frames > 0 else 0
            print(f"📊 {self.camera_id}: Frame {self.video_frame_count}/{self.total_frames} ({progress:.1f}%)")
        
        roi_frame = frame[self.roi[1]:self.roi[1]+self.roi[3], self.roi[0]:self.roi[0]+self.roi[2]] if self.roi else frame
          
        has_motion, _ = self.motion_detector.detect_motion(roi_frame) # motion_mask not used
        
        self.pre_capture_buffer.append(frame.copy()) # Use the original frame for buffer
        if len(self.pre_capture_buffer) > self.max_buffer_size:
            self.pre_capture_buffer.pop(0)
        
        if has_motion:
            self.stats['motion_detected'] += 1
            await self._handle_motion_detected(frame) # Pass original frame for full context
    
    async def _handle_motion_detected(self, current_frame: np.ndarray):
        """Maneja la detección de movimiento"""
        current_time = time.time()
        
        if current_time - self.last_detection_time < self.detection_cooldown:
            return
        
        print(f"🔍 Movimiento detectado en {self.camera_id}, analizando...")
        
        best_detection_result = None
        best_frame_for_detection = None
          # Analyze frames from buffer + current_frame
        # Ensure buffer frames are used if available, otherwise just current_frame
        if self.pre_capture_buffer:
            frames_to_analyze = self.pre_capture_buffer + [current_frame]
        else:
            frames_to_analyze = [current_frame]
        
        for f_idx, test_frame in enumerate(frames_to_analyze):
            # run_detection_on_frame expects a numpy array (frame)
            # and returns a dict with detection results
            detection_data = run_detection_on_frame(test_frame)
            
            if detection_data and detection_data.get('numero_detectado'):
                current_confidence = float(detection_data.get('confianza_numero', 0.0))
                if not best_detection_result or current_confidence > float(best_detection_result.get('confianza_numero', 0.0)):
                    best_detection_result = detection_data
                    best_frame_for_detection = test_frame # Store the frame that yielded best detection
        
        if best_detection_result and best_frame_for_detection is not None:
            self.last_detection_time = current_time
            self.stats['vagonetas_detectadas'] += 1
            await self._save_detection(best_detection_result, best_frame_for_detection)
        else:
            self.stats['false_positives'] += 1
            print(f"⚠️ Movimiento sin vagoneta identificable en {self.camera_id}")

    async def _save_detection(self, detection: Dict, frame: np.ndarray):
        """Guarda una detección exitosa"""
        try:
            timestamp_dt = datetime.now(timezone.utc)
            
            numero_str = str(detection.get('numero_detectado', 'unknown')).replace(' ', '_').replace('/', '_')
            sane_evento = str(self.evento).replace(' ', '_').replace('/', '_')

            image_filename = f"{numero_str}_{sane_evento}_{timestamp_dt.strftime('%Y%m%d_%H%M%S%f')}.jpg"

            save_dir = Path(self.upload_dir)
            save_dir.mkdir(parents=True, exist_ok=True)

            image_full_save_path = save_dir / image_filename
            cv2.imwrite(str(image_full_save_path), frame)
            image_path_for_db = f"uploads/{image_filename}"

            raw_confidence = detection.get('confianza_numero', 0.0)
            try:
                confidence_float = float(raw_confidence)
                if confidence_float < 0.0: confidence_float = 0.0
                # Capping at 1.0 can be done here if desired, or rely on process_image to return valid scores
                # confidence_float = min(confidence_float, 1.0) 
            except (ValueError, TypeError):
                confidence_float = 0.0
            
            vagoneta_data_create = VagonetaCreate(
                numero=str(detection['numero_detectado']), # Ensure numero is string
                evento=self.evento,
                tunel=self.tunel,
                timestamp=timestamp_dt,
                modelo_ladrillo=detection.get('modelo_ladrillo'),
                imagen_path=image_path_for_db,
                confianza=confidence_float,
                origen_deteccion="auto_capture",
                merma=None, 
                metadata={"camera_id": self.camera_id}
            )
            
            record_id = create_vagoneta_record(vagoneta_data_create) # This is a sync function

            print(f"✅ Vagoneta {detection['numero_detectado']} guardada automáticamente ({self.evento}), ID: {record_id}")

            if self.ws_manager:
                db_record_dict = vagoneta_data_create.dict()
                db_record_dict["_id"] = str(record_id) 
                db_record_dict["id"] = str(record_id) 
                if isinstance(db_record_dict.get("timestamp"), datetime):
                    db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
                
                ws_payload = {
                    "type": "new_detection",
                    "data": db_record_dict
                }
                # Use asyncio.create_task for non-blocking broadcast
                asyncio.create_task(self.ws_manager.broadcast_json(ws_payload))
                print(f"WebSocket broadcast initiated for auto-captured record {record_id}")
            
        except Exception as e:
            print(f"❌ Error guardando detección automática: {e}")
            import traceback
            traceback.print_exc()

    async def stop(self):
        """Detiene la captura"""
        print(f"Solicitando detención de captura para {self.camera_id}...")
        self.is_running = False # Signal the loop to stop
        # The loop in start() will break, release cap, and print stats.
        # If start() is running in a task, canceling the task is another way.

class AutoCaptureManager:
    """Gestor principal del sistema de captura automática"""
    
    def __init__(self, cameras_config: List[Dict], upload_dir: Path, ws_manager: Optional[Any]):
        self.cameras: List[SmartCameraCapture] = []
        self.tasks: List[asyncio.Task] = []
        self.ws_manager = ws_manager
        self.upload_dir = upload_dir
        self._is_running_flag = False # Internal flag for manager's state
        
        for config in cameras_config:
            camera = SmartCameraCapture(config, self.ws_manager, self.upload_dir)
            self.cameras.append(camera)
    
    async def start_system(self):
        """Inicia todas las cámaras y el sistema."""
        if self._is_running_flag:
            print("AutoCaptureManager: El sistema ya está en ejecución.")
            return

        print("AutoCaptureManager: Iniciando todas las cámaras...")
        if not self.cameras:
            print("AutoCaptureManager: No hay cámaras configuradas.")
            return

        self._is_running_flag = True
        self.tasks = [asyncio.create_task(camera.start()) for camera in self.cameras]
        
        # Optionally, could gather tasks here if start_system is meant to block
        # await asyncio.gather(*self.tasks, return_exceptions=True)
        # However, typically this is launched as a background task itself.
        print("AutoCaptureManager: Sistema iniciado, cámaras operando en segundo plano.")


    async def stop_system(self):
        print("AutoCaptureManager: Deteniendo todas las cámaras...")
        self._is_running_flag = False
        for camera in self.cameras:
            await camera.stop() # Signal each camera to stop its loop

        # Wait for tasks to complete after being signaled to stop
        if self.tasks:
            await asyncio.gather(*self.tasks, return_exceptions=True)
        
        self.tasks = []
        print("AutoCaptureManager: Todas las cámaras detenidas y tareas finalizadas.")

    def is_running(self) -> bool:
        # Check if the manager was started and if any camera tasks are still active
        # This could also check camera.is_running if that's more accurate
        return self._is_running_flag and any(not task.done() for task in self.tasks if task)

    def get_status(self) -> Dict:
        camera_statuses = []
        for cam in self.cameras:
            status = {
                "camera_id": cam.camera_id,
                "is_running": cam.is_running, # SmartCameraCapture.is_running reflects its loop
                "source_type": cam.source_type,
                "evento": cam.evento,
                "stats": cam.stats,
            }
            if cam.source_type == 'video':
                status['video_progress'] = f"{cam.video_frame_count}/{cam.total_frames}" if cam.total_frames > 0 else "N/A"
            camera_statuses.append(status)
        return {
            "manager_running": self.is_running(),
            "cameras": camera_statuses
        }
