// Configuración centralizada del backend
export const API_BASE_URL = 'http://127.0.0.1:8000';

// Helpers para construir URLs de API
export const apiUrl = (endpoint) => `${API_BASE_URL}${endpoint}`;

// URLs específicas comunes
export const API_ENDPOINTS = {
  vagonetas: '/vagonetas/',
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
