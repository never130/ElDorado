from database import get_database
from schemas import VagonetaCreate
from datetime import datetime, timedelta, timezone
from typing import List, Optional, Dict, Any, Tuple
from bson import ObjectId
from motor.motor_asyncio import AsyncIOMotorDatabase

# Funciones CRUD asíncronas optimizadas

async def create_vagoneta_record(data: VagonetaCreate) -> str:
    db = await get_database()
    doc = data.dict()
    result = await db.vagonetas.insert_one(doc)
    return str(result.inserted_id)

async def get_vagonetas_historial(
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
    db = await get_database()
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
    return await cursor.to_list(length=limit)

async def get_vagonetas_historial_with_filters(
    db, # AsyncIOMotorDatabase - Type hint for clarity
    skip: int = 0, 
    limit: int = 100,
    sort_by: Optional[str] = "timestamp",
    sort_order: Optional[int] = -1,
    filtro: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None
) -> Tuple[List[Dict[str, Any]], int]:
    query: Dict[str, Any] = {}

    if filtro:
        # Case-insensitive regex search across multiple fields
        regex_query = {"$regex": filtro, "$options": "i"}
        query["$or"] = [
            {"numero": regex_query},
            {"evento": regex_query},
            {"tunel": regex_query},
            {"modelo_ladrillo": regex_query}
        ]

    if fecha_inicio and fecha_fin:
        query["timestamp"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["timestamp"] = {"$gte": fecha_inicio}
    elif fecha_fin:
        query["timestamp"] = {"$lte": fecha_fin}

    # Get total count before pagination
    total_registros = await db.vagonetas.count_documents(query)

    # Get paginated and sorted results
    cursor = db.vagonetas.find(query).sort(sort_by, sort_order).skip(skip).limit(limit)
    
    # Convert cursor to list asynchronously
    registros = await cursor.to_list(length=limit)
    
    return registros, total_registros

async def get_trayectoria_completa(numero: str) -> List[Dict[str, Any]]:
    db = await get_database()
    cursor = db.vagonetas.find({"numero": numero, "estado": "activo"}).sort("timestamp", 1)
    return await cursor.to_list(length=None)

async def get_estadisticas_vagoneta(numero: str) -> Dict[str, Any]:
    db = await get_database()
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
    result = await db.vagonetas.aggregate(pipeline).to_list(length=1)
    return result[0] if result else None

async def anular_registro(id: str) -> bool:
    db = await get_database()
    result = await db.vagonetas.update_one(
        {"_id": ObjectId(id)},
        {"$set": {
            "estado": "anulado",
            "anulado_en": datetime.now(timezone.utc)
        }}
    )
    return result.modified_count > 0

async def buscar_vagonetas(
    texto: str,
    skip: int = 0,
    limit: int = 20
) -> List[Dict[str, Any]]:
    db = await get_database()
    cursor = db.vagonetas.find(
        {"$text": {"$search": texto}, "estado": "activo"},
        {"score": {"$meta": "textScore"}}
    ) \
    .sort([("score", {"$meta": "textScore"})]) \
    .skip(skip) \
    .limit(limit)
    
    return await cursor.to_list(length=limit)

async def actualizar_registro(
    id: str,
    data: Dict[str, Any]
) -> bool:
    db = await get_database()
    no_update = ["_id", "timestamp", "imagen_path"]
    update_data = {k:v for k,v in data.items() if k not in no_update}
    
    result = await db.vagonetas.update_one(
        {"_id": ObjectId(id)},
        {"$set": update_data}
    )
    return result.modified_count > 0

async def get_vagonetas_historial_count(
    filtro: Optional[str] = None,
    fecha_inicio: Optional[datetime] = None,
    fecha_fin: Optional[datetime] = None
) -> int:
    db = await get_database()
    query: Dict[str, Any] = {"estado": "activo"}  # Match the query used in get_vagonetas_historial
    
    if filtro:
        # Search in numero field to match existing data structure
        query["$or"] = [
            {"numero": {"$regex": filtro, "$options": "i"}},
            {"evento": {"$regex": filtro, "$options": "i"}},
            {"tunel": {"$regex": filtro, "$options": "i"}}
        ]

    if fecha_inicio and fecha_fin:
        query["timestamp"] = {"$gte": fecha_inicio, "$lte": fecha_fin}
    elif fecha_inicio:
        query["timestamp"] = {"$gte": fecha_inicio}
    elif fecha_fin:
        query["timestamp"] = {"$lte": fecha_fin}

    count = await db.vagonetas.count_documents(query)
    return count
