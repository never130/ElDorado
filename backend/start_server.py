#!/usr/bin/env python3
"""
Script para iniciar el servidor de desarrollo
"""

if __name__ == "__main__":
    import uvicorn
    import sys
    import os
    
    # Asegurar que el directorio actual está en el path
    current_dir = os.path.dirname(os.path.abspath(__file__))
    if current_dir not in sys.path:
        sys.path.insert(0, current_dir)
    
    # Importar la aplicación
    try:
        from main import app
        print("✅ Aplicación importada correctamente")
        
        # Ejecutar el servidor
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=8000,
            reload=True,
            reload_dirs=[current_dir],
            log_level="info"
        )
    except Exception as e:
        print(f"❌ Error al iniciar el servidor: {e}")
        import traceback
        traceback.print_exc()
