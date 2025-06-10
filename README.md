# Sistema El Dorado - Detección de Números de Vagonetas

**Profesores a Cargo:**
- Nicolás Caballero
- Federico Magaldi
- Martín Mirabete
- Carlos Ghio

# Proyecto - Sistema de Detección de Números en Vagonetas

Este proyecto integra visión computacional avanzada y aprendizaje profundo (YOLOv8) para automatizar la detección y reconocimiento de números en vagonetas de carga. El sistema utiliza inteligencia artificial para procesar imágenes y video, detectar números automáticamente, y registrar todas las detecciones en una base de datos MongoDB para análisis posterior y monitoreo.

## 🎯 Características Principales

- **🤖 Detección Automática con IA**: Modelo YOLOv8 entrenado para números de vagonetas.
- **📹 Procesamiento de Imágenes y Video**: Análisis de archivos subidos y captura desde cámaras.
- ** WebSocket Real-Time Monitoring**: Actualizaciones de detección en vivo en la interfaz de usuario.
- **🗄️ Base de Datos MongoDB**: Almacenamiento persistente de todas las detecciones.
- **🌐 Interfaz Web Moderna**: Frontend React para interacción con el sistema.
- **📊 Historial Completo**: Consulta y análisis de detecciones históricas.
- **⚙️ Configuración Externalizada**: Configuración de cámaras en un archivo JSON.
- **📚 Manual de Usuario Integrado**: Guía completa accesible desde la interfaz.

## 📂 Estructura del Proyecto (Simplificada)

```
app_imagenes/
│   README.md                # Documentación general del proyecto
│
├── backend/                 # 🚀 Backend FastAPI con IA
│   ├── main.py              # Servidor principal con endpoints API y WebSockets
│   ├── crud.py              # Operaciones de base de datos (MongoDB)
│   ├── database.py          # Configuración y conexión a MongoDB, creación de índices
│   ├── schemas.py           # Modelos de datos Pydantic
│   ├── requirements.txt     # Dependencias Python
│   ├── README.md            # Documentación del backend
│   ├── cameras_config.json  # Configuración de las cámaras
│   ├── models/              # 🤖 Modelos de IA
│   │   └── numeros_enteros/ # Modelo YOLOv8 para números de vagonetas
│   │       └── yolo_model/
│   │           └── training/
│   │               └── best.pt  # Modelo entrenado
│   └── utils/               # 🔧 Utilidades
│       ├── auto_capture_system.py    # Sistema de captura automática desde cámaras
│       ├── image_processing.py       # Lógica de procesamiento de imágenes con YOLO
│       ├── camera_capture.py         # Clases para manejo de cámaras/video (si aplica directamente)
│       └── ocr.py                    # Lógica OCR (si se usa como fallback o complemento)
│
├── frontend/                # 🌐 Frontend React moderno
│   ├── package.json         # Dependencias React
│   ├── README.md            # Documentación del frontend (generalmente sobre cómo construir/ejecutar)
│   ├── public/              # Archivos estáticos
│   └── src/                 # 📱 Código fuente React
│       ├── App.js           # Aplicación principal
│       ├── index.js         # Punto de entrada
│       ├── components/      # Componentes React UI
│       │   ├── RealTimeMonitor.js # Monitor de detecciones en tiempo real (WebSockets)
│       │   ├── Historial.js       # Visualización del historial de detecciones
│       │   ├── Upload.js          # Componente para subir imágenes/videos
│       │   └── Navbar.js          # Navegación principal
│       └── config/
│           └── api.js       # Configuración de endpoints API (si es necesario centralizar)
```

## 🚀 Despliegue y Uso

(Instrucciones detalladas en los READMEs de `backend/` y `frontend/`)

1.  **Configurar Backend**:
    *   Instalar dependencias de Python.
    *   Configurar variables de entorno para MongoDB.
    *   Ajustar `cameras_config.json` si se usa el sistema de captura automática.
    *   Ejecutar el servidor FastAPI.
2.  **Configurar Frontend**:
    *   Instalar dependencias de Node.js.
    *   Ejecutar la aplicación React.
3.  **Acceder a la Aplicación**: Abrir la URL del frontend en un navegador.

## Contribuciones

(Información sobre cómo contribuir al proyecto, si aplica)

## Licencia

(Información de licencia, si aplica)

