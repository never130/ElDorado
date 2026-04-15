import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import { Settings2, Activity, Database, CheckCircle2, XCircle, X, Save, Search, Target, HelpCircle, Layers } from 'lucide-react';
import Spinner from './Spinner';

const ModelConfig = () => {
    const [config, setConfig] = useState({
    min_confidence: 0.25,
    usar_agrupacion: true,
    umbral_agrupacion: 50,
    modo_deteccion: 'mejorado'
  });
  const [modelInfo, setModelInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [notification, setNotification] = useState(null);

  const fetchModelInfo = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/model/info`);
      setModelInfo(response.data);
      
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
      
      await fetchModelInfo();
      
      setTimeout(() => {
        setNotification(null);
      }, 3000);
    } catch (error) {
      console.error('Error updating config:', error);
      setNotification({
        type: 'error',
        message: 'Error al actualizar la configuración del modelo'
      });
      
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-4xl mx-auto card p-8 mt-6 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2 flex items-center justify-center gap-3">
          <Settings2 className="w-8 h-8 text-orange-600" /> Configuración del Modelo IA
        </h2>
        <p className="text-slate-600 text-lg">
          Ajusta los parámetros principales del modelo YOLOv8: confianza y agrupación
        </p>
      </div>

      {notification && (
        <div className={`mb-6 p-4 rounded-xl border animate-in fade-in flex items-start gap-3 ${
          notification.type === 'success' 
            ? 'bg-emerald-50 border-emerald-200 text-emerald-800' 
            : 'bg-red-50 border-red-200 text-red-800'
        }`}>
          {notification.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 flex-shrink-0 mt-0.5" />
          ) : (
            <XCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1 font-medium">{notification.message}</div>
          <button
            onClick={() => setNotification(null)}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {modelInfo && (
        <div className="bg-slate-50 rounded-xl border border-slate-200 p-6 mb-8">
          <h3 className="text-xl font-bold text-slate-900 mb-6 flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-600" /> Estado del Modelo
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center shadow-sm">
              <Target className="w-6 h-6 text-orange-400 mb-2" />
              <div className="text-3xl font-bold text-slate-900 mb-1">{modelInfo.classes_count}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Clases</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center shadow-sm ring-2 ring-orange-500/20 ring-offset-1">
              <Activity className="w-6 h-6 text-orange-600 mb-2" />
              <div className="text-3xl font-bold text-orange-600 mb-1">{modelInfo.confidence_threshold}</div>
              <div className="text-xs font-medium text-orange-600/70 uppercase tracking-wider">Confianza</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center shadow-sm">
              <Database className="w-6 h-6 text-orange-400 mb-2" />
              <div className="text-3xl font-bold text-slate-900 mb-1">{modelInfo.model_size}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tamaño</div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col items-center justify-center text-center shadow-sm">
              <Layers className="w-6 h-6 text-orange-400 mb-2" />
              <div className="text-3xl font-bold text-slate-900 mb-1">{modelInfo.training_epochs}</div>
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Épocas</div>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-8">
        <div className="grid md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <label className="flex items-center justify-between text-sm font-bold text-slate-900">
              <span className="flex items-center gap-2"><Target className="w-4 h-4 text-orange-600" /> Confianza Mínima</span>
              <span className="text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{config.min_confidence}</span>
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
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Muy Sensible (0.01)</span>
              <span>Muy Estricto (0.95)</span>
            </div>
          </div>

          <div className="space-y-4">
            <label className="flex items-center justify-between text-sm font-bold text-slate-900">
              <span className="flex items-center gap-2"><Layers className="w-4 h-4 text-orange-600" /> Umbral Agrupación</span>
              <span className="text-orange-600 bg-orange-50 px-3 py-1 rounded-full">{config.umbral_agrupacion}px</span>
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
            <div className="flex justify-between text-xs font-medium text-slate-400">
              <span>Muy Cercano (10px)</span>
              <span>Muy Lejano (200px)</span>
            </div>
          </div>
        </div>

        <div className="flex justify-center pt-8 border-t border-slate-100">
          <button
            onClick={() => updateConfig(config)}
            disabled={loading}
            className="btn-primary text-lg px-8 py-3"
          >
            {loading ? (
              <><Spinner size={20} color="#ffffff" /><span className="ml-2">Aplicando...</span></>
            ) : (
              <><Save className="w-5 h-5 mr-2" /> Aplicar Configuración</>
            )}
          </button>
        </div>
      </div>

      {modelInfo?.classes && (
        <div className="mt-10 p-6 bg-slate-50 rounded-xl border border-slate-200">
          <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
            <Search className="w-5 h-5 text-orange-600" /> Clases Detectables
          </h3>
          <div className="flex flex-wrap gap-2">
            {modelInfo.classes.map((cls, idx) => (
              <span key={idx} className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg font-mono text-sm font-semibold text-slate-700 hover:bg-orange-50 hover:border-orange-200 hover:text-orange-700 transition-colors shadow-sm">
                {cls}
              </span>
            ))}
          </div>
          <div className="mt-5 text-sm text-slate-500 flex items-center gap-2 font-medium">
            <HelpCircle className="w-4 h-4 text-orange-400" /> Estas son las clases (números y ladrillos) que el modelo puede detectar automáticamente
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelConfig;
