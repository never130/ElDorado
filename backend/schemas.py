from pydantic import BaseModel, Field
from typing import Optional, Dict, Any
from datetime import datetime

class VagonetaBase(BaseModel):
    """Modelo base para registros de vagonetas"""
    numero: Optional[str] = Field(None, description="Número identificador de la vagoneta")
    confianza: Optional[float] = Field(None, description="Confianza de la detección de la placa") # Added field
    imagen_path: str = Field(..., description="Ruta de la imagen almacenada")
    timestamp: datetime = Field(default_factory=datetime.utcnow, description="Fecha y hora del evento")
    tunel: Optional[str] = Field(None, description="Identificador del túnel")
    evento: str = Field(..., description="Tipo de evento: 'ingreso' o 'egreso'")
    modelo_ladrillo: Optional[str] = Field(None, description="Modelo de ladrillo detectado o ingresado")
    merma: Optional[float] = Field(None, description="Porcentaje de merma/fisuración", ge=0, le=100)
    estado: Optional[str] = Field(None, description="Estado del registro: activo, anulado, etc")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Metadatos adicionales (temperatura, humedad, etc)")

class VagonetaCreate(VagonetaBase):
    # Se hereda todo de VagonetaBase
    pass

class VagonetaInDB(VagonetaBase):
    id: str = Field(..., alias="_id")
