# 🌐 Frontend - Sistema El Dorado

## 📋 Descripción

Interfaz web moderna desarrollada en React para el Sistema El Dorado de detección de números en vagonetas de carga. Proporciona una experiencia de usuario intuitiva para monitorear detecciones en tiempo real, gestionar archivos multimedia, consultar historial detallado y acceder a reportes estadísticos completos.

## 🎯 Características Principales

- **📡 Monitor en Tiempo Real**: Visualización de detecciones en vivo con WebSockets
- **📤 Gestión de Archivos**: Subida y procesamiento de imágenes y videos con IA
- **📋 Historial Inteligente**: Consulta avanzada con filtros por fecha, número y confianza
- **📊 Dashboard de Reportes**: Análisis estadístico y visualización de tendencias
- **🗺️ Análisis de Trayectorias**: Seguimiento temporal de vagonetas específicas
- **📖 Manual Integrado**: Documentación completa del sistema accesible desde la interfaz
- **📹 Control de Cámaras**: Gestión directa de cámaras físicas para monitoreo automático
- **🎨 Diseño Responsivo**: Interfaz adaptable a desktop, tablet y móvil

## 🏗️ Arquitectura Frontend

```
src/
├── App.js                    # 🏗️ Componente principal y enrutamiento
├── index.js                  # 🚪 Punto de entrada React
├── index.css                 # 🎨 Estilos globales con Tailwind CSS
├── App.css                   # 🎭 Estilos específicos de componentes
│
└── components/               # 🧩 Componentes React reutilizables
    ├── Navbar.js            # 🧭 Navegación principal responsiva
    ├── Upload.js            # 📤 Subida de archivos con drag & drop
    ├── Historial.js         # 📋 Tabla de resultados con filtros avanzados
    ├── RealTimeMonitorNew.js # 📡 Monitor en tiempo real con WebSockets
    ├── Reports.js           # 📊 Dashboard de reportes y estadísticas
    ├── Trayectoria.js       # 🗺️ Visualización de rutas de vagonetas
    ├── ManualUsuario.js     # 📖 Manual de usuario integrado
    ├── ModelConfig.js       # ⚙️ Configuración del modelo IA
    ├── Spinner.js           # ⏳ Componente de loading
    ├── VideoPlayer.js       # ▶️ Reproductor de video
    ├── CameraCapture.js     # 📹 Captura desde cámara
    └── ui/                  # 🎨 Componentes UI base
```

## 🛠️ Stack Tecnológico

### Framework Principal
- **React 19**: Biblioteca para interfaces de usuario modernas
- **JavaScript ES6+**: Sintaxis moderna con async/await y módulos
- **React Hooks**: useState, useEffect, useCallback para gestión de estado

### Diseño y Estilos
- **Tailwind CSS**: Framework CSS utilitario para diseño responsivo
- **CSS Grid/Flexbox**: Layouts adaptativos a diferentes dispositivos
- **React Icons**: Iconografía moderna y consistente

### Comunicación
- **Axios**: Cliente HTTP para comunicación asíncrona con backend
- **WebSocket API**: Conexión en tiempo real para actualizaciones instantáneas
- **File API**: Manejo nativo del navegador para archivos

### Funcionalidades Avanzadas
- **Drag & Drop**: Interfaz intuitiva para carga de archivos
- **Real-time Updates**: Actualizaciones instantáneas vía WebSocket
- **Responsive Design**: Adaptable a todos los dispositivos
- **Progressive Enhancement**: Funcionalidad básica garantizada

## 🚀 Instalación y Configuración

### � Prerrequisitos
- **Node.js 18+** y **npm 9+**
- **Git** para control de versiones
- **Backend API** ejecutándose en puerto 8000

### 1. � Clonar e Instalar

```bash
# Clonar el repositorio
git clone https://github.com/never130/ElDorado.git
cd ElDorado/frontend

# Instalar dependencias
npm install
```

### 2. ⚙️ Configuración (Opcional)

Crear archivo `.env` para variables de entorno:

```env
# Configuración de API
REACT_APP_API_URL=http://localhost:8000
REACT_APP_WS_URL=ws://localhost:8000/ws/detections

# Configuración de desarrollo
GENERATE_SOURCEMAP=false
REACT_APP_DEBUG=true
```

### 3. 🚀 Ejecutar la Aplicación

```bash
# Desarrollo
npm start

# Build para producción
npm run build

# Servir build localmente
npm run serve
```

### 4. 🌐 Acceso

- **Desarrollo**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentación API**: http://localhost:8000/docs

## � Funcionalidades del Sistema

### 📡 **Monitor en Tiempo Real**
- **Stream de Video**: Visualización en vivo desde cámaras configuradas
- **Detecciones Instantáneas**: Actualizaciones automáticas vía WebSocket
- **Control de Cámaras**: Inicio/parada de monitoreo por cámara individual
- **Panel de Estado**: Información en tiempo real del sistema y conexiones

### 📤 **Gestión de Archivos**
- **Formatos Soportados**: JPG, PNG, WEBP, MP4, AVI, MOV
- **Drag & Drop**: Interfaz intuitiva de arrastrar y soltar
- **Procesamiento Lote**: Carga múltiple para eficiencia operativa
- **Vista Previa**: Previsualización antes del procesamiento
- **Validación Automática**: Verificación de formato y tamaño

### 📋 **Historial Avanzado**
- **Filtros Inteligentes**: Por fecha, número, evento, confianza y modelo
- **Búsqueda Rápida**: Localización inmediata de registros específicos
- **Ordenamiento Dinámico**: Por cualquier columna, ascendente/descendente
- **Paginación Optimizada**: Navegación eficiente en grandes volúmenes
- **Exportación CSV**: Descarga de datos filtrados para análisis externo

### 📊 **Dashboard de Reportes**
- **Estadísticas Diarias**: Resumen de actividad por día
- **Análisis Mensual**: Tendencias y patrones a largo plazo
- **Métricas de Confianza**: Análisis de precisión del modelo IA
- **Gráficos Interactivos**: Visualización clara de datos históricos
- **Reportes Personalizados**: Filtros específicos por período y criterios

### 🗺️ **Análisis de Trayectorias**
- **Seguimiento Individual**: Historial completo por número de vagoneta
- **Ruta Cronológica**: Visualización temporal de movimientos
- **Puntos de Detección**: Mapeo de ubicaciones y timestamps
- **Patrones de Movimiento**: Análisis de comportamiento y rutas frecuentes
- **Exportación de Rutas**: Datos específicos para análisis posterior

### 📖 **Manual de Usuario Integrado**
- **Guía Completa**: Documentación paso a paso del sistema
- **Casos de Uso**: Ejemplos prácticos y mejores prácticas
- **Troubleshooting**: Solución a problemas comunes
- **FAQ**: Preguntas frecuentes con respuestas detalladas
- **Especificaciones**: Detalles técnicos del hardware y software

### ⚙️ **Configuración del Sistema**
- **Parámetros del Modelo**: Ajuste de confianza y umbrales de detección
- **Configuración de Cámaras**: Gestión de dispositivos de captura
- **Preferencias de Usuario**: Personalización de interfaz y notificaciones

## � Flujo de Interacción del Usuario

### 1. 🏠 **Acceso Principal**
- Usuario ingresa al sistema y visualiza dashboard principal
- Navegación intuitiva entre módulos desde la barra superior
- Estado del sistema visible con indicadores de conexión

### 2. 🎯 **Selección de Modo de Operación**

#### **📡 Tiempo Real**
1. Seleccionar cámara del sistema desde dropdown
2. Iniciar monitoreo automático con botón de control
3. Ver transmisión en vivo con overlay de detecciones
4. Recibir notificaciones instantáneas de nuevas detecciones
5. Monitorear panel de detecciones recientes en tiempo real

#### **📤 Carga Manual**
1. Acceder al módulo de subida de archivos
2. Seleccionar o arrastrar imágenes/videos al área de carga
3. Previsualizar archivos seleccionados antes del procesamiento
4. Iniciar procesamiento con seguimiento de progreso
5. Visualizar resultados inmediatos con metadatos completos

### 3. 🔍 **Procesamiento y Análisis**
- **Frontend**: Envía archivos al backend con indicadores de progreso
- **Backend**: Procesa con modelo YOLOv8 y responde con resultados estructurados
- **Visualización**: Presenta detecciones con confianza, coordenadas y metadatos
- **Almacenamiento**: Guarda automáticamente en base de datos para consulta posterior

### 4. 📊 **Consulta y Análisis Histórico**
- **Filtrado Avanzado**: Por número, fecha, evento, confianza o modelo detectado
- **Búsqueda Rápida**: Localización inmediata de registros específicos
- **Exportación de Datos**: Descarga de resultados filtrados en formato CSV
- **Análisis de Trayectorias**: Seguimiento temporal de vagonetas específicas

### 5. 📈 **Reportes y Estadísticas**
- **Dashboard Visual**: Gráficos de tendencias y patrones de detección
- **Métricas de Sistema**: Análisis de rendimiento y precisión del modelo
- **Reportes Personalizados**: Generación de informes por períodos específicos

## � Requisitos del Sistema

### **Navegador Web**
- **Chrome 88+** (recomendado)
- **Firefox 85+**
- **Safari 14+**
- **Edge 88+**

### **Hardware Mínimo**
- **RAM**: 4GB (recomendado 8GB para videos grandes)
- **Procesador**: Dual-core moderno
- **Almacenamiento**: 1GB libre para caché
- **Conexión**: Banda ancha estable para WebSocket

### **Resolución de Pantalla**
- **Mínima**: 1024x768
- **Recomendada**: 1920x1080 o superior
- **Soporte Móvil**: 375px+ ancho

## 🔧 Configuración Avanzada

### **Variables de Entorno Adicionales**
```env
# Debug y desarrollo
REACT_APP_DEBUG_MODE=true
REACT_APP_LOG_LEVEL=info

# Configuración de WebSocket
REACT_APP_WS_RECONNECT_INTERVAL=5000
REACT_APP_WS_MAX_RETRIES=10

# Configuración de archivos
REACT_APP_MAX_FILE_SIZE=100MB
REACT_APP_ALLOWED_TYPES=image/*,video/*

# UI personalización
REACT_APP_THEME=light
REACT_APP_PRIMARY_COLOR=#3b82f6
```

### **Personalización de Estilos**
```css
/* En src/index.css - Variables CSS personalizadas */
:root {
  --primary-color: #3b82f6;
  --secondary-color: #64748b;
  --success-color: #10b981;
  --warning-color: #f59e0b;
  --error-color: #ef4444;
  --background-color: #f8fafc;
}
```

### **Configuración de Tailwind**
```javascript
// tailwind.config.js - Personalización del tema
module.exports = {
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eff6ff',
          500: '#3b82f6',
          900: '#1e3a8a',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      }
    }
  }
}
```

## 🛠️ Troubleshooting

### **Problemas Comunes**

#### **1. Error de conexión con backend**
```bash
# Verificar que el backend esté ejecutándose
curl http://localhost:8000/health

# Verificar variables de entorno
echo $REACT_APP_API_URL
```

#### **2. WebSocket desconectado**
- Verificar que el backend soporte WebSockets en `/ws/detections`
- Comprobar firewall y configuración de proxy
- Revisar console del navegador para errores específicos

#### **3. Archivos no se procesan**
- Verificar formato de archivo soportado
- Comprobar tamaño del archivo (límite configurado)
- Revisar permisos de la carpeta uploads en backend

#### **4. Interfaz no responsiva**
- Limpiar caché del navegador
- Verificar que Tailwind CSS esté cargando correctamente
- Comprobar compatibilidad del navegador

### **Comandos de Diagnóstico**
```bash
# Verificar instalación de dependencias
npm list --depth=0

# Limpiar caché y reinstalar
rm -rf node_modules package-lock.json
npm install

# Build con análisis de bundle
npm run build -- --analyze

# Verificar compatibilidad del navegador
npx browserslist
```

## 🚀 Despliegue en Producción

### **Build Optimizado**
```bash
# Crear build de producción
npm run build

# Analizar tamaño del bundle
npm install -g serve
serve -s build
```

### **Vercel (Recomendado)**
```bash
# Instalar Vercel CLI
npm install -g vercel

# Deploy directo
vercel

# Configurar dominio personalizado
vercel --prod
```

### **Variables de Entorno para Producción**
```env
REACT_APP_API_URL=https://tu-backend-api.herokuapp.com
REACT_APP_WS_URL=wss://tu-backend-api.herokuapp.com/ws/detections
GENERATE_SOURCEMAP=false
REACT_APP_DEBUG_MODE=false
```

### **Nginx Configuration**
```nginx
server {
    listen 80;
    server_name tu-dominio.com;
    
    location / {
        root /var/www/build;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    location /api {
        proxy_pass http://backend:8000;
    }
}
```

## 🎯 Optimización de Performance

### **Mejores Prácticas**
- **Lazy Loading**: Componentes cargados bajo demanda
- **Memoización**: React.memo para componentes puros
- **Bundle Splitting**: Separación de código por rutas
- **Image Optimization**: Compresión automática de imágenes
- **Cache Strategy**: Estrategia de caché para assets estáticos

### **Métricas de Performance**
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **Time to Interactive**: < 3.0s

## 🤝 Desarrollo y Contribuciones

### **Setup de Desarrollo**
```bash
# Instalar dependencias de desarrollo
npm install --include=dev

# Ejecutar linting
npm run lint

# Ejecutar tests
npm test

# Pre-commit hooks
npm run pre-commit
```

### **Estructura de Commits**
```
feat: nueva funcionalidad para reportes avanzados
fix: corrección en filtros del historial  
docs: actualización de documentación
style: mejoras de diseño en componentes
refactor: optimización de componente Upload
test: tests para componente RealTimeMonitor
```

---

## 📚 Recursos Adicionales

- **React Documentation**: https://react.dev/
- **Tailwind CSS**: https://tailwindcss.com/docs
- **Axios Documentation**: https://axios-http.com/docs
- **WebSocket API**: https://developer.mozilla.org/en-US/docs/Web/API/WebSocket

---

*🌐 Frontend desarrollado para el Sistema El Dorado - Detección de Números de Vagonetas*
*📅 Última actualización: Julio 2025*
   - Backend responde con resultados de detección YOLO
4. **Visualización**:
   - Presenta resultados con confianza, coordenadas y metadatos
   - Permite filtrado, búsqueda y exportación de datos
5. **Consulta Histórica**:
   - Acceso a base de datos completa con filtros avanzados
   - Visualización de trayectorias y patrones de movimiento

