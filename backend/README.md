# 🔧 Backend - Sistema de Detección de Números Calados

Este backend implementa un sistema avanzado de visión computacional para la detección automática de números calados en vagonetas utilizando modelos YOLO especializados, con procesamiento en tiempo real y registro completo en MongoDB.

## 🎯 ¿Para qué sirve?
- **Detección Automática**: Identifica números calados en vagonetas mediante modelos YOLO entrenados específicamente
- **Procesamiento en Tiempo Real**: Captura desde cámaras y procesa videos/imágenes instantáneamente
- **Sistema de Captura Inteligente**: Implementa cooldown automático para evitar duplicados
- **Registro Completo**: Almacena metadatos, imágenes procesadas y trayectorias en MongoDB

## 🛠️ Tecnologías Usadas y Para Qué Sirve Cada Una
- **FastAPI:** Framework moderno para crear APIs REST de alto rendimiento con documentación automática
- **Uvicorn:** Servidor ASGI para ejecutar aplicaciones FastAPI con soporte para async/await
- **MongoDB:** Base de datos NoSQL para almacenar registros de detecciones, metadatos e imágenes
- **PyMongo:** Driver oficial de Python para operaciones con MongoDB
- **OpenCV (cv2):** Biblioteca de visión computacional para procesamiento de imágenes y videos
- **Ultralytics YOLOv8:** Modelos de detección especializados para números calados y enteros
- **Tesseract OCR:** Motor de reconocimiento óptico de caracteres como fallback
- **python-dotenv:** Gestión de variables de entorno para configuración flexible
- **aiofiles:** Manejo asíncrono de archivos para mejor rendimiento
- **python-multipart:** Soporte para formularios multipart y carga de archivos

## 🔄 Flujo de Procesamiento Especializado
1. **Captura**: El sistema recibe imágenes/videos desde frontend o cámaras físicas
2. **Detección YOLO**: Aplica modelos especializados para detectar números calados
3. **Procesamiento Inteligente**: 
   - Recorta regiones de interés usando detecciones YOLO
   - Aplica filtros y mejoras de calidad
   - Implementa sistema de cooldown para evitar duplicados
4. **Extracción de Datos**: Utiliza OCR como fallback si YOLO no detecta texto
5. **Registro Completo**: Almacena en MongoDB con timestamps, confianza y metadatos
6. **Respuesta**: Retorna resultados estructurados al frontend

## Instalación manual

### 1. Requisitos previos
- Python 3.9+ instalado y en PATH
- MongoDB Community Server instalado y corriendo
- Tesseract OCR instalado en C:\Program Files\Tesseract-OCR

### 2. Crear y activar entorno virtual
```powershell
# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
.\venv\Scripts\Activate
```

### 3. Instalar dependencias
```powershell
pip install -r requirements.txt
```

### 4. Configurar MongoDB
```powershell
# Inicializar base de datos y crear índices
python init_db.py
```

### 5. Configurar variables de entorno (opcional)
Crea un archivo `.env` si necesitas personalizar la configuración:
```ini
# MongoDB Configuration
MONGO_URI=mongodb://localhost:27017
MONGO_DB=vagonetas_db

# OCR Configuration
TESSERACT_PATH=C:\\Program Files\\Tesseract-OCR\\tesseract.exe

# Image Processing
MIN_CONFIDENCE=0.5
DETECTION_COOLDOWN=5
```

### 6. Ejecutar el servidor
```powershell
uvicorn main:app --reload
```

## 📋 Endpoints principales
- `POST /upload/` — Procesa imagen individual con detección de números calados
- `POST /upload-multiple/` — Procesamiento por lotes de múltiples imágenes
- `POST /upload-video/` — Análisis completo de videos con detección frame por frame
- `POST /cameras/start` — Inicia captura automática desde cámaras físicas
- `POST /cameras/stop/{camera_id}` — Detiene captura específica de cámara
- `GET /cameras/status` — Estado en tiempo real de todas las cámaras activas
- `GET /vagonetas/` — Consulta historial con filtros por número, fecha y confianza
- `GET /trayectoria/{numero}` — Seguimiento temporal de vagoneta específica
- `GET /stats/` — Estadísticas de detecciones y rendimiento del sistema

## 📁 Estructura de archivos
```
backend/
├── main.py                 # Punto de entrada FastAPI y definición de endpoints
├── crud.py                # Operaciones CRUD optimizadas para MongoDB
├── database.py            # Configuración y conexión a MongoDB
├── schemas.py             # Modelos Pydantic para validación de datos
├── init_db.py             # Inicialización de base de datos e índices
├── requirements.txt       # Dependencias del proyecto
├── models/                # 🆕 Modelos YOLO especializados
│   ├── numeros_calados/   # Modelo para detección de números calados
│   │   └── yolo_model/
│   │       └── training/
│   │           └── best.pt
│   └── numeros_enteros/   # Modelo para números enteros (futuro)
│       └── yolo_model/
│           └── training/
│               └── best.pt
└── utils/
    ├── camera_capture.py      # Sistema de captura desde cámaras físicas
    ├── image_processing.py    # Procesamiento avanzado con YOLO
    ├── auto_capture_system.py # Sistema automático con cooldown
    └── ocr.py                # OCR con Tesseract como fallback
```

## 🗄️ Base de datos # EN DESARROLLO
- **MongoDB local**: `mongodb://localhost:27017`
- **Base de datos**: `vagonetas_db`
- **Colección principal**: `vagonetas`
- **Campos especializados**:
  - `numero_detectado`: Número extraído por YOLO
  - `confianza_deteccion`: Nivel de confianza del modelo
  - `tipo_deteccion`: "yolo" o "ocr_fallback"
  - `coordenadas_bbox`: Bounding box de la detección
  - `metadatos_modelo`: Información del modelo utilizado

## 📚 Documentación EN DESARROLLO
