from database import get_database
from schemas import VagonetaCreate
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any
from bson import ObjectId

# Funciones CRUD optimizadas

def create_vagoneta_record(data: VagonetaCreate) -> str:
    db = get_database()
    doc = data.dict()
    result = db.vagonetas.insert_one(doc)  # MODIFIED: Removed await
    return str(result.inserted_id)

def get_vagonetas_historial(
    skip: int = 0, 
    limit: int = 50, 
    numero: Optional[str] = None,
    fecha: Optional[str] = None,
    tunel: Optional[str] = None,
    modelo: Optional[str] = None,
    evento: Optional[str] = None,
    merma_min: Optional[float] = None,
    merma_max: Optional[float] = None
) -> List[Dict[str, Any]]:
    db = get_database()
    query = {"estado": "activo"}
    if numero:
        query["numero"] = numero
    if fecha:
        start = datetime.strptime(fecha, "%Y-%m-%d")
        end = start + timedelta(days=1)
        query["timestamp"] = {"$gte": start, "$lt": end}
    if tunel:
        query["tunel"] = tunel
    if modelo:
        query["modelo_ladrillo"] = modelo
    if evento:
        query["evento"] = evento
    if merma_min is not None or merma_max is not None:
        query["merma"] = {}
        if merma_min is not None:
            query["merma"]["$gte"] = merma_min
        if merma_max is not None:
            query["merma"]["$lte"] = merma_max
    cursor = db.vagonetas.find(query).sort("timestamp", -1).skip(skip).limit(limit)
    return list(cursor)

def get_trayectoria_completa(numero: str) -> List[Dict[str, Any]]:
    db = get_database()
    return list(db.vagonetas.find({"numero": numero, "estado": "activo"}).sort("timestamp", 1))

def get_estadisticas_vagoneta(numero: str) -> Dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$match": {"numero": numero, "estado": "activo"}},
        {"$group": {
            "_id": None,
            "total_eventos": {"$sum": 1},
            "primera_vez": {"$min": "$timestamp"},
            "ultima_vez": {"$max": "$timestamp"},
            "merma_promedio": {"$avg": "$merma"},
            "tuneles": {"$addToSet": "$tunel"},
            "modelos": {"$addToSet": "$modelo_ladrillo"}
        }}
    ]
    result = db.vagonetas.aggregate(pipeline).to_list(1)
    return result[0] if result else None

def anular_registro(id: str) -> bool:
    db = get_database()
    result = db.vagonetas.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "estado": "anulado",
            "anulado_en": datetime.utcnow()
        }}
    )
    return result.modified_count > 0

def buscar_vagonetas(
    texto: str,
    skip: int = 0,
    limit: int = 20
) -> List[Dict[str, Any]]:
    db = get_database()
    cursor = db.vagonetas.find(
        {"$text": {"$search": texto}, "estado": "activo"},
        {"score": {"$meta": "textScore"}}
    ) \
    .sort([("score", {"$meta": "textScore"})]) \
    .skip(skip) \
    .limit(limit)
    
    return [doc for doc in cursor] # Cambiado a comprensión síncrona

def actualizar_registro(
    id: str,
    data: Dict[str, Any]
) -> bool:
    db = get_database()
    no_update = ["_id", "timestamp", "imagen_path"]
    update_data = {k:v for k,v in data.items() if k not in no_update}
    
    result = db.vagonetas.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    return result.modified_count > 0

async def get_vagonetas_historial_count(
    db: Any, # Should be AsyncIOMotorDatabase, but using Any for broader compatibility if get_database() changes
    filtro: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None
) -> int:
    query: Dict[str, Any] = {}
    if filtro:
        # Assuming 'filtro' searches in 'numero_detectado' or other relevant text fields
        # This might need to be adjusted based on how 'filtro' is intended to work (e.g., regex, specific fields)
        query["$or"] = [
            {"numero_detectado": {"$regex": filtro, "$options": "i"}},
            {"evento": {"$regex": filtro, "$options": "i"}},
            {"tunel": {"$regex": filtro, "$options": "i"}}
        ]

    if fecha_inicio and fecha_fin:
        query["timestamp"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["timestamp"] = {"$gte": fecha_inicio}
    elif fecha_fin:
        query["timestamp"] = {"$lte": fecha_fin}
    
    # Add any other fixed query parameters if necessary, e.g., {"estado": "activo"}
    # query["estado"] = "activo" # Uncomment if you only want active records

    count = await db.vagonetas.count_documents(query)
    return count
