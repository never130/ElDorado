# 🖥️ Frontend - Sistema de Detección de Números Calados

## 📋 Descripción
Interfaz web moderna desarrollada en React para interactuar con el sistema de detección de números calados, visualizar resultados en tiempo real, consultar historial detallado y acceder a documentación educativa completa.

## 🎯 ¿Qué hace?
- **Visualización en Tiempo Real**: Interfaz para monitorear detecciones de números calados
- **Carga de Archivos**: Subida de imágenes y videos para procesamiento con YOLO
- **Historial Inteligente**: Consulta avanzada con filtros por fecha, número y confianza
- **Trayectoria Visual**: Seguimiento temporal detallado de vagonetas específicas
- **Manual Educativo**: Documentación completa sobre el sistema de números calados
- **Captura desde Cámaras**: Control directo de cámaras físicas para detección automática

## Instalación rápida

### Requisitos previos
- Node.js 16+
- npm
- Git

### 1. Clona el repositorio
```bash
# Clona el repositorio y entra al frontend
 git clone <URL_DEL_REPOSITORIO>
 cd ElDorado/frontend
```

### 2. Instala las dependencias
```bash
npm install
```

### 3. Configura la URL del backend (opcional)
Por defecto, el frontend está configurado para conectarse al backend en `http://localhost:8000`. Si necesitas usar otro puerto o dominio, modifica la configuración en `src/config/api.js`:

```javascript
// src/config/api.js
const API_BASE_URL = 'http://localhost:8000'; // Cambiar si es necesario
```

### 4. Inicia la aplicación
```bash
npm start
```

La app se abrirá en tu navegador en http://localhost:3000

## 🚀 Funcionalidades principales

### 🎥 **Captura en Tiempo Real**
- Conexión directa con cámaras físicas para detección automática
- Visualización en vivo del stream de video
- Control de inicio/parada de captura por cámara
- Sistema de cooldown inteligente para evitar duplicados

### 📤 **Carga de Archivos**
- **Imágenes**: Soporte para JPG, PNG, WEBP con vista previa
- **Videos**: Procesamiento completo de MP4, AVI, MOV frame por frame
- **Lotes**: Carga múltiple de archivos para procesamiento masivo
- **Validación**: Verificación de formato y tamaño antes del envío

### 📊 **Historial y Consultas**
- Tabla interactiva con resultados de detección
- Filtros avanzados: fecha, número, tipo de detección, confianza
- Exportación de datos en diferentes formatos
- Paginación optimizada para grandes volúmenes

### 🗺️ **Trayectoria de Vagonetas**
- Visualización cronológica del recorrido de cada vagoneta
- Mapeo de puntos de detección con timestamps
- Análisis de patrones de movimiento
- Exportación de rutas específicas

### 📚 **Manual de Usuario Integrado**
- **Sistema de Numeración**: Explicación completa de números calados vs enteros
- **Guía de Operación**: Instrucciones paso a paso para usar el sistema
- **Casos de Uso**: Ejemplos prácticos y mejores prácticas
- **Troubleshooting**: Solución a problemas comunes
- **FAQ**: Preguntas frecuentes con respuestas detalladas
- **Especificaciones Técnicas**: Detalles del hardware y software

## 📁 Estructura de Componentes
```
src/
├── App.js                    # Componente principal y enrutamiento
├── App.css                   # Estilos globales y variables CSS
├── index.js                  # Punto de entrada de React
├── index.css                 # Estilos base con Tailwind
├── components/
│   ├── Navbar.js            # Navegación principal con menú responsive
│   ├── Upload.js            # Carga de archivos con drag & drop
│   ├── CameraCapture.js     # Control de cámaras en tiempo real
│   ├── Historial.js         # Tabla de resultados con filtros
│   ├── Trayectoria.js       # Visualización de rutas de vagonetas
│   ├── ManualUsuario.js     # 🆕 Documentación educativa completa
│   ├── RealTimeMonitor.js   # Monitor de detecciones en vivo
│   ├── AutoCaptureControl.js # Control automático de captura
│   ├── VideoPlayer.js       # Reproductor para videos procesados
│   ├── VideoTrainingMonitor.js # Monitor para entrenamiento
│   ├── GuiaUsuario.js       # Guía rápida de uso
│   └── Spinner.js           # Componente de loading
└── config/
    └── api.js               # Configuración centralizada de API
```

## 🎨 Características de Diseño
- **Responsive Design**: Adaptable a desktop, tablet y móvil
- **Loading States**: Spinners y progress bars para mejor UX
- **Error Handling**: Mensajes informativos para errores de red o procesamiento
- **Drag & Drop**: Interfaz intuitiva para carga de archivos

## ⚙️ Notas importantes
- **Flujo Principal**: El sistema está optimizado para funcionar con cámaras físicas en tiempo real
- **Modelos YOLO**: Requiere que el backend tenga los modelos entrenados en `backend/models/`
- **Compatibilidad**: Funciona en navegadores modernos con soporte para ES6+
- **Performance**: Optimizado para manejar múltiples detecciones simultáneas
- **Seguridad**: Validación de archivos en cliente y servidor

## 🎯 Personalización
- **Estilos**: Modifica `src/App.css` y utiliza clases de Tailwind para cambios visuales
- **Branding**: Reemplaza logo en `public/logo.jpg` y actualiza colores en `tailwind.config.js`
- **API Endpoints**: Centraliza cambios en `src/config/api.js`
- **Componentes**: Estructura modular permite agregar nuevas funcionalidades fácilmente

## 📋 Requisitos del Sistema
- **Node.js**: Versión 16.0 o superior
- **npm**: Versión 7.0 o superior (incluido con Node.js)
- **Navegador**: Chrome 88+, Firefox 85+, Safari 14+, Edge 88+
- **Backend**: Sistema backend corriendo en http://localhost:8000
- **Memoria**: Mínimo 4GB RAM para procesamiento de videos
- **Almacenamiento**: 1GB libre para caché y archivos temporales

## 🌐 URLs y Puertos
- **Desarrollo**: http://localhost:3000 (servidor de desarrollo React)
- **Backend API**: http://localhost:8000 (servidor FastAPI)
- **Build de Producción**: Configurable según servidor web

---

## 🚀 Inicio Rápido

Para comenzar a usar el sistema inmediatamente:

1. **Asegúrate que el backend esté corriendo** en puerto 8000
2. **Ejecuta el frontend** con `npm start`
3. **Accede a http://localhost:3000**
4. **Ve al Manual de Usuario** para aprender sobre números calados
5. **Comienza con Carga de Archivos** para probar el sistema
6. **Configura Cámaras** para uso en producción

El sistema incluye documentación completa integrada - ¡no necesitas leer manuales externos!

## 🛠️ Tecnologías Usadas y Para Qué Sirve Cada Una
- **React 18:** Framework principal para construir interfaces de usuario modernas y reactivas
- **Axios:** Cliente HTTP para comunicación asíncrona con el backend y manejo de archivos
- **Tailwind CSS:** Framework CSS utilitario para diseño responsivo y componentes estilizados
- **React Hooks:** useState, useEffect, useCallback para manejo de estado y efectos
- **JavaScript ES6+:** Sintaxis moderna con async/await, destructuring y módulos
- **CSS Grid/Flexbox:** Layouts responsivos y adaptables a diferentes dispositivos
- **File API:** Manejo nativo del navegador para carga y vista previa de archivos
- **WebRTC (futuro):** Para integración directa con cámaras web del navegador

## 🔄 Flujo de Interacción Completo
1. **Acceso Principal**: Usuario ingresa al sistema y visualiza dashboard principal
2. **Selección de Modo**:
   - **Tiempo Real**: Conecta cámaras físicas para detección automática
   - **Carga Manual**: Sube imágenes/videos para procesamiento bajo demanda
3. **Procesamiento**:
   - Frontend envía archivos al backend usando Axios con progress tracking
   - Muestra spinner y progress bar durante procesamiento
   - Backend responde con resultados de detección YOLO
4. **Visualización**:
   - Presenta resultados con confianza, coordenadas y metadatos
   - Permite filtrado, búsqueda y exportación de datos
5. **Consulta Histórica**:
   - Acceso a base de datos completa con filtros avanzados
   - Visualización de trayectorias y patrones de movimiento

