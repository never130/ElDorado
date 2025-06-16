# main.py - Backend principal de la app de seguimiento de vagonetas
# Autor: [Tu nombre o equipo]
# Descripción: API REST para subir, procesar y consultar registros de vagonetas usando visión computacional.

import asyncio 
import shutil
import os
import uuid
import json
import traceback
import cv2 

from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Form, WebSocket, WebSocketDisconnect, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime, timezone # MODIFIED: Added timezone
from typing import List, Dict, Optional, Any

import crud 
from utils.image_processing import detectar_vagoneta_y_placa_mejorado, detectar_modelo_ladrillo 
from utils.auto_capture_system import AutoCaptureManager, load_cameras_config 
from database import connect_to_mongo, close_mongo_connection, get_database 
from collections import Counter # Keep if used elsewhere, not in provided snippets
from schemas import VagonetaCreate, VagonetaInDB, HistorialResponse, RegistroHistorialDisplay
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        print(f"WebSocket connection established: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"WebSocket connection closed: {websocket.client}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def broadcast(self, message: str): # Kept for potential direct text broadcasts
        for connection in self.active_connections:
            await connection.send_text(message)

    async def broadcast_json(self, data: dict):
        # Prepare a deep copy for modification if necessary, or ensure data is safe to modify
        # For simplicity, assuming data can be modified or is already prepared
        # Ensure datetime objects are serialized if they exist at top level of 'data' or 'data.data'
        # The current broadcast_message structure is {"type": "new_detection", "data": db_record_dict}
        # So, db_record_dict is what needs checking.
        
        # This check is now done before calling broadcast_json in most places.
        # However, a general check here can be a safeguard.
        # data_to_send = json.loads(json.dumps(data, default=str)) # Robust serialization
        # Using direct send_json, FastAPI handles datetime to ISO string.

        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager()

async def procesar_video_mp4_streamable(video_path: str, upload_dir: Path):
    yield {"type": "status", "stage": "initialization", "message": f"Iniciando procesamiento de video: {Path(video_path).name}"}
    
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        yield {"type": "error", "stage": "initialization", "message": f"Error al abrir el video: {video_path}"}
        return

    detections = {}  # Para agrupar por número: {numero: [lista de detecciones]}
    frame_count = 0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    yield {"type": "progress", "stage": "setup", "message": "Video abierto y listo para procesar.", "total_frames": total_frames, "current_frame": 0}

    try:
        while cap.isOpened():
            ret, frame = cap.read()
            if not ret:
                yield {"type": "status", "stage": "frame_processing", "message": "Fin de los frames o error al leer."}
                break
            
            frame_count += 1
            if frame_count % 5 != 0:  # Procesar cada N frames
                if frame_count % 100 == 0: 
                    yield {"type": "progress", "stage": "frame_processing", "message": f"Avanzando video...", "current_frame": frame_count, "total_frames": total_frames}
                continue

            yield {"type": "progress", "stage": "frame_processing", "message": f"Procesando frame {frame_count}/{total_frames}", "current_frame": frame_count, "total_frames": total_frames}

            if frame is None or frame.size == 0:
                yield {"type": "warning", "stage": "frame_processing", "message": f"Frame {frame_count} es None o está vacío."}
                continue

            try:
                # Assuming this function returns: cropped_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza_placa
                _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame) 
                
                if numero_detectado and confianza_placa is not None:
                    confianza_float = 0.0
                    try:
                        confianza_float = float(confianza_placa)
                    except (ValueError, TypeError):
                        pass # Keep confianza_float as 0.0 or log warning

                    yield {
                        "type": "detection_update", 
                        "stage": "frame_processing",
                        "frame": frame_count, 
                        "numero": numero_detectado, 
                        "confianza": confianza_float 
                    }
                    
                    # Guardar TODAS las detecciones significativas (no solo la mejor)
                    if confianza_float >= 0.5:  # Solo detecciones con confianza >= 50%
                        if numero_detectado not in detections:
                            detections[numero_detectado] = []
                        
                        # Guardar frame como imagen para esta detección
                        frame_filename = f"frame_{frame_count}_{numero_detectado}_{confianza_float:.3f}.jpg"
                        frame_path = upload_dir / frame_filename
                        cv2.imwrite(str(frame_path), frame)
                        
                        detections[numero_detectado].append({
                            'confianza': confianza_float,
                            'frame': frame_count,
                            'imagen_path': f"uploads/{frame_filename}"
                        })
            except Exception as e_detect:
                yield {"type": "warning", "stage": "frame_processing", "message": f"Error detectando en frame {frame_count}: {str(e_detect)}"}
    except Exception as e_video:
        yield {"type": "error", "stage": "video_processing_error", "message": f"Error mayor durante el procesamiento del video: {str(e_video)}"}
        traceback.print_exc()
        return 
    finally:
        cap.release()
        yield {"type": "status", "stage": "cleanup", "message": f"Video {Path(video_path).name} procesado. Total frames leídos: {frame_count}."}

    if not detections:
        yield {"type": "final_result", "stage": "completion", "data": None, "message": "No se detectaron números en el video."}
    else:
        # Convertir a formato que mantenga todas las detecciones
        final_detections_serializable = {}
        for numero, lista_detecciones in detections.items():
            final_detections_serializable[numero] = lista_detecciones
        yield {"type": "final_result", "stage": "completion", "data": final_detections_serializable, "message": "Detecciones finales recopiladas."}

def parse_merma(merma_str: Optional[str]) -> Optional[float]:
    if not merma_str or merma_str.strip() == "":
        return None
    try:
        return float(merma_str)
    except (ValueError, TypeError):
        return None

@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    print("INFO:     Iniciando aplicación...")
    connect_to_mongo()
    app_instance.state.pending_video_processing = {} 
    print("INFO:     Aplicación iniciada y base de datos conectada.")
    yield
    print("INFO:     Cerrando aplicación...")
    if auto_capture_manager and auto_capture_manager.is_running():
        print("INFO:     Deteniendo sistema de captura automática...")
        await auto_capture_manager.stop_system()
    close_mongo_connection()
    print("INFO:     Aplicación apagada y conexión a base de datos cerrada.")

app = FastAPI(
    title="API de Seguimiento de Vagonetas",
    description="Sistema de trazabilidad y seguimiento de vagonetas con visión computacional",
    version="2.0.0",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = Path("uploads")
UPLOAD_DIR.mkdir(exist_ok=True)
TEMP_CHUNK_DIR = UPLOAD_DIR / "temp_chunks"
TEMP_CHUNK_DIR.mkdir(exist_ok=True)

app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads") # Ensure directory is string

@app.post("/upload-chunk/")
async def upload_chunk(
    fileId: str = Form(...),
    chunkIndex: int = Form(...),
    chunk: UploadFile = File(...)
):
    chunk_dir = TEMP_CHUNK_DIR / fileId
    chunk_dir.mkdir(parents=True, exist_ok=True)  # Ensure parent dirs and fileId dir exist

    chunk_filename = f"chunk_{chunkIndex}"
    save_path = chunk_dir / chunk_filename

    try:
        with save_path.open("wb") as buffer:
            shutil.copyfileobj(chunk.file, buffer)
        # Optional: print statement for server log
        # print(f"💾 Chunk {chunkIndex} para {fileId} guardado en {save_path}")
        return {"message": f"Chunk {chunkIndex} for {fileId} received and saved.", "status": "ok"}
    except Exception as e:
        # Optional: print statement for server log
        # print(f"❌ Error guardando chunk {chunkIndex} para {fileId}: {e}\\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error saving chunk {chunkIndex} for {fileId}: {str(e)}")

auto_capture_manager: Optional[AutoCaptureManager] = None 
auto_capture_task: Optional[asyncio.Task] = None 
CAMERAS_CONFIG = load_cameras_config() 

def sanitize_filename(filename: str) -> str:
    return "".join(c if c.isalnum() or c in ('.', '_', '-') else '_' for c in filename)

@app.post("/upload/", response_model=Dict)
async def upload_image(
    file: UploadFile = File(...),
    tunel: Optional[str] = Form(None),
    evento: str = Form(...),
    merma: Optional[str] = Form(None), 
    metadata_str: Optional[str] = Form(None) 
):
    parsed_metadata: Optional[Dict] = None
    if metadata_str:
        try:
            parsed_metadata = json.loads(metadata_str)
        except json.JSONDecodeError:
            print(f"Warning: Invalid metadata JSON string in /upload/: {metadata_str}")
            # Not raising HTTPException to allow processing if metadata is optional/auxiliary

    timestamp_obj = datetime.now(timezone.utc)
    filename_ts_str = timestamp_obj.strftime("%Y%m%d%H%M%S%f")
    sane_original_filename = sanitize_filename(Path(file.filename).name)
    save_path = UPLOAD_DIR / f"{filename_ts_str}_{sane_original_filename}"
    
    try:
        with save_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Returns: cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza_placa
        _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(save_path))
        
        if not numero_detectado:
            try: os.remove(save_path)
            except Exception: pass
            return JSONResponse(
                {"message": "No se detectó vagoneta con número", "status": "ignored", "filename": file.filename},
                status_code=200
            )
        modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
        
        vagoneta_create_obj = VagonetaCreate(
            numero=str(numero_detectado),
            imagen_path=f"uploads/{save_path.name}",
            timestamp=timestamp_obj,
            tunel=tunel,
            evento=evento,
            modelo_ladrillo=modelo_ladrillo,
            merma=parse_merma(merma),
            metadata=parsed_metadata,
            confianza=float(confianza_placa) if confianza_placa is not None else None,
            origen_deteccion="image_upload"
        )
        record_id = crud.create_vagoneta_record(vagoneta_create_obj)
        
        db_record_dict = vagoneta_create_obj.dict()
        db_record_dict["_id"] = str(record_id)
        db_record_dict["id"] = str(record_id)
        if isinstance(db_record_dict.get("timestamp"), datetime):
            db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
        
        broadcast_message = {"type": "new_detection", "data": db_record_dict}
        asyncio.create_task(manager.broadcast_json(broadcast_message))

        return {
            "message": "Registro creado exitosamente", "status": "ok", "record_id": str(record_id),
            "numero_detectado": numero_detectado, "modelo_ladrillo": modelo_ladrillo,
            "confianza": confianza_placa, "filename": file.filename
        }

    except Exception as e:
        if save_path.exists():
            try: os.remove(save_path)
            except Exception: pass
        print(f"Error in /upload/ for {file.filename}: {e}\n{traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Error procesando imagen '{file.filename}': {str(e)}")

@app.post("/upload-multiple/")
async def upload_files(
    files: List[UploadFile] = File(...),
    tunel: Optional[str] = Form(None),
    evento: str = Form(...),
    merma: Optional[str] = Form(None),
    metadata_str: Optional[str] = Form(None)
):
    results = []
    parsed_metadata: Optional[Dict] = None
    if metadata_str:
        try:
            parsed_metadata = json.loads(metadata_str)
        except json.JSONDecodeError:
            print(f"Warning: Invalid metadata JSON string in /upload-multiple/: {metadata_str}")
            # Not raising, will proceed with metadata as None for records

    for file in files:
        current_file_save_path: Optional[Path] = None
        try:
            is_image = file.content_type and file.content_type.startswith('image/')
            # More specific video type check
            is_video = file.content_type and file.content_type.startswith('video/') and \
                       any(ct_suffix in file.content_type for ct_suffix in ['mp4', 'avi', 'mov', 'quicktime', 'mkv'])


            if not (is_image or is_video):
                results.append({
                    "filename": file.filename, "status": "error",
                    "error": f"Tipo de archivo no soportado: {file.content_type}."
                })
                continue
            
            timestamp_obj = datetime.now(timezone.utc)
            filename_ts_str = timestamp_obj.strftime("%Y%m%d%H%M%S%f")
            sane_original_filename = sanitize_filename(Path(file.filename).name)
            current_file_save_path = UPLOAD_DIR / f"{filename_ts_str}_{sane_original_filename}"
            
            with current_file_save_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            if is_video: # Videos are not processed by this endpoint directly
                results.append({
                    "filename": file.filename, "status": "video_not_processed",
                    "message": "Video subido. Usar subida individual con chunks para procesamiento.",
                    "path": f"uploads/{current_file_save_path.name}" # Provide path if needed later
                })
                # Do not remove the video, it's uploaded. User might use /finalize-upload if it was chunked,
                # or it's just stored. This endpoint is ambiguous for non-chunked videos.
                # For now, assume it's just uploaded and not processed.
                continue

            # Process if it's an image
            _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(current_file_save_path))
            
            if not numero_detectado:
                if current_file_save_path.exists(): os.remove(current_file_save_path)
                results.append({
                    "filename": file.filename, "status": "ignored",
                    "message": "No se detectó vagoneta con número"
                })
                continue
            
            modelo_ladrillo = detectar_modelo_ladrillo(str(current_file_save_path))
            
            vagoneta_create_obj = VagonetaCreate(
                numero=str(numero_detectado),
                imagen_path=f"uploads/{current_file_save_path.name}",
                timestamp=timestamp_obj,
                tunel=tunel,
                evento=evento,
                modelo_ladrillo=modelo_ladrillo,
                merma=parse_merma(merma),
                metadata=parsed_metadata,
                confianza=float(confianza_placa) if confianza_placa is not None else None,
                origen_deteccion="image_upload_multiple"
            )
            record_id = crud.create_vagoneta_record(vagoneta_create_obj)
            
            db_record_dict = vagoneta_create_obj.dict()
            db_record_dict["_id"] = str(record_id)
            db_record_dict["id"] = str(record_id)
            if isinstance(db_record_dict.get("timestamp"), datetime):
                db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
            broadcast_message = {"type": "new_detection", "data": db_record_dict}
            asyncio.create_task(manager.broadcast_json(broadcast_message))
            
            results.append({
                "filename": file.filename, "status": "ok", "record_id": str(record_id),
                "numero_detectado": numero_detectado, "modelo_ladrillo": modelo_ladrillo,
                "confianza": confianza_placa
            })
            
        except Exception as e:
            if current_file_save_path and current_file_save_path.exists():
                try: os.remove(current_file_save_path)
                except Exception: pass # Ignore cleanup error
            print(f"Error procesando archivo {file.filename} en /upload-multiple/: {e}\n{traceback.format_exc()}")
            results.append({
                "filename": file.filename, "status": "error", "error": str(e)
            })
    return {"results": results}

@app.post("/finalize-upload/")
async def finalize_upload(
    fileId: str = Form(...),
    originalFilename: str = Form(...),
    totalChunks: int = Form(...),
    tunel: Optional[str] = Form(None),
    evento: str = Form(...),
    merma: Optional[str] = Form(None),
    metadata_str: Optional[str] = Form(None)
):
    metadata: Optional[Dict] = None
    if metadata_str:
        try:
            metadata = json.loads(metadata_str)
        except json.JSONDecodeError:
            raise HTTPException(status_code=400, detail="Invalid metadata JSON string")

    chunk_dir = TEMP_CHUNK_DIR / fileId
    if not chunk_dir.exists():
        raise HTTPException(status_code=404, detail=f"No chunks found for file ID: {fileId}")

    # Verify all chunks are present before assembly
    for i in range(totalChunks):
        chunk_path = chunk_dir / f"chunk_{i}"
        if not chunk_path.exists():
            shutil.rmtree(chunk_dir, ignore_errors=True) # Clean up partial upload
            raise HTTPException(status_code=400, detail=f"Missing chunk {i+1}/{totalChunks} for file ID: {fileId}")

    final_timestamp_obj = datetime.now(timezone.utc)
    filename_ts_str = final_timestamp_obj.strftime("%Y%m%d%H%M%S%f")
    sane_original_filename = sanitize_filename(Path(originalFilename).name)
    final_save_path = UPLOAD_DIR / f"{filename_ts_str}_{sane_original_filename}"
    
    print(f"🧩 Ensamblando archivo: {final_save_path} desde {totalChunks} chunks (ID: {fileId})")
    try:
        with open(final_save_path, "wb") as final_file:
            for i in range(totalChunks):
                chunk_path = chunk_dir / f"chunk_{i}"
                with open(chunk_path, "rb") as chunk_file:
                    final_file.write(chunk_file.read())
        print(f"✅ Archivo {originalFilename} ensamblado exitosamente en {final_save_path}")
        shutil.rmtree(chunk_dir) # Clean up chunks after successful assembly
        print(f"🧹 Chunks temporales para {fileId} eliminados.")
    except Exception as e:
        print(f"❌ Error ensamblando archivo {originalFilename} (ID: {fileId}): {e}\n{traceback.format_exc()}")
        if chunk_dir.exists(): shutil.rmtree(chunk_dir, ignore_errors=True)
        if final_save_path.exists():
            try: os.remove(final_save_path)
            except OSError: pass
        raise HTTPException(status_code=500, detail=f"Error assembling file: {str(e)}")

    file_ext = Path(originalFilename).suffix.lower()
    is_image = file_ext in ['.jpg', '.jpeg', '.png', '.bmp', '.webp']
    is_video = file_ext in ['.mp4', '.avi', '.mov', '.mkv']

    if is_image:
        try:
            print(f"🖼️  Procesando imagen ensamblada: {final_save_path}")
            _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(final_save_path))
            
            if not numero_detectado:
                if final_save_path.exists(): os.remove(final_save_path)
                return JSONResponse(
                    content={"message": f"No se detectó vagoneta con número en {originalFilename}", "status": "ignored", "filename": originalFilename},
                    status_code=200
                )
            modelo_ladrillo = detectar_modelo_ladrillo(str(final_save_path))

            vagoneta_data = VagonetaCreate(
                numero=str(numero_detectado),
                imagen_path=f"uploads/{final_save_path.name}",
                timestamp=final_timestamp_obj,
                tunel=tunel,
                evento=evento,
                modelo_ladrillo=modelo_ladrillo,
                merma=parse_merma(merma),
                metadata=metadata,
                confianza=float(confianza_placa) if confianza_placa is not None else None,
                origen_deteccion="image_chunk_upload"
            )
            record_id = crud.create_vagoneta_record(vagoneta_data)
            
            db_record_dict = vagoneta_data.dict()
            db_record_dict["_id"] = str(record_id)
            db_record_dict["id"] = str(record_id)
            if isinstance(db_record_dict.get("timestamp"), datetime):
                db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
            broadcast_message = {"type": "new_detection", "data": db_record_dict}
            asyncio.create_task(manager.broadcast_json(broadcast_message))

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
            print(f"❌ Error procesando imagen ensamblada {originalFilename}: {e}\n{traceback.format_exc()}")
            raise HTTPException(status_code=500, detail=f"Error processing assembled image: {str(e)}")

    elif is_video:
        processing_id = str(uuid.uuid4())
        app.state.pending_video_processing[processing_id] = {
            "video_path": str(final_save_path), # This is the assembled video path
            "original_filename": originalFilename,
            "upload_dir": str(UPLOAD_DIR), # For consistency, though procesar_video_mp4_streamable might not use it
            "tunel": tunel,
            "evento": evento,
            "merma_str": merma,
            "metadata": metadata,
            "timestamp": final_timestamp_obj # Timestamp of when the video processing task was created
        }
        print(f"📹 Video {originalFilename} (ID: {fileId}) ensamblado y listo para procesamiento en segundo plano. Task ID: {processing_id}")
        return JSONResponse(content={
            "status": "video_processing_pending", "processing_id": processing_id,
            "filename": originalFilename,
            "message": "El video está siendo procesado. Conéctese al stream para ver el progreso."
        })
    else:
        if final_save_path.exists():
            try: os.remove(final_save_path)
            except OSError: pass
        raise HTTPException(status_code=400, detail=f"Unsupported file type after assembly: {file_ext} for {originalFilename}")

@app.get("/stream-video-processing/{processing_id}")
async def stream_video_processing(processing_id: str):
    if processing_id not in app.state.pending_video_processing:
        raise HTTPException(status_code=404, detail=f"Video processing ID '{processing_id}' not found or already processed.")

    task_info = app.state.pending_video_processing[processing_id]
    
    async def event_generator():
        final_detection_data = None
        processing_error_occurred = False
        error_message_detail = "Unknown error during video processing."
        db_record_id_created = None # To store the ID of the created record

        try:
            yield f"data: {json.dumps({'type': 'status', 'stage': 'stream_init', 'message': 'Conectado al stream de procesamiento de video.'})}\n\n"
            
            video_path_to_process = task_info["video_path"]
            upload_dir_for_streamer = Path(task_info["upload_dir"])

            async for update in procesar_video_mp4_streamable(video_path_to_process, upload_dir_for_streamer):
                yield f"data: {json.dumps(update)}\n\n"
                if update.get("type") == "final_result":
                    final_detection_data = update.get("data")
                elif update.get("type") == "error": 
                    processing_error_occurred = True
                    error_message_detail = update.get("message", error_message_detail)
            
            if not processing_error_occurred and final_detection_data:
                if isinstance(final_detection_data, dict) and final_detection_data:
                    # Procesar TODAS las detecciones (no solo la mejor)
                    registros_creados = []
                    
                    for numero_str, lista_detecciones in final_detection_data.items():
                        if isinstance(lista_detecciones, list):
                            # Nueva estructura: lista de detecciones por número
                            for deteccion in lista_detecciones:
                                confianza_val = deteccion.get('confianza', 0.0)
                                frame_num = deteccion.get('frame', 0)
                                imagen_path = deteccion.get('imagen_path', f"uploads/{Path(task_info['video_path']).name}")
                                
                                # Validar confianza
                                if confianza_val > 1.0:
                                    print(f"Warning (VID:{processing_id}): Confianza {confianza_val} > 1.0 para N°{numero_str} frame {frame_num}. Capada a 1.0.")
                                    confianza_val = 1.0
                                elif confianza_val < 0.0:
                                    print(f"Warning (VID:{processing_id}): Confianza {confianza_val} < 0.0 para N°{numero_str} frame {frame_num}. Capada a 0.0.")
                                    confianza_val = 0.0

                                # Crear registro individual
                                record_timestamp = task_info.get("timestamp", datetime.now(timezone.utc))
                                if not isinstance(record_timestamp, datetime): 
                                    record_timestamp = datetime.now(timezone.utc)
                                if record_timestamp.tzinfo is None: 
                                    record_timestamp = record_timestamp.replace(tzinfo=timezone.utc)

                                vagoneta_data = VagonetaCreate(
                                    numero=str(numero_str),
                                    imagen_path=imagen_path,
                                    timestamp=record_timestamp,
                                    tunel=task_info.get("tunel"),
                                    evento=task_info.get("evento"),
                                    modelo_ladrillo=None,
                                    merma=parse_merma(task_info.get("merma_str")),                                    metadata={
                                        **(task_info.get("metadata") or {}),
                                        "frame_number": frame_num,
                                        "video_source": Path(task_info['video_path']).name
                                    },
                                    confianza=confianza_val,
                                    origen_deteccion="video_processing"
                                )
                                
                                record_id = crud.create_vagoneta_record(vagoneta_data)
                                registros_creados.append({
                                    "id": str(record_id),
                                    "numero": numero_str,
                                    "confianza": confianza_val,
                                    "frame": frame_num
                                })

                                db_record_dict = vagoneta_data.dict()
                                db_record_dict["_id"] = str(record_id)
                                db_record_dict["id"] = str(record_id)
                                if isinstance(db_record_dict.get("timestamp"), datetime):
                                    db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()

                                yield f"data: {json.dumps({'type': 'db_record_created', 'data': db_record_dict})}\n\n"
                                print(f"✅ Registro creado para video {task_info['original_filename']} (Task:{processing_id}), N°: {numero_str}, Frame: {frame_num}, Conf: {confianza_val:.3f}, DB_ID: {record_id}")
                                
                                # Broadcast via WebSocket
                                broadcast_message = {"type": "new_detection", "data": db_record_dict}
                                asyncio.create_task(manager.broadcast_json(broadcast_message))
                        
                        else:
                            # Estructura antigua: compatibilidad hacia atrás
                            confianza_val = float(lista_detecciones) if lista_detecciones else 0.0
                            
                            if confianza_val > 1.0:
                                confianza_val = 1.0
                            elif confianza_val < 0.0:
                                confianza_val = 0.0

                            record_timestamp = task_info.get("timestamp", datetime.now(timezone.utc))
                            if not isinstance(record_timestamp, datetime): 
                                record_timestamp = datetime.now(timezone.utc)
                            if record_timestamp.tzinfo is None: 
                                record_timestamp = record_timestamp.replace(tzinfo=timezone.utc)

                            vagoneta_data = VagonetaCreate(
                                numero=str(numero_str),
                                imagen_path=f"uploads/{Path(task_info['video_path']).name}",
                                timestamp=record_timestamp,
                                tunel=task_info.get("tunel"),
                                evento=task_info.get("evento"),
                                modelo_ladrillo=None,
                                merma=parse_merma(task_info.get("merma_str")),
                                metadata=task_info.get("metadata") or {},
                                confianza=confianza_val,
                                origen_deteccion="video_processing"
                            )
                            
                            record_id = crud.create_vagoneta_record(vagoneta_data)
                            registros_creados.append({
                                "id": str(record_id),
                                "numero": numero_str,
                                "confianza": confianza_val
                            })

                    print(f"📊 Total de {len(registros_creados)} registros creados para video {task_info['original_filename']}")
                    yield f"data: {json.dumps({'type': 'processing_complete', 'total_records': len(registros_creados), 'records': registros_creados})}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'status', 'stage': 'completion', 'message': 'Video procesado, pero no se identificó un número de vagoneta claro.'})}\n\n"
                    print(f"ℹ️ Video {task_info['original_filename']} (Task:{processing_id}) procesado. No se identificó un número principal. Detecciones: {final_detection_data}")
                    # processing_error_occurred remains False, but no record is created.
                    
            elif processing_error_occurred:
                yield f"data: {json.dumps({'type': 'error', 'stage': 'finalization', 'message': f'Error final durante el procesamiento: {error_message_detail}'})}\n\n"
                print(f"❌ Error final durante el procesamiento del video {task_info['original_filename']} (Task:{processing_id}): {error_message_detail}")
            
            elif not final_detection_data : # and not processing_error_occurred implicitly
                yield f"data: {json.dumps({'type': 'status', 'stage': 'completion', 'message': 'Video procesado pero no se encontraron detecciones.'})}\n\n"
                print(f"ℹ️ Video {task_info['original_filename']} (Task:{processing_id}) procesado, pero no se encontraron detecciones.")
        
        except Exception as e_stream:
            processing_error_occurred = True # Mark error
            error_message_detail = f'Excepción en el stream principal: {str(e_stream)}'
            yield f"data: {json.dumps({'type': 'error', 'stage': 'stream_exception', 'message': error_message_detail})}\n\n"
            print(f"💥 Excepción en stream_video_processing para {processing_id} ({task_info.get('original_filename', 'N/A')}): {e_stream}\n{traceback.format_exc()}")
        
        finally:
            # Send stream_end event
            final_message = error_message_detail if processing_error_occurred else \
                            f"Proceso completado para {task_info.get('original_filename', 'video')}. " + \
                            (f"Registro DB ID: {db_record_id_created}" if db_record_id_created else "No se creó registro.")
            
            yield f"data: {json.dumps({'type': 'stream_end', 'error_occurred': processing_error_occurred, 'message': final_message, 'processing_id': processing_id})}\n\n"
            print(f"INFO: Stream para {processing_id} ({task_info.get('original_filename', 'N/A')}) finalizando. Error ocurrido: {processing_error_occurred}")
            
            # Clean up pending task
            if processing_id in app.state.pending_video_processing:
                del app.state.pending_video_processing[processing_id]
                print(f"INFO: Tarea {processing_id} eliminada de pendientes.")
            else:
                # This case might happen if cleanup occurs due to an early exit or another mechanism
                print(f"WARN: Tarea {processing_id} ya no estaba en pendientes al finalizar stream (posiblemente ya eliminada o error previo).")

    return StreamingResponse(event_generator(), media_type="text/event-stream")

@app.get("/historial/", response_model=HistorialResponse)
async def get_historial_registros(
    skip: int = 0, limit: int = 100,
    sort_by: Optional[str] = Query("timestamp", enum=["timestamp", "numero_detectado", "confianza", "origen_deteccion"]),
    sort_order: Optional[int] = Query(-1, enum=[-1, 1]), # -1 for descending, 1 for ascending
    filtro: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db: AsyncIOMotorDatabase = Depends(get_database) # This type hint is standard and correct
):
    if fecha_fin and fecha_fin.hour == 0 and fecha_fin.minute == 0 and fecha_fin.second == 0:
        fecha_fin = fecha_fin.replace(hour=23, minute=59, second=59, microsecond=999999)    # Fixed function call to match crud.get_vagonetas_historial signature
    registros_from_db = crud.get_vagonetas_historial(
        skip=skip, 
        limit=limit
        # Note: The current crud function doesn't support filtering by sort_by, sort_order, 
        # filtro, fecha_inicio, fecha_fin - these need to be implemented later
    )    
    registros_list = []
    # get_vagonetas_historial returns a list, not a cursor, so iterate normally
    for r_doc in registros_from_db:
        doc_data = dict(r_doc) 

        # 1. Handle 'id' from '_id'
        if "_id" in doc_data and isinstance(doc_data["_id"], ObjectId):
            doc_data["id"] = str(doc_data["_id"])
        
        # 2. Handle 'timestamp' (required by schema, assumed datetime)
        ts = doc_data.get('timestamp')
        if not isinstance(ts, datetime):
            if isinstance(ts, str):
                try:
                    ts = datetime.fromisoformat(ts)
                except ValueError:
                    ts = datetime.now(timezone.utc) # Fallback
            else:
                ts = datetime.now(timezone.utc) # Fallback
        
        if ts.tzinfo is None: # Ensure timezone-aware
            ts = ts.replace(tzinfo=timezone.utc)
        doc_data['timestamp'] = ts        # 3. Handle 'numero_detectado' (required by schema, assumed str)
        # Map from 'numero' field in old schema to 'numero_detectado' in new schema
        doc_data['numero_detectado'] = str(doc_data.get('numero', 'N/A'))

        # 4. Handle 'confianza' (required by schema, assumed float)
        conf = doc_data.get('confianza')
        try:
            doc_data['confianza'] = float(conf if conf is not None else 0.0)
        except (ValueError, TypeError):
            doc_data['confianza'] = 0.0        # 5. Handle 'origen_deteccion' (required by schema, assumed str)
        # Since this is a new field, set a default value
        doc_data['origen_deteccion'] = str(doc_data.get('origen_deteccion', 'historico'))

        # 6. Handle 'evento' (required by schema, assumed str)
        doc_data['evento'] = str(doc_data.get('evento', 'desconocido'))
          # 7. Handle 'tunel' (required by schema, assumed str)
        doc_data['tunel'] = str(doc_data.get('tunel', 'N/A')) if doc_data.get('tunel') is not None else None

        # 8. Handle 'merma' field - convert to string if it exists
        merma_val = doc_data.get('merma')
        if merma_val is not None:
            doc_data['merma'] = str(merma_val)
        else:
            doc_data['merma'] = None        # 9. Optional fields (defaults to None if not present, Pydantic handles Optional types)
        doc_data['imagen_path'] = doc_data.get('imagen_path')
        doc_data['url_video_frame'] = doc_data.get('url_video_frame')
        doc_data['ruta_video_original'] = doc_data.get('ruta_video_original')

        # Ensure all fields required by RegistroHistorialDisplay are present
        # The .get with defaults above should cover required string/float/datetime fields.
        # Optional fields will be None if missing, which is fine for Pydantic.
        
        try:
            # Create the Pydantic model instance
            registro_display = RegistroHistorialDisplay(**doc_data)
            registros_list.append(registro_display)
        except Exception as e: # Catch Pydantic validation errors or others
            print(f"Error converting document to RegistroHistorialDisplay: {doc_data}")
            print(f"Validation/Conversion Error: {e}")
            # Optionally, skip this record or handle error appropriately
            # For now, this will prevent the request from failing entirely if one doc is bad.
            # Consider if a bad record should raise an HTTP error or be skipped.    # Fixed function call - no await needed since function is now synchronous
    total_registros = crud.get_vagonetas_historial_count(
        filtro=filtro, fecha_inicio=fecha_inicio, fecha_fin=fecha_fin
    )

    return HistorialResponse(
        registros=registros_list,
        total=total_registros,
        skip=skip,
        limit=limit,
        has_more=(skip + len(registros_list) < total_registros)
    )

@app.post("/auto-capture/start")
async def start_auto_capture():
    global auto_capture_manager, auto_capture_task, CAMERAS_CONFIG, UPLOAD_DIR, manager
    if auto_capture_manager and auto_capture_manager.is_running():
        raise HTTPException(status_code=400, detail="La captura automática ya está en ejecución.")
    
    print("INFO: Iniciando sistema de captura automática...")
    auto_capture_manager = AutoCaptureManager(CAMERAS_CONFIG, UPLOAD_DIR, manager) 
    auto_capture_task = asyncio.create_task(auto_capture_manager.start_system())
    return {"message": "Sistema de captura automática iniciado."}

@app.post("/auto-capture/stop")
async def stop_auto_capture():
    global auto_capture_manager, auto_capture_task
    if not auto_capture_manager or not auto_capture_manager.is_running():
        raise HTTPException(status_code=400, detail="La captura automática no está en ejecución.")
    
    print("INFO: Deteniendo sistema de captura automática...")
    await auto_capture_manager.stop_system()
    # auto_capture_manager = None # Keep manager instance for potential restart or status check?
    # auto_capture_task = None # Task should be awaited/cancelled in stop_system
    if auto_capture_task and not auto_capture_task.done():
        auto_capture_task.cancel() # Ensure task is cancelled if not done by stop_system
    return {"message": "Sistema de captura automática detenido."}

@app.get("/auto-capture/status")
async def auto_capture_status():
    global auto_capture_manager
    if auto_capture_manager: # Check if manager exists
        return auto_capture_manager.get_status() # get_status should return a dict
    return {"manager_running": False, "cameras": [], "message": "El sistema de captura automática no ha sido inicializado."}

@app.websocket("/ws/detections")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep connection alive, optionally handle incoming messages from client
            data = await websocket.receive_text() 
            # Example: await manager.send_personal_message(f"Message text was: {data}", websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client {websocket.client} disconnected from WebSocket /ws/detections.")
    except Exception as e:
        print(f"Error en WebSocket /ws/detections para {websocket.client}: {e}")
        manager.disconnect(websocket) # Ensure disconnect on other errors too

# Example model info endpoint (if processor object exists and has details)
# from utils.image_processing import processor # Assuming processor is initialized here or globally
@app.get("/model/info")
async def get_model_info():
    # This depends on how 'processor' is defined and what attributes it has.
    # Placeholder if 'processor' is not readily available or its structure is unknown.
    # if 'processor' in globals() and hasattr(processor, 'get_model_details'):
    #     return processor.get_model_details()
    return {"message": "Información del modelo no disponible en esta configuración."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
