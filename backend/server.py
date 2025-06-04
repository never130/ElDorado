#!/usr/bin/env python3
"""
Archivo de arranque del servidor backend
"""

if __name__ == "__main__":
    import uvicorn
    
    # Importar la app
    from main import app
    
    # Ejecutar servidor
    uvicorn.run(
        app,
        host="127.0.0.1",
        port=8000,
        reload=True,
        reload_dirs=["./"]
    )
