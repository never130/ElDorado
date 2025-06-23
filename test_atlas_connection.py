#!/usr/bin/env python3
"""
Script para probar la conexión a MongoDB Atlas
"""

import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

try:
    from database import connect_to_mongo, get_database
    
    print("🔍 Probando conexión a MongoDB Atlas...")
    
    # Conectar a MongoDB
    connect_to_mongo()
    
    # Obtener base de datos
    db = get_database()
    
    print(f"✅ Conexión exitosa!")
    print(f"📊 Base de datos: {db.name}")
    print(f"📋 Colecciones disponibles: {db.list_collection_names()}")
    
    # Verificar colección vagonetas
    if 'vagonetas' in db.list_collection_names():
        print(f"✅ Colección 'vagonetas' encontrada")
        
        # Contar documentos
        count = db.vagonetas.count_documents({})
        print(f"📊 Documentos en vagonetas: {count}")
        
    else:
        print(f"⚠️ Colección 'vagonetas' no encontrada")
        print(f"🔧 Se creará automáticamente al insertar el primer documento")
    
except Exception as e:
    print(f"❌ Error de conexión: {e}")
    import traceback
    traceback.print_exc()
