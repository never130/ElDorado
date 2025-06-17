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
import time

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
        print(f"🔌 WebSocket conectado: {websocket.client}")

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        print(f"🔌❌ WebSocket desconectado: {websocket.client}")

    async def send_personal_message(self, message: str, websocket: WebSocket):
        await websocket.send_text(message)

    async def send_json_to_connection(self, data: dict, websocket: WebSocket):
        """Enviar mensaje JSON a una conexión específica"""
        try:
            await websocket.send_json(data)
        except Exception as e:
            print(f"❌ Error enviando mensaje JSON a {websocket.client}: {e}")

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except:
                pass

    async def broadcast_json(self, data: dict):
        print(f"📡 Broadcasting a {len(self.active_connections)} conexiones: {data.get('type', 'unknown')}")
        disconnected = []
        for connection in self.active_connections:
            try:
                await connection.send_json(data)
                print(f"✅ Mensaje enviado a {connection.client}")
            except Exception as e:
                print(f"❌ Error enviando a {connection.client}: {e}")
                disconnected.append(connection)
        
        # Remover conexiones rotas
        for conn in disconnected:
            if conn in self.active_connections:
                self.active_connections.remove(conn)

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

# Variables globales para monitoreo en vivo
monitor_tasks = {}  # Diccionario para manejar tareas de monitoreo activas

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
    skip: int = 0, 
    limit: int = 100,
    sort_by: Optional[str] = Query("timestamp", enum=["timestamp", "numero_detectado", "confianza", "origen_deteccion"]),
    sort_order: Optional[int] = Query(-1, enum=[-1, 1]),
    filtro: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None,
    db = Depends(get_database)
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
    print(f"🔌 Nueva conexión WebSocket desde {websocket.client}")
    await manager.connect(websocket)
    try:
        # Enviar mensaje de bienvenida
        welcome_message = {
            "type": "connection_established",
            "message": "Conectado al WebSocket de detecciones",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        await manager.send_json_to_connection(welcome_message, websocket)
        print(f"✅ WebSocket conectado: {websocket.client}")
        
        while True:
            # Keep connection alive
            data = await websocket.receive_text()
            print(f"📩 Mensaje recibido del cliente: {data}")
            # Echo back para confirmar comunicación
            echo_response = {
                "type": "echo",
                "original_message": data,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            await manager.send_json_to_connection(echo_response, websocket)
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"🔌❌ Cliente {websocket.client} desconectado del WebSocket")
    except Exception as e:
        print(f"❌ Error en WebSocket para {websocket.client}: {e}")
        manager.disconnect(websocket)

# Example model info endpoint (if processor object exists and has details)
# from utils.image_processing import processor # Assuming processor is initialized here or globally
@app.get("/model/info")
async def get_model_info():
    # This depends on how 'processor' is defined and what attributes it has.
    # Placeholder if 'processor' is not readily available or its structure is unknown.
    # if 'processor' in globals() and hasattr(processor, 'get_model_details'):
    #     return processor.get_model_details()
    return {"message": "Información del modelo no disponible en esta configuración."}

# Endpoints para Monitor en Vivo

@app.get("/cameras/list")
async def get_cameras_list():
    """Obtener lista de cámaras disponibles para el monitor en vivo"""
    try:
        cameras_info = []
        for camera in CAMERAS_CONFIG:
            cameras_info.append({
                "camera_id": camera["camera_id"],
                "tunel": camera.get("tunel", "Sin nombre"),
                "evento": camera.get("evento", "desconocido"),
                "source_type": camera.get("source_type", "camera"),
                "demo_mode": camera.get("demo_mode", False)
            })
        return {"cameras": cameras_info}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error obteniendo lista de cámaras: {str(e)}")

@app.post("/monitor/start/{camera_id}")
async def start_camera_monitoring(camera_id: str):
    """Iniciar monitoreo en vivo de una cámara específica"""
    global monitor_tasks
    
    # Para la webcam, usar configuración predeterminada
    if camera_id == "webcam":
        camera_config = {
            "camera_id": "webcam",
            "camera_url": 0,
            "source_type": "camera",
            "evento": "ingreso",
            "tunel": "Túnel Principal",
            "motion_sensitivity": 0.3,
            "min_motion_area": 8000,
            "detection_cooldown": 5,
            "demo_mode": False
        }
    else:
        # Buscar en la configuración de cámaras
        camera_config = next((cam for cam in CAMERAS_CONFIG if cam["camera_id"] == camera_id), None)
        
    if not camera_config:
        raise HTTPException(status_code=404, detail=f"Cámara {camera_id} no encontrada")
      # Verificar si ya está en ejecución
    if camera_id in monitor_tasks:
        raise HTTPException(status_code=400, detail=f"El monitoreo de la cámara {camera_id} ya está activo")
    
    # Crear tarea de monitoreo
    task = asyncio.create_task(monitor_camera_live(camera_id, camera_config))
    monitor_tasks[camera_id] = task
    
    print(f"INFO: Monitoreo iniciado para cámara {camera_id}")
    return {
        "status": "started",
        "message": f"Monitoreo iniciado para cámara {camera_id}", 
        "camera_id": camera_id
    }

@app.post("/monitor/stop/{camera_id}")
async def stop_camera_monitoring(camera_id: str):
    """Detener monitoreo en vivo de una cámara específica"""
    global monitor_tasks
    
    if camera_id not in monitor_tasks:
        raise HTTPException(status_code=404, detail=f"No hay monitoreo activo para la cámara {camera_id}")
    
    # Cancelar la tarea
    monitor_tasks[camera_id].cancel()
    del monitor_tasks[camera_id]
    
    print(f"INFO: Monitoreo detenido para cámara {camera_id}")
    return {
        "status": "stopped",
        "message": f"Monitoreo detenido para cámara {camera_id}", 
        "camera_id": camera_id
    }

@app.get("/monitor/status")
async def get_monitor_status():
    """Obtener estado actual del monitoreo"""
    global monitor_tasks
    
    active_monitors = []
    for camera_id, task in monitor_tasks.items():
        if not task.done():
            active_monitors.append({
                "camera_id": camera_id,
                "status": "running"
            })
    
    return {
        "active_monitors": active_monitors,
        "total_active": len(active_monitors)
    }

async def monitor_camera_live(camera_id: str, camera_config: dict):
    """Función para monitorear una cámara en tiempo real"""
    cap = None
    try:
        # Configurar la captura de video
        camera_url = camera_config["camera_url"]
        print(f"🎥 Iniciando monitoreo para cámara {camera_id} (URL: {camera_url})")

        # Inicializar captura de video
        if isinstance(camera_url, (int, str)) and str(camera_url).isdigit():
            cap = cv2.VideoCapture(int(camera_url))
        else:
            cap = cv2.VideoCapture(str(camera_url))

        if not cap.isOpened():
            raise Exception(f"No se pudo abrir la cámara {camera_id}")

        # Configurar propiedades de captura
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 15)

        # Leer primer frame para verificar
        ret, frame = cap.read()
        if not ret or frame is None:
            raise Exception(f"No se pueden leer frames de la cámara {camera_id}")

        # Obtener resolución actual
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"✅ Cámara {camera_id} conectada (Resolución: {frame_width}x{frame_height})")

        # Variables de control
        frame_count = 0
        last_update = time.time()
        fps = 0

        # Bucle principal de monitoreo
        while True:
            try:
                ret, frame = cap.read()
                if not ret:
                    print(f"⚠️ Error leyendo frame de {camera_id}")
                    await asyncio.sleep(0.1)
                    continue

                frame_count += 1
                current_time = time.time()
                elapsed = current_time - last_update

                # Actualizar FPS cada segundo
                if elapsed >= 1.0:
                    fps = frame_count / elapsed
                    frame_count = 0
                    last_update = current_time

                    await manager.broadcast_json({
                        "type": "debug_info",
                        "data": {
                            "camera_id": camera_id,
                            "fps": round(fps, 1),
                            "resolution": f"{frame_width}x{frame_height}",
                            "timestamp": datetime.now().isoformat()
                        }
                    })

                # Enviar detección cada 30 frames
                if frame_count % 30 == 0:
                    await manager.broadcast_json({
                        "type": "detection",
                        "camera_id": camera_id,
                        "data": {
                            "timestamp": datetime.now().isoformat(),
                            "fps": round(fps, 1)
                        }
                    })

                # Pausa para no saturar CPU
                await asyncio.sleep(0.01)

            except Exception as e:
                print(f"❌ Error en frame: {e}")
                await asyncio.sleep(0.1)

    except asyncio.CancelledError:
        print(f"� Monitoreo de {camera_id} cancelado")
    except Exception as e:
        print(f"❌ Error en monitor_camera_live: {e}")
        raise
    finally:
        if cap:
            cap.release()
            print(f"📹 Cámara {camera_id} liberada")
            
            # Configurar timeouts muy estrictos para conexión rápida
            cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 1500)  # Reducido a 1.5 segundos
            cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 500)    # Reducido a 0.5 segundos
            
            # Configurar propiedades básicas para acelerar
            cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            cap.set(cv2.CAP_PROP_FPS, 15)  # Reducido FPS para menos carga
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)  # Buffer mínimo para reducir latencia
        
        # Verificación rápida de conexión
        if not cap.isOpened():
            print(f"❌ Error: No se pudo abrir la cámara {camera_id} en el primer intento")
            # Intentar sin DirectShow como fallback
            if camera_config.get("source_type") != "video":
                print(f"🔄 Reintentando cámara {camera_id} sin DirectShow...")
                cap.release()
                cap = cv2.VideoCapture(int(camera_url))
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 2000)
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 1000)
                
                if not cap.isOpened():
                    print(f"❌ Error: Cámara {camera_id} no disponible después de reintentos")
                    return        # Verificar conexión y configurar cámara
        if not cap.isOpened():
            raise Exception(f"No se pudo abrir la cámara {camera_id}")
            
        # Configurar captura para mejor rendimiento
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 15)
        cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        
        # Verificar que podemos leer frames
        ret = False
        for _ in range(3):  # Intentar hasta 3 veces
            ret, frame = cap.read()
            if ret and frame is not None:
                break
            await asyncio.sleep(0.1)
            
        if not ret:
            raise Exception(f"No se pueden leer frames de la cámara {camera_id}")
            
        # Obtener resolución actual
        frame_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        frame_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        print(f"✅ Cámara {camera_id} conectada exitosamente (Resolución: {frame_width}x{frame_height})")
          frame_count = 0
        last_time = time.time()
        fps_update_interval = 1.0  # Actualizar FPS cada segundo
        cooldown_seconds = camera_config.get("detection_cooldown", 5)        # Bucle principal de monitoreo
        frame_count = 0
        detection_interval = 30  # Procesar cada N frames
        last_time = time.time()
        
        try:
            while True:
                try:
                    # Leer frame con timeout
                    ret, frame = cap.read()
                    if not ret:
                        print(f"⚠️ Error al leer frame de {camera_id}")
                        await asyncio.sleep(0.1)
                        continue
                    
                    # Control de FPS y rendimiento
                    frame_count += 1
                    current_time = time.time()
                    elapsed_time = current_time - last_time
                    
                    # Actualizar estadísticas cada segundo
                    if elapsed_time >= 1.0:
                        fps = frame_count / elapsed_time
                        frame_count = 0
                        last_time = current_time
                        
                        # Broadcast de estadísticas
                        await manager.broadcast_json({
                            "type": "debug_info",
                            "data": {
                                "camera_id": camera_id,
                                "fps": round(fps, 1),
                                "resolution": f"{frame_width}x{frame_height}",
                                "status": "active"
                            }
                        })
                    
                    # Procesar detecciones cada N frames
                    if frame_count % detection_interval == 0:
                        # Aquí iría tu lógica de detección de números
                        # Por ahora solo enviamos un mensaje de prueba
                        await manager.broadcast_json({
                            "type": "detection",
                            "data": {
                                "camera_id": camera_id,
                                "timestamp": datetime.now().isoformat(),
                                "status": "processing"
                            }
                        })
                    
                    # Evitar saturación de CPU
                    await asyncio.sleep(0.01)
                    
                except Exception as frame_error:
                    print(f"Error procesando frame: {frame_error}")
                    await asyncio.sleep(0.1)
                    continue
                    
        except asyncio.CancelledError:
            print(f"📹 Cámara {camera_id} desconectada")
            raise
        except Exception as e:
            print(f"❌ Error en monitor_camera_live: {e}")
            raise
        finally:
            if cap:
                cap.release()
                    # Reiniciar video si está en modo loop
                    cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                    continue
                else:
                    print(f"📹 Fin del video para cámara {camera_id}")
                    break
            
            frame_count += 1
              # Procesar solo cada N frames para optimizar
            if frame_count % detection_interval != 0:
                continue
            
            try:
                # Detectar números en el frame
                _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame)
                  # Debug: Mostrar qué está detectando el modelo
                if frame_count % 30 == 0:  # Log cada 30 frames procesados
                    print(f"🔍 Frame {frame_count}: numero_detectado='{numero_detectado}', confianza={confianza_placa}")
                    
                    # Enviar mensaje de debug por WebSocket
                    debug_message = {
                        "type": "debug_info",
                        "data": {
                            "camera_id": camera_id,
                            "frame_count": frame_count,
                            "numero_detectado": numero_detectado,
                            "confianza": confianza_placa,
                            "processing": True
                        }
                    }
                    asyncio.create_task(manager.broadcast_json(debug_message))
                
                if numero_detectado and confianza_placa is not None:
                    confianza_float = float(confianza_placa) if confianza_placa else 0.0
                    
                    # Debug: Log todas las detecciones, no solo las válidas
                    print(f"🔍 Detección encontrada: N°{numero_detectado}, Conf: {confianza_float:.3f}")
                    
                    # Aplicar filtro de confianza mínima (reducido para testing)
                    if confianza_float >= 0.3:  # 30% de confianza mínima para testing (era 0.6)
                        current_time = datetime.now()
                        
                        # Verificar cooldown para evitar duplicados
                        if numero_detectado in last_detection_time:
                            time_diff = (current_time - last_detection_time[numero_detectado]).total_seconds()
                            if time_diff < cooldown_seconds:
                                continue  # Skip esta detección por cooldown
                        
                        # Actualizar tiempo de última detección
                        last_detection_time[numero_detectado] = current_time
                        
                        # Guardar frame como imagen
                        timestamp_str = current_time.strftime("%Y%m%d_%H%M%S_%f")[:-3]  # Microsegundos a milisegundos
                        frame_filename = f"live_{camera_id}_{timestamp_str}_{numero_detectado}_{confianza_float:.3f}.jpg"
                        frame_path = UPLOAD_DIR / frame_filename
                        cv2.imwrite(str(frame_path), frame)
                        
                        # Crear registro en la base de datos
                        vagoneta_data = VagonetaCreate(
                            numero=str(numero_detectado),
                            imagen_path=f"uploads/{frame_filename}",
                            timestamp=current_time.replace(tzinfo=timezone.utc),
                            tunel=camera_config.get("tunel"),
                            evento=camera_config.get("evento", "ingreso"),
                            modelo_ladrillo=None,
                            merma=None,
                            metadata={
                                "camera_id": camera_id,
                                "frame_number": frame_count,
                                "detection_source": "live_monitoring"
                            },
                            confianza=min(confianza_float, 1.0),  # Asegurar que no sea > 1.0
                            origen_deteccion="camera_capture"
                        )
                        
                        record_id = crud.create_vagoneta_record(vagoneta_data)
                        
                        # Preparar datos para broadcast
                        db_record_dict = vagoneta_data.dict()
                        db_record_dict["_id"] = str(record_id)
                        db_record_dict["id"] = str(record_id)
                        if isinstance(db_record_dict.get("timestamp"), datetime):
                            db_record_dict["timestamp"] = db_record_dict["timestamp"].isoformat()
                          # Broadcast via WebSocket
                        broadcast_message = {
                            "type": "new_detection", 
                            "data": db_record_dict,
                            "source": "live_monitoring",
                            "camera_id": camera_id
                        }
                        print(f"📡 Enviando detección por WebSocket a {len(manager.active_connections)} conexiones")
                        asyncio.create_task(manager.broadcast_json(broadcast_message))
                        
                        print(f"🎯 Detección en vivo: Cámara {camera_id}, N°{numero_detectado}, Conf: {confianza_float:.3f}, DB_ID: {record_id}")
                        
            except Exception as e_detect:
                print(f"⚠️ Error detectando en frame de cámara {camera_id}: {e_detect}")
                continue
                
            # Pequeña pausa para no saturar el CPU
            await asyncio.sleep(0.1)
    
    except asyncio.CancelledError:
        print(f"🛑 Monitoreo de cámara {camera_id} cancelado")
    except Exception as e:
        print(f"❌ Error en monitoreo de cámara {camera_id}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        if cap:
            cap.release()
        print(f"📹 Cámara {camera_id} desconectada")

@app.get("/cameras/system-info")
async def get_system_cameras_info():
    """Obtener información detallada de las cámaras del sistema - OPTIMIZADO"""
    try:
        import cv2
        system_cameras = []
        
        print("🔍 Escaneando cámaras del sistema (rango optimizado 0-2)...")
        
        # Reducir rango a 0-2 para máxima velocidad
        for i in range(3):
            cap = None
            try:
                print(f"  📷 Probando cámara índice {i}...")
                
                # Usar DirectShow en Windows para conexión más rápida
                cap = cv2.VideoCapture(i, cv2.CAP_DSHOW)
                
                # Timeouts muy agresivos para velocidad máxima
                cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 800)   # 0.8 segundos
                cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 400)   # 0.4 segundos
                
                if cap.isOpened():
                    # Intentar leer frame rápidamente
                    ret, frame = cap.read()
                    if ret and frame is not None:
                        width = cap.get(cv2.CAP_PROP_FRAME_WIDTH)
                        height = cap.get(cv2.CAP_PROP_FRAME_HEIGHT)
                        fps = cap.get(cv2.CAP_PROP_FPS)
                        
                        system_cameras.append({
                            "index": i,
                            "width": int(width) if width > 0 else "Desconocido",
                            "height": int(height) if height > 0 else "Desconocido", 
                            "fps": int(fps) if fps > 0 else "Desconocido",
                            "status": "Disponible y funcional"
                        })
                        print(f"    ✅ Cámara {i}: Funcional ({int(width)}x{int(height)})")
                    else:
                        system_cameras.append({
                            "index": i,
                            "width": "N/A",
                            "height": "N/A", 
                            "fps": "N/A",
                            "status": "Detectada pero no funcional"
                        })
                        print(f"    ⚠️ Cámara {i}: No funcional")
                else:
                    print(f"    ❌ Cámara {i}: No disponible")
                    
            except Exception as e:
                print(f"    💥 Cámara {i}: Error - {str(e)[:50]}...")
                # Continuar silenciosamente para no spam
            finally:
                if cap:
                    cap.release()
        
        print(f"✅ Escaneo completado: {len(system_cameras)} cámaras encontradas")
        
        # Información de configuración actual
        config_cameras = []
        for camera in CAMERAS_CONFIG:
            config_cameras.append({
                "camera_id": camera["camera_id"],
                "camera_url": camera["camera_url"],
                "tunel": camera.get("tunel", "Sin nombre"),
                "source_type": camera.get("source_type", "camera"),
                "demo_mode": camera.get("demo_mode", False),
                "currently_monitoring": camera["camera_id"] in monitor_tasks
            })
        
        return {
            "system_cameras": system_cameras,
            "configured_cameras": config_cameras,
            "total_system_cameras": len(system_cameras),
            "active_monitors": len(monitor_tasks),
            "scan_range": "0-2 (ultra-optimizado para velocidad máxima)",
            "scan_method": "DirectShow + timeouts agresivos"
        }
        
    except Exception as e:
        print(f"❌ Error en get_system_cameras_info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Error obteniendo información del sistema: {str(e)}")

@app.get("/cameras/test/{camera_index}")
async def test_specific_camera(camera_index: int):
    """Verificar rápidamente si una cámara específica está disponible"""
    try:
        import cv2
        
        print(f"🔍 Probando cámara índice {camera_index}...")
        
        # Verificación ultra-rápida
        cap = cv2.VideoCapture(camera_index, cv2.CAP_DSHOW)
        cap.set(cv2.CAP_PROP_OPEN_TIMEOUT_MSEC, 500)  # 0.5 segundos
        cap.set(cv2.CAP_PROP_READ_TIMEOUT_MSEC, 200)  # 0.2 segundos
        
        if cap.isOpened():
            ret, frame = cap.read()
            if ret and frame is not None:
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                
                result = {
                    "index": camera_index,
                    "available": True,
                    "functional": True,
                    "width": width,
                    "height": height,
                    "test_time": "< 1 segundo"
                }
                print(f"✅ Cámara {camera_index}: Funcional ({width}x{height})")
            else:
                result = {
                    "index": camera_index,
                    "available": True,
                    "functional": False,
                    "width": None,
                    "height": None,
                    "test_time": "< 1 segundo"
                }
                print(f"⚠️ Cámara {camera_index}: Detectada pero no funcional")
        else:
            result = {
                "index": camera_index,
                "available": False,
                "functional": False,
                "width": None,
                "height": None,
                "test_time": "< 1 segundo"
            }
            print(f"❌ Cámara {camera_index}: No disponible")
        
        cap.release()
        return result
        
    except Exception as e:
        print(f"💥 Error probando cámara {camera_index}: {str(e)}")
        return {
            "index": camera_index,
            "available": False,
            "functional": False,
            "error": str(e),
            "test_time": "< 1 segundo"
        }

@app.get("/cameras/capture-frame/{camera_id}")
async def capture_frame_from_camera(camera_id: str):
    """Capturar un frame actual de la cámara para debugging"""
    try:
        # Encontrar configuración de la cámara
        camera_config = None
        for cam in CAMERAS_CONFIG:
            if cam["camera_id"] == camera_id:
                camera_config = cam
                break
        
        if not camera_config:
            raise HTTPException(status_code=404, detail=f"Cámara {camera_id} no encontrada")
        
        camera_url = camera_config["camera_url"]
        
        # Abrir cámara temporalmente
        if camera_config["source_type"] == "camera":
            cap = cv2.VideoCapture(int(camera_url), cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(camera_url)
            
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail=f"No se pudo abrir la cámara {camera_id}")
        
        # Capturar frame
        ret, frame = cap.read()
        cap.release()
        
        if not ret or frame is None:
            raise HTTPException(status_code=500, detail=f"No se pudo capturar frame de cámara {camera_id}")
        
        # Guardar frame temporalmente
        timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        frame_filename = f"debug_frame_{camera_id}_{timestamp_str}.jpg"
        frame_path = UPLOAD_DIR / frame_filename
        cv2.imwrite(str(frame_path), frame)
        
        # Intentar detección en el frame capturado para debugging
        try:
            _, _, _, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(frame)
            detection_result = {
                "numero_detectado": numero_detectado,
                "confianza": float(confianza_placa) if confianza_placa else None
            }
        except Exception as e_detect:
            detection_result = {
                "error": f"Error en detección: {str(e_detect)}"
            }
        
        return {
            "camera_id": camera_id,
            "frame_captured": True,
            "frame_path": f"/uploads/{frame_filename}",
            "frame_size": {
                "width": frame.shape[1],
                "height": frame.shape[0]
            },
            "detection_test": detection_result,
            "timestamp": timestamp_str
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"💥 Error capturando frame de cámara {camera_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error interno: {str(e)}")

# Agregar endpoint para debug de monitoreo
@app.get("/monitor/debug/{camera_id}")
async def get_monitor_debug_info(camera_id: str):
    """Obtener información de debug del monitoreo de una cámara"""
    active_task = monitor_tasks.get(camera_id)
    
    if not active_task:
        return {
            "camera_id": camera_id,
            "is_monitoring": False,
            "error": "No hay tarea de monitoreo activa"
        }
    
    # Info básica de la tarea
    task_info = {
        "camera_id": camera_id,
        "is_monitoring": True,
        "task_done": active_task.done(),
        "task_cancelled": active_task.cancelled()
    }
    
    if active_task.done():
        try:
            exception = active_task.exception()
            if exception:
                task_info["task_exception"] = str(exception)
        except:
            pass
    
    return task_info

# Esta línea se eliminó para corregir indentación
        cap.release()

@app.get("/video/stream/{camera_id}")
async def video_stream(camera_id: str):
    """Stream de video en vivo desde una cámara"""
    try:
        # Si la cámara es la webcam (camera_id == "webcam"), usar índice 0
        if camera_id == "webcam":
            cap = cv2.VideoCapture(0)
        else:
            # Buscar la configuración de la cámara
            cameras = load_cameras_config()
            camera_config = next((c for c in cameras if c["camera_id"] == camera_id), None)
            if not camera_config:
                raise HTTPException(status_code=404, detail=f"Cámara {camera_id} no encontrada")
                
            cap = cv2.VideoCapture(camera_config["camera_url"])
            
        if not cap.isOpened():
            raise HTTPException(status_code=500, detail="No se pudo abrir la cámara")
            
        # Configurar resolución preferida
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        
        async def generate_frames():
            try:
                while True:
                    success, frame = cap.read()
                    if not success:
                        break
                        
                    # Codificar frame a JPEG
                    ret, buffer = cv2.imencode('.jpg', frame)
                    if not ret:
                        continue
                        
                    # Convertir a bytes y enviar
                    frame_bytes = buffer.tobytes()
                    yield (b'--frame\r\n'
                           b'Content-Type: image/jpeg\r\n\r\n' + frame_bytes + b'\r\n')
                    
                    # Pequeña pausa para controlar FPS
                    await asyncio.sleep(0.033)  # ~30 FPS
                    
            except Exception as e:
                print(f"Error en generate_frames: {e}")
            finally:
                cap.release()
                
        return StreamingResponse(
            generate_frames(),
            media_type='multipart/x-mixed-replace; boundary=frame'
        )
        
    except Exception as e:
        print(f"Error en video_stream: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Inicialización del servidor
if __name__ == "__main__":
    import uvicorn
    print("🚀 Iniciando servidor FastAPI...")
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True,
        log_level="info"
    )
