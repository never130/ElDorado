# 🚀 Backend - Sistema El Dorado

## 📋 Descripción

API backend desarrollada con FastAPI que implementa un sistema avanzado de visión computacional para la detección automática de números en vagonetas de carga. Utiliza inteligencia artificial (YOLOv8) para procesar imágenes y video en tiempo real, con almacenamiento en MongoDB y comunicación WebSocket para actualizaciones en vivo.

## 🎯 Características Principales

- **🤖 Detección Automática con IA**: Modelo YOLOv8 personalizado entrenado para números de vagonetas
- **📹 Procesamiento Multimedia**: Análisis de imágenes, videos y streams de cámaras en tiempo real  
- **🔗 WebSocket Real-Time**: Actualizaciones de detección en vivo para el frontend
- **🗄️ Base de Datos MongoDB**: Almacenamiento persistente con índices optimizados
- **📡 Monitor de Cámaras**: Sistema de monitoreo continuo configurable
- **🛠️ API RESTful**: Endpoints completos para gestión de datos y configuración
- **⚙️ Configuración Flexible**: Cámaras configurables vía JSON
- **📊 Reportes Avanzados**: Estadísticas y análisis de detecciones

## 🏗️ Arquitectura

```
backend/
├── main.py                  # 🔧 Servidor principal con endpoints y WebSockets
├── crud.py                  # 🗃️ Operaciones CRUD para MongoDB
├── database.py              # 🔗 Configuración y conexión a base de datos
├── schemas.py               # 📝 Modelos de datos Pydantic
├── requirements.txt         # 📦 Dependencias Python
├── cameras_config.json      # 📹 Configuración de cámaras del sistema
├── .env                     # 🔒 Variables de entorno
├── runtime.txt              # 🐍 Versión de Python para despliegue
├── Procfile                 # 🚀 Configuración para Heroku
│
├── models/                  # 🤖 Modelos de Inteligencia Artificial
│   └── numeros_enteros/     # 📊 Modelo YOLOv8 para detección de números
│       └── yolo_model/
│           └── training/
│               └── best.pt  # 🎯 Modelo entrenado
│
├── utils/                   # 🔧 Utilidades y procesamiento
│   ├── image_processing.py  # 🖼️ Procesamiento de imágenes con YOLO
│   ├── camera_capture.py    # 📷 Manejo de cámaras y video
│   └── auto_capture_system.py # 🔄 Sistema de captura automática
│
└── uploads/                 # 📁 Archivos subidos por usuarios
```

## 🛠️ Stack Tecnológico

### Core Framework
- **FastAPI 0.104+**: Framework web moderno para APIs REST y WebSockets
- **Uvicorn**: Servidor ASGI de alto rendimiento
- **Pydantic**: Validación de datos y serialización

### Inteligencia Artificial
- **YOLOv8 (Ultralytics)**: Modelo de detección de objetos en tiempo real
- **OpenCV**: Procesamiento de imágenes y video
- **NumPy**: Computación numérica optimizada

### Base de Datos
- **MongoDB**: Base de datos NoSQL escalable
- **Motor**: Driver asíncrono de MongoDB para Python
- **PyMongo**: Driver MongoDB tradicional

### Utilidades
- **Python-dotenv**: Gestión de variables de entorno
- **Aiofiles**: Manejo asíncrono de archivos
- **Python-multipart**: Soporte para carga de archivos
- **Pillow**: Procesamiento adicional de imágenes

## 🔄 Flujo de Procesamiento

### 1. 📥 Entrada de Datos
- **Carga Manual**: Subida de imágenes/videos vía endpoints REST
- **Monitor en Tiempo Real**: Captura automática desde cámaras configuradas
- **WebSocket**: Conexiones en tiempo real para actualizaciones instantáneas

### 2. 🤖 Procesamiento IA
- **Detección YOLO**: Aplicación del modelo YOLOv8 entrenado
- **Extracción de Datos**: Identificación y extracción de números
- **Validación**: Verificación de confianza y calidad de detección

### 3. 💾 Almacenamiento
- **MongoDB**: Registro completo con metadatos
- **Índices Optimizados**: Búsquedas rápidas por fecha, número y evento
- **Archivos**: Almacenamiento seguro de imágenes procesadas

### 4. 📡 Comunicación
- **WebSocket**: Notificaciones instantáneas al frontend
- **API REST**: Respuestas estructuradas para consultas
- **Stream Video**: Transmisión en vivo de cámaras

## 🚀 Instalación y Configuración

### 1. 📋 Prerrequisitos
- **Python 3.11+** (recomendado)
- **MongoDB** (local o Atlas)
- **Git** para control de versiones

### 2. 🔧 Configuración del Entorno

#### Crear entorno virtual
```bash
# Navegar al directorio backend
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual (Windows)
venv\Scripts\activate

# Activar entorno virtual (macOS/Linux)
source venv/bin/activate
```

#### Instalar dependencias
```bash
pip install -r requirements.txt
```

### 3. ⚙️ Variables de Entorno

Crear archivo `.env` en la carpeta backend:

```env
# MongoDB Configuration
MONGO_CONNECTION_STRING=mongodb+srv://usuario:password@cluster.mongodb.net/el_dorado?retryWrites=true&w=majority
MONGO_DB_NAME=el_dorado

# Para MongoDB local (alternativo)
# MONGO_HOST=localhost
# MONGO_PORT=27017
# MONGO_USER=tu_usuario
# MONGO_PASS=tu_password
# MONGO_DB_NAME=el_dorado

# Configuración del servidor
HOST=0.0.0.0
PORT=8000
DEBUG=True

# Configuración de archivos
MAX_FILE_SIZE=50MB
UPLOAD_DIR=uploads
```

### 4. 📹 Configuración de Cámaras

Editar `cameras_config.json`:

```json
{
  "cameras": [
    {
      "camera_id": "cam_tunel_1",
      "tunel": "Túnel 1 - Entrada Principal",
      "camera_url": 0,
      "descripcion": "Cámara principal del túnel de entrada",
      "activa": true
    },
    {
      "camera_id": "cam_tunel_2", 
      "tunel": "Túnel 2 - Salida",
      "camera_url": 1,
      "descripcion": "Cámara del túnel de salida",
      "activa": true
    }
  ]
}
```

### 5. 🚀 Ejecutar el Servidor

```bash
# Desarrollo con recarga automática
python main.py

# O usando uvicorn directamente
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Producción
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 🌐 Endpoints API Principales

### 📤 Detecciones
- `POST /detect/image` - Procesar imagen individual
- `POST /detect/video` - Procesar video completo
- `POST /upload-multiple/` - Subida múltiple de archivos
- `GET /historial/` - Obtener historial con filtros avanzados
- `GET /historial/export` - Exportar detecciones a CSV

### 📡 Monitoreo en Tiempo Real
- `POST /monitor/start/{camera_id}` - Iniciar monitoreo de cámara
- `POST /monitor/stop/{camera_id}` - Detener monitoreo
- `GET /monitor/status/{camera_id}` - Estado del monitor
- `WS /ws/detections` - WebSocket para actualizaciones en vivo

### 📹 Cámaras
- `GET /cameras/list` - Listar cámaras disponibles
- `GET /cameras/system-info` - Información del sistema de cámaras
- `GET /video/stream/{camera_id}` - Stream de video en vivo

### 📊 Reportes
- `GET /reports/daily` - Reporte diario de detecciones
- `GET /reports/monthly` - Reporte mensual
- `GET /reports/statistics` - Estadísticas generales del sistema

### ⚙️ Sistema
- `GET /health` - Estado de salud del sistema
- `GET /docs` - Documentación interactiva (Swagger)
- `GET /redoc` - Documentación alternativa

## 🔧 Configuración Avanzada

### Optimización del Modelo YOLO
```python
# En utils/image_processing.py
model = YOLO('models/numeros_enteros/yolo_model/training/best.pt')
model.conf = 0.5  # Confianza mínima (0.0 - 1.0)
model.iou = 0.45  # Intersección sobre unión
model.max_det = 300  # Máximo de detecciones por imagen
```

### Configuración de MongoDB
```javascript
// Índices recomendados para mejor rendimiento
db.detecciones.createIndex({ "timestamp": -1 })
db.detecciones.createIndex({ "numero_detectado": 1 })
db.detecciones.createIndex({ "evento": 1, "timestamp": -1 })
db.detecciones.createIndex({ "confianza_numero": -1 })
```

### Variables de Entorno Adicionales
```env
# Configuración avanzada del modelo
YOLO_CONFIDENCE=0.5
YOLO_IOU_THRESHOLD=0.45
MAX_DETECTIONS=300

# Configuración de WebSocket
WS_HEARTBEAT_INTERVAL=30
WS_MAX_CONNECTIONS=100

# Configuración de archivos
MAX_UPLOAD_SIZE=100MB
ALLOWED_EXTENSIONS=jpg,jpeg,png,mp4,avi,mov
CLEANUP_INTERVAL=3600
```

## 🛠️ Troubleshooting

### Problemas Comunes

#### 1. Error de conexión a MongoDB
```bash
# Verificar estado del servicio
systemctl status mongod

# Verificar conexión desde Python
python -c "from database import get_database; import asyncio; asyncio.run(get_database())"
```

#### 2. Modelo YOLO no carga
```bash
# Verificar que el modelo existe
ls -la models/numeros_enteros/yolo_model/training/best.pt

# Verificar permisos
chmod 644 models/numeros_enteros/yolo_model/training/best.pt
```

#### 3. Cámaras no detectadas
```bash
# Verificar configuración
cat cameras_config.json

# Listar dispositivos de video (Linux)
ls /dev/video*
```

### Comandos de Verificación
```bash
# Verificar instalación de dependencias
pip list | grep -E "(fastapi|opencv|ultralytics|pymongo)"

# Test de conexión a la API
curl http://localhost:8000/health

# Verificar endpoints disponibles
curl http://localhost:8000/docs
```

## 📊 Monitoreo y Logs

### Logs del Sistema
```bash
# Ver logs en tiempo real (si están configurados)
tail -f logs/app.log

# Logs de uvicorn
uvicorn main:app --log-level debug
```

### Métricas de Performance
- **Latencia de detección**: < 2 segundos por imagen
- **Throughput**: 30+ imágenes por minuto
- **Precisión del modelo**: > 85% de confianza promedio
- **Disponibilidad**: 99.9% uptime objetivo

## 🔒 Seguridad

### Mejores Prácticas
- Cambiar credenciales por defecto de MongoDB
- Usar HTTPS en producción
- Validar y sanitizar todas las entradas
- Limitar tamaño de archivos subidos
- Implementar rate limiting

### Variables Sensibles
```env
# NUNCA commitear al repositorio
MONGO_CONNECTION_STRING=mongodb+srv://...
JWT_SECRET_KEY=tu_clave_secreta_super_larga
API_KEY=tu_api_key_segura
```

## 🚢 Despliegue en Producción

### Docker
```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4"]
```

### Heroku
```bash
# Configurar Heroku
heroku create el-dorado-backend
heroku config:set MONGO_CONNECTION_STRING="tu_string_mongodb"

# Deploy
git push heroku main
```

### Variables de Entorno para Producción
```env
DEBUG=False
HOST=0.0.0.0
PORT=8000
WORKERS=4
MONGO_CONNECTION_STRING=mongodb+srv://...
ALLOWED_ORIGINS=https://tu-frontend.vercel.app
```

## 🤝 Desarrollo y Contribuciones

### Estructura de Desarrollo
```bash
# Instalar dependencias de desarrollo
pip install -r requirements-dev.txt

# Ejecutar linting
flake8 .

# Ejecutar formateo
black .

# Verificar tipos
mypy .
```

### Testing (Futuro)
```bash
# Cuando se implementen tests
pytest tests/
pytest --cov=. tests/
```

---

## 📚 Documentación Adicional

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **MongoDB Atlas**: https://www.mongodb.com/atlas
- **YOLOv8 Docs**: https://docs.ultralytics.com/

---

*🔧 Backend desarrollado para el Sistema El Dorado - Detección de Números de Vagonetas*
*📅 Última actualización: Julio 2025*
