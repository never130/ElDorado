#!/usr/bin/env python3
# Script para actualizar registros con origen_deteccion

from database import get_database

def main():
    try:
        db = get_database()
        
        # Actualizar registros que no tienen origen_deteccion
        result = db.vagonetas.update_many(
            {"$or": [{"origen_deteccion": {"$exists": False}}, {"origen_deteccion": None}]},
            {"$set": {"origen_deteccion": "historico"}}
        )
        
        print(f"Actualizados {result.modified_count} registros con origen_deteccion='historico'")
        
        # Verificar el resultado
        historicos = db.vagonetas.count_documents({"origen_deteccion": "historico"})
        total = db.vagonetas.count_documents({})
        
        print(f"Total de registros: {total}")
        print(f"Registros históricos: {historicos}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
