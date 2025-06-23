#!/usr/bin/env python3
"""
Script para limpiar el historial de la base de datos LOCAL de MongoDB
ADVERTENCIA: Esto eliminará TODOS los registros de la colección 'vagonetas' LOCAL
"""

import sys
import os
from datetime import datetime

# Configuración para conectar a MongoDB LOCAL (no Atlas)
LOCAL_MONGO_CONFIG = {
    'host': 'localhost',
    'port': 27017,
    'db_name': 'el_dorado'
}

try:
    from pymongo import MongoClient
    print("✅ PyMongo importado correctamente")
except ImportError:
    print("❌ Error: PyMongo no está instalado")
    print("   Ejecuta: pip install pymongo")
    sys.exit(1)

def conectar_mongo_local():
    """Conectar específicamente a MongoDB LOCAL"""
    try:
        # Conectar sin autenticación a MongoDB local
        client = MongoClient(
            host=LOCAL_MONGO_CONFIG['host'],
            port=LOCAL_MONGO_CONFIG['port']
        )
        
        # Probar la conexión
        client.admin.command('ping')
        db = client[LOCAL_MONGO_CONFIG['db_name']]
        
        print(f"✅ Conectado a MongoDB LOCAL:")
        print(f"   - Host: {LOCAL_MONGO_CONFIG['host']}:{LOCAL_MONGO_CONFIG['port']}")
        print(f"   - Base de datos: {LOCAL_MONGO_CONFIG['db_name']}")
        
        return client, db
        
    except Exception as e:
        print(f"❌ Error conectando a MongoDB LOCAL: {e}")
        return None, None

def verificar_coleccion(db):
    """Verificar la colección vagonetas y contar registros"""
    try:
        colecciones = db.list_collection_names()
        print(f"📊 Colecciones disponibles: {colecciones}")
        
        if 'vagonetas' not in colecciones:
            print("⚠️ La colección 'vagonetas' no existe en MongoDB LOCAL")
            return 0
        
        count = db.vagonetas.count_documents({})
        print(f"📋 Registros encontrados en 'vagonetas': {count}")
        
        if count > 0:
            # Mostrar algunos registros como muestra
            sample = list(db.vagonetas.find({}).limit(3))
            print("\n🔍 Muestra de registros:")
            for i, reg in enumerate(sample):
                numero = reg.get('numero', 'N/A')
                timestamp = reg.get('timestamp', 'N/A')
                origen = reg.get('origen_deteccion', 'N/A')
                print(f"   {i+1}. N°{numero} | {origen} | {timestamp}")
        
        return count
        
    except Exception as e:
        print(f"❌ Error verificando colección: {e}")
        return 0

def limpiar_historial(db):
    """Eliminar todos los registros de la colección vagonetas"""
    try:
        print("\n🗑️ Iniciando limpieza del historial...")
        
        # Eliminar todos los documentos
        result = db.vagonetas.delete_many({})
        
        print(f"✅ Limpieza completada:")
        print(f"   - Registros eliminados: {result.deleted_count}")
        print(f"   - Timestamp: {datetime.now()}")
        
        # Verificar que esté vacío
        remaining = db.vagonetas.count_documents({})
        if remaining == 0:
            print("✅ Colección 'vagonetas' completamente vacía")
        else:
            print(f"⚠️ Quedan {remaining} registros (posible error)")
        
        return result.deleted_count
        
    except Exception as e:
        print(f"❌ Error durante la limpieza: {e}")
        return 0

def main():
    print("🗑️ LIMPIEZA DEL HISTORIAL - MONGODB LOCAL")
    print("=" * 50)
    print("⚠️ ADVERTENCIA: Esto eliminará TODOS los registros")
    print("   de la colección 'vagonetas' en MongoDB LOCAL")
    print("   (NO afectará a MongoDB Atlas)")
    print("=" * 50)
    
    # 1. Conectar a MongoDB local
    print("\n1. Conectando a MongoDB LOCAL...")
    client, db = conectar_mongo_local()
    
    if client is None or db is None:
        print("❌ No se pudo conectar a MongoDB LOCAL")
        return
    
    # 2. Verificar colección y registros
    print("\n2. Verificando registros existentes...")
    total_registros = verificar_coleccion(db)
    
    if total_registros == 0:
        print("ℹ️ No hay registros para eliminar")
        client.close()
        return
    
    # 3. Confirmar limpieza
    print(f"\n⚠️ Se van a eliminar {total_registros} registros")
    confirmacion = input("¿Estás seguro? Escribe 'CONFIRMAR' para continuar: ")
    
    if confirmacion.upper() != 'CONFIRMAR':
        print("❌ Operación cancelada por el usuario")
        client.close()
        return
    
    # 4. Limpiar historial
    print("\n3. Eliminando registros...")
    eliminados = limpiar_historial(db)
    
    # 5. Cerrar conexión
    client.close()
    
    print("\n" + "=" * 50)
    print("📋 RESUMEN DE LIMPIEZA:")
    print(f"✅ Registros eliminados: {eliminados}")
    print(f"🗄️ Base de datos: MongoDB LOCAL ({LOCAL_MONGO_CONFIG['host']})")
    print(f"📁 Colección: vagonetas")
    print("✅ Operación completada exitosamente")

if __name__ == "__main__":
    main()
