import asyncio
from database import get_vagonetas_collection
from bson import ObjectId

async def check_latest():
    collection = await get_vagonetas_collection()
    
    # Buscar el registro específico por ID (convertir string a ObjectId)
    try:
        specific_record = await collection.find_one({'_id': ObjectId('68643ec9073b8224f1c6cc2c')})
        print('=== Registro específico ===')
        if specific_record:
            print(f'ID: {specific_record.get("_id")}')
            print(f'Número: {specific_record.get("numero")}')
            print(f'Timestamp: {specific_record.get("timestamp")}')
            print(f'Origen: {specific_record.get("origen_deteccion")}')
            print(f'Confianza: {specific_record.get("confianza")}')
        else:
            print('❌ Registro NO encontrado por ID')
    except Exception as e:
        print(f'Error buscando por ID: {e}')

    # Buscar los últimos 5 registros  
    print('\n=== Últimos 5 registros ===')
    latest = await collection.find().sort('timestamp', -1).limit(5).to_list(length=5)
    for i, record in enumerate(latest, 1):
        print(f'{i}. ID: {record.get("_id")}, N°: {record.get("numero")}, Timestamp: {record.get("timestamp")}, Origen: {record.get("origen_deteccion")}')

    # Contar total de registros       
    total = await collection.count_documents({})
    print(f'\n=== Total de registros en la colección: {total} ===')

if __name__ == "__main__":
    asyncio.run(check_latest())
