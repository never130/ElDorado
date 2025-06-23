#!/usr/bin/env python3
"""
Script para verificar el historial en la base de datos local antes de limpiar
"""

import pymongo
from datetime import datetime

def conectar_mongo_local():
    """Conectar a MongoDB local"""
    try:
        # Configuración para MongoDB local
        client = pymongo.MongoClient(
            host="localhost",
            port=27017,
            username="ever_1",
            password="cOwqkAk0Qdb2z2vE",
            authSource="admin"
        )
        
        # Verificar conexión
        client.admin.command('ping')
        print("✅ Conexión exitosa a MongoDB local")
        
        return client
    except Exception as e:
        print(f"❌ Error conectando a MongoDB local: {e}")
        return None

def verificar_historial():
    """Verificar registros en la base de datos local"""
    client = conectar_mongo_local()
    if not client:
        return
    
    try:
        db = client["el_dorado"]
        collection = db["vagonetas"]
        
        # Contar total de registros
        total_registros = collection.count_documents({})
        print(f"\n📊 Total de registros en base local: {total_registros}")
        
        if total_registros > 0:
            # Mostrar algunos registros de ejemplo
            print("\n📋 Primeros 5 registros:")
            for i, doc in enumerate(collection.find().limit(5)):
                print(f"  {i+1}. ID: {doc.get('_id')}")
                print(f"     Número: {doc.get('numero_detectado', 'N/A')}")
                print(f"     Fecha: {doc.get('fecha_deteccion', 'N/A')}")
                print(f"     Origen: {doc.get('origen', 'N/A')}")
                print()
            
            # Mostrar últimos registros
            print("📋 Últimos 3 registros:")
            for i, doc in enumerate(collection.find().sort("_id", -1).limit(3)):
                print(f"  {i+1}. ID: {doc.get('_id')}")
                print(f"     Número: {doc.get('numero_detectado', 'N/A')}")
                print(f"     Fecha: {doc.get('fecha_deteccion', 'N/A')}")
                print(f"     Origen: {doc.get('origen', 'N/A')}")
                print()
        else:
            print("✅ No hay registros en la base de datos local")
            
    except Exception as e:
        print(f"❌ Error verificando historial: {e}")
    finally:
        client.close()

if __name__ == "__main__":
    print("🔍 Verificando historial en base de datos local...")
    verificar_historial()
