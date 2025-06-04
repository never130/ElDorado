# main.py - Backend principal de la app de seguimiento de vagonetas
# Autor: [Tu nombre o equipo]
# Descripción: API REST para subir, procesar y consultar registros de vagonetas usando visión computacional.

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
import shutil
import os
from datetime import datetime
from typing import List, Dict, Optional, Any
import crud
from utils.image_processing import detectar_vagoneta_y_placa, detectar_modelo_ladrillo
from utils.ocr import extract_number_from_image # Changed from ocr_placa_img
from utils.camera_capture import CameraCapture
from utils.auto_capture_system import AutoCaptureManager, CAMERAS_CONFIG
from database import connect_to_mongo, close_mongo_connection, get_database
import cv2
import numpy as np
from schemas import VagonetaCreate, VagonetaInDB
import asyncio
import base64
import io

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

# --- ENDPOINTS PRINCIPALES ---

@app.post("/upload/",
    response_model=Dict,
    summary="Subir imagen de vagoneta",
    description="Procesa una imagen y detecta automáticamente el número de vagoneta y modelo de ladrillo.")
async def upload_image(
    file: UploadFile = File(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: float = Form(None),
    metadata: Optional[Dict] = Form(None)
):
    # Validar y guardar imagen
    file_ext = file.filename.split(".")[-1]
    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    save_path = UPLOAD_DIR / f"{timestamp}_{file.filename}"
    
    with save_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    # Procesar imagen
    try:
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado = detectar_vagoneta_y_placa(str(save_path))
        
        if not numero_detectado:
            try:
                os.remove(save_path)
            except Exception:
                pass
            return JSONResponse(
                {"message": "No se detectó vagoneta con número", "status": "ignored"},
                status_code=200
            )

        # Detectar modelo
        modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
        
        # Crear registro
        vagoneta = VagonetaCreate(
            numero=numero_detectado,
            imagen_path=f"uploads/{save_path.name}",
            timestamp=datetime.utcnow(),
            tunel=tunel,
            evento=evento,
            modelo_ladrillo=modelo_ladrillo,
            merma=merma,
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
async def upload_images(
    files: List[UploadFile] = File(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: float = Form(None),
    metadata: Optional[Dict] = Form(None)
):
    results = []
    for file in files:
        try:
            timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
            save_path = UPLOAD_DIR / f"{timestamp}_{file.filename}"
            
            with save_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado = detectar_vagoneta_y_placa(str(save_path))
            
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
                merma=merma,
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
    global auto_capture_manager, auto_capture_task
    
    if auto_capture_task and not auto_capture_task.done():
        return {"status": "error", "message": "El sistema de captura automática ya está en ejecución"}
    
    try:
        auto_capture_manager = AutoCaptureManager(CAMERAS_CONFIG)
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
        "statistics": stats
    }

@app.get("/auto-capture/config")
async def get_auto_capture_config():
    """Obtiene la configuración actual de las cámaras"""
    return {"cameras": CAMERAS_CONFIG}

@app.put("/auto-capture/config")
async def update_auto_capture_config(new_config: dict):
    """Actualiza la configuración de las cámaras"""
    global CAMERAS_CONFIG
    try:
        CAMERAS_CONFIG.clear()
        CAMERAS_CONFIG.extend(new_config.get("cameras", []))
        return {"status": "success", "message": "Configuración actualizada"}
    except Exception as e:
        return {"status": "error", "message": f"Error al actualizar configuración: {str(e)}"}

@app.get("/model/info")
async def get_model_info():
    """Obtiene información sobre el modelo NumerosCalados activo"""
    try:
        from utils.image_processing import processor
        
        # Información del modelo
        model_info = {
            "model_type": "YOLOv8 NumerosCalados",
            "model_path": str(processor.model.model_path if hasattr(processor.model, 'model_path') else "backend/models/numeros_calados/yolo_model/training/best.pt"),
            "confidence_threshold": processor.min_confidence,
            "classes_count": len(processor.model.names) if hasattr(processor.model, 'names') else 29,
            "supported_classes": list(processor.model.names.values()) if hasattr(processor.model, 'names') else [
                "01", "010", "011", "012", "0123", "013", "014", "015", "016", "017", 
                "018", "019", "02", "020", "0256", "03", "030", "04", "040", "05", 
                "050", "06", "060", "07", "070", "08", "080", "09", "090"
            ],
            "optimized_for": "Números calados en vagonetas",
            "training_dataset": "newcarro_numcal_v8"
        }
        
        return {"status": "success", "model_info": model_info}
    except Exception as e:
        return {"status": "error", "message": f"Error obteniendo información del modelo: {str(e)}"}

@app.get("/system/stats")
async def get_system_stats():
    """Obtiene estadísticas generales del sistema"""
    try:
        # Obtener conexión a la base de datos
        db = get_database()
        
        # Obtener estadísticas de la base de datos
        total_detections = db.vagonetas.count_documents({})
        auto_detections = db.vagonetas.count_documents({"auto_captured": True})
        manual_detections = total_detections - auto_detections
        
        # Estadísticas por evento
        ingreso_count = db.vagonetas.count_documents({"evento": "ingreso"})
        egreso_count = db.vagonetas.count_documents({"evento": "egreso"})
        
        # Estadísticas por fecha (últimos 7 días)
        from datetime import datetime, timedelta
        week_ago = datetime.now() - timedelta(days=7)
        recent_detections = db.vagonetas.count_documents({
            "timestamp": {"$gte": week_ago}
        })
        
        # Modelo con mejor confianza promedio
        pipeline = [
            {"$match": {"confidence": {"$exists": True}}},
            {"$group": {"_id": None, "avg_confidence": {"$avg": "$confidence"}}}
        ]
        avg_confidence_result = list(db.vagonetas.aggregate(pipeline))
        avg_confidence = avg_confidence_result[0]["avg_confidence"] if avg_confidence_result else 0
        
        stats = {
            "total_detections": total_detections,
            "auto_detections": auto_detections,
            "manual_detections": manual_detections,
            "ingreso_count": ingreso_count,
            "egreso_count": egreso_count,
            "recent_detections_7d": recent_detections,
            "average_confidence": round(avg_confidence, 3) if avg_confidence else 0,
            "automation_rate": round((auto_detections / total_detections * 100), 1) if total_detections > 0 else 0
        }
        
        return {"status": "success", "stats": stats}
    except Exception as e:
        return {"status": "error", "message": f"Error obteniendo estadísticas: {str(e)}"}

# --- ENDPOINTS DE VIDEO STREAMING ---

@app.get("/video/stream/{camera_id}")
async def video_stream(camera_id: str):
    """Stream de video en tiempo real para el frontend"""
    
    def generate_frames():
        # Buscar la cámara en el sistema de auto-captura
        camera = None
        
        if auto_capture_manager:
            for cam in auto_capture_manager.cameras:
                if cam.camera_id == camera_id:
                    camera = cam
                    break
        
        if not camera or not camera.cap:
            # Si no hay cámara activa, crear una temporal para streaming
            video_path = r'c:\Users\Ever\VSCode\ElDorado\backend\models\numeros_calados\yolo_model\dataset\CarroNcalados800.mp4'
            if os.path.exists(video_path):
                cap = cv2.VideoCapture(video_path)
            else:
                return b'--frame\r\nContent-Type: image/jpeg\r\n\r\n' + b'\r\n'
        else:
            cap = camera.cap
        
        frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                # Reiniciar video si es demo
                if camera_id == 'video_demo_calados':
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    break
            
            # Redimensionar frame para streaming eficiente
            frame = cv2.resize(frame, (640, 480))
            
            # Codificar frame como JPEG
            _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
            frame_bytes = buffer.tobytes()
            
            # Formato multipart para streaming
            yield (b'--frame\r\n'
                   b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
            
            frame_count += 1
            # Limitar FPS para streaming
            if frame_count % 3 == 0:  # Solo cada 3er frame para reducir bandwidth
                continue
    
    return StreamingResponse(generate_frames(), media_type="multipart/x-mixed-replace; boundary=frame")

@app.get("/video/frame/{camera_id}")
async def get_video_frame(camera_id: str):
    """Obtiene un frame individual del video como base64"""
    try:
        # Buscar la cámara en el sistema de auto-captura        camera = None
        if auto_capture_manager:
            for cam in auto_capture_manager.cameras:
                if cam.camera_id == camera_id:
                    camera = cam
                    break
        
        if not camera or not camera.cap:
            # Si no hay cámara activa, usar video demo
            video_path = r'c:\Users\Ever\VSCode\ElDorado\backend\models\numeros_calados\yolo_model\dataset\CarroNcalados800.mp4'
            if os.path.exists(video_path):
                cap = cv2.VideoCapture(video_path)
                ret, frame = cap.read()
                cap.release()
                if not ret:
                    raise HTTPException(status_code=404, detail="No se pudo obtener frame del video")
            else:
                raise HTTPException(status_code=404, detail="Video demo no encontrado")
        else:
            ret, frame = camera.cap.read()
            if not ret:
                raise HTTPException(status_code=404, detail="No se pudo obtener frame de la cámara")
        
        # Redimensionar y codificar
        frame = cv2.resize(frame, (480, 360))
        _, buffer = cv2.imencode('.jpg', frame, [cv2.IMWRITE_JPEG_QUALITY, 80])
        
        # Convertir a base64
        frame_base64 = base64.b64encode(buffer).decode('utf-8')
        
        return {
            "status": "success",
            "frame": f"data:image/jpeg;base64,{frame_base64}",
            "camera_id": camera_id,
            "timestamp": datetime.now().isoformat()
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo frame: {str(e)}")

@app.get("/video/info/{camera_id}")
async def get_video_info(camera_id: str):
    """Obtiene información del video/cámara"""
    try:
        # Buscar configuración de la cámara
        camera_config = None
        for config in CAMERAS_CONFIG:
            if config['camera_id'] == camera_id:
                camera_config = config
                break
        
        if not camera_config:
            raise HTTPException(status_code=404, detail="Cámara no encontrada")
        
        video_info = {
            "camera_id": camera_id,
            "source_type": camera_config.get('source_type', 'unknown'),
            "evento": camera_config.get('evento', ''),
            "tunel": camera_config.get('tunel', ''),
            "demo_mode": camera_config.get('demo_mode', False),
            "is_active": False,
            "frame_count": 0,
            "total_frames": 0,
            "fps": 0
        }
        
        # Si es video, obtener información adicional
        if camera_config.get('source_type') == 'video' and os.path.exists(camera_config['camera_url']):
            cap = cv2.VideoCapture(camera_config['camera_url'])
            video_info.update({
                "total_frames": int(cap.get(cv2.CAP_PROP_FRAME_COUNT)),
                "fps": cap.get(cv2.CAP_PROP_FPS),
                "width": int(cap.get(cv2.CAP_PROP_FRAME_WIDTH)),
                "height": int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT)),
                "duration_seconds": int(cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS))
            })
            cap.release()
        
        # Verificar si está activa en auto-captura
        if auto_capture_manager:
            for cam in auto_capture_manager.cameras:
                if cam.camera_id == camera_id:
                    video_info.update({
                        "is_active": cam.is_running,
                        "frame_count": cam.video_frame_count if hasattr(cam, 'video_frame_count') else 0
                    })
                    break
        
        return {"status": "success", "video_info": video_info}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo información del video: {str(e)}")
