#!/usr/bin/env python3
"""
Simple server runner with proper path setup
"""
import os
import sys
import asyncio

# Add current directory to Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, current_dir)

if __name__ == "__main__":
    try:
        # Import after setting up the path
        from main import app
        import uvicorn
        
        print("🚀 Iniciando servidor FastAPI...")
        print("📍 URL: http://localhost:8000")
        print("📚 Documentación: http://localhost:8000/docs")
        print("🔄 Recarga automática: Activada")
        
        # Start the server
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=8000,
            reload=True,
            reload_dirs=[current_dir]
        )
        
    except Exception as e:
        print(f"❌ Error iniciando servidor: {e}")
        sys.exit(1)
