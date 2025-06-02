# main.py - Backend principal de la app de seguimiento de vagonetas
# Autor: [Tu nombre o equipo]
# Descripción: API REST para subir, procesar y consultar registros de vagonetas usando visión computacional.

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
from database import connect_to_mongo, close_mongo_connection
import cv2
import numpy as np
from schemas import VagonetaCreate, VagonetaInDB

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
    registros = await crud.get_vagonetas_historial(
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
    registros = await crud.get_trayectoria_completa(numero)
    estadisticas = await crud.get_estadisticas_vagoneta(numero)
    
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
