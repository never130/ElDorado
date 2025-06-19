#!/usr/bin/env python3
# Script para corregir registros con confianza > 1.0

from database import get_database

def main():
    try:
        db = get_database()
        
        # Corregir registros con confianza > 1.0
        result = db.vagonetas.update_many(
            {"confianza": {"$gt": 1.0}},
            {"$set": {"confianza": 1.0}}
        )
        
        print(f"Corregidos {result.modified_count} registros con confianza > 1.0")
        
        # Verificar que no queden registros problemáticos
        problematic = db.vagonetas.count_documents({"confianza": {"$gt": 1.0}})
        print(f"Registros restantes con confianza > 1.0: {problematic}")
        
        # Mostrar estadísticas actualizadas
        pipeline = [
            {"$group": {"_id": "$confianza", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        
        print("\nValores únicos de confianza después de la corrección:")
        for result in db.vagonetas.aggregate(pipeline):
            confianza = result["_id"]
            count = result["count"]
            if confianza is not None:
                print(f"Confianza: {confianza} -> {count} registros")
            else:
                print(f"Confianza: None -> {count} registros")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
