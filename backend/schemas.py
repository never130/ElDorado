from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone

class VagonetaBase(BaseModel):
    """Modelo base para registros de vagonetas"""
    numero: Optional[str] = Field(None, description="Número identificador de la vagoneta")
    confianza: Optional[float] = Field(None, description="Confianza de la detección de la placa", ge=0.0, le=1.0)
    imagen_path: str = Field(..., description="Ruta de la imagen almacenada")
    timestamp: datetime = Field(default_factory=lambda: datetime.now(timezone.utc), description="Fecha y hora del evento")
    tunel: Optional[str] = Field(None, description="Identificador del túnel")
    evento: str = Field(..., description="Tipo de evento: 'ingreso' o 'egreso'")
    modelo_ladrillo: Optional[str] = Field(None, description="Modelo de ladrillo detectado o ingresado")
    merma: Optional[float] = Field(None, description="Porcentaje de merma/fisuración", ge=0, le=100)
    estado: str = Field(default="activo", description="Estado del registro: activo, anulado, etc")
    origen_deteccion: Optional[str] = Field(None, description="Origen de la detección: video_processing, camera_capture, manual")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadatos adicionales (temperatura, humedad, etc)")

class VagonetaCreate(VagonetaBase):
    # Se hereda todo de VagonetaBase
    pass

class VagonetaInDB(VagonetaBase):
    id: str = Field(..., alias="_id")

# Added for Historial page
class RegistroHistorialDisplay(BaseModel):
    id: str
    timestamp: datetime
    numero_detectado: str
    confianza: Optional[float] = None
    origen_deteccion: str # 'video', 'imagen', 'manual'
    evento: Optional[str] = None
    tunel: Optional[str] = None
    merma: Optional[str] = None # Assuming merma can be a string like "10%" or a numeric value. Adjust if it's strictly numeric.
    imagen_path: Optional[str] = None  # Ruta de la imagen
    url_video_frame: Optional[str] = None
    ruta_video_original: Optional[str] = None

    class Config:
        from_attributes = True # Replaced orm_mode with from_attributes
        # If your IDs are ObjectIds from MongoDB, you might need this for proper conversion:
        # json_encoders = {
        #     ObjectId: str
        # }

class HistorialResponse(BaseModel):
    registros: List[RegistroHistorialDisplay]
    total: int
    skip: int
    limit: int
    has_more: bool
