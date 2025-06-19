#!/usr/bin/env python3
# Script para verificar problemas con la confianza

from database import get_database

def main():
    try:
        db = get_database()
        
        # Buscar registros con confianza > 1.0
        problematic = list(db.vagonetas.find({"confianza": {"$gt": 1.0}}))
        print(f"Registros con confianza > 1.0: {len(problematic)}")
        
        for doc in problematic:
            print(f"ID: {doc.get('_id')}, Número: {doc.get('numero')}, Confianza: {doc.get('confianza')}")
            
        # Ver todos los valores de confianza únicos
        pipeline = [
            {"$group": {"_id": "$confianza", "count": {"$sum": 1}}},
            {"$sort": {"_id": 1}}
        ]
        
        print("\nValores únicos de confianza:")
        for result in db.vagonetas.aggregate(pipeline):
            confianza = result["_id"]
            count = result["count"]
            if confianza is not None:
                print(f"Confianza: {confianza} -> {count} registros")
            else:
                print(f"Confianza: None -> {count} registros")
                
        # Verificar registros sin confianza
        sin_confianza = db.vagonetas.count_documents({"confianza": None})
        print(f"\nRegistros sin confianza: {sin_confianza}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
