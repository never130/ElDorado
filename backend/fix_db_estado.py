#!/usr/bin/env python3
# Script para actualizar registros existentes con estado=activo

from database import get_database

def main():
    try:
        db = get_database()
        
        # Actualizar todos los registros que no tienen estado o tienen estado=None
        result = db.vagonetas.update_many(
            {"$or": [{"estado": {"$exists": False}}, {"estado": None}]},
            {"$set": {"estado": "activo"}}
        )
        
        print(f"Actualizados {result.modified_count} registros con estado='activo'")
        
        # Verificar el resultado
        active_count = db.vagonetas.count_documents({"estado": "activo"})
        total_count = db.vagonetas.count_documents({})
        
        print(f"Total de registros: {total_count}")
        print(f"Registros activos: {active_count}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
