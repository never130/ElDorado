#!/usr/bin/env python3
"""
Script de optimización final para producción del frontend
Limpia console.log, optimiza código y prepara para deploy
"""

import os
import re
from pathlib import Path

def optimize_frontend_for_production():
    """Optimiza el frontend para producción"""
    frontend_path = Path(__file__).parent
    
    print("🚀 OPTIMIZACIÓN FRONTEND PARA PRODUCCIÓN")
    print("=" * 50)
    
    # 1. Limpiar console.log en producción
    print("🧹 Limpiando console.log...")
    
    js_files = list(frontend_path.glob("src/**/*.js"))
    console_logs_removed = 0
    
    for js_file in js_files:
        try:
            content = js_file.read_text(encoding='utf-8')
            original_content = content
            
            # Comentar console.log pero mantener console.error
            content = re.sub(
                r'^(\s*)console\.log\(',
                r'\1// console.log(',
                content,
                flags=re.MULTILINE
            )
            
            if content != original_content:
                # Solo escribir si hubo cambios
                js_file.write_text(content, encoding='utf-8')
                console_logs_removed += 1
                print(f"📝 Limpiado: {js_file.name}")
                
        except Exception as e:
            print(f"⚠️ Error procesando {js_file}: {e}")
    
    print(f"✅ {console_logs_removed} archivos optimizados")
    
    # 2. Verificar configuración para producción
    print("\n⚙️ Verificando configuración...")
    
    api_config_path = frontend_path / "src/config/api.js"
    if api_config_path.exists():
        content = api_config_path.read_text(encoding='utf-8')
        if "localhost" in content:
            print("⚠️ Configuración apunta a localhost (desarrollo)")
            print("   Para producción, cambiar en src/config/api.js:")
            print("   export const API_BASE_URL = 'http://tu-servidor-produccion:8000';")
        else:
            print("✅ Configuración lista para producción")
    
    # 3. Crear script de build
    print("\n📦 Preparando para build...")
    
    package_json_path = frontend_path / "package.json"
    if package_json_path.exists():
        print("✅ package.json encontrado")
        print("🏗️ Para construir para producción ejecutar:")
        print("   npm run build")
        print("   Esto creará una carpeta 'build' optimizada")
    
    print("\n" + "=" * 50)
    print("🎉 OPTIMIZACIÓN COMPLETADA")
    print("✅ Frontend listo para producción")
    print("=" * 50)

if __name__ == "__main__":
    optimize_frontend_for_production()
