#!/usr/bin/env python3
"""
Script de verificación simple de la base de datos MongoDB
Verifica conexión, registros existentes y funcionamiento básico
"""

import sys
import os

# Agregar el directorio backend al path
backend_path = os.path.join(os.path.dirname(__file__), 'backend')
sys.path.insert(0, backend_path)

try:
    from database import get_database
    from crud import get_vagonetas_historial, create_vagoneta_record
    from schemas import VagonetaCreate
    from datetime import datetime, timezone
    print("✅ Módulos importados correctamente")
except Exception as e:
    print(f"❌ Error al importar módulos: {e}")
    sys.exit(1)

def verificar_conexion_db():
    """Verificar conexión a MongoDB"""
    try:
        db = get_database()
        # Intentar hacer una operación simple
        collections = db.list_collection_names()
        print(f"✅ Conexión a MongoDB exitosa")
        print(f"📊 Colecciones disponibles: {collections}")
        return True
    except Exception as e:
        print(f"❌ Error de conexión a MongoDB: {e}")
        return False

def verificar_registros_existentes():
    """Verificar registros existentes en la colección vagonetas"""
    try:
        # Obtener todos los registros recientes
        registros = get_vagonetas_historial(skip=0, limit=20)
        print(f"📋 Total de registros recientes: {len(registros)}")
          if registros:
            print("\n🔍 Últimos 5 registros:")
            for i, registro in enumerate(registros[:5]):
                origen_deteccion = registro.get('origen_deteccion', 'N/A')
                numero = registro.get('numero', 'N/A')
                timestamp = registro.get('timestamp', 'N/A')
                estado = registro.get('estado', 'N/A')
                print(f"  {i+1}. Origen: {origen_deteccion}, Número: {numero}, Timestamp: {timestamp}, Estado: {estado}")
        else:
            print("⚠️  No se encontraron registros en la base de datos")
        
        return len(registros)
    except Exception as e:
        print(f"❌ Error al consultar registros: {e}")
        return 0

def verificar_registros_por_origen():
    """Verificar registros por tipo de origen"""
    try:
        # Obtener registros generales
        todos_registros = get_vagonetas_historial(skip=0, limit=100)
          origenes = {}
        for registro in todos_registros:
            origen_deteccion = registro.get('origen_deteccion', 'desconocido')
            if origen_deteccion not in origenes:
                origenes[origen_deteccion] = 0
            origenes[origen_deteccion] += 1
        
        print(f"\n📊 Distribución por origen de detección:")
        for origen_deteccion, cantidad in origenes.items():
            print(f"  - {origen_deteccion}: {cantidad} registros")
        
        # Verificar específicamente registros de live_camera
        registros_live = [r for r in todos_registros if r.get('origen_deteccion') == 'live_camera']
        print(f"\n🎥 Registros de 'live_camera': {len(registros_live)}")
        
        if registros_live:
            print("📅 Últimos registros de live_camera:")
            for registro in registros_live[:3]:
                timestamp = registro.get('timestamp', 'N/A')
                numero = registro.get('numero', 'N/A')
                print(f"  - {timestamp}: Número {numero}")
        else:
            print("⚠️  No se encontraron registros de 'live_camera'")
        
        return origenes
    except Exception as e:
        print(f"❌ Error al analizar registros por origen: {e}")
        return {}

def verificar_insercion_test():
    """Verificar que se puede insertar un registro de prueba"""
    try:        # Crear un registro de prueba
        test_data = VagonetaCreate(
            numero="TEST-999",
            confianza=0.95,
            imagen_path="test/test_image.jpg",
            modelo_ladrillo="test",
            merma=0.0,
            tunel="test",
            evento="test_verificacion",
            origen_deteccion="test_script",
            timestamp=datetime.now(timezone.utc)
        )
        
        # Intentar insertar
        record_id = create_vagoneta_record(test_data)
        print(f"✅ Registro de prueba insertado con ID: {record_id}")
        
        # Verificar que se puede leer
        registros_test = get_vagonetas_historial(skip=0, limit=5)
        registro_insertado = None
        for registro in registros_test:
            if registro.get('numero') == 'TEST-999':
                registro_insertado = registro
                break
        
        if registro_insertado:
            print("✅ Registro de prueba encontrado en la consulta")
            return True
        else:
            print("⚠️  Registro de prueba no encontrado en la consulta")
            return False
            
    except Exception as e:
        print(f"❌ Error al insertar registro de prueba: {e}")
        return False

def main():
    print("🔍 VERIFICACIÓN DE BASE DE DATOS MONGODB")
    print("=" * 50)
    
    # 1. Verificar conexión
    print("\n1. Verificando conexión a MongoDB...")
    if not verificar_conexion_db():
        return
    
    # 2. Verificar registros existentes
    print("\n2. Verificando registros existentes...")
    total_registros = verificar_registros_existentes()
    
    # 3. Verificar distribución por origen
    print("\n3. Analizando registros por origen...")
    origenes = verificar_registros_por_origen()
    
    # 4. Verificar operación de inserción
    print("\n4. Verificando operación de inserción...")
    insercion_ok = verificar_insercion_test()
    
    # Resumen
    print("\n" + "=" * 50)
    print("📋 RESUMEN DE VERIFICACIÓN:")
    print(f"✅ Conexión a MongoDB: OK")
    print(f"📊 Total de registros: {total_registros}")
    print(f"🔧 Inserción funcional: {'SÍ' if insercion_ok else 'NO'}")
      if 'live_camera' in origenes:
        print(f"🎥 Registros de live_camera: {origenes['live_camera']}")
    else:
        print("⚠️  Sin registros de live_camera detectados")
    
    if origenes.get('live_camera', 0) == 0:
        print("\n🚨 PROBLEMA DETECTADO:")
        print("   No hay registros de 'live_camera' en la base de datos.")
        print("   Esto sugiere que el monitor en tiempo real no está")
        print("   guardando las detecciones correctamente.")

if __name__ == "__main__":
    main()
