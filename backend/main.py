# main.py - Backend principal de la app de seguimiento de vagonetas
# Autor: [Tu nombre o equipo]
# Descripción: API REST para subir, procesar y consultar registros de vagonetas usando visión computacional.

import sys # Add this import
import os # Add this import
import json
import uuid
import cv2
import shutil
import traceback
import asyncio # <--- AÑADIDO IMPORT ASYNCIO
from contextlib import asynccontextmanager # <--- IMPORTADO PARA LIFESPAN

from fastapi import FastAPI, UploadFile, File, HTTPException, BackgroundTasks, Query, Form, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Optional, Any

# Cambiando a importaciones directas
import crud # Anteriormente: from .import crud
from utils.image_processing import detectar_vagoneta_y_placa, detectar_vagoneta_y_placa_mejorado, detectar_modelo_ladrillo # Anteriormente: from .utils.image_processing import ...
from utils.ocr import extract_number_from_image # Anteriormente: from .utils.ocr import ...
from utils.camera_capture import CameraCapture # Anteriormente: from .utils.camera_capture import ...
from utils.auto_capture_system import AutoCaptureManager, load_cameras_config # Anteriormente: from .utils.auto_capture_system import ...
from database import connect_to_mongo, close_mongo_connection, get_database # Anteriormente: from .database import ...
from collections import Counter
from schemas import VagonetaCreate, VagonetaInDB # Anteriormente: from .schemas import ...
from utils.image_processing import processor # Anteriormente: from .utils.image_processing import processor
from bson import ObjectId # Import ObjectId

# WebSocket Connection Manager (from incoming changes 5b494cfd2b9733b80f9777f03a9f343d1a5e61a8)
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
        # This part uses `datetime` which should be imported if not already.
        # Checking existing imports: `from datetime import datetime` is present.
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
        
        for connection in self.active_connections:
            await connection.send_json(data)

manager = ConnectionManager() # from incoming changes 5b494cfd2b9733b80f9777f03a9f343d1a5e61a8

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
    # Ensure processed_frames_dir is correctly defined if used, or remove if not.
    # processed_frames_dir = upload_dir / "processed_frames" / str(uuid.uuid4())
    # os.makedirs(processed_frames_dir, exist_ok=True) # This was commented out, if needed, ensure uuid and os are imported here.
    
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

# Lifespan manager para manejar eventos de inicio y cierre
@asynccontextmanager
async def lifespan(app_instance: FastAPI):
    # Lógica de inicio
    print("INFO:     Iniciando aplicación...")
    connect_to_mongo()
    app_instance.state.pending_video_processing = {}  # Inicializar el almacén de tareas
    print("INFO:     Aplicación iniciada y base de datos conectada.")
    yield
    # Lógica de cierre
    print("INFO:     Cerrando aplicación...")
    close_mongo_connection()
    print("INFO:     Aplicación apagada y conexión a base de datos cerrada.")

# Inicializa la app FastAPI
app = FastAPI(
    title="API de Seguimiento de Vagonetas",
    description="Sistema de trazabilidad y seguimiento de vagonetas con visión computacional",
    version="2.0.0",
    lifespan=lifespan  # Usar el nuevo lifespan manager
)

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
            with save_path.open("wb") as buffer:
                shutil.copyfileobj(file.file, buffer)
            
            numero_detectado = None
            confianza_placa = None
            modelo_ladrillo = None
            record_id = None # Inicializar record_id

            if is_image:
                cropped_placa_img, bbox_vagoneta, bbox_placa, numero_detectado, confianza_placa = detectar_vagoneta_y_placa_mejorado(str(save_path))
                modelo_ladrillo = detectar_modelo_ladrillo(str(save_path))
            elif is_video:
                # Para /upload-multiple/, si se quiere mantener el procesamiento de video síncrono aquí,
                # se necesitaría una función que no sea streamable, o adaptar para usar el stream.
                # Por ahora, vamos a devolver un placeholder o error indicando que se use la subida por chunks para videos.
                # O, si se decide que /upload-multiple/ no manejará videos directamente y solo imágenes:
                results.append({
                    "filename": file.filename,
                    "status": "error",
                    "error": "Para videos, por favor use la funcionalidad de subida individual (que soporta chunks y procesamiento en segundo plano)."
                })
                if save_path.exists(): os.remove(save_path) # Limpiar el video no procesado
                continue

                # Comentado: La lógica original de procesar_video_mp4 ya no existe directamente aquí.
                # detection_results = await procesar_video_mp4(str(save_path), UPLOAD_DIR) 
                # if detection_results:
                #     if isinstance(detection_results, dict) and detection_results:
                #         if detection_results:
                #             numero_detectado = max(detection_results, key=detection_results.get)
                #             confianza_placa = detection_results[numero_detectado]
                # modelo_ladrillo = None 
            
            if not numero_detectado and is_image: # Solo continuar para imágenes si hubo detección
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
            
            if is_image: # Solo crear registro para imágenes en este endpoint por ahora
                vagoneta = VagonetaCreate(
                    numero=numero_detectado,
                    imagen_path=f"uploads/{save_path.name}",
                    timestamp=datetime.utcnow(),
                    tunel=tunel,
                    evento=evento,
                    modelo_ladrillo=modelo_ladrillo,
                    merma=parse_merma(merma),
                    metadata=metadata,
                    confianza=confianza_placa
                )
                record_id = crud.create_vagoneta_record(vagoneta)
            
            results.append({
                "filename": file.filename,
                "status": "ok" if is_image else "pending_chunk_upload_for_video", # Cambiar status para video
                "record_id": str(record_id) if record_id else None,
                "numero_detectado": numero_detectado,
                "modelo_ladrillo": modelo_ladrillo,
                "confianza": confianza_placa,
                "message": "Para videos, usar subida individual." if is_video else "Imagen procesada."
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
        raise HTTPException(status_code=404, detail="Video processing ID not found or already processed.")

    task_info = app.state.pending_video_processing[processing_id]
    # db = get_database() # Ya no es necesario aquí si crud lo maneja o no se usa directamente en este bloque

    async def event_generator():
        final_detection_data = None
        processing_error_occurred = False
        # record_created_successfully = False # No se usa actualmente en este scope
        error_message_detail = "Unknown error during video processing."
        video_file_to_delete = task_info.get("video_path") # Guardar antes de que se elimine task_info

        try:
            yield f"data: {json.dumps({'type': 'status', 'stage': 'stream_init', 'message': 'Conectado al stream de procesamiento de video.'})}\\n\\n"
            
            async for update in procesar_video_mp4_streamable(task_info["video_path"], Path(task_info["upload_dir"])):
                yield f"data: {json.dumps(update)}\\n\\n"
                if update.get("type") == "final_result":
                    final_detection_data = update.get("data")
                elif update.get("type") == "error": 
                    processing_error_occurred = True
                    error_message_detail = update.get("message", error_message_detail)
            
            # Lógica de creación de registro después de procesar el video
            if not processing_error_occurred and final_detection_data: 
                best_numero_from_video = None
                max_confianza_from_video = -1.0
                
                if isinstance(final_detection_data, dict) and final_detection_data:
                    for numero, confianza in final_detection_data.items():
                        if confianza > max_confianza_from_video:
                            max_confianza_from_video = confianza
                            best_numero_from_video = numero
                
                if best_numero_from_video:
                    vagoneta_video_data = VagonetaCreate(
                        numero=best_numero_from_video,
                        imagen_path=f"uploads/{Path(task_info['video_path']).name}", # Usar el path relativo
                        timestamp=task_info.get("timestamp", datetime.utcnow()),
                        tunel=task_info.get("tunel"),
                        evento=task_info.get("evento"),
                        modelo_ladrillo=None, # Modelo de ladrillo no se detecta en videos actualmente
                        merma=parse_merma(task_info.get("merma_str")),
                        metadata=task_info.get("metadata"),
                        confianza=float(max_confianza_from_video) if max_confianza_from_video != -1.0 else None
                    )
                    try:
                        record_id = crud.create_vagoneta_record(vagoneta_video_data)
                        yield f"data: {json.dumps({'type': 'status', 'stage': 'completion', 'message': f'Registro de video creado con ID: {record_id}', 'record_id': str(record_id)})}\\n\\n"
                        # record_created_successfully = True # No se usa actualmente
                    except Exception as e_crud:
                        yield f"data: {json.dumps({'type': 'error', 'stage': 'db_error', 'message': f'Error al crear registro en BD para video: {str(e_crud)}'})}\\n\\n"
                else: 
                    yield f"data: {json.dumps({'type': 'status', 'stage': 'completion', 'message': 'No se detectó un número claro en el video para crear registro.'})}\\n\\n"
            
            elif processing_error_occurred: # Error durante el procesamiento del streamable
                 yield f"data: {json.dumps({'type': 'completion_error', 'status': 'error', 'message': f'El procesamiento del video falló: {error_message_detail}'})}\\n\\n"
            
            elif not processing_error_occurred and final_detection_data is None: # No hubo error, pero no se obtuvieron detecciones finales
                yield f"data: {json.dumps({'type': 'status', 'stage': 'completion', 'message': 'Procesamiento de video completado. No se encontraron detecciones para crear un registro.'})}\\n\\n"
        
        except Exception as e_stream:
            # processing_error_occurred = True # Ya no es necesario, el error se propaga
            error_message_detail = f"Error inesperado en el stream de procesamiento: {str(e_stream)}"
            try: # Intentar enviar un último mensaje de error si el stream sigue activo
                yield f"data: {json.dumps({'type': 'error', 'status': 'error', 'stage': 'stream_error', 'message': error_message_detail})}\\n\\n"
            except Exception:
                pass # El cliente pudo haberse desconectado
            traceback.print_exc()
        
        finally:
            app.state.pending_video_processing.pop(processing_id, None)
            if video_file_to_delete:
                try:
                    video_path_obj = Path(video_file_to_delete)
                    if video_path_obj.exists():
                        os.remove(video_path_obj)
                        # Intentar enviar mensaje de eliminación. Puede fallar si el cliente ya cerró.
                        try:
                            yield f"data: {json.dumps({'type': 'status', 'stage': 'cleanup', 'message': f'Archivo de video temporal {video_path_obj.name} eliminado.'})}\\n\\n"
                        except Exception: pass
                        print(f"🗑️ Archivo de video temporal {video_file_to_delete} eliminado.")
                except Exception as e_delete:
                    try:
                        yield f"data: {json.dumps({'type': 'warning', 'stage': 'cleanup', 'message': f'No se pudo eliminar el archivo de video temporal {video_file_to_delete}: {e_delete}'})}\\n\\n"
                    except Exception: pass
                    print(f"⚠️ No se pudo eliminar el archivo de video temporal {video_file_to_delete}: {e_delete}")
            # Señal de fin de stream explícita
            try:
                yield f"data: {json.dumps({'type': 'stream_end', 'message': 'Stream de procesamiento finalizado.'})}\\n\\n"
            except Exception: pass


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
    for r_doc in registros_cursor: 
        r_doc["_id"] = str(r_doc["_id"])
        registros_list.append(VagonetaInDB(**r_doc)) 

    return registros_list

@app.get("/registros/{registro_id}", 
    response_model=VagonetaInDB,
    summary="Obtener un registro específico",
    description="Recupera un registro de vagoneta por su ID.")
async def get_registro_por_id(registro_id: str):
    db = get_database() 
    try:
        obj_id = ObjectId(registro_id)
    except Exception: 
        raise HTTPException(status_code=400, detail="ID de registro inválido.")

    registro_doc = await db.vagonetas.find_one({"_id": obj_id}) 
    
    if registro_doc is not None:
        registro_doc["_id"] = str(registro_doc["_id"]) 
        return VagonetaInDB(**registro_doc)
    raise HTTPException(status_code=404, detail="Registro no encontrado")


@app.get("/health",
    summary="Healthcheck",
    description="Verifica que el backend está funcionando correctamente.")
def health():
    return {"status": "ok", "message": "API de Vagonetas funcionando!"}

# --- ENDPOINTS DE CAPTURA AUTOMÁTICA ---

@app.post("/auto-capture/start")
async def start_auto_capture():
    global auto_capture_manager, auto_capture_task, CAMERAS_CONFIG
    if auto_capture_manager and auto_capture_manager.is_running():
        raise HTTPException(status_code=400, detail="La captura automática ya está en ejecución.")
    
    db = get_database()
    auto_capture_manager = AutoCaptureManager(CAMERAS_CONFIG, db, UPLOAD_DIR, manager) 
    auto_capture_task = asyncio.create_task(auto_capture_manager.start_system())
    return {"message": "Sistema de captura automática iniciado."}

@app.post("/auto-capture/stop")
async def stop_auto_capture():
    global auto_capture_manager, auto_capture_task
    if not auto_capture_manager or not auto_capture_manager.is_running():
        raise HTTPException(status_code=400, detail="La captura automática no está en ejecución.")
    
    await auto_capture_manager.stop_system()
    auto_capture_manager = None
    auto_capture_task = None
    return {"message": "Sistema de captura automática detenido."}

@app.get("/auto-capture/status")
async def auto_capture_status():
    global auto_capture_manager
    if auto_capture_manager and auto_capture_manager.is_running():
        return {"status": "running", "details": auto_capture_manager.get_status()}
    return {"status": "stopped"}


# WebSocket endpoint for real-time detections
@app.websocket("/ws/detections")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text() 
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        print(f"Client {websocket.client} disconnected from WebSocket.")
    except Exception as e:
        print(f"Error en WebSocket: {e}")
        manager.disconnect(websocket)


# --- ENDPOINTS DE INFORMACIÓN Y UTILIDADES ---

@app.get("/model/info",
    summary="Información del modelo",
    description="Obtiene información detallada del modelo YOLOv8 NumerosCalados en uso.")
async def get_model_info():
    if hasattr(processor, 'get_model_details') and callable(processor.get_model_details):
        return processor.get_model_details()
    elif hasattr(processor, 'model_name'): 
        return {"model_name": processor.model_name, "description": "Modelo YOLOv8 para detección."}
    return {"message": "Información del modelo no disponible."}

# Añadir el bloque para ejecutar con 'python main.py'
if __name__ == "__main__":
    import uvicorn
    # Usar string de importación para que el reload funcione correctamente
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)
