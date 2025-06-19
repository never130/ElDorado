#!/usr/bin/env python3
"""
Script de verificación final del backend refactorizado
Verifica que todos los componentes estén funcionando correctamente
"""

import os
import sys
import importlib
from pathlib import Path

def test_imports():
    """Verifica que todos los módulos principales se importen correctamente"""
    print("🔍 Verificando importaciones...")
    
    modules_to_test = [
        'main',
        'schemas', 
        'database',
        'crud',
        'utils.image_processing',
        'utils.auto_capture_system'
    ]
    
    success = True
    for module_name in modules_to_test:
        try:
            importlib.import_module(module_name)
            print(f"✅ {module_name}")
        except Exception as e:
            print(f"❌ {module_name}: {e}")
            success = False
    
    return success

def test_model_path():
    """Verifica que el modelo YOLO esté en la ubicación correcta"""
    print("\n🤖 Verificando modelo YOLO...")
    
    model_path = Path("models/numeros_enteros/yolo_model/training/best.pt")
    
    if model_path.exists():
        size_mb = model_path.stat().st_size / (1024 * 1024)
        print(f"✅ Modelo encontrado: {model_path}")
        print(f"📊 Tamaño: {size_mb:.1f} MB")
        return True
    else:
        print(f"❌ Modelo no encontrado en: {model_path}")
        return False

def test_config_files():
    """Verifica que los archivos de configuración existan"""
    print("\n⚙️ Verificando archivos de configuración...")
    
    config_files = [
        "cameras_config.json",
        "config.json",
        "requirements.txt"
    ]
    
    success = True
    for config_file in config_files:
        path = Path(config_file)
        if path.exists():
            print(f"✅ {config_file}")
        else:
            print(f"⚠️ {config_file} (opcional)")
    
    return True

def test_database_connection():
    """Verifica la conexión a la base de datos"""
    print("\n🗄️ Verificando conexión a base de datos...")
    
    try:
        from database import connect_to_mongo, close_mongo_connection
        connect_to_mongo()
        print("✅ Conexión a MongoDB exitosa")
        close_mongo_connection()
        return True
    except Exception as e:
        print(f"⚠️ Conexión a MongoDB falló: {e}")
        print("💡 Asegúrate de que MongoDB esté ejecutándose")
        return False

def test_detection_functions():
    """Verifica que las funciones de detección estén disponibles"""
    print("\n🔍 Verificando funciones de detección...")
    
    try:
        from utils.image_processing import run_detection_on_frame, run_detection_on_path
        print("✅ run_detection_on_frame")
        print("✅ run_detection_on_path")
        return True
    except Exception as e:
        print(f"❌ Error importando funciones de detección: {e}")
        return False

def check_obsolete_files():
    """Verifica si hay archivos obsoletos que deben eliminarse"""
    print("\n🧹 Verificando archivos obsoletos...")
    
    obsolete_files = [
        "server.py",
        "monitor_camera.py", 
        "connection_manager_temp.py"
    ]
    
    found_obsolete = []
    for file in obsolete_files:
        if Path(file).exists():
            found_obsolete.append(file)
    
    if found_obsolete:
        print("⚠️ Archivos obsoletos encontrados:")
        for file in found_obsolete:
            print(f"   - {file}")
        print("💡 Ejecuta 'python cleanup_duplicates.py' para limpiar")
    else:
        print("✅ No se encontraron archivos obsoletos")
    
    return len(found_obsolete) == 0

def main():
    """Función principal de verificación"""
    print("🚀 VERIFICACIÓN COMPLETA DEL BACKEND REFACTORIZADO")
    print("=" * 55)
    
    # Cambiar al directorio del backend
    backend_dir = Path(__file__).parent
    os.chdir(backend_dir)
    
    # Ejecutar todas las verificaciones
    tests = [
        test_imports,
        test_model_path,
        test_config_files,
        test_database_connection,
        test_detection_functions,
        check_obsolete_files
    ]
    
    results = []
    for test in tests:
        try:
            result = test()
            results.append(result)
        except Exception as e:
            print(f"❌ Error ejecutando {test.__name__}: {e}")
            results.append(False)
    
    # Resumen final
    print("\n" + "=" * 55)
    print("📊 RESUMEN DE VERIFICACIÓN")
    print("=" * 55)
    
    total_tests = len(results)
    passed_tests = sum(results)
    
    print(f"✅ Pruebas exitosas: {passed_tests}/{total_tests}")
    print(f"❌ Pruebas fallidas: {total_tests - passed_tests}/{total_tests}")
    
    if all(results):
        print("\n🎉 ¡BACKEND COMPLETAMENTE FUNCIONAL!")
        print("✅ Todos los componentes verificados")
        print("✅ Sistema listo para producción")
    elif passed_tests >= total_tests - 1:
        print("\n⚠️ Backend casi completamente funcional")
        print("💡 Revisa las advertencias arriba")
    else:
        print("\n❌ Se encontraron problemas críticos")
        print("🔧 Revisa los errores antes de continuar")
    
    return all(results)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
