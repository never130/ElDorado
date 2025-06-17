import axios from 'axios';
import { API_BASE_URL } from './api';

// Crear instancia de axios con configuración base
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
    timeout: 10000, // 10 segundos de timeout
    headers: {
        'Content-Type': 'application/json',
    },
    withCredentials: false // Deshabilitar credenciales para CORS
});

// Interceptor para manejar errores
axiosInstance.interceptors.response.use(
    response => response,
    error => {
        if (error.code === 'ERR_NETWORK') {
            console.error('Error de conexión:', error.message);
            // Aquí podrías mostrar una notificación al usuario
        }
        return Promise.reject(error);
    }
);

export default axiosInstance;
