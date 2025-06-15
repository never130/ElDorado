import cv2
import time
from datetime import datetime
from typing import Optional, Dict, Any
import asyncio
from .image_processing import process_image  # Changed from process_frame
from crud import create_vagoneta_record  # Changed from ..crud
from schemas import VagonetaCreate

class CameraCapture:
    def __init__(self, camera_id: str, camera_url: str, evento: str, tunel: str):
        """
        Inicializa la captura de cámara.
        Args:
            camera_id: Identificador único de la cámara
            camera_url: URL de la cámara (rtsp://, http://) o índice (0, 1, etc.)
            evento: 'ingreso' o 'egreso'
            tunel: Identificador del túnel
        """
        self.camera_id = camera_id
        self.camera_url = camera_url
        self.evento = evento
        self.tunel = tunel
        self.is_running = False
        self.cap = None
        self.last_detection_time = 0
        self.detection_cooldown = 5  # segundos entre detecciones

    async def start(self):
        """Inicia la captura en un bucle asíncrono"""
        self.is_running = True
        self.cap = cv2.VideoCapture(self.camera_url)
        
        while self.is_running:
            ret, frame = self.cap.read()
            if not ret:
                print(f"Error leyendo frame de cámara {self.camera_id}")
                await asyncio.sleep(1)
                continue

            # Solo procesa si pasó el tiempo de cooldown
            current_time = time.time()
            if current_time - self.last_detection_time < self.detection_cooldown:
                await asyncio.sleep(0.1)
                continue

            # Procesa el frame
            detection = process_image(frame)
            if detection and detection.get('numero'):
                self.last_detection_time = current_time
                await self._handle_detection(detection, frame)

            await asyncio.sleep(0.1)  # Evita consumo excesivo de CPU

    async def stop(self):
        """Detiene la captura"""
        self.is_running = False
        if self.cap:
            self.cap.release()

    async def _handle_detection(self, detection: Dict[str, Any], frame: Any):
        """Maneja una detección exitosa"""
        # Guarda la imagen
        timestamp = datetime.now()
        image_filename = f"{detection['numero']}_{timestamp.strftime('%Y%m%d_%H%M%S')}.jpg"
        image_path = f"uploads/{image_filename}"
        cv2.imwrite(image_path, frame)        # Crea el registro en MongoDB
        record = VagonetaCreate(
            numero=detection['numero'],
            evento=self.evento,
            tunel=self.tunel,
            timestamp=timestamp,
            modelo_ladrillo=detection.get('modelo_ladrillo', None),
            imagen_path=image_path,
            origen_deteccion="camera_capture"
        )
        create_vagoneta_record(record)
        print(f"Detección guardada: Vagoneta {detection['numero']} en {self.evento}")

# Ejemplo de uso:
"""
camera = CameraCapture(
    camera_id="cam1",
    camera_url="rtsp://camera1.local:554/stream1",
    evento="ingreso",
    tunel="Tunel 1"
)
await camera.start()
"""
