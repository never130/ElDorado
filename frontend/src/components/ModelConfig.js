import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import './ModelConfig.css';
import { API_BASE_URL } from '../config/api';

const ModelConfig = () => {
    const [config, setConfig] = useState({
    min_confidence: 0.25,
    usar_agrupacion: true,
    umbral_agrupacion: 50,
    modo_deteccion: 'mejorado'
  });
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);  const fetchModelInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/model/info`);
      setModelInfo(response.data);
      
      // Sincronizar el estado local con la configuración actual del modelo
      setConfig(prevConfig => ({
        ...prevConfig,
        min_confidence: response.data.confidence_threshold,
        umbral_agrupacion: response.data.umbral_agrupacion || 50
      }));
    } catch (error) {
      console.error('Error fetching model info:', error);
    }
  }, [API_BASE_URL]);

  useEffect(() => {
    fetchModelInfo();
  }, [fetchModelInfo]);
  const updateConfig = async (newConfig) => {
    setLoading(true);
    setNotification(null);
    try {
      await axios.post(`${API_BASE_URL}/model/config`, newConfig);
      setConfig(newConfig);
      setNotification({
        type: 'success',
        message: 'Configuración del modelo actualizada exitosamente'
      });
      console.log('✅ Configuración del modelo actualizada');
      
      // Refrescar la información del modelo
      await fetchModelInfo();
      
      // Auto-ocultar la notificación después de 3 segundos
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error('Error updating config:', error);
      setNotification({
        type: 'error',
        message: '❌ Error al actualizar la configuración del modelo'
      });
      
      // Auto-ocultar la notificación de error después de 5 segundos
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
    setLoading(false);
  };
  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-lg border border-slate-200 p-8 mt-6 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-semibold text-slate-900 mb-2">
          🧠 Configuración del Modelo IA
        </h2>
        <p className="text-slate-600 text-sm">
          Ajusta los parámetros principales del modelo YOLOv8: confianza y agrupación de números/ladrillos
        </p>
      </div>      {/* Notificación */}
      {notification && (
        <div className={`mb-6 p-4 rounded-md border ${
          notification.type === 'success' 
            ? 'bg-green-50 border-green-200 text-green-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <div className="text-green-600 text-sm font-medium">✓</div>
              ) : (
                <div className="text-red-600 text-sm font-medium">✕</div>
              )}
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium">{notification.message}</p>
            </div>
            <div className="ml-auto pl-3">
              <button
                onClick={() => setNotification(null)}
                className="text-slate-400 hover:text-slate-600 transition-colors"
              >
                <span className="sr-only">Cerrar</span>
                ✕
              </button>
            </div>
          </div>
        </div>
      )}      {/* Información del Modelo */}
      {modelInfo && (
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-6 mb-6">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">📊 Estado del Modelo</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-md border border-slate-200 p-4">
              <div className="text-2xl font-semibold text-slate-900">{modelInfo.classes_count}</div>
              <div className="text-sm text-slate-600">Clases Detectables</div>
            </div>
            <div className="bg-white rounded-md border border-slate-200 p-4">
              <div className="text-2xl font-semibold text-orange-600">{modelInfo.confidence_threshold}</div>
              <div className="text-sm text-slate-600">Umbral Confianza</div>
            </div>
            <div className="bg-white rounded-md border border-slate-200 p-4">
              <div className="text-2xl font-semibold text-slate-900">{modelInfo.model_size}</div>
              <div className="text-sm text-slate-600">Tamaño Modelo</div>
            </div>
            <div className="bg-white rounded-md border border-slate-200 p-4">
              <div className="text-2xl font-semibold text-slate-900">{modelInfo.training_epochs}</div>
              <div className="text-sm text-slate-600">Épocas Entrenamiento</div>
            </div>
          </div>
        </div>
      )}      {/* Configuración Avanzada */}
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Confianza Mínima */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              🎯 Confianza Mínima: <span className="text-orange-600 font-semibold">{config.min_confidence}</span>
            </label>
            <input
              type="range"
              min="0.01"
              max="0.95"
              step="0.01"
              value={config.min_confidence}
              onChange={(e) => setConfig({...config, min_confidence: parseFloat(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              style={{
                background: `linear-gradient(to right, #ea580c 0%, #ea580c ${((config.min_confidence - 0.01) / (0.95 - 0.01)) * 100}%, #e2e8f0 ${((config.min_confidence - 0.01) / (0.95 - 0.01)) * 100}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Muy Sensible (0.01)</span>
              <span>Muy Estricto (0.95)</span>
            </div>
          </div>

          {/* Umbral de Agrupación */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-slate-900">
              🔗 Umbral Agrupación: <span className="text-orange-600 font-semibold">{config.umbral_agrupacion}px</span>
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={config.umbral_agrupacion}
              onChange={(e) => setConfig({...config, umbral_agrupacion: parseInt(e.target.value)})}
              className="w-full h-2 bg-slate-200 rounded-full appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
              style={{
                background: `linear-gradient(to right, #ea580c 0%, #ea580c ${((config.umbral_agrupacion - 10) / (200 - 10)) * 100}%, #e2e8f0 ${((config.umbral_agrupacion - 10) / (200 - 10)) * 100}%, #e2e8f0 100%)`
              }}
            />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Muy Cercano (10px)</span>
              <span>Muy Lejano (200px)</span>
            </div>
          </div>
        </div>{/* Opciones de Modo - OCULTAS POR NO ESTAR IMPLEMENTADAS */}
        {/* 
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <input
              type="checkbox"
              id="usar_agrupacion"
              checked={config.usar_agrupacion}
              onChange={(e) => setConfig({...config, usar_agrupacion: e.target.checked})}
              className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
            />
            <label htmlFor="usar_agrupacion" className="text-sm font-medium text-gray-700">
              🧩 Usar Agrupación de Números Compuestos
            </label>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">🔧 Modo de Detección</label>
            <select
              value={config.modo_deteccion}
              onChange={(e) => setConfig({...config, modo_deteccion: e.target.value})}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white"
            >
              <option value="mejorado">🚀 Mejorado (Agrupación + Multi-Config)</option>
              <option value="estandar">⚡ Estándar (YOLOv8 Directo)</option>
              <option value="agresivo">🔥 Agresivo (Múltiples Intentos)</option>
            </select>
          </div>
        </div>
        */}        {/* Botón de Aplicar */}
        <div className="text-center pt-6">
          <button
            onClick={() => updateConfig(config)}
            disabled={loading}
            className="inline-flex items-center px-6 py-3 bg-orange-600 hover:bg-orange-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2"
          >
            {loading ? (
              <>
                <div className="animate-spin -ml-1 mr-2 h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Aplicando...
              </>
            ) : (
              <>
                💾 Aplicar Configuración
              </>
            )}
          </button>
        </div>
      </div>      {/* Clases Detectables */}
      {modelInfo?.classes && (
        <div className="mt-8 p-6 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900 mb-4">🎯 Números y ladrillos detectables</h3>
          <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
            {modelInfo.classes.map((cls, idx) => (
              <div key={idx} className="bg-white border border-slate-200 px-3 py-2 rounded-md text-center font-mono text-sm text-slate-700 hover:bg-orange-50 hover:border-orange-200 transition-colors">
                {cls}
              </div>
            ))}
          </div>
          <div className="mt-4 text-sm text-slate-600">
            💡 Estos son todos los números que el modelo puede detectar automáticamente
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelConfig;
