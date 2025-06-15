#!/usr/bin/env python3
# Script para verificar el estado de la base de datos

from database import get_database
from datetime import datetime

def main():
    try:
        db = get_database()
        total_docs = db.vagonetas.count_documents({})
        active_docs = db.vagonetas.count_documents({"estado": "activo"})
        
        print(f"Total registros en vagonetas: {total_docs}")
        print(f"Registros activos: {active_docs}")
        print("\nÚltimos 5 registros:")
        
        for i, doc in enumerate(db.vagonetas.find().sort("timestamp", -1).limit(5), 1):
            numero = doc.get("numero", "N/A")
            timestamp = doc.get("timestamp", "N/A")
            estado = doc.get("estado", "N/A")
            evento = doc.get("evento", "N/A")
            origen = doc.get("origen_deteccion", "N/A")
            print(f"{i}. Nº{numero} | {timestamp} | Estado: {estado} | Evento: {evento} | Origen: {origen}")
            
        print("\nRegistros de hoy:")
        today = datetime.now().replace(hour=0, minute=0, second=0, microsecond=0)
        today_docs = list(db.vagonetas.find({"timestamp": {"$gte": today}}).sort("timestamp", -1))
        print(f"Encontrados {len(today_docs)} registros de hoy")
        
        for doc in today_docs[:3]:
            numero = doc.get("numero", "N/A")
            timestamp = doc.get("timestamp", "N/A")
            origen = doc.get("origen_deteccion", "N/A")
            print(f"- Nº{numero} | {timestamp} | Origen: {origen}")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
