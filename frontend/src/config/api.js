// Configuración centralizada del backend.
// Override vía REACT_APP_API_URL / REACT_APP_WS_URL en .env del frontend.
export const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';
export const WS_BASE_URL =
  process.env.REACT_APP_WS_URL ||
  API_BASE_URL.replace(/^http/, 'ws') + '/ws/detections';

// Ayuda a construir URLs a archivos subidos (imagen_path devuelto por el backend).
export const assetUrl = (path) => {
  if (!path) return '';
  const clean = String(path).replace(/^\/+/, '');
  return `${API_BASE_URL}/${clean}`;
};

// Helpers para construir URLs de API
export const apiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

// URLs específicas comunes
export const API_ENDPOINTS = {
  vagonetas: '/historial/',
  autoCapture: {
    start: '/auto-capture/start',
    stop: '/auto-capture/stop',
    status: '/auto-capture/status',
    config: '/auto-capture/config'
  },
  video: {
    frame: (cameraId) => `/video/frame/${cameraId}`,
    info: (cameraId) => `/video/info/${cameraId}`,
    stream: (cameraId) => `/video/stream/${cameraId}`
  },
  upload: '/upload/',
  uploadMultiple: '/upload-multiple/',
  trayectoria: (numero) => `/trayectoria/${numero}`
};
