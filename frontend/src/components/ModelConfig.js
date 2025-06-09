import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './ModelConfig.css';

const ModelConfig = () => {
  const [config, setConfig] = useState({
    min_confidence: 0.25,
    usar_agrupacion: true,
    umbral_agrupacion: 50,
    modo_deteccion: 'mejorado'
  });
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModelInfo();
  }, []);

  const fetchModelInfo = async () => {
    try {
      const response = await axios.get('http://localhost:8000/model/info');
      setModelInfo(response.data);
    } catch (error) {
      console.error('Error fetching model info:', error);
    }
  };

  const updateConfig = async (newConfig) => {
    setLoading(true);
    try {
      await axios.post('http://localhost:8000/model/config', newConfig);
      setConfig(newConfig);
    } catch (error) {
      console.error('Error updating config:', error);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-lg mt-6 mb-8 border border-cyan-200">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-purple-600 mb-2">
          🧠 Configuración del Modelo IA
        </h2>
        <p className="text-gray-600">
          Ajusta los parámetros del modelo YOLOv8 NumerosCalados
        </p>
      </div>      {/* Información del Modelo */}
      {modelInfo && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-6 mb-6">
          <h3 className="text-xl font-bold text-purple-700 mb-4">📊 Estado del Modelo</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg p-4 shadow-sm model-info-card">
              <div className="text-2xl font-bold text-green-600">{modelInfo.classes_count}</div>
              <div className="text-sm text-gray-600">Clases Detectables</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm model-info-card">
              <div className="text-2xl font-bold text-blue-600">{modelInfo.confidence_threshold}</div>
              <div className="text-sm text-gray-600">Umbral Confianza</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm model-info-card">
              <div className="text-2xl font-bold text-purple-600">{modelInfo.model_size}</div>
              <div className="text-sm text-gray-600">Tamaño Modelo</div>
            </div>
            <div className="bg-white rounded-lg p-4 shadow-sm model-info-card">
              <div className="text-2xl font-bold text-orange-600 status-pulse">{modelInfo.training_epochs}</div>
              <div className="text-sm text-gray-600">Épocas Entrenamiento</div>
            </div>
          </div>
        </div>
      )}

      {/* Configuración Avanzada */}
      <div className="space-y-6">
        <div className="grid md:grid-cols-2 gap-6">
          {/* Confianza Mínima */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              🎯 Confianza Mínima: {config.min_confidence}
            </label>
            <input
              type="range"
              min="0.01"
              max="0.95"
              step="0.01"
              value={config.min_confidence}
              onChange={(e) => setConfig({...config, min_confidence: parseFloat(e.target.value)})}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Muy Sensible (0.01)</span>
              <span>Muy Estricto (0.95)</span>
            </div>
          </div>

          {/* Umbral de Agrupación */}
          <div className="space-y-2">
            <label className="block text-sm font-semibold text-gray-700">
              🔗 Umbral Agrupación: {config.umbral_agrupacion}px
            </label>
            <input
              type="range"
              min="10"
              max="200"
              step="5"
              value={config.umbral_agrupacion}
              onChange={(e) => setConfig({...config, umbral_agrupacion: parseInt(e.target.value)})}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
            />
            <div className="flex justify-between text-xs text-gray-500">
              <span>Muy Cercano (10px)</span>
              <span>Muy Lejano (200px)</span>
            </div>
          </div>
        </div>

        {/* Opciones de Modo */}
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

        {/* Botón de Aplicar */}
        <div className="text-center pt-4">
          <button
            onClick={() => updateConfig(config)}
            disabled={loading}
            className="px-8 py-3 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed text-lg shadow-lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                Aplicando...
              </div>
            ) : (
              '💾 Aplicar Configuración'
            )}
          </button>
        </div>
      </div>

      {/* Clases Detectables */}
      {modelInfo?.classes && (          <div className="mt-8 p-6 bg-gray-50 rounded-xl">
            <h3 className="text-lg font-bold text-gray-700 mb-4">🎯 Números Calados Detectables</h3>
            <div className="grid grid-cols-5 md:grid-cols-10 gap-2">
              {modelInfo.classes.map((cls, idx) => (
                <div key={idx} className="bg-white px-3 py-2 rounded-lg text-center font-mono text-sm border number-badge hover:bg-purple-50 hover:border-purple-300">
                  {cls}
                </div>
              ))}
            </div>
            <div className="mt-4 text-sm text-gray-600">
              💡 Estos son todos los números que el modelo puede detectar automáticamente
            </div>
          </div>
      )}
    </div>
  );
};

export default ModelConfig;
