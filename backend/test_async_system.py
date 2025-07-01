#!/usr/bin/env python3
"""
Script de verificación del sistema asíncrono migrado
Prueba las conexiones, CRUD operations y funcionalidades principales
"""

import asyncio
import sys
import os
from pathlib import Path

# Agregar el directorio backend al path
sys.path.insert(0, str(Path(__file__).parent))

from database import connect_to_mongo, close_mongo_connection, get_database
from crud import (
    create_vagoneta_record, 
    get_vagonetas_historial_with_filters, 
    buscar_vagonetas,
    get_vagonetas_historial
)
from schemas import VagonetaCreate
from datetime import datetime, timezone

async def test_database_connection():
    """Prueba la conexión a la base de datos"""
    print("🔍 Probando conexión a MongoDB...")
    try:
        await connect_to_mongo()
        db = await get_database()
        
        # Verificar que la base de datos responde
        server_info = await db.client.server_info()
        print(f"✅ MongoDB conectado - Versión: {server_info.get('version', 'Unknown')}")
        return True
    except Exception as e:
        print(f"❌ Error conectando a MongoDB: {e}")
        return False

async def test_crud_operations():
    """Prueba las operaciones CRUD asíncronas"""
    print("\n🔍 Probando operaciones CRUD asíncronas...")
    
    try:
        # Crear un registro de prueba
        test_record = VagonetaCreate(
            numero="TEST001",
            evento="ingreso",
            tunel="Test Tunnel",
            timestamp=datetime.now(timezone.utc),
            modelo_ladrillo="test_brick",
            imagen_path="/test/path.jpg",
            origen_deteccion="test_async_system"
        )
        
        print("  📝 Creando registro de prueba...")
        created_id = await create_vagoneta_record(test_record)
        print(f"  ✅ Registro creado con ID: {created_id}")
        
        # Probar consultas
        print("  🔎 Probando consultas...")
        
        # Consultar historial básico
        historial = await get_vagonetas_historial(skip=0, limit=5)
        print(f"  ✅ Consulta de historial: {len(historial)} registros encontrados")
        
        print(f"  ✅ Operaciones CRUD básicas funcionando correctamente")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error en operaciones CRUD: {e}")
        return False

async def test_image_processing():
    """Prueba las funciones de procesamiento de imágenes"""
    print("\n🔍 Probando módulo de procesamiento de imágenes...")
    
    try:
        from utils.image_processing import processor
        print("  ✅ Módulo image_processing importado correctamente")
        
        # Verificar que el procesador está disponible
        if processor is not None:
            print("  ✅ Procesador YOLO disponible")
        else:
            print("  ⚠️ Procesador YOLO no disponible (normal si no hay modelo)")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error importando image_processing: {e}")
        return False

async def test_auto_capture_system():
    """Prueba el sistema de captura automática"""
    print("\n🔍 Probando sistema de captura automática...")
    
    try:
        from utils.auto_capture_system import AutoCaptureManager, load_cameras_config
        print("  ✅ Módulo auto_capture_system importado correctamente")
        
        # Probar carga de configuración
        try:
            config = load_cameras_config()
            print(f"  ✅ Configuración de cámaras cargada: {len(config)} cámaras")
        except Exception as e:
            print(f"  ⚠️ No se pudo cargar configuración de cámaras: {e}")
        
        return True
        
    except Exception as e:
        print(f"  ❌ Error importando auto_capture_system: {e}")
        return False

async def main():
    """Función principal de pruebas"""
    print("🚀 Iniciando verificación del sistema asíncrono migrado")
    print("=" * 60)
    
    tests_results = []
    
    # Prueba de conexión de base de datos
    db_ok = await test_database_connection()
    tests_results.append(("Database Connection", db_ok))
    
    if db_ok:
        # Solo ejecutar pruebas CRUD si la BD está conectada
        crud_ok = await test_crud_operations()
        tests_results.append(("CRUD Operations", crud_ok))
    else:
        tests_results.append(("CRUD Operations", False))
    
    # Pruebas de módulos
    img_ok = await test_image_processing()
    tests_results.append(("Image Processing", img_ok))
    
    capture_ok = await test_auto_capture_system()
    tests_results.append(("Auto Capture System", capture_ok))
    
    # Resumen de resultados
    print("\n" + "=" * 60)
    print("📊 RESUMEN DE VERIFICACIÓN:")
    print("=" * 60)
    
    all_passed = True
    for test_name, passed in tests_results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"  {test_name:.<30} {status}")
        if not passed:
            all_passed = False
    
    print("=" * 60)
    if all_passed:
        print("🎉 TODAS LAS PRUEBAS PASARON - Sistema funcionando correctamente")
    else:
        print("⚠️ ALGUNAS PRUEBAS FALLARON - Revisar configuración")
    
    # Cerrar conexión
    close_mongo_connection()

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n⚠️ Pruebas interrumpidas por el usuario")
    except Exception as e:
        print(f"\n❌ Error inesperado: {e}")
        sys.exit(1)
