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
import asyncio
from datetime import datetime
from typing import List, Dict, Optional, Any
import crud
from utils.image_processing import detectar_vagoneta_y_placa, detectar_vagoneta_y_placa_mejorado, detectar_modelo_ladrillo
from utils.ocr import extract_number_from_image # Changed from ocr_placa_img
from utils.camera_capture import CameraCapture
from utils.auto_capture_system import AutoCaptureManager, CAMERAS_CONFIG
from database import connect_to_mongo, close_mongo_connection, get_database
import cv2
import numpy as np
from collections import Counter
from schemas import VagonetaCreate, VagonetaInDB
import asyncio
import base64
import io
from utils.image_processing import processor
import uuid # Asegúrate de que uuid esté importado
import json # Para serializar los datos de SSE
import traceback

# Función para procesar videos MP4
async def procesar_video_mp4_streamable(video_path: str, upload_dir: Path):
    """
    Procesa un video MP4 frame por frame para detectar números de vagonetas,
    emitiendo actualizaciones de progreso.
    """
    yield {"type": "status", "stage": "initialization", "message": f"Iniciando procesamiento de video: {Path(video_path).name}"}
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        yield {"type": "error", "stage": "initialization", "message": f"Error al abrir el video: {video_path}"}
        return

    detections = {}
    frame_count = 0
    processed_frames_dir = upload_dir / "processed_frames" / str(uuid.uuid4())
    os.makedirs(processed_frames_dir, exist_ok=True)
    
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    yield {"type": "progress", "stage": "setup", "message": "Video abierto y listo para procesar.", "total_frames": total_frames, "current_frame": 0}

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                yield {"type": "status", "stage": "frame_processing", "message": "Fin de los frames o error al leer."}
                break
            
            frame_count += 1
            if frame_count % 5 != 0:  # Procesar cada 5 frames para optimizar
                if frame_count % 100 == 0: # Send a heartbeat progress for skipped frames less frequently
                    yield {"type": "progress", "stage": "frame_processing", "message": f"Avanzando video...", "current_frame": frame_count, "total_frames": total_frames}
                continue

            yield {"type": "progress", "stage": "frame_processing", "message": f"Procesando frame {frame_count}/{total_frames}", "current_frame": frame_count, "total_frames": total_frames}

            if frame is None or frame.size == 0:
                yield {"type": "warning", "stage": "frame_processing", "message": f"Frame {frame_count} es None o está vacío."}
                continue

            # temp_frame_path = processed_frames_dir / f"frame_{frame_count}.jpg"
            # cv2.imwrite(str(temp_frame_path), frame) # Opcional: guardar frame

            try:
                _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame)
                
                if numero_detectado and confianza_placa is not None:
                    yield {
                        "type": "detection_update", 
                        "stage": "frame_processing",
                        "frame": frame_count, 
                        "numero": numero_detectado, 
                        "confianza": float(confianza_placa) # Asegurar que sea float para JSON
                    }
                    if numero_detectado not in detections or confianza_placa > detections[numero_detectado]:
                        detections[numero_detectado] = confianza_placa
            except Exception as e_detect:
                yield {"type": "warning", "stage": "frame_processing", "message": f"Error detectando en frame {frame_count}: {str(e_detect)}"}
                # traceback.print_exc() # Podrías querer loguearlo en servidor en lugar de enviarlo siempre

    except Exception as e_video:
        yield {"type": "error", "stage": "video_processing_error", "message": f"Error mayor durante el procesamiento del video: {str(e_video)}"}
        traceback.print_exc()
        # No emitir final_result si hay un error catastrófico aquí
        return 
    finally:
        cap.release()
        yield {"type": "status", "stage": "cleanup", "message": f"Video {Path(video_path).name} procesado. Total frames leídos: {frame_count}."}
        # shutil.rmtree(processed_frames_dir) # Opcional: limpiar frames

    if not detections:
        yield {"type": "final_result", "stage": "completion", "data": None, "message": "No se detectaron números en el video."}
    else:
        # Asegurar que la confianza sea float para JSON
        final_detections_serializable = {k: float(v) for k, v in detections.items()}
        yield {"type": "final_result", "stage": "completion", "data": final_detections_serializable, "message": "Detecciones finales recopiladas."}

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
    app.state.pending_video_processing = {} # Inicializar el almacén de tareas

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
TEMP_CHUNK_DIR = UPLOAD_DIR / "temp_chunks"
TEMP_CHUNK_DIR.mkdir(exist_ok=True)

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
        
        # Quitar await porque create_vagoneta_record es síncrona
        record_id = crud.create_vagoneta_record(vagoneta) 
        
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
                cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(save_path))
                # Solo detectar modelo de ladrillo para imágenes directamente
                modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
            else:
                # Procesar video
                detection_results = await procesar_video_mp4(str(save_path), UPLOAD_DIR)
                numero_detectado = None # Inicializar
                confianza_placa = None # Inicializar para videos
                if detection_results:
                    if isinstance(detection_results, dict) and detection_results:
                        # Tomar el número con la mayor confianza
                        if detection_results: # Asegurarse que no está vacío
                            numero_detectado = max(detection_results, key=detection_results.get)
                            confianza_placa = detection_results[numero_detectado]
                        
                # Para videos, no intentamos detectar el modelo de ladrillo de la misma manera que una imagen única.
                # Podría implementarse una lógica para analizar frames individuales si es necesario.
                modelo_ladrillo = None
            
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
            
            vagoneta = VagonetaCreate(
                numero=numero_detectado,
                imagen_path=f"uploads/{save_path.name}", # Guardar la ruta del video original
                timestamp=datetime.utcnow(),
                tunel=tunel,
                evento=evento,
                modelo_ladrillo=modelo_ladrillo, # Será None para videos por ahora
                merma=parse_merma(merma),
                metadata=metadata,
                confianza=confianza_placa # Añadir confianza al registro
            )
            
            # Quitar await porque create_vagoneta_record es síncrona
            record_id = crud.create_vagoneta_record(vagoneta) 
            
            results.append({
                "filename": file.filename,
                "status": "ok",
                "record_id": record_id,
                "numero_detectado": numero_detectado,
                "modelo_ladrillo": modelo_ladrillo,
                "confianza": confianza_placa
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

# --- ENDPOINTS PARA SUBIDA EN TROZOS (CHUNKING) ---

@app.post("/upload-chunk/")
async def upload_chunk(
    fileChunk: UploadFile = File(...),
    fileId: str = Form(...),
    chunkNumber: int = Form(...),
    totalChunks: int = Form(...),
    originalFilename: str = Form(...)
):
    try:
        chunk_dir = TEMP_CHUNK_DIR / fileId
        chunk_dir.mkdir(exist_ok=True)
        
        chunk_path = chunk_dir / f"chunk_{chunkNumber}"
        with open(chunk_path, "wb") as buffer:
            shutil.copyfileobj(fileChunk.file, buffer)
        
        print(f"📦 Recibido chunk {chunkNumber + 1}/{totalChunks} para {originalFilename} (ID: {fileId})")
        
        # Opcional: verificar si todos los chunks han llegado y ensamblar aquí
        # si no se quiere un endpoint /finalize-upload/ separado para cada archivo.
        # Por ahora, separamos la finalización.

        return {"message": f"Chunk {chunkNumber + 1}/{totalChunks} for {originalFilename} received successfully."}
    except Exception as e:
        print(f"❌ Error recibiendo chunk para {originalFilename} (ID: {fileId}): {e}")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Error processing chunk: {str(e)}")

@app.post("/finalize-upload/")
async def finalize_upload(
    fileId: str = Form(...),
    originalFilename: str = Form(...),
    totalChunks: int = Form(...),
    tunel: str = Form(None),
    evento: str = Form(...),
    merma: str = Form(None),
    metadata_str: Optional[str] = Form(None)
):
    import json # Mover import json dentro si solo se usa aquí
    metadata: Optional[Dict] = None
    if metadata_str:
        try:
            metadata = json.loads(metadata_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON string")

    chunk_dir = TEMP_CHUNK_DIR / fileId
    if not chunk_dir.exists():
        raise HTTPException(status_code=404, detail=f"No chunks found for file ID: {fileId}")

    # Verificar que todos los chunks están presentes
    for i in range(totalChunks):
        chunk_path = chunk_dir / f"chunk_{i}"
        if not chunk_path.exists():
            # Limpiar chunks si falta alguno antes de fallar
            shutil.rmtree(chunk_dir, ignore_errors=True)
            raise HTTPException(status_code=400, detail=f"Missing chunk {i} for file ID: {fileId}")


    timestamp = datetime.utcnow().strftime("%Y%m%d%H%M%S")
    final_save_path = UPLOAD_DIR / f"{timestamp}_{originalFilename}"
    
    print(f"🧩 Ensamblando archivo: {final_save_path} desde {totalChunks} chunks (ID: {fileId})")
    try:
        with open(final_save_path, "wb") as final_file:
            for i in range(totalChunks):
                chunk_path = chunk_dir / f"chunk_{i}"
                with open(chunk_path, "rb") as chunk_file:
                    final_file.write(chunk_file.read())
        print(f"✅ Archivo {originalFilename} ensamblado exitosamente en {final_save_path}")
        shutil.rmtree(chunk_dir)
        print(f"🧹 Chunks temporales para {fileId} eliminados.")
    except Exception as e:
        # ... (manejo de error de ensamblaje y limpieza como antes) ...
        print(f"❌ Error ensamblando archivo {originalFilename} (ID: {fileId}): {e}")
        traceback.print_exc()
        if chunk_dir.exists():
            shutil.rmtree(chunk_dir, ignore_errors=True)
        if final_save_path.exists():
            try:
                os.remove(final_save_path)
            except OSError: pass
        raise HTTPException(status_code=500, detail=f"Error assembling file: {str(e)}")

    # Determinar tipo de archivo
    file_ext = Path(originalFilename).suffix.lower()
    is_image = file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']
    is_video = file_ext in ['.mp4', '.avi', '.mov', '.mkv']

    if is_image:
        try:
            print(f"🖼️  Procesando imagen ensamblada: {final_save_path}")
            _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(final_save_path))
            modelo_ladrillo = detectar_modelo_ladrillo(str(final_save_path))

            if not numero_detectado:
                try: os.remove(final_save_path)
                except OSError: pass
                return JSONResponse(
                    content={"message": f"No se detectó vagoneta con número en {originalFilename}", "status": "ignored", "filename": originalFilename},
                    status_code=200
                )

            vagoneta_data = VagonetaCreate(
                numero=numero_detectado,
                imagen_path=f"uploads/{final_save_path.name}",
                timestamp=datetime.utcnow(),
                tunel=tunel,
                evento=evento,
                modelo_ladrillo=modelo_ladrillo,
                merma=parse_merma(merma),
                metadata=metadata,
                confianza=confianza_placa
            )
            record_id = crud.create_vagoneta_record(vagoneta_data)
            
            response_data = {
                "filename": originalFilename, "status": "ok", "record_id": str(record_id),
                "numero_detectado": numero_detectado, "modelo_ladrillo": modelo_ladrillo,
                "confianza": confianza_placa, "message": f"File {originalFilename} processed and record created successfully."
            }
            return JSONResponse(content=response_data)
        except Exception as e:
            if final_save_path.exists():
                try: os.remove(final_save_path)
                except OSError: pass
            print(f"❌ Error procesando imagen ensamblada {originalFilename}: {e}")
            traceback.print_exc()
            raise HTTPException(status_code=500, detail=f"Error processing assembled image: {str(e)}")

    elif is_video:
        processing_id = str(uuid.uuid4())
        app.state.pending_video_processing[processing_id] = {
            "video_path": str(final_save_path),
            "original_filename": originalFilename,
            "upload_dir": str(UPLOAD_DIR), # Convertir Path a str para almacenar en dict/JSON
            "tunel": tunel,
            "evento": evento,
            "merma_str": merma, # Guardar como string, parsear luego
            "metadata": metadata, # Ya es un dict o None
            "timestamp": datetime.utcnow() # Para posible limpieza de tareas antiguas
        }
        print(f"📹 Video {originalFilename} listo para procesamiento en segundo plano. ID: {processing_id}")
        return JSONResponse(content={
            "status": "video_processing_pending",
            "processing_id": processing_id,
            "filename": originalFilename,
            "message": "El video está siendo procesado. Conéctese al stream para ver el progreso."
        })
    else:
        if final_save_path.exists():
            try: os.remove(final_save_path)
            except OSError: pass
        raise HTTPException(status_code=400, detail=f"Unsupported file type after assembly: {file_ext}")


@app.get("/stream-video-processing/{processing_id}")
async def stream_video_processing(processing_id: str):
    if processing_id not in app.state.pending_video_processing:
        # Podríamos devolver un SSE de error aquí también para consistencia si el cliente espera SSE
        # For now, a simple HTTP error is fine.
        raise HTTPException(status_code=404, detail="Video processing ID not found or already processed.")

    task_info = app.state.pending_video_processing[processing_id]

    async def event_generator():
        final_detection_data = None
        processing_error_occurred = False
        try:
            yield f"data: {json.dumps({'type': 'status', 'stage': 'stream_init', 'message': 'Conectado al stream de procesamiento de video.'})}\\n\\n"
            
            async for update in procesar_video_mp4_streamable(task_info["video_path"], Path(task_info["upload_dir"])):
                yield f"data: {json.dumps(update)}\\n\\n"
                if update.get("type") == "final_result":
                    final_detection_data = update.get("data")
                if update.get("type") == "error": # Un error grave dentro de procesar_video_mp4_streamable
                    processing_error_occurred = True


            # Procesamiento de video (iteración sobre procesar_video_mp4_streamable) ha terminado
            if processing_error_occurred:
                 yield f"data: {json.dumps({'type': 'status', 'stage': 'completion_error', 'message': 'El procesamiento del video falló.'})}\\n\\n"
                 # No intentar crear registro en BD si el procesamiento falló gravemente
            elif final_detection_data:
                numero_detectado_final = None
                confianza_placa_final = None
                
                # Lógica para obtener la mejor detección del video
                best_numero_from_video = None
                max_confianza_from_video = -1.0
                if isinstance(final_detection_data, dict): # final_detection_data es el dict de detections
                    for num, conf in final_detection_data.items():
                        if isinstance(conf, (float, int)) and conf > max_confianza_from_video:
                            max_confianza_from_video = conf
                            best_numero_from_video = num
                
                if best_numero_from_video is not None:
                    numero_detectado_final = best_numero_from_video
                    confianza_placa_final = max_confianza_from_video

                if numero_detectado_final:
                    vagoneta_to_create = VagonetaCreate(
                        numero=numero_detectado_final,
                        imagen_path=f"uploads/{Path(task_info['video_path']).name}",
                        timestamp=datetime.utcnow(), # Usar un timestamp fresco para el registro
                        tunel=task_info["tunel"],
                        evento=task_info["evento"],
                        modelo_ladrillo=None, # No se detecta para videos
                        merma=parse_merma(task_info["merma_str"]),
                        metadata=task_info["metadata"],
                        confianza=confianza_placa_final
                    )
                    try:
                        record_id = crud.create_vagoneta_record(vagoneta_to_create)
                        db_response = {
                            "type": "db_record_created", "stage": "db_creation_success",
                            "status": "ok", "record_id": str(record_id),
                            "numero_detectado": numero_detectado_final,
                            "confianza": confianza_placa_final,
                            "filename": task_info["original_filename"],
                            "message": f"Video {task_info['original_filename']} procesado y registro creado."
                        }
                        yield f"data: {json.dumps(db_response)}\\n\\n"
                    except Exception as e_crud:
                        print(f"Error creando registro en BD para video {task_info['original_filename']}: {e_crud}")
                        traceback.print_exc()
                        error_db_response = {
                            "type": "db_error", "stage": "db_creation_failure",
                            "status": "error", "filename": task_info["original_filename"],
                            "message": f"Error al crear registro en BD para {task_info['original_filename']}: {str(e_crud)}"
                        }
                        yield f"data: {json.dumps(error_db_response)}\\n\\n"
                else: # Hubo final_result pero no se extrajo un numero_detectado_final (ej. vacío)
                    no_detection_response = {
                        "type": "no_detection_final", "stage": "completion_no_detection",
                        "status": "ignored", "filename": task_info["original_filename"],
                        "message": f"No se detectó vagoneta con número en video {task_info['original_filename']} después del análisis."
                    }
                    yield f"data: {json.dumps(no_detection_response)}\\n\\n"
                    # Opcional: eliminar archivo si no hubo detección útil
                    try: os.remove(task_info["video_path"])
                    except OSError: pass
            
            elif not processing_error_occurred and final_detection_data is None: # No hubo error grave, pero final_result fue None
                no_data_response = {
                    "type": "no_detection_final", "stage": "completion_no_data",
                    "status": "ignored", "filename": task_info["original_filename"],
                    "message": f"El procesamiento del video {task_info['original_filename']} finalizó sin datos de detección."
                }
                yield f"data: {json.dumps(no_data_response)}\\n\\n"
                try: os.remove(task_info["video_path"])
                except OSError: pass

            yield f"data: {json.dumps({'type': 'stream_end', 'stage': 'finished', 'message': 'Stream de procesamiento finalizado.'})}\\n\\n"
        
        finally:
            # Limpiar la tarea del diccionario
            if processing_id in app.state.pending_video_processing:
                del app.state.pending_video_processing[processing_id]
            print(f"Tarea de procesamiento {processing_id} para {task_info.get('original_filename', 'video desconocido')} finalizada y eliminada.")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

# --- ENDPOINTS DE CONSULTA ---

@app.get("/historial/", 
    response_model=List[VagonetaInDB],
    summary="Obtener historial de registros",
    description="Recupera una lista paginada de todos los registros de vagonetas.")
async def get_historial_registros(
    skip: int = Query(0, ge=0, description="Número de registros a saltar para paginación"),
    limit: int = Query(10, ge=1, le=100, description="Número máximo de registros a devolver")
):
    db = get_database()
    registros_cursor = db.vagonetas.find().sort("timestamp", -1).skip(skip).limit(limit)
    
    registros_list = []
    async for r_doc in registros_cursor:
        model_data = dict(r_doc)
        # Ensure 'id' is a string representation of '_id'
        model_data["id"] = str(model_data.pop("_id", None)) # Use pop to remove _id, provide default
        
        if isinstance(model_data.get("timestamp"), datetime):
            model_data["timestamp"] = model_data["timestamp"].isoformat()
        
        # Ensure all fields required by VagonetaInDB are present or Pydantic will use defaults/raise errors
        # This step is simplified; Pydantic handles missing fields based on model definitions (Optional, default values)
        
        # Defaulting potentially missing optional fields to None if not present in DB document
        # and not automatically handled by Pydantic model if it expects them.
        # This is more explicit for fields that might be missing in older documents.
        for field_name in VagonetaInDB.__fields__:
            if field_name not in model_data and field_name != 'id': # 'id' is handled from '_id'
                 # Check if the field in Pydantic model has a default value or is Optional
                pydantic_field = VagonetaInDB.__fields__[field_name]
                if not pydantic_field.required and pydantic_field.default is None:
                    model_data[field_name] = None
        
        try:
            vagoneta_in_db = VagonetaInDB(**model_data)
            registros_list.append(vagoneta_in_db)
        except Exception as e_model: 
            print(f"Error creando VagonetaInDB para el registro {model_data.get('id')}: {e_model}. Data: {model_data}")
            continue
            
    return registros_list

@app.get("/registros/{registro_id}", 
    response_model=VagonetaInDB,
    summary="Obtener un registro específico",
    description="Recupera un registro de vagoneta por su ID.")
async def get_registro_por_id(registro_id: str):
    db = get_database()
    registro = await db.vagonetas.find_one({"_id": registro_id})
    
    if registro is not None:
        # Convertir ObjectId a string
        registro["_id"] = str(registro["_id"])
        return VagonetaInDB(**registro)
    
    raise HTTPException(status_code=404, detail="Registro no encontrado")

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
                "confidence_threshold": processor.min_confianza,
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
                "confidence_threshold": processor.min_confianza,
                "model_path": "numeros_enteros/yolo_model/training/best.pt",
                "classes_count": len(processor.model.names)
            }
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

@app.post("/debug/adjust-confidence")
async def debug_adjust_confidence(new_confidence_value: float = Form(...)):
    """Ajusta dinámicamente el umbral de confianza del modelo"""
    try:
        if not (0.01 <= new_confidence_value <= 1.0):
            return {"status": "error", "message": "La confianza debe estar entre 0.01 y 1.0"}
        
        old_confidence_val = processor.min_confidence
        processor.min_confidence = new_confidence_value
        
        print(f"🔧 Confianza ajustada: {old_confidence_val} → {new_confidence_value}")
        
        return {
            "status": "success",
            "message": f"Confianza ajustada de {old_confidence_val} a {new_confidence_value}",
            "old_confianza": old_confidence_val,
            "new_confianza": new_confidence_value
        }
        
    except Exception as e:
        return {"status": "error", "message": str(e)}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000, reload=True)
