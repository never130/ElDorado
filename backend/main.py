# main.py - Backend principal de la app de seguimiento de vagonetas
# Autor: [Tu nombre o equipo]
# Descripción: API REST para subir, procesar y consultar registros de vagonetas usando visión computacional.

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Form, WebSocket, WebSocketDisconnect # Added WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import os
import tempfile
import glob
import uvicorn
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Any
import crud
from utils.image_processing import detectar_vagoneta_y_placa, detectar_vagoneta_y_placa_mejorado, detectar_modelo_ladrillo
from utils.ocr import extract_number_from_image # Changed from ocr_placa_img
from utils.camera_capture import CameraCapture
from utils.auto_capture_system import AutoCaptureManager, load_cameras_config # Ensure load_cameras_config is imported
from database import connect_to_mongo, close_mongo_connection, get_database
import cv2
import numpy as np
from collections import Counter
from schemas import VagonetaCreate, VagonetaInDB
import asyncio
import base64
import io
from utils.image_processing import processor # Import the processor instance

# WebSocket Connection Manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connection established: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        print(f"WebSocket connection closed: {websocket.client}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data: dict):
        # Ensure datetime objects are serialized
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()

# Función para procesar videos MP4
async def procesar_video_mp4(video_path: str) -> Optional[str]: # Asegurar que Optional se importa de typing
    """
    Procesa un video MP4 frame por frame para detectar números de vagonetas
    Retorna el primer número detectado con alta confianza
    """
    try:
        print(f"📹 Iniciando procesamiento de video: {video_path}")

        cap = cv2.VideoCapture(video_path)

        if not cap.isOpened():
            raise ValueError(f"No se pudo abrir el video: {video_path}")

        total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        print(f"📊 Video info: {total_frames} frames, {fps:.2f} FPS")

        frame_count = 0
        frames_to_skip = max(1, int(fps // 3))
        max_frames = min(50, total_frames // frames_to_skip)

        numeros_detectados = []

        while cap.isOpened() and frame_count < max_frames:
            for _ in range(frames_to_skip):
                ret_skip = cap.read()[0]
                if not ret_skip:
                    break
            if not cap.isOpened() or not ret_skip:
                break

            ret, frame = cap.read()
            if not ret:
                break

            print(f"🔍 Procesando frame {frame_count + 1}/{max_frames}")

            try:
                cropped_placa_img, bbox_vagoneta, bbox_placa, numero, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame)

                if numero and numero.strip():
                    numeros_detectados.append(numero.strip())
                    print(f"✅ Número detectado en frame {frame_count}: {numero}")

                    if len(numeros_detectados) >= 3:
                        ultimo_numero = numeros_detectados[-1]
                        count_ultimo = numeros_detectados[-10:].count(ultimo_numero)
                        if count_ultimo >= 3:
                            print(f"🏁 Detección consistente de '{ultimo_numero}', finalizando procesamiento de video.")
                            cap.release()
                            return ultimo_numero
                else:
                    print(f"❌ No se detectó número en frame {frame_count}")

            except Exception as frame_error:
                import traceback
                print(f"⚠️ Error procesando frame {frame_count}: {str(frame_error)}")
                traceback.print_exc()

            frame_count += 1

        cap.release()

        if numeros_detectados:
            numero_mas_comun = max(set(numeros_detectados), key=numeros_detectados.count)
            frecuencia = numeros_detectados.count(numero_mas_comun)
            print(f"📈 Números detectados: {numeros_detectados}")
            print(f"🏆 Número más común: {numero_mas_comun} (detectado {frecuencia} veces)")
            return numero_mas_comun
        else:
            print("❌ No se detectó ningún número en todo el video")
            return None

    except Exception as e:
        import traceback
        print(f"💥 Error GRANDE procesando video: {str(e)}")
        traceback.print_exc()
        return None

# Función auxiliar para convertir string a float
def parse_merma(merma_str: str) -> Optional[float]:
    """Convierte string de merma a float, manejando cadenas vacías"""
    if not merma_str or merma_str.strip() == "":
        return None
    try:
        return float(merma_str)
    except (ValueError, TypeError):
        return None

# Inicializa la app FastAPI
app = FastAPI(
    title="API de Seguimiento de Vagonetas",
    description="Sistema de trazabilidad y seguimiento de vagonetas con visión computacional",
    version="2.0.0"
)

# Eventos de inicio y cierre
@app.on_event("startup")
async def startup_db_client():
    connect_to_mongo()

@app.on_event("shutdown")
async def shutdown_db_client():
    close_mongo_connection()

# Habilita CORS para permitir peticiones desde el frontend React
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Carpeta donde se guardan las imágenes subidas
UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)

# Sirve las imágenes subidas como archivos estáticos
app.mount("/uploads", StaticFiles(directory="uploads"), name="uploads")

# Diccionario para mantener las instancias de cámaras activas
active_cameras: Dict[str, CameraCapture] = {}

# Variable global para el sistema de captura automática
auto_capture_manager = None
auto_capture_task = None
CAMERAS_CONFIG = load_cameras_config() # Load camera configs here

# --- ENDPOINTS PRINCIPALES ---

@app.post("/upload/",
    response_model=Dict,
    summary="Subir imagen de vagoneta",
    description="Procesa una imagen y detecta automáticamente el número de vagoneta y modelo de ladrillo.")
async def upload_image(
    file: UploadFile = File(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: str = Form(None),
    metadata: Optional[Dict] = Form(None)
):
    # Validar y guardar imagen
    file_ext = file.filename.split(".")[-1]
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    save_path = UPLOAD_DIR / f"{timestamp}_{file.filename}"
    
    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)    # Procesar imagen
    try:
        # NUEVA: Usar detección mejorada con agrupación de números compuestos
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado = detectar_vagoneta_y_placa_mejorado(str(save_path))
        
        if not numero_detectado:
            try:
                os.remove(save_path)
            except Exception:
                pass
            return JSONResponse(
                {"message": "No se detectó vagoneta con número", "status": "ignored"},
                status_code=200
            )        # Detectar modelo
        modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
        
        # Crear registro
        vagoneta = VagonetaCreate(
            numero=numero_detectado,
            imagen_path=f"uploads/{save_path.name}",
            timestamp=datetime.utcnow(),
            tunel=tunel,
            evento=evento,
            modelo_ladrillo=modelo_ladrillo,
            merma=parse_merma(merma),
            metadata=metadata
        )
        
        record_id = await crud.create_vagoneta_record(vagoneta)
        
        return {
            "message": "Registro creado exitosamente",
            "status": "ok",
            "record_id": record_id,
            "numero_detectado": numero_detectado,
            "modelo_ladrillo": modelo_ladrillo
        }

    except Exception as e:
        try:
            os.remove(save_path)
        except:
            pass
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/upload-multiple/")
async def upload_files(
    files: List[UploadFile] = File(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: str = Form(None),
    metadata: Optional[Dict] = Form(None)
):
    results = []
    for file in files:
        try:
            # Validar tipo de archivo
            if not file.content_type:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "error": "Tipo de contenido no detectado"
                })
                continue
                
            # Verificar si es imagen o video
            is_image = file.content_type.startswith('image/')
            is_video = file.content_type.startswith('video/') and file.content_type in ['video/mp4', 'video/avi', 'video/mov', 'video/quicktime']
            
            if not (is_image or is_video):
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "error": f"Tipo de archivo no soportado: {file.content_type}. Solo se permiten imágenes y videos MP4/AVI/MOV."
                })
                continue
            
            timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            save_path = UPLOAD_DIR / f"{timestamp}_{file.filename}"
              # Guardar archivo
            with save_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            if is_image:
                # Procesar imagen
                cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado = detectar_vagoneta_y_placa_mejorado(str(save_path))
            else:
                # Procesar video
                numero_detectado = await procesar_video_mp4(str(save_path))
            
            if not numero_detectado:
                try:
                    os.remove(save_path)
                except:
                    pass
                results.append({
                    "filename": file.filename,
                    "status": "ignored",
                    "message": "No se detectó vagoneta con número"
                })
                continue
            
            modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
            
            vagoneta = VagonetaCreate(
                numero=numero_detectado,
                imagen_path=f"uploads/{save_path.name}",
                timestamp=datetime.utcnow(),
                tunel=tunel,
                evento=evento,
                modelo_ladrillo=modelo_ladrillo,
                merma=parse_merma(merma),
                metadata=metadata
            )
            
            record_id = await crud.create_vagoneta_record(vagoneta)
            
            results.append({
                "filename": file.filename,
                "status": "ok",
                "record_id": record_id,
                "numero_detectado": numero_detectado,
                "modelo_ladrillo": modelo_ladrillo
            })
            
        except Exception as e:
            try:
                os.remove(save_path)
            except:
                pass
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return {"results": results}

@app.get("/vagonetas/",
    response_model=List[VagonetaInDB],
    summary="Consultar historial de vagonetas",
    description="Consulta el historial con múltiples filtros disponibles.")
async def get_vagonetas(
    numero: Optional[str] = Query(None, description="Número de vagoneta"),
    fecha: Optional[str] = Query(None, description="Fecha en formato YYYY-MM-DD"),
    tunel: Optional[str] = Query(None, description="Filtrar por túnel"),
    modelo: Optional[str] = Query(None, description="Filtrar por modelo de ladrillo"),
    evento: Optional[str] = Query(None, description="Filtrar por tipo de evento"),
    merma_min: Optional[float] = Query(None, ge=0, le=100, description="Merma mínima"),
    merma_max: Optional[float] = Query(None, ge=0, le=100, description="Merma máxima"),
    skip: int = Query(0, ge=0, description="Registros a saltar"),
    limit: int = Query(50, ge=1, le=100, description="Límite de registros")
):
    registros = crud.get_vagonetas_historial(
        skip=skip,
        limit=limit,
        numero=numero,
        fecha=fecha,
        tunel=tunel,
        modelo=modelo,
        evento=evento,
        merma_min=merma_min,
        merma_max=merma_max
    )
    return registros

@app.get("/trayectoria/{numero}",
    response_model=Dict,
    summary="Trayectoria completa de vagoneta",
    description="Obtiene todos los eventos y estadísticas de una vagoneta específica.")
async def trayectoria_vagoneta(numero: str):
    registros = crud.get_trayectoria_completa(numero)
    estadisticas = crud.get_estadisticas_vagoneta(numero)
    
    if not registros:
        raise HTTPException(status_code=404, detail="Vagoneta no encontrada")
    
    return {
        "numero": numero,
        "eventos": registros,
        "estadisticas": estadisticas
    }

@app.delete("/vagonetas/{record_id}",
    summary="Anular registro",
    description="Anula (soft delete) un registro específico.")
async def anular_registro(record_id: str):
    success = await crud.anular_registro(record_id)
    if not success:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro anulado exitosamente"}

@app.put("/vagonetas/{record_id}",
    summary="Actualizar registro",
    description="Actualiza campos específicos de un registro.")
async def actualizar_registro(
    record_id: str,
    data: Dict
):
    success = await crud.actualizar_registro(record_id, data)
    if not success:
        raise HTTPException(status_code=404, detail="Registro no encontrado")
    return {"message": "Registro actualizado exitosamente"}

@app.get("/search",
    response_model=List[VagonetaInDB],
    summary="Búsqueda de texto",
    description="Búsqueda de texto completo en registros.")
async def buscar_registros(
    q: str = Query(..., min_length=2, description="Texto a buscar"),
    skip: int = Query(0, ge=0),
    limit: int = Query(20, ge=1, le=100)
):
    return await crud.buscar_vagonetas(q, skip, limit)

# --- ENDPOINTS DE CÁMARAS ---

@app.post("/cameras/start",
    summary="Iniciar cámara",
    description="Inicia la captura automática desde una cámara.")
async def start_camera(
    camera_config: dict,
    background_tasks: BackgroundTasks
):
    try:
        camera = CameraCapture(**camera_config)
        active_cameras[camera_config["camera_id"]] = camera
        background_tasks.add_task(camera.start)
        return {"message": f"Cámara {camera_config['camera_id']} iniciada"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/cameras/stop/{camera_id}",
    summary="Detener cámara",
    description="Detiene la captura de una cámara específica.")
async def stop_camera(camera_id: str):
    if camera_id in active_cameras:
        await active_cameras[camera_id].stop()
        del active_cameras[camera_id]
        return {"message": f"Cámara {camera_id} detenida"}
    raise HTTPException(status_code=404, detail="Cámara no encontrada")

@app.get("/cameras/status",
    summary="Estado de cámaras",
    description="Obtiene el estado de todas las cámaras activas.")
def get_cameras_status():
    return {
        camera_id: {
            "evento": camera.evento,
            "tunel": camera.tunel,
            "is_running": camera.is_running,
            "last_detection": camera.last_detection_time,
            "detection_count": camera.detection_count if hasattr(camera, 'detection_count') else 0
        }
        for camera_id, camera in active_cameras.items()
    }

@app.get("/health",
    summary="Healthcheck",
    description="Verifica que el backend está funcionando correctamente.")
def health():
    return {
        "status": "ok",
        "timestamp": datetime.utcnow(),
        "active_cameras": len(active_cameras)
    }

# --- ENDPOINTS DE CAPTURA AUTOMÁTICA ---

@app.post("/auto-capture/start")
async def start_auto_capture():
    """Inicia el sistema de captura automática"""
    global auto_capture_manager, auto_capture_task # manager is already global
    
    if auto_capture_task and not auto_capture_task.done():
        return {"status": "error", "message": "El sistema de captura automática ya está en ejecución"}
    
    try:
        # Pass the WebSocket manager to the AutoCaptureManager
        auto_capture_manager = AutoCaptureManager(CAMERAS_CONFIG, manager)
        auto_capture_task = asyncio.create_task(auto_capture_manager.start_all())
        return {"status": "success", "message": "Sistema de captura automática iniciado"}
    except Exception as e:
        return {"status": "error", "message": f"Error al iniciar captura automática: {str(e)}"}

@app.post("/auto-capture/stop")
async def stop_auto_capture():
    """Detiene el sistema de captura automática"""
    global auto_capture_manager, auto_capture_task
    
    if not auto_capture_task or auto_capture_task.done():
        return {"status": "error", "message": "El sistema de captura automática no está ejecutándose"}
    
    try:
        if auto_capture_manager:
            await auto_capture_manager.stop_all()
        if auto_capture_task:
            auto_capture_task.cancel()
        return {"status": "success", "message": "Sistema de captura automática detenido"}
    except Exception as e:
        return {"status": "error", "message": f"Error al detener captura automática: {str(e)}"}

@app.get("/auto-capture/status")
async def get_auto_capture_status():
    """Obtiene el estado del sistema de captura automática"""
    global auto_capture_task
    
    if not auto_capture_task:
        status = "stopped"
    elif auto_capture_task.done():
        status = "stopped"
    else:
        status = "running"
    
    # Obtener estadísticas si está ejecutándose
    stats = {}
    if auto_capture_manager and status == "running":
        stats = {camera.camera_id: camera.stats for camera in auto_capture_manager.cameras}
    
    return {
        "status": status,
        "cameras_configured": len(CAMERAS_CONFIG),
        "statistics": stats if stats else {} # Ensure statistics is always present
    }

# WebSocket endpoint for real-time detections
@app.websocket("/ws/detections")
async def websocket_detections_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, server primarily broadcasts
            # You could implement receiving messages from client if needed
            await websocket.receive_text() # Or receive_json
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception as e:
        print(f"Error in WebSocket connection: {e}")
        manager.disconnect(websocket)


# --- ENDPOINTS DE INFORMACIÓN Y UTILIDADES ---

@app.get("/model/info",
    summary="Información del modelo",
    description="Obtiene información detallada del modelo YOLOv8 NumerosCalados en uso.")
async def get_model_info():
    """Obtiene información del modelo actual"""
    try:
        model_info = {
            "model_type": "YOLOv8 NumerosCalados",
            "model_path": processor.model.model_path if hasattr(processor.model, 'model_path') else "best.pt",
            "classes_count": len(processor.model.names),
            "classes": list(processor.model.names.values()),
            "confidence_threshold": processor.min_confidence,
            "model_size": "~14MB",
            "last_updated": "2024-12-01",
            "training_epochs": 150,
            "image_size": 1280,
            "dataset": "NewCarro_NumCal_v8 (Roboflow)"
        }
        return model_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo información del modelo: {str(e)}")

@app.post("/model/config",
    summary="Configurar modelo",
    description="Actualiza la configuración del modelo de detección.")
async def update_model_config(config: dict):
    """Actualiza configuración del modelo"""
    try:
        if "min_confidence" in config:
            processor.min_confidence = float(config["min_confidence"])
        
        # Aquí puedes agregar más configuraciones según necesites
        # Por ejemplo, si implementas parámetros configurables en el processor
        
        return {
            "message": "Configuración actualizada exitosamente",
            "new_config": {
                "min_confidence": processor.min_confidence,
                **config
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error actualizando configuración: {str(e)}")

@app.get("/model/test",
    summary="Probar modelo",
    description="Realiza una prueba del modelo con una imagen de ejemplo.")
async def test_model():
    """Prueba el modelo con datos de ejemplo"""
    try:
        # Podrías implementar una prueba con una imagen de ejemplo
        test_results = {
            "status": "ok",
            "model_loaded": processor.model is not None,
            "classes_available": len(processor.model.names),
            "confidence_threshold": processor.min_confidence,
            "test_timestamp": datetime.utcnow().isoformat()
        }
        return test_results
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en prueba del modelo: {str(e)}")

# --- ENDPOINTS ADMINISTRATIVOS ---

@app.post("/admin/load-seed-data")
async def load_seed_data():
    """Cargar datos desde detecciones.json"""
    try:
        from database import load_detections_from_json_to_db_async
        count = await load_detections_from_json_to_db_async()
        return {"status": "success", "message": f"Se cargaron {count} registros exitosamente"}
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Archivo detecciones.json no encontrado")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al cargar datos: {str(e)}")

@app.get("/model/evaluate")
async def evaluate_model():
    """Evalúa el rendimiento del modelo actual"""
    try:
        from utils.image_processing import processor
        
        # Obtener estadísticas básicas del modelo
        model_stats = {
            "model_type": "YOLOv8 NumerosCalados + Agrupación Mejorada",
            "confidence_threshold": processor.min_confidence,
            "agrupacion_activada": True,
            "clases_soportadas": len(processor.model.names) if hasattr(processor.model, 'names') else 29,
            "ultima_deteccion": processor.last_detection
        }
        
        # Obtener estadísticas de la base de datos
        db = get_database()
        total_detections = await db.vagonetas.count_documents({})
        
        # Calcular métricas si hay detecciones recientes
        if total_detections > 0:
            # Obtener confianza promedio de las últimas 100 detecciones
            pipeline = [
                {"$match": {"confidence": {"$exists": True}}},
                {"$sort": {"timestamp": -1}},
                {"$limit": 100},
                {"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}}}
            ]
            avg_confidence_result = list(await db.vagonetas.aggregate(pipeline).to_list(length=1))
            avg_confidence = avg_confidence_result[0]["avg_confidence"] if avg_confidence_result else 0
            
            model_stats.update({
                "metricas_recientes": {
                    "total_detecciones": total_detections,
                    "confianza_promedio": round(avg_confidence, 3),
                    "precision_estimada": "Pendiente implementar",
                    "recall_estimado": "Pendiente implementar"
                }
            })
        
        return {"status": "success", "model_evaluation": model_stats}
        
    except Exception as e:
        return {"status": "error", "message": f"Error evaluando modelo: {str(e)}"}

@app.get("/model/config")
async def get_model_config():
    """Obtiene la configuración actual del modelo"""
    try:
        from utils.image_processing import processor
        config = {
            "confidence_threshold": processor.min_confidence,
            "model_path": "backend/models/numeros_enteros/yolo_model/training/best.pt",
            "agrupacion_enabled": True,
            "umbral_agrupacion": 50,  # Default
            "filtros_calidad": {
                "min_area": 100,
                "min_confidence": 0.3,
                "aspect_ratio_range": [0.3, 3.0]
            }
        }
        
        return {"status": "success", "config": config}
        
    except Exception as e:
        return {"status": "error", "message": f"Error obteniendo configuración: {str(e)}"}

@app.put("/model/config")
async def update_model_config(new_config: dict):
    """Actualiza la configuración del modelo"""
    try:
        from utils.image_processing import processor
        
        if "confidence_threshold" in new_config:
            new_threshold = float(new_config["confidence_threshold"])
            if 0.1 <= new_threshold <= 1.0:
                processor.min_confidence = new_threshold
            else:
                raise ValueError("confidence_threshold debe estar entre 0.1 y 1.0")
        
        return {"status": "success", "message": "Configuración actualizada", "new_config": new_config}
        
    except Exception as e:
        return {"status": "error", "message": f"Error actualizando configuración: {str(e)}"}

@app.post("/test/detection")
async def test_detection_with_sample():
    """Prueba la detección con imagen de muestra"""
    try:
        # Podrías implementar una prueba con una imagen de ejemplo
        sample_image_path = r"c:\\Users\\NEVER\\OneDrive\\Documentos\\VSCode\\MisProyectos\\app_imagenes\\backend\\models\\numeros_enteros\\yolo_model\\dataset"
        
        # Buscar archivos de imagen en el directorio
        import glob
        image_extensions = ['*.jpg', '*.jpeg', '*.png', '*.bmp']
        sample_files = []
        
        for ext in image_extensions:
            sample_files.extend(glob.glob(os.path.join(sample_image_path, ext)))
            sample_files.extend(glob.glob(os.path.join(sample_image_path, "**", ext), recursive=True))
        
        if not sample_files:
            return {"status": "error", "message": "No se encontraron imágenes de muestra"}
        
        # Usar la primera imagen encontrada
        test_image = sample_files[0]
        
        from utils.image_processing import detectar_vagoneta_y_placa_mejorado
        
        # Probar detección mejorada
        # Actualizado para desempaquetar 5 valores
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(test_image)
        
        result = {
            "status": "success",
            "test_image": os.path.basename(test_image),
            "numero_detectado": numero_detectado,
            "confianza_placa": confianza_placa, # Añadido
            "bbox_placa": bbox_placa.tolist() if bbox_placa is not None else None,
            "bbox_vagoneta": bbox_vagoneta.tolist() if bbox_vagoneta is not None else None,
            "deteccion_exitosa": numero_detectado is not None
        }
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error en prueba de detección: {str(e)}")

@app.post("/debug/test-detection")
async def debug_test_detection(file: UploadFile = File(...)):
    """Endpoint de debug para probar detección en imagen específica"""
    try:
        # Guardar imagen temporal
        timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
        temp_path = UPLOAD_DIR / f"debug_{timestamp}_{file.filename}"
        
        with temp_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        print(f"🔍 DEBUG: Procesando imagen {temp_path}")
        
        # Probar detección mejorada
        numero_detectado_mejorado = None
        bbox_vagoneta_mejorado = None
        bbox_placa_mejorado = None
        confianza_placa_mejorado = None # Añadido
        try:
            # Actualizado para desempaquetar 5 valores
            cropped_placa_img_mejorado, bbox_vagoneta_mejorado, bbox_placa_mejorado, numero_detectado_mejorado, confianza_placa_mejorada = detectar_vagoneta_y_placa_mejorado(str(temp_path))
            print(f"📊 DEBUG: Resultado detección mejorada: {numero_detectado_mejorado}, Confianza: {confianza_placa_mejorada}")
        except Exception as e:
            print(f"❌ DEBUG: Error en detección mejorada: {str(e)}")
            # Asegurar que todas las variables tienen un valor asignado en caso de error
            cropped_placa_img_mejorado = None 
            # bbox_vagoneta_mejorado ya está inicializado a None
            # bbox_placa_mejorado ya está inicializado a None
            # numero_detectado_mejorado ya está inicializado a None
            # confianza_placa_mejorada ya está inicializado a None
        
        # Probar detección estándar como respaldo
        numero_estandar = None
        confianza_placa_estandar = None # Añadido
        bbox_vagoneta_std = None # Inicializar
        bbox_placa_std = None    # Inicializar
        try:
            # Actualizado para desempaquetar 5 valores
            cropped_placa_std, bbox_vagoneta_std, bbox_placa_std, numero_estandar, confianza_placa_estandar = detectar_vagoneta_y_placa(str(temp_path))
            print(f"📊 DEBUG: Resultado detección estándar: {numero_estandar}, Confianza: {confianza_placa_estandar}")
        except Exception as e:
            print(f"❌ DEBUG: Error en detección estándar: {str(e)}")
            # Asegurar que todas las variables tienen un valor asignado
            cropped_placa_std = None
            # bbox_vagoneta_std ya está inicializado a None
            # bbox_placa_std ya está inicializado a None
            # numero_estandar ya está inicializado a None
            # confianza_placa_estandar ya está inicializado a None

        # Limpiar archivo temporal
        try:
            os.remove(temp_path)
        except:
            pass
        
        return {
            "status": "debug_complete",
            "filename": file.filename,
            "deteccion_mejorada": {
                "numero": numero_detectado_mejorado,
                "confianza_placa": confianza_placa_mejorada, # Añadido
                "bbox_vagoneta": bbox_vagoneta_mejorado.tolist() if bbox_vagoneta_mejorado is not None else None,
                "bbox_placa": bbox_placa_mejorado.tolist() if bbox_placa_mejorado is not None else None
            },
            "deteccion_estandar": {
                "numero": numero_estandar,
                "confianza_placa": confianza_placa_estandar, # Añadido
                "bbox_vagoneta": bbox_vagoneta_std.tolist() if bbox_vagoneta_std is not None else None, # Añadido para consistencia
                "bbox_placa": bbox_placa_std.tolist() if bbox_placa_std is not None else None       # Añadido para consistencia
            },
            "model_info": {
                "confidence_threshold": processor.min_confidence,
                "model_classes": len(processor.model.names)
            }
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/debug/test-sample-video")
async def debug_test_sample_video():
    """Prueba la detección con el video de muestra del dataset"""
    try:
        sample_video_path = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset\CarroNenteros800.mp4"
        
        if not os.path.exists(sample_video_path):
            return {"status": "error", "message": "Video de muestra no encontrado"}
        
        print(f"🎬 Probando video de muestra: {sample_video_path}")
        
        # Procesar video
        numero_detectado = await procesar_video_mp4(sample_video_path)
        
        return {
            "status": "test_complete",
            "sample_video": "CarroNenteros800.mp4",
            "numero_detectado": numero_detectado,
            "model_config": {
                "confidence_threshold": processor.min_confidence,
                "model_path": "numeros_enteros/yolo_model/training/best.pt",
                "classes_count": len(processor.model.names)
            }
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/debug/adjust-confidence")
async def debug_adjust_confidence(new_confidence: float):
    """Ajusta dinámicamente el umbral de confianza del modelo"""
    try:
        if not (0.01 <= new_confidence <= 1.0):
            return {"status": "error", "message": "La confianza debe estar entre 0.01 y 1.0"}
        
        old_confidence = processor.min_confidence
        processor.min_confidence = new_confidence
        
        print(f"🔧 Confianza ajustada: {old_confidence} → {new_confidence}")
        
        return {
            "status": "success",
            "message": f"Confianza ajustada de {old_confidence} a {new_confidence}",
            "old_confidence": old_confidence,
            "new_confidence": new_confidence
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
