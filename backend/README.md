# 🔧 Backend - Sistema de Detección de Números de Vagonetas

Este backend implementa un sistema avanzado de visión computacional para la detección automática de números en vagonetas utilizando modelos YOLO, con procesamiento de imágenes/videos subidos, captura automática desde cámaras, y registro completo en MongoDB. Proporciona actualizaciones en tiempo real al frontend mediante WebSockets.

## 🎯 Funcionalidades Principales
- **Detección Automática con IA**: Identifica números de vagonetas usando un modelo YOLOv8 entrenado.
- **Procesamiento de Archivos**: Permite la subida de imágenes y videos para su análisis.
- **Sistema de Captura Automática**: Configurable mediante `cameras_config.json` para monitorear cámaras o fuentes de video, detectar movimiento y procesar vagonetas automáticamente.
- **Registro en MongoDB**: Almacena todas las detecciones con metadatos relevantes (timestamp, número, túnel, evento, imagen, etc.).
- **WebSockets para Tiempo Real**: Envía notificaciones de nuevas detecciones al frontend conectado.
- **API RESTful**: Endpoints para la gestión de datos, configuración y estado del sistema.

## 🛠️ Tecnologías Usadas
- **FastAPI**: Framework para crear APIs REST y WebSockets.
- **Uvicorn**: Servidor ASGI para ejecutar la aplicación FastAPI.
- **MongoDB & PyMongo**: Base de datos NoSQL y driver Python para almacenamiento.
- **OpenCV (cv2)**: Procesamiento de imágenes y videos.
- **Ultralytics YOLOv8**: Modelo de detección de objetos.
- **python-dotenv**: Gestión de variables de entorno.
- **aiofiles**: Manejo asíncrono de archivos.
- **python-multipart**: Soporte para carga de archivos.

## 🔄 Flujo de Procesamiento
1.  **Entrada de Datos**:
    *   **Carga Manual**: El usuario sube imágenes/videos a través del endpoint `/upload-multiple/`.
    *   **Captura Automática**: El `AutoCaptureSystem` monitorea las fuentes definidas en `cameras_config.json`. Al detectar movimiento y una vagoneta, procesa el frame.
2.  **Detección YOLO**: Se aplica el modelo YOLOv8 para detectar la vagoneta y su número.
3.  **Extracción de Datos**: Se extrae el número detectado.
4.  **Registro en MongoDB**: La información de la detección (número, timestamp, ruta de imagen, etc.) se guarda en la colección `vagonetas`.
5.  **Notificación WebSocket**: Si la detección proviene de la captura automática, se envía un mensaje a través del endpoint `/ws/detections` a los clientes frontend conectados.
6.  **Respuesta API**: Para cargas manuales, se devuelve una respuesta JSON con el resultado del procesamiento.

## Instalación

### 1. Requisitos Previos
- Python 3.9+
- MongoDB Community Server instalado y corriendo.
- (Opcional) Tesseract OCR si se planea usar como fallback (actualmente la dependencia podría estar o no en el código).

### 2. Entorno Virtual y Dependencias
```powershell
# Navegar al directorio backend
cd backend

# Crear entorno virtual
python -m venv venv

# Activar entorno virtual
.\venv\Scripts\Activate

# Instalar dependencias
pip install -r requirements.txt
```

### 3. Configuración
- **Variables de Entorno**: Crear un archivo `.env` en el directorio `backend/` para la configuración de MongoDB si no se usan los valores por defecto:
  ```ini
  MONGO_HOST=localhost
  MONGO_PORT=27017
  MONGO_DB_NAME=el_dorado
  # MONGO_USER=tu_usuario (si aplica)
  # MONGO_PASS=tu_contraseña (si aplica)
  # MONGO_AUTH_DB=admin (si aplica)
  ```
- **Configuración de Cámaras**: Editar `cameras_config.json` para definir las fuentes de video/cámaras para el sistema de captura automática.

### 4. Ejecutar el Servidor
```powershell
uvicorn main:app --reload
```
El backend estará disponible en `http://localhost:8000`.

## 📋 Endpoints Principales (API REST)
- `POST /upload-multiple/`: Sube y procesa múltiples archivos (imágenes/videos).
- `GET /vagonetas/`: Consulta el historial de detecciones con filtros.
- `GET /trayectoria/{numero}`: Obtiene todos los eventos de una vagoneta específica.
- `DELETE /vagonetas/{record_id}`: Anula (soft delete) un registro.
- `PUT /vagonetas/{record_id}`: Actualiza un registro.
- `GET /search`: Búsqueda de texto en registros.
- `POST /auto-capture/start`: Inicia el sistema de captura automática.
- `POST /auto-capture/stop`: Detiene el sistema de captura automática.
- `GET /auto-capture/status`: Obtiene el estado del sistema de captura automática y estadísticas de cámaras.
- `GET /model/info`: Devuelve información sobre el modelo de IA cargado.
- `POST /model/config`: Permite actualizar la configuración del modelo (ej. umbral de confianza).
- `GET /health`: Endpoint de healthcheck.

##  WebSocket Endpoint
- `GET /ws/detections`: Endpoint para la conexión WebSocket. El servidor enviará mensajes JSON con nuevas detecciones. Formato del mensaje:
  ```json
  {
    "type": "new_detection",
    "data": {
      "_id": "...",
      "numero": "123",
      "evento": "ingreso_tunel_A",
      "tunel": "Tunel A",
      "timestamp": "2024-06-10T12:00:00.000Z",
      "modelo_ladrillo": null, // o el modelo detectado
      "imagen_path": "uploads/...",
      "confidence": 0.85,
      "auto_captured": true,
      "camera_id": "camara_entrada_A"
    }
  }
  ```

## 📁 Estructura de Archivos (Backend)
```
backend/
├── main.py                 # Punto de entrada FastAPI, endpoints API y WebSocket
├── crud.py                 # Operaciones CRUD para MongoDB
├── database.py             # Conexión a MongoDB y creación de índices
├── schemas.py              # Modelos Pydantic para validación
├── requirements.txt        # Dependencias
├── cameras_config.json     # Configuración de cámaras para captura automática
├── .env.example            # Ejemplo de archivo de variables de entorno
├── models/                 # Modelos de IA
│   └── numeros_enteros/
│       └── yolo_model/
│           └── training/
│               └── best.pt # Modelo YOLOv8 entrenado
└── utils/                  # Módulos de utilidad
    ├── auto_capture_system.py  # Lógica de captura automática
    ├── image_processing.py     # Procesamiento de imágenes y detección
    ├── camera_capture.py       # (Si se usa directamente para abstracción de cámara)
    └── ocr.py                  # (Si se usa como fallback)
```
