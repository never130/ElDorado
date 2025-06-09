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
import tempfile
import glob
import uvicorn
from datetime import datetime
from typing import List, Dict, Optional, Any
from collections import Counter
import crud
from utils.image_processing import detectar_vagoneta_y_placa, detectar_vagoneta_y_placa_mejorado, detectar_modelo_ladrillo
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
from utils.image_processing import processor

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
async def upload_files(
    files: List[UploadFile] = File(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: float = Form(None),
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
            
            if not numero_detectado or numero_detectado == "No detectado":
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
                if 'save_path' in locals():
                    os.remove(save_path)
            except:
                pass
            results.append({
                "filename": file.filename,
                "status": "error",
                "error": str(e)
            })
    
    return {"results": results}

# Función para procesar videos MP4
async def procesar_video_mp4(video_path: str) -> str:
    """
    Procesa un video MP4 frame por frame para detectar números de vagonetas
    Retorna el primer número detectado con alta confianza
    """
    try:
        cap = cv2.VideoCapture(video_path)
        
        if not cap.isOpened():
            raise ValueError(f"No se pudo abrir el video: {video_path}")
        
        frame_count = 0
        max_frames = 30  # Procesar máximo 30 frames para no sobrecargar
        numeros_detectados = []
        
        while cap.read()[0] and frame_count < max_frames:
            ret, frame = cap.read()
            if not ret:
                break
            
            # Guardar frame temporal como imagen
            with tempfile.NamedTemporaryFile(suffix='.jpg', delete=False) as temp_file:
                temp_frame_path = temp_file.name
                cv2.imwrite(temp_frame_path, frame)
                
                try:
                    # Procesar frame con detección mejorada
                    cropped_placa_img, bbox_vagoneta, bbox_placa, numero = detectar_vagoneta_y_placa_mejorado(temp_frame_path)
                    
                    if numero and numero.strip():
                        numeros_detectados.append(numero.strip())
                        
                    # Si ya tenemos 3 detecciones iguales, devolver resultado
                    if len(numeros_detectados) >= 3 and numeros_detectados[-3:].count(numeros_detectados[-1]) >= 2:
                        cap.release()
                        os.unlink(temp_frame_path)
                        return numeros_detectados[-1]
                        
                except Exception as frame_error:
                    print(f"Error procesando frame {frame_count}: {str(frame_error)}")
                
                # Limpiar archivo temporal
                try:
                    os.unlink(temp_frame_path)
                except:
                    pass
            
            frame_count += 1
        
        cap.release()
        
        # Retornar el número más común detectado
        if numeros_detectados:
            return max(set(numeros_detectados), key=numeros_detectados.count)
        else:
            return "No detectado"
            
    except Exception as e:
        print(f"Error procesando video: {str(e)}")
        return "No detectado"

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

@app.get("/model/info",
    summary="Información del modelo",
    description="Obtiene información detallada del modelo YOLOv8 Números Enteros en uso.")
async def get_model_info():
    """Obtiene información del modelo actual"""
    try:
        model_info = {
            "model_type": "YOLOv8 Números Enteros",
            "model_path": "backend/models/numeros_enteros/yolo_model/training/best.pt",
            "classes_count": len(processor.model.names),
            "classes": list(processor.model.names.values()),
            "confidence_threshold": processor.min_confidence,
            "model_size": "~14MB",
            "last_updated": "2024-12-01",
            "training_epochs": 150,
            "image_size": 1280,
            "dataset": "enteros_carros (Roboflow)"
        }
        return model_info
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo información del modelo: {str(e)}")

@app.get("/model/config")
async def get_model_config():
    """Obtiene la configuración actual del modelo"""
    try:
        from utils.image_processing import processor
        config = {
            "confidence_threshold": processor.min_confidence,
            "model_path": "backend/models/numeros_enteros/yolo_model/training/best.pt",
            "agrupacion_enabled": True,
            "umbral_agrupacion": 50,
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
async def update_model_config_put(new_config: dict):
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
        # Buscar una imagen de muestra en el directorio del dataset
        sample_image_path = r"c:\Users\NEVER\OneDrive\Documentos\VSCode\MisProyectos\app_imagenes\backend\models\numeros_enteros\yolo_model\dataset"
        
        # Buscar archivos de imagen en el directorio
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
        cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado = detectar_vagoneta_y_placa_mejorado(test_image)
        
        result = {
            "status": "success",
            "test_image": os.path.basename(test_image),
            "numero_detectado": numero_detectado,
            "bbox_placa": bbox_placa.tolist() if bbox_placa is not None else None,
            "bbox_vagoneta": bbox_vagoneta.tolist() if bbox_vagoneta is not None else None,
            "deteccion_exitosa": numero_detectado is not None
        }
        
        return result
        
    except Exception as e:
        return {"status": "error", "message": f"Error en prueba de detección: {str(e)}"}

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
