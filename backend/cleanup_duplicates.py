#!/usr/bin/env python3
"""
Script de limpieza para eliminar archivos duplicados y obsoletos del backend
Mantiene solo los archivos necesarios para el funcionamiento del sistema
"""

import os
import shutil
from pathlib import Path

def cleanup_backend():
    """Limpia archivos duplicados y obsoletos del backend"""
    backend_path = Path(__file__).parent
    
    # Archivos que pueden ser eliminados (duplicados o obsoletos)
    files_to_remove = [
        "server.py",  # Vacío
        "monitor_camera.py",  # Duplicado con main.py
        "connection_manager_temp.py",  # Duplicado con main.py
        "models/deteccion_webcam.py",  # Posiblemente obsoleto
    ]
    
    # Scripts de utilidad que pueden mantenerse pero organizarse
    utility_scripts = [
        "check_confianza.py",
        "check_db.py", 
        "check_model.py",
        "fix_confianza.py",
        "fix_db_estado.py",
        "update_origen.py",
        "add_test_data.py"
    ]
    
    print("🧹 Iniciando limpieza del backend...")
    
    # Crear directorio de scripts si no existe
    scripts_dir = backend_path / "scripts"
    scripts_dir.mkdir(exist_ok=True)
    
    # Mover scripts de utilidad
    for script in utility_scripts:
        script_path = backend_path / script
        if script_path.exists():
            new_path = scripts_dir / script
            shutil.move(str(script_path), str(new_path))
            print(f"📦 Movido {script} a scripts/")
    
    # Eliminar archivos duplicados
    for file_to_remove in files_to_remove:
        file_path = backend_path / file_to_remove
        if file_path.exists():
            if file_path.is_file():
                os.remove(file_path)
                print(f"🗑️ Eliminado archivo duplicado: {file_to_remove}")
            elif file_path.is_dir():
                shutil.rmtree(file_path)
                print(f"🗑️ Eliminado directorio: {file_to_remove}")
    
    # Crear archivo README para scripts
    readme_content = """# Scripts de Utilidad

Este directorio contiene scripts de mantenimiento y utilidad para el backend:

- `check_confianza.py`: Verifica problemas con valores de confianza
- `check_db.py`: Verifica la conexión y estado de la base de datos
- `check_model.py`: Verifica el modelo YOLO
- `fix_confianza.py`: Corrige valores de confianza inválidos
- `fix_db_estado.py`: Corrige estados de registros en la base de datos
- `update_origen.py`: Actualiza el campo origen_deteccion
- `add_test_data.py`: Añade datos de prueba

Uso: `python scripts/nombre_del_script.py`
"""
    
    with open(scripts_dir / "README.md", "w", encoding="utf-8") as f:
        f.write(readme_content)
    
    print("✅ Limpieza completada!")
    print("📁 Scripts organizados en backend/scripts/")

if __name__ == "__main__":
    cleanup_backend()
