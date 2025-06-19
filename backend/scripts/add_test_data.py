#!/usr/bin/env python3
# Script para agregar registros de prueba con confianza variada

from database import get_database
from datetime import datetime, timedelta
import random

def main():
    try:
        db = get_database()
        
        # Datos de prueba realistas
        numeros_vagonetas = ["01", "02", "03", "045", "067", "089", "123", "156"]
        eventos = ["ingreso", "egreso"]
        tuneles = ["Túnel A", "Túnel B", "Túnel C"]
        modelos_ladrillo = ["Tipo I", "Tipo II", "Tipo III", None]
        
        registros_prueba = []
        base_time = datetime.now() - timedelta(days=7)
        
        for i in range(15):  # Agregar 15 registros de prueba
            registro = {
                "numero": random.choice(numeros_vagonetas),
                "evento": random.choice(eventos),
                "tunel": random.choice(tuneles),
                "modelo_ladrillo": random.choice(modelos_ladrillo),
                "merma": round(random.uniform(0, 15), 1) if random.random() > 0.3 else None,
                "confianza": round(random.uniform(0.75, 0.98), 3),  # Confianza realista entre 75% y 98%
                "origen_deteccion": random.choice(["video_processing", "camera_capture"]),
                "estado": "activo",
                "timestamp": base_time + timedelta(hours=random.randint(1, 168)),  # Últimos 7 días
                "imagen_path": f"uploads/test_image_{i+1}.jpg",
                "metadata": {"temperatura": round(random.uniform(20, 35), 1)}
            }
            registros_prueba.append(registro)
        
        # Insertar registros
        result = db.vagonetas.insert_many(registros_prueba)
        print(f"Insertados {len(result.inserted_ids)} registros de prueba")
        
        # Mostrar estadísticas actualizadas
        total = db.vagonetas.count_documents({})
        activos = db.vagonetas.count_documents({"estado": "activo"})
        print(f"Total registros: {total}")
        print(f"Registros activos: {activos}")
        
        # Mostrar rango de confianza
        pipeline = [
            {"$match": {"confianza": {"$ne": None}}},
            {"$group": {
                "_id": None,
                "min_confianza": {"$min": "$confianza"},
                "max_confianza": {"$max": "$confianza"},
                "avg_confianza": {"$avg": "$confianza"}
            }}
        ]
        
        stats = list(db.vagonetas.aggregate(pipeline))
        if stats:
            s = stats[0]
            print(f"Confianza mín: {s['min_confianza']:.3f}")
            print(f"Confianza máx: {s['max_confianza']:.3f}")
            print(f"Confianza promedio: {s['avg_confianza']:.3f}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
