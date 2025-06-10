#!/usr/bin/env python3
"""
Sistema de captura automática con detección de movimiento para vagonetas
Integra múltiples cámaras con detección inteligente y filtros anti-ruido
"""

import cv2
import numpy as np
import asyncio
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any # Added Any
from .image_processing import process_image
from crud import create_vagoneta_record
import os
import json
from datetime import datetime # Added for timestamp in _save_detection

# Forward declaration for ConnectionManager if it's in main.py and imported here
# This is a common pattern if type hinting a class from a module that also imports this one,
# but in this case, ConnectionManager will be passed as an argument.
# class ConnectionManager:
#     pass # Actual implementation in main.py

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
        # Aplicar sustracción de fondo
        fg_mask = self.background_subtractor.apply(frame)
        
        # Reducir ruido
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_OPEN, self.kernel)
        fg_mask = cv2.morphologyEx(fg_mask, cv2.MORPH_CLOSE, self.kernel)
        
        # Encontrar contornos
        contours, _ = cv2.findContours(fg_mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
        
        has_motion = False
        for contour in contours:
            area = cv2.contourArea(contour)
            if area > self.min_area:
                has_motion = True
                break
                
        return has_motion, fg_mask

class SmartCameraCapture:
    """Sistema inteligente de captura automática"""
    
    def __init__(self, config: Dict, ws_manager: Optional[Any] = None): # Added ws_manager argument
        self.camera_id = config['camera_id']
        self.camera_url = config['camera_url']
        self.source_type = config.get('source_type', 'camera')
        self.evento = config['evento']
        self.tunel = config['tunel']
        self.roi = config.get('roi', None)  # Región de interés
        self.demo_mode = config.get('demo_mode', False)
        self.loop_video = config.get('loop_video', True)
        self.fps_limit = config.get('fps_limit', 20)
        
        # Configuración de captura inteligente
        self.motion_detector = MotionDetector(
            sensitivity=config.get('motion_sensitivity', 0.3),
            min_area=config.get('min_motion_area', 5000)
        )
        
        # Control de tiempo y detecciones
        self.detection_cooldown = config.get('detection_cooldown', 5)  # segundos
        self.last_detection_time = 0
        self.pre_capture_buffer = []  # Buffer para capturar frames antes del movimiento
        self.post_capture_frames = 0
        self.max_buffer_size = 10
        
        self.ws_manager = ws_manager # Store WebSocket manager instance
        
        # Estados
        self.is_running = False
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
        self.is_running = True
        
        # Configurar fuente según tipo
        await self._setup_capture_source()
        
        print(f"🎥 Iniciando captura automática en {self.camera_id} ({self.evento})")
        if self.source_type == 'video':
            print(f"📹 Procesando video: {self.camera_url}")
        
        while self.is_running:
            ret, frame = self.cap.read()
            
            # Manejar fin de video y loop
            if not ret:
                if self.source_type == 'video' and self.loop_video:
                    print(f"🔄 Reiniciando video {self.camera_id} (Loop #{self.stats['video_loops'] + 1})")
                    self.stats['video_loops'] += 1
                    self.cap.set(cv2.CAP_PROP_POS_FRAMES, 0)  # Volver al inicio
                    self.video_frame_count = 0
                    continue
                else:
                    print(f"❌ Error leyendo frame de {self.camera_id}")
                    await asyncio.sleep(1)
                    continue
            
            self.video_frame_count += 1
            await self._process_frame(frame)
            
            # Controlar FPS
            sleep_time = 1.0 / self.fps_limit if self.fps_limit > 0 else 0.05
            await asyncio.sleep(sleep_time)

    async def _setup_capture_source(self):
        """Configura la fuente de captura según el tipo"""
        if self.source_type == 'video':
            # Verificar que el archivo existe
            if not os.path.exists(self.camera_url):
                raise FileNotFoundError(f"Video no encontrado: {self.camera_url}")
            
            self.cap = cv2.VideoCapture(self.camera_url)
            self.total_frames = int(self.cap.get(cv2.CAP_PROP_FRAME_COUNT))
            fps = self.cap.get(cv2.CAP_PROP_FPS)
            print(f"📊 Video cargado: {self.total_frames} frames, {fps:.1f} FPS")
            
        elif self.source_type == 'camera':
            self.cap = cv2.VideoCapture(self.camera_url)
            # Configurar cámara si es local
            if isinstance(self.camera_url, int):
                self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 1280)
                self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 720)
                self.cap.set(cv2.CAP_PROP_FPS, 15)
        
        elif self.source_type == 'rtsp':
            self.cap = cv2.VideoCapture(self.camera_url)
        
        if not self.cap.isOpened():
            raise RuntimeError(f"No se pudo abrir la fuente: {self.camera_url}")

    async def _process_frame(self, frame: np.ndarray):
        """Procesa un frame individual"""
        self.stats['frames_processed'] += 1
        
        # Mostrar progreso para videos en modo demo
        if self.demo_mode and self.source_type == 'video' and self.stats['frames_processed'] % 100 == 0:
            progress = (self.video_frame_count / self.total_frames) * 100 if self.total_frames > 0 else 0
            print(f"📊 {self.camera_id}: Frame {self.video_frame_count}/{self.total_frames} ({progress:.1f}%)")
        
        # Aplicar ROI si está definida
        if self.roi:
            x, y, w, h = self.roi
            roi_frame = frame[y:y+h, x:x+w]
        else:
            roi_frame = frame
          # Detectar movimiento
        has_motion, motion_mask = self.motion_detector.detect_motion(roi_frame)
        
        # Mantener buffer de frames pre-movimiento
        self.pre_capture_buffer.append(frame.copy())
        if len(self.pre_capture_buffer) > self.max_buffer_size:
            self.pre_capture_buffer.pop(0)
        
        if has_motion:
            self.stats['motion_detected'] += 1
            await self._handle_motion_detected(frame)
    
    async def _handle_motion_detected(self, frame: np.ndarray):
        """Maneja la detección de movimiento"""
        current_time = time.time()
        
        # Verificar cooldown
        if current_time - self.last_detection_time < self.detection_cooldown:
            return
        
        print(f"🔍 Movimiento detectado en {self.camera_id}, analizando...")
        
        # Procesar los últimos frames del buffer para mayor precisión
        best_detection = None
        best_frame = None
        
        # Analizar frames del buffer + frame actual
        frames_to_analyze = self.pre_capture_buffer[-3:] + [frame]
        
        for test_frame in frames_to_analyze:
            detection = process_image(test_frame) # Simplificado para usar siempre process_image
            
            if detection and detection.get('numero'):
                if not best_detection or detection.get('confidence', 0) > best_detection.get('confidence', 0):
                    best_detection = detection
                    best_frame = test_frame
        
        if best_detection:
            self.last_detection_time = current_time
            self.stats['vagonetas_detectadas'] += 1
            await self._save_detection(best_detection, best_frame)
        else:
            self.stats['false_positives'] += 1
            print(f"⚠️ Movimiento sin vagoneta identificable en {self.camera_id}")

    async def _save_detection(self, detection: Dict, frame: np.ndarray):
        """Guarda una detección exitosa"""
        try:
            timestamp = datetime.now()
            image_filename = f"{detection['numero']}_{self.evento}_{timestamp.strftime('%Y%m%d_%H%M%S')}.jpg"
            image_path = f"uploads/{image_filename}"
            
            # Asegurar que el directorio existe
            os.makedirs(os.path.dirname(image_path), exist_ok=True)
            
            # Guardar imagen
            cv2.imwrite(image_path, frame)
            
            # Crear registro
            record_data = {
                "numero": detection['numero'],
                "evento": self.evento,
                "tunel": self.tunel,
                "timestamp": timestamp, # Use the generated timestamp object
                "modelo_ladrillo": detection.get('modelo_ladrillo'),
                "imagen_path": image_path,
                "confidence": detection.get('confidence', 0.0),
                "auto_captured": True,
                "camera_id": self.camera_id
            }
            
            # Convert record_data to a structure that can be JSON serialized (e.g., VagonetaInDB like)
            # For simplicity, we'll assume direct dict is fine for now, but Pydantic model is better.
            db_record = await create_vagoneta_record(record_data)
            print(f"✅ Vagoneta {detection['numero']} guardada automáticamente ({self.evento})")

            # Broadcast the new detection via WebSocket
            if self.ws_manager:
                # Prepare a slightly richer payload for WebSocket if needed
                ws_payload = {
                    "type": "new_detection",
                    "data": {
                        "_id": str(db_record.inserted_id), # Assuming create_vagoneta_record returns InsertOneResult
                        "numero": detection['numero'],
                        "evento": self.evento,
                        "tunel": self.tunel,
                        "timestamp": timestamp.isoformat(), # Serialize datetime
                        "modelo_ladrillo": detection.get('modelo_ladrillo'),
                        "imagen_path": image_path,
                        "confidence": detection.get('confidence', 0.0),
                        "auto_captured": True,
                        "camera_id": self.camera_id
                    }
                }
                await self.ws_manager.broadcast_json(ws_payload)
            
        except Exception as e:
            print(f"❌ Error guardando detección: {e}")

    async def stop(self):
        """Detiene la captura"""
        self.is_running = False
        if self.cap:
            self.cap.release()
        
        print(f"📊 Estadísticas de {self.camera_id}:")
        print(f"   Frames procesados: {self.stats['frames_processed']}")
        print(f"   Movimientos detectados: {self.stats['motion_detected']}")
        print(f"   Vagonetas identificadas: {self.stats['vagonetas_detectadas']}")
        print(f"   Falsos positivos: {self.stats['false_positives']}")

class AutoCaptureManager:
    """Gestor principal del sistema de captura automática"""
    
    def __init__(self, cameras_config: List[Dict], ws_manager: Optional[Any] = None): # Added ws_manager argument
        self.cameras = []
        self.tasks = []
        self.ws_manager = ws_manager # Store WebSocket manager
        
        for config in cameras_config:
            camera = SmartCameraCapture(config, self.ws_manager) # Pass ws_manager to SmartCameraCapture
            self.cameras.append(camera)
    
    async def start_all(self):
        """Inicia todas las cámaras"""
        print("🚀 Iniciando sistema de captura automática...")
        
        for camera in self.cameras:
            task = asyncio.create_task(camera.start())
            self.tasks.append(task)
        
        await asyncio.gather(*self.tasks)
    
    async def stop_all(self):
        """Detiene todas las cámaras"""
        print("🛑 Deteniendo sistema de captura automática...")
        
        for camera in self.cameras:
            await camera.stop()
        
        for task in self.tasks:
            task.cancel()

def load_cameras_config(config_path: str = "cameras_config.json") -> List[Dict]:
    """Carga la configuración de las cámaras desde un archivo JSON."""
    try:
        with open(config_path, 'r') as f:
            config = json.load(f)
        print(f"🔧 Configuración de cámaras cargada desde {config_path}")
        return config
    except FileNotFoundError:
        print(f"❌ Error: Archivo de configuración de cámaras no encontrado en {config_path}. Usando configuración por defecto.")
        # Fallback a una configuración por defecto o vacía si el archivo no existe
        return [] 
    except json.JSONDecodeError:
        print(f"❌ Error: El archivo de configuración de cámaras {config_path} no es un JSON válido. Usando configuración por defecto.")
        return []

# Ejemplo de uso
async def main():
    # cameras_config = load_cameras_config() # Cargar configuración desde JSON
    # if not cameras_config: # Si la carga falla o el archivo está vacío, no continuar
    #     print("🛑 No se pudo cargar la configuración de las cámaras. El sistema no puede iniciar.")
    #     return
    # manager = AutoCaptureManager(cameras_config)
    
    # WebSocket manager would be initialized in main.py and passed here if running standalone
    # For this example, assuming it's run via FastAPI, ws_manager is handled by FastAPI app.
    print("AutoCaptureSystem main() is for standalone testing and needs CAMERAS_CONFIG and potentially a mock ws_manager.")
    
    # Example for standalone testing (requires CAMERAS_CONFIG to be loaded):
    # cameras_config = load_cameras_config()
    # if cameras_config:
    #     # Mock WebSocket manager for testing if needed
    #     class MockWsManager:
    #         async def broadcast_json(self, data):
    #             print(f"[Mock WS Broadcast]: {data}")
    #     
    #     manager = AutoCaptureManager(cameras_config, MockWsManager())
    #     try:
    #         await manager.start_all()
    #     except KeyboardInterrupt:
    #         await manager.stop_all()
    # else:
    #     print("🛑 No camera configuration found for standalone test.")

if __name__ == "__main__":
    asyncio.run(main())
