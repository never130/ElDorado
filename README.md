# Sistema El Dorado - Detección de Números de Vagonetas

**Profesores a Cargo:**
- Nicolás Caballero
- Federico Magaldi
- Martín Mirabete
- Carlos Ghio

## 📋 Descripción del Proyecto

Sistema avanzado de visión computacional para la detección automática de números en vagonetas de carga utilizando inteligencia artificial (YOLOv8). El sistema procesa imágenes y video en tiempo real, detecta números automáticamente, y registra todas las detecciones en una base de datos MongoDB para análisis posterior y monitoreo continuo.

## 🎯 Características Principales

- **🤖 Detección Automática con IA**: Modelo YOLOv8 personalizado entrenado para números de vagonetas
- **📹 Procesamiento Multimedia**: Análisis de imágenes, videos y captura desde cámaras en tiempo real
- **🔗 WebSocket Real-Time**: Actualizaciones de detección en vivo en la interfaz de usuario
- **🗄️ Base de Datos MongoDB**: Almacenamiento persistente con índices optimizados
- **🌐 Interfaz Web Moderna**: Frontend React responsivo con Tailwind CSS
- **📊 Historial y Reportes**: Consulta avanzada con filtros y exportación a CSV
- **⚙️ Configuración Flexible**: Configuración de cámaras externalizadas en JSON
- **📚 Manual de Usuario**: Guía completa integrada en la interfaz
- **🔄 Monitor en Tiempo Real**: Sistema de monitoreo continuo con WebSockets
- **📈 Dashboard de Reportes**: Análisis estadístico y visualización de datos

## 🏗️ Arquitectura del Sistema

```
ElDorado/
│   README.md                    # 📚 Documentación principal
│   
├── backend/                     # 🚀 API Backend (FastAPI + Python)
│   ├── main.py                  # 🔧 Servidor principal con endpoints y WebSockets
│   ├── crud.py                  # 🗃️ Operaciones CRUD para MongoDB
│   ├── database.py              # 🔗 Configuración y conexión a base de datos
│   ├── schemas.py               # 📝 Modelos de datos Pydantic
│   ├── requirements.txt         # 📦 Dependencias Python
│   ├── cameras_config.json      # 📹 Configuración de cámaras del sistema
│   ├── .env                     # 🔒 Variables de entorno (MongoDB, etc.)
│   ├── runtime.txt              # 🐍 Versión de Python para despliegue
│   │
│   ├── models/                  # 🤖 Modelos de Inteligencia Artificial
│   │   └── numeros_enteros/     # 📊 Modelo YOLOv8 para detección de números
│   │       └── yolo_model/
│   │           └── training/
│   │               └── best.pt  # 🎯 Modelo entrenado (.pt)
│   │
│   ├── utils/                   # 🔧 Utilidades y procesamiento
│   │   ├── image_processing.py  # 🖼️ Procesamiento de imágenes con YOLO
│   │   ├── camera_capture.py    # 📷 Manejo de cámaras y video
│   │   └── auto_capture_system.py # 🔄 Sistema de captura automática
│   │
│   ├── uploads/                 # 📁 Archivos subidos por usuarios
│   └── __pycache__/             # 🗂️ Cache de Python
│
├── frontend/                    # 🌐 Interfaz de Usuario (React + Tailwind)
│   ├── package.json             # 📦 Dependencias Node.js/React
│   ├── tailwind.config.js       # 🎨 Configuración de Tailwind CSS
│   ├── postcss.config.js        # 🔧 Configuración PostCSS
│   ├── vercel.json              # ☁️ Configuración para Vercel
│   │
│   ├── public/                  # 📂 Archivos estáticos públicos
│   │   ├── index.html           # 🏠 Página HTML principal
│   │   └── favicon.ico          # 🔖 Icono de la aplicación
│   │
│   ├── src/                     # � Código fuente React
│   │   ├── App.js               # 🏗️ Componente principal de la aplicación
│   │   ├── index.js             # 🚪 Punto de entrada React
│   │   ├── index.css            # 🎨 Estilos globales y Tailwind
│   │   ├── App.css              # 🎭 Estilos específicos de App
│   │   │
│   │   └── components/          # 🧩 Componentes React reutilizables
│   │       ├── Navbar.js        # 🧭 Barra de navegación principal
│   │       ├── Upload.js        # 📤 Subida de archivos (imágenes/videos)
│   │       ├── Historial.js     # 📋 Visualización del historial completo
│   │       ├── RealTimeMonitorNew.js # 📡 Monitor en tiempo real con WebSockets
│   │       ├── Reports.js       # 📊 Dashboard de reportes y estadísticas
│   │       ├── Trayectoria.js   # 🗺️ Análisis de trayectorias
│   │       ├── ManualUsuario.js # 📖 Manual de usuario integrado
│   │       ├── ModelConfig.js   # ⚙️ Configuración del modelo IA
│   │       ├── Spinner.js       # ⏳ Componente de carga
│   │       ├── VideoPlayer.js   # ▶️ Reproductor de video
│   │       ├── CameraCapture.js # 📹 Captura desde cámara
│   │       └── ui/              # 🎨 Componentes UI reutilizables
│   │
│   └── build/                   # 📦 Aplicación compilada (producción)
│
└── uploads/                     # 📁 Directorio global de archivos
    └── temp_chunks/             # 🗂️ Archivos temporales de subida


##  Tecnologías Utilizadas

### Backend (Python + FastAPI)
- **FastAPI 0.104+**: Framework web moderno y rápido para APIs
- **YOLOv8 (Ultralytics)**: Modelo de detección de objetos en tiempo real
- **OpenCV**: Procesamiento de imágenes y video
- **MongoDB + Motor**: Base de datos NoSQL con driver asíncrono
- **WebSockets**: Comunicación en tiempo real cliente-servidor
- **Uvicorn**: Servidor ASGI de alto rendimiento
- **Pydantic**: Validación de datos y serialización
- **Python-dotenv**: Manejo de variables de entorno

### Frontend (React + Tailwind CSS)
- **React 19**: Biblioteca para interfaces de usuario
- **Tailwind CSS**: Framework CSS utilitario moderno
- **Axios**: Cliente HTTP para comunicación con API
- **React Icons**: Iconografía moderna
- **WebSocket API**: Conexión en tiempo real con backend

### Base de Datos
- **MongoDB Atlas/Local**: Base de datos NoSQL escalable
- **Índices optimizados**: Para búsquedas rápidas por fecha y número
- **Agregación avanzada**: Para reportes y estadísticas

## 📋 Prerrequisitos del Sistema

### Desarrollo Local
- **Python 3.11+** (recomendado 3.11 o superior)
- **Node.js 18+** y **npm 9+**
- **MongoDB** (local o Atlas)
- **Git** para control de versiones

### Hardware Recomendado
- **RAM**: Mínimo 8GB (recomendado 16GB para IA)
- **CPU**: Procesador multicúadro moderno
- **GPU**: Opcional, NVIDIA CUDA compatible para aceleración
- **Almacenamiento**: 10GB libres mínimo

### Cámaras (Opcional)
- Cámaras USB compatibles con OpenCV
- Cámaras IP con stream RTSP/HTTP
- Cámaras web estándar

## 🚀 Instalación y Despliegue

### 1. 📥 Clonar el Repositorio

```bash
git clone https://github.com/never130/ElDorado.git
cd ElDorado
```

### 2. 🗄️ Configuración de la Base de Datos

#### Opción A: MongoDB Atlas (Recomendado para producción)
1. Crear cuenta en [MongoDB Atlas](https://www.mongodb.com/atlas)
2. Crear un cluster gratuito
3. Configurar usuario y contraseña
4. Obtener string de conexión

#### Opción B: MongoDB Local
```bash
# Windows (con Chocolatey)
choco install mongodb

# macOS (con Homebrew)
brew install mongodb-community

# Ubuntu/Debian
sudo apt-get install mongodb

# Iniciar servicio
sudo systemctl start mongod
```

### 3. ⚙️ Configuración del Backend

```bash
cd backend
```

#### 3.1 Crear entorno virtual de Python
```bash
# Windows
python -m venv venv
venv\Scripts\activate

# macOS/Linux
python3 -m venv venv
source venv/bin/activate
```

#### 3.2 Instalar dependencias
```bash
pip install -r requirements.txt
```

#### 3.3 Configurar variables de entorno
Crear archivo `.env` en la carpeta `backend/`:

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

#### 3.4 Configurar cámaras (opcional)
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

#### 3.5 Iniciar el servidor backend

```bash
# Desarrollo
python main.py 
o
uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Producción
uvicorn main:app --host 0.0.0.0 --port 8000 --workers 4
```

### 4. 🌐 Configuración del Frontend

Abrir nueva terminal:

```bash
cd frontend
```

#### 4.1 Instalar dependencias de Node.js
```bash
npm install
```

#### 4.2 Configurar variables de entorno (opcional)
Crear archivo `.env` en la carpeta `frontend/`:

```env
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws/detections
GENERATE_SOURCEMAP=false
```

#### 4.3 Iniciar el servidor de desarrollo
```bash
# Desarrollo
npm run start

# Build para producción
npm run build
```

### 5. 🌍 Acceso a la Aplicación

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentación API**: http://localhost:8000/docs
- **Documentación Redoc**: http://localhost:8000/redoc


## 📚 Guía de Uso

### 🏠 Página Principal
- Navegación intuitiva entre todas las funcionalidades
- Dashboard con acceso rápido a las herramientas principales

### 📤 Subir Archivos
1. Seleccionar imágenes o videos desde el dispositivo
2. El sistema procesa automáticamente con IA
3. Visualizar resultados de detección en tiempo real
4. Las detecciones se guardan automáticamente en el historial

### 📡 Monitor en Tiempo Real
1. Seleccionar cámara del sistema
2. Iniciar monitoreo automático
3. Ver transmisión en vivo con detecciones superpuestas
4. Las detecciones aparecen automáticamente en el panel
5. Todas las detecciones se guardan en la base de datos

### 📋 Historial de Detecciones
- Visualizar todas las detecciones históricas
- Filtrar por número, fecha, evento o modelo
- Ordenar por diferentes campos
- Exportar resultados a CSV
- Paginación para navegar grandes volúmenes de datos

### 📊 Reportes y Estadísticas
- Análisis de detecciones por períodos
- Gráficos de tendencias y patrones
- Estadísticas de confianza del modelo
- Reportes de actividad por túnel/cámara

### ⚙️ Configuración del Modelo
- Ajustar parámetros de confianza
- Configurar umbrales de detección
- Calibrar modelo para diferentes condiciones

### 📖 Manual de Usuario
- Documentación completa integrada
- Guías paso a paso
- Troubleshooting y FAQ

## 🔍 API Endpoints Principales

### Detecciones
- `POST /detect/image` - Procesar imagen individual
- `POST /detect/video` - Procesar video
- `GET /historial/` - Obtener historial con filtros
- `GET /historial/export` - Exportar a CSV

### Monitoreo en Tiempo Real
- `POST /monitor/start/{camera_id}` - Iniciar monitoreo
- `POST /monitor/stop/{camera_id}` - Detener monitoreo
- `WS /ws/detections` - WebSocket para actualizaciones en vivo

### Cámaras
- `GET /cameras/list` - Listar cámaras disponibles
- `GET /cameras/system-info` - Información del sistema
- `GET /video/stream/{camera_id}` - Stream de video en vivo

### Reportes
- `GET /reports/daily` - Reporte diario
- `GET /reports/monthly` - Reporte mensual
- `GET /reports/statistics` - Estadísticas generales


### Problemas Comunes

#### 1. Error de conexión a MongoDB
```bash
# Verificar estado de MongoDB
sudo systemctl status mongod

# Reiniciar servicio
sudo systemctl restart mongod
```

#### 2. Cámaras no detectadas
```bash
# Verificar configuración de cámaras
cat backend/cameras_config.json

# Verificar endpoint de cámaras
curl http://localhost:8000/cameras/list
```

#### 3. Modelo YOLO no carga
- Verificar que existe `backend/models/numeros_enteros/yolo_model/training/best.pt`
- Comprobar permisos de lectura del archivo
- Verificar versión de ultralytics compatible

#### 4. WebSocket desconectado
- Verificar que el backend está ejecutándose
- Comprobar configuración de CORS
- Revisar firewall/proxy settings

### Comandos de Verificación
```bash
# Verificar estado del backend
curl http://localhost:8000/health

# Verificar cámaras
curl http://localhost:8000/cameras/list

# Verificar conexión a base de datos
python -c "from database import get_database; import asyncio; asyncio.run(get_database())"
```

### Backup de Base de Datos
```bash
# MongoDB dump
mongodump --uri="mongodb://localhost:27017/el_dorado" --out=./backup

# Restaurar
mongorestore --uri="mongodb://localhost:27017/el_dorado" ./backup/el_dorado
```


## 🤝 Contribuciones

### Proceso de Desarrollo
1. Fork del repositorio
2. Crear rama para nueva funcionalidad
3. Desarrollar y escribir tests
4. Hacer pull request con descripción detallada

### Estándares de Código
- **Python**: PEP 8, type hints, docstrings
- **JavaScript**: ESLint, Prettier, JSDoc
- **Commits**: Conventional Commits format


## 👥 Equipo de Desarrollo


**Contribuidores:**
- Ever Loza
- Maria Celeste Moreno
- Carlos Gongora
- Dario Verdun

## 🔄 Actualizaciones y Roadmap

### Versión Actual: 1.0.0
- ✅ Sistema básico de detección
- ✅ Interface web completa
- ✅ Monitor en tiempo real
- ✅ Historial y reportes

---

*📅 Última actualización: Julio 2025*

