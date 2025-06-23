#!/usr/bin/env python3
"""
Script de verificación completa de la base de datos MongoDB.
Verifica la conexión, los registros existentes, y simula el guardado
de detecciones desde el monitor en tiempo real.
"""

import os
import sys
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import json

# Agregar el directorio backend al path
backend_dir = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_dir)

# Cargar variables de entorno del archivo .env
from dotenv import load_dotenv
load_dotenv(os.path.join(backend_dir, '.env'))

try:
    from database import connect_to_mongo, get_vagonetas_collection, close_mongo_connection, get_database
    from crud import create_vagoneta_record, get_vagonetas_stats, get_recent_vagonetas
    from schemas import VagonetaCreate
    print("✅ Módulos de base de datos importados correctamente")
except ImportError as e:
    print(f"❌ Error al importar módulos de BD: {e}")
    sys.exit(1)

def verificar_conexion_mongodb():
    """Verifica la conexión básica a MongoDB"""
    print("\n🔍 Verificando conexión a MongoDB...")
    
    try:
        # Intentar conectar
        connect_to_mongo()
        db = get_database()
        
        if db is None:
            print("❌ Error: No se pudo obtener la base de datos")
            return False
        
        # Probar comando ping
        result = db.client.admin.command('ping')
        print(f"✅ Conexión exitosa a MongoDB")
        print(f"   - Host: {os.getenv('MONGO_HOST', 'localhost')}")
        print(f"   - Puerto: {os.getenv('MONGO_PORT', 27017)}")
        print(f"   - Base de datos: {os.getenv('MONGO_DB_NAME', 'el_dorado')}")
        print(f"   - Usuario: {os.getenv('MONGO_USER', 'sin_autenticacion')}")
        print(f"   - Ping response: {result}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error de conexión a MongoDB: {e}")
        return False

def verificar_coleccion_vagonetas():
    """Verifica la colección de vagonetas y sus índices"""
    print("\n📊 Verificando colección 'vagonetas'...")
    
    try:
        db = get_database()
        collection = get_vagonetas_collection()
        
        # Verificar si la colección existe
        collections = db.list_collection_names()
        if 'vagonetas' not in collections:
            print("⚠️  La colección 'vagonetas' no existe aún")
            print("   Se creará automáticamente con el primer registro")
            return True
        
        # Contar documentos
        total_docs = collection.count_documents({})
        print(f"✅ Colección 'vagonetas' encontrada")
        print(f"   - Total de documentos: {total_docs}")
        
        # Verificar índices
        indexes = list(collection.list_indexes())
        print(f"   - Índices existentes: {len(indexes)}")
        for idx in indexes:
            print(f"     * {idx.get('name', 'sin_nombre')}: {idx.get('key', {})}")
        
        # Verificar estructura de documentos (muestra de los últimos 3)
        if total_docs > 0:
            print("\n📄 Muestra de documentos recientes:")
            recent_docs = list(collection.find().sort("timestamp", -1).limit(3))
            for i, doc in enumerate(recent_docs, 1):
                print(f"   Documento {i}:")
                print(f"     - ID: {doc.get('_id')}")
                print(f"     - Número: {doc.get('numero')}")
                print(f"     - Evento: {doc.get('evento')}")
                print(f"     - Origen: {doc.get('origen')}")
                print(f"     - Timestamp: {doc.get('timestamp')}")
                print(f"     - Modelo ladrillo: {doc.get('modelo_ladrillo')}")
        
        return True
        
    except Exception as e:
        print(f"❌ Error al verificar colección: {e}")
        return False

def analizar_registros_por_origen():
    """Analiza los registros separados por origen (live_camera vs upload)"""
    print("\n📈 Analizando registros por origen...")
    
    try:
        collection = get_vagonetas_collection()
        
        # Contar por origen
        pipeline = [
            {"$group": {
                "_id": "$origen",
                "count": {"$sum": 1},
                "ultimo_registro": {"$max": "$timestamp"}
            }},
            {"$sort": {"count": -1}}
        ]
        
        origen_stats = list(collection.aggregate(pipeline))
        
        if not origen_stats:
            print("⚠️  No hay registros en la base de datos")
            return
        
        print("📊 Estadísticas por origen:")
        total_registros = 0
        for stat in origen_stats:
            origen = stat['_id'] or 'sin_origen'
            count = stat['count']
            ultimo = stat['ultimo_registro']
            total_registros += count
            
            print(f"   🔹 {origen}:")
            print(f"     - Cantidad: {count}")
            print(f"     - Último registro: {ultimo}")
            
            # Tiempo desde el último registro
            if ultimo:
                tiempo_transcurrido = datetime.now() - ultimo
                print(f"     - Hace: {tiempo_transcurrido}")
        
        print(f"\n📋 Total de registros: {total_registros}")
        
        # Verificar específicamente registros de live_camera
        live_camera_count = collection.count_documents({"origen": "live_camera"})
        upload_count = collection.count_documents({"origen": "upload"})
        
        print(f"\n🎯 Desglose específico:")
        print(f"   - Detecciones en vivo (live_camera): {live_camera_count}")
        print(f"   - Cargas de archivo (upload): {upload_count}")
        
        if live_camera_count == 0:
            print("❌ PROBLEMA: No hay registros de detección en vivo")
            print("   Esto indica que el monitor en tiempo real no está guardando datos")
        else:
            print("✅ Se encontraron registros de detección en vivo")
            
            # Mostrar los últimos registros de live_camera
            print("\n🔴 Últimos registros de cámara en vivo:")
            live_recent = list(collection.find({"origen": "live_camera"})
                             .sort("timestamp", -1).limit(5))
            
            for i, doc in enumerate(live_recent, 1):
                print(f"   {i}. {doc.get('timestamp')} - Número: {doc.get('numero')} - Ladrillo: {doc.get('modelo_ladrillo')}")
        
    except Exception as e:
        print(f"❌ Error al analizar registros: {e}")

def probar_crud_operations():
    """Prueba las operaciones CRUD básicas"""
    print("\n🧪 Probando operaciones CRUD...")
    
    try:
        # Crear un registro de prueba
        test_data = VagonetaCreate(
            numero=9999,
            evento="entrada",
            origen="test_verificacion",
            modelo_ladrillo="Test",
            confianza_numero=0.95,
            confianza_ladrillo=0.90,
            metadata_imagen={"test": True, "script": "verificar_base_datos.py"}
        )
        
        print("📝 Creando registro de prueba...")
        created_record = create_vagoneta_record(test_data)
        
        if created_record:
            print(f"✅ Registro de prueba creado exitosamente")
            print(f"   - ID: {created_record.get('_id')}")
            print(f"   - Número: {created_record.get('numero')}")
            
            # Verificar que se puede leer
            collection = get_vagonetas_collection()
            found_record = collection.find_one({"numero": 9999, "origen": "test_verificacion"})
            
            if found_record:
                print("✅ Registro de prueba encontrado en la BD")
                
                # Eliminar el registro de prueba
                delete_result = collection.delete_one({"_id": found_record["_id"]})
                if delete_result.deleted_count > 0:
                    print("✅ Registro de prueba eliminado correctamente")
                else:
                    print("⚠️  No se pudo eliminar el registro de prueba")
            else:
                print("❌ No se encontró el registro de prueba que se acabó de crear")
        else:
            print("❌ No se pudo crear el registro de prueba")
            
    except Exception as e:
        print(f"❌ Error en operaciones CRUD: {e}")
        import traceback
        traceback.print_exc()

def simular_deteccion_live_camera():
    """Simula una detección como lo haría el monitor en tiempo real"""
    print("\n🎬 Simulando detección del monitor en tiempo real...")
    
    try:
        # Simular datos como los que enviaría el monitor
        timestamp_actual = datetime.now()
        
        live_detection_data = VagonetaCreate(
            numero=1234,
            evento="entrada",
            origen="live_camera",
            modelo_ladrillo="Simulado",
            confianza_numero=0.75,
            confianza_ladrillo=0.80,
            metadata_imagen={
                "resolucion": "640x640",
                "fps": 15,
                "simulacion": True,
                "timestamp_deteccion": timestamp_actual.isoformat()
            }
        )
        
        print(f"📡 Simulando detección en vivo...")
        print(f"   - Número: {live_detection_data.numero}")
        print(f"   - Origen: {live_detection_data.origen}")
        print(f"   - Confianza número: {live_detection_data.confianza_numero}")
        
        # Crear el registro usando la misma función que usa el monitor
        created_record = create_vagoneta_record(live_detection_data)
        
        if created_record:
            print("✅ Simulación de detección en vivo guardada exitosamente")
            
            # Verificar que aparece en las consultas recientes
            collection = get_vagonetas_collection()
            recent_live = list(collection.find({"origen": "live_camera"})
                             .sort("timestamp", -1).limit(1))
            
            if recent_live and recent_live[0].get('numero') == 1234:
                print("✅ El registro simulado aparece en las consultas recientes")
                
                # Limpiar el registro simulado
                delete_result = collection.delete_one({"_id": created_record["_id"]})
                if delete_result.deleted_count > 0:
                    print("✅ Registro simulado eliminado")
            else:
                print("❌ El registro simulado no aparece en las consultas recientes")
        else:
            print("❌ No se pudo guardar la simulación de detección en vivo")
            
    except Exception as e:
        print(f"❌ Error en simulación de detección: {e}")
        import traceback
        traceback.print_exc()

def verificar_apis_crud():
    """Verifica las APIs de consulta que usa el frontend"""
    print("\n🌐 Verificando APIs de consulta...")
    
    try:
        # Probar get_recent_vagonetas (que usa el frontend)
        print("📋 Probando get_recent_vagonetas...")
        recent_records = get_recent_vagonetas(limit=10)
        
        if recent_records:
            print(f"✅ get_recent_vagonetas devuelve {len(recent_records)} registros")
            
            # Verificar que incluye registros de live_camera
            live_records = [r for r in recent_records if r.get('origen') == 'live_camera']
            upload_records = [r for r in recent_records if r.get('origen') == 'upload']
            
            print(f"   - Registros de live_camera: {len(live_records)}")
            print(f"   - Registros de upload: {len(upload_records)}")
            
            if len(live_records) == 0:
                print("⚠️  PROBLEMA: No hay registros recientes de live_camera")
                print("   El frontend no mostrará detecciones en vivo recientes")
        else:
            print("❌ get_recent_vagonetas no devuelve datos")
        
        # Probar get_vagonetas_stats
        print("\n📊 Probando get_vagonetas_stats...")
        stats = get_vagonetas_stats()
        
        if stats:
            print(f"✅ get_vagonetas_stats devuelve estadísticas")
            print(f"   - Total registros: {stats.get('total_registros', 0)}")
            print(f"   - Registros hoy: {stats.get('registros_hoy', 0)}")
            print(f"   - Número más frecuente: {stats.get('numero_mas_frecuente', 'N/A')}")
        else:
            print("❌ get_vagonetas_stats no devuelve datos")
            
    except Exception as e:
        print(f"❌ Error al verificar APIs: {e}")
        import traceback
        traceback.print_exc()

def verificar_configuracion_env():
    """Verifica la configuración del archivo .env"""
    print("\n⚙️  Verificando configuración de .env...")
    
    env_vars = [
        'MONGO_HOST', 'MONGO_PORT', 'MONGO_USER', 'MONGO_PASS', 
        'MONGO_DB_NAME', 'MONGO_AUTH_DB'
    ]
    
    for var in env_vars:
        value = os.getenv(var)
        if value:
            # Ocultar la contraseña por seguridad
            display_value = "***" if 'PASS' in var else value
            print(f"   ✅ {var}: {display_value}")
        else:
            print(f"   ⚠️  {var}: No configurado")
    
    # Verificar archivo .env existe
    env_file = os.path.join(backend_dir, '.env')
    if os.path.exists(env_file):
        print(f"   ✅ Archivo .env encontrado: {env_file}")
    else:
        print(f"   ❌ Archivo .env no encontrado: {env_file}")

def main():
    """Función principal de verificación"""
    print("🔍 VERIFICACIÓN COMPLETA DE BASE DE DATOS MONGODB")
    print("=" * 60)
    
    # 1. Verificar configuración
    verificar_configuracion_env()
    
    # 2. Verificar conexión básica
    if not verificar_conexion_mongodb():
        print("\n❌ FALLA CRÍTICA: No se puede conectar a MongoDB")
        print("Verifica que MongoDB esté corriendo y las credenciales sean correctas")
        return
    
    # 3. Verificar colección y estructura
    if not verificar_coleccion_vagonetas():
        print("\n❌ PROBLEMA: Error con la colección de vagonetas")
        return
    
    # 4. Analizar registros existentes
    analizar_registros_por_origen()
    
    # 5. Probar operaciones CRUD
    probar_crud_operations()
    
    # 6. Simular detección en vivo
    simular_deteccion_live_camera()
    
    # 7. Verificar APIs que usa el frontend
    verificar_apis_crud()
    
    print("\n" + "=" * 60)
    print("✅ VERIFICACIÓN COMPLETADA")
    print("\nRESUMEN:")
    print("- Si ves '❌ PROBLEMA: No hay registros de detección en vivo'")
    print("  significa que el monitor en tiempo real no está guardando datos")
    print("- Si ves errores de conexión, revisa la configuración de MongoDB")
    print("- Si las simulaciones funcionan, el problema está en el monitor real")
    
    # Cerrar conexión
    try:
        close_mongo_connection()
    except:
        pass

if __name__ == "__main__":
    main()
