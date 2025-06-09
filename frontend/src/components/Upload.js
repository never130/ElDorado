import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const Feedback = ({ status, message, details }) => {
  if (!status) return null;
  let color = "text-cyan-700";
  let icon = "ℹ️";
  if (status === "ok") { color = "text-green-600"; icon = "✅"; }
  if (status === "error") { color = "text-red-600"; icon = "❌"; }
  if (status === "ignored") { color = "text-yellow-600"; icon = "⚠️"; }
  
  return (
    <div className={`font-bold text-center mt-2 ${color}`}>
      <div className="flex items-center justify-center gap-2">
        <span>{icon}</span>
        <span>{message}</span>
      </div>
      {details && (
        <div className="text-sm font-normal mt-2 p-3 bg-gray-50 rounded-lg">
          {details}
        </div>
      )}
    </div>
  );
};

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [feedback, setFeedback] = useState(null);
  const [progress, setProgress] = useState(null);
  const [evento, setEvento] = useState("ingreso");
  const [tunel, setTunel] = useState("");
  const [merma, setMerma] = useState("");  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);

  useEffect(() => {
    // Cargar información del modelo
    const fetchModelInfo = async () => {
      try {
        const response = await axios.get('http://localhost:8000/model/info');
        setModelInfo(response.data);
      } catch (error) {
        console.error('Error loading model info:', error);
      }
    };
    fetchModelInfo();
  }, []);

  const handleChange = (e) => {
    setFiles(Array.from(e.target.files));
  };
  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;
    setLoading(true);
    setProgress({ current: 0, total: files.length });
    
    const formData = new FormData();
    files.forEach((file) => formData.append("files", file));
    formData.append("evento", evento);
    formData.append("tunel", tunel);
    formData.append("merma", merma);
    
    try {
      const res = await axios.post(
        "http://localhost:8000/upload-multiple/",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
          timeout: 300000, // 5 minutos para videos grandes
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              setProgress({
                current: Math.round(
                  (progressEvent.loaded / progressEvent.total) * files.length
                ),
                total: files.length,
              });
            }
          },
        }
      );
      
      const ok = res.data.results.filter((r) => r.status === "ok").length;
      const ignored = res.data.results.filter((r) => r.status === "ignored").length;
      const fail = res.data.results.filter((r) => r.status === "error").length;
      
      let msg = `✅ Procesados correctamente: ${ok}`;
      if (ignored > 0) msg += `, ⚠️ Sin detección: ${ignored}`;
      if (fail > 0) msg += `, ❌ Con errores: ${fail}`;
      
      // Mostrar detalles de errores si los hay
      const errorDetails = res.data.results
        .filter(r => r.status === "error")
        .map(r => `${r.filename}: ${r.error}`)
        .join(', ');
        
      if (errorDetails) {
        msg += `\n\nDetalles de errores: ${errorDetails}`;
      }
      
      setFeedback({
        status: fail > 0 ? "error" : ignored > 0 ? "warning" : "success",
        message: msg,
        details: res.data.results
      });
      
    } catch (err) {
      console.error('Error detallado:', err);
      
      let errorMessage = "Error al procesar archivos";
      
      if (err.response?.status === 422) {
        errorMessage = `Error 422: ${err.response.data.detail || 'Formato de archivo no válido o archivo corrupto'}`;
      } else if (err.response?.status === 413) {
        errorMessage = "Error: Archivo demasiado grande. Máximo 50MB por archivo.";
      } else if (err.code === 'ECONNABORTED') {
        errorMessage = "Timeout: El archivo es muy grande o la conexión es lenta. Intenta con un archivo más pequeño.";
      } else if (err.response?.data?.detail) {
        errorMessage = `Error: ${err.response.data.detail}`;
      }
      
      setFeedback({ 
        status: "error", 
        message: errorMessage,
        details: err.response?.data
      });
    }
    
    setFiles([]);
    setProgress(null);
    setLoading(false);
  };
  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-lg mt-6 mb-8 border border-cyan-200">      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-orange-600 mb-2">
          📤 Procesar Imágenes de Vagonetas
        </h2>
        <p className="text-gray-600">
          Sube una o múltiples imágenes para detectar automáticamente números calados
        </p>
        {modelInfo && (
          <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
            <div className="text-sm text-purple-700 font-semibold">
              🧠 Modelo Activo: {modelInfo.model_type} | 
              🎯 {modelInfo.classes_count} clases detectables | 
              📊 Confianza: {modelInfo.confidence_threshold}
            </div>
          </div>
        )}
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        {/* Área de selección de archivos */}
        <div className="border-2 border-dashed border-cyan-300 rounded-xl p-8 text-center bg-cyan-50 hover:bg-cyan-100 transition">
          <div className="mb-4">
            <svg className="mx-auto h-12 w-12 text-cyan-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
              <path d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <input
            type="file"
            accept="image/*,video/*"
            multiple
            onChange={handleChange}
            className="hidden"
            id="file-upload"
          />
          <label htmlFor="file-upload" className="cursor-pointer">
            <span className="text-lg font-semibold text-cyan-700">
              Haz clic para seleccionar archivos
            </span>
            <p className="text-cyan-600 mt-1">
              Soporta imágenes (JPG, PNG) y videos (MP4, AVI)
            </p>
          </label>        </div>

        {/* Archivos seleccionados */}
        {files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              📁 Archivos seleccionados ({files.length})
            </h3>
            <div className="space-y-2">
              {files.map((file, index) => {
                const isVideo = file.type.startsWith('video/');
                const isImage = file.type.startsWith('image/');
                const fileSize = (file.size / (1024 * 1024)).toFixed(2);
                
                return (
                  <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                    <div className="text-2xl">
                      {isVideo ? '🎬' : isImage ? '🖼️' : '📄'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {isVideo ? '📹 Video' : '🖼️ Imagen'} • {fileSize} MB
                        {isVideo && <span className="text-blue-600"> • Se procesarán varios frames</span>}
                      </div>
                    </div>
                    <button
                      onClick={() => setFiles(files.filter((_, i) => i !== index))}
                      className="text-red-500 hover:text-red-700 text-xl"
                      title="Eliminar archivo"
                    >
                      ❌
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Configuración básica */}
        <div className="grid md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Evento</label>
            <select
              value={evento}
              onChange={(e) => setEvento(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white"
            >
              <option value="ingreso">🟢 Ingreso</option>
              <option value="egreso">🔴 Egreso</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Túnel (opcional)</label>
            <input
              type="text"
              placeholder="ej: Túnel A"
              value={tunel}
              onChange={(e) => setTunel(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">% Merma (opcional)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              placeholder="0.00"
              value={merma}
              onChange={(e) => setMerma(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
        </div>

        {/* Botón de subida */}
        <div className="text-center">
          <button
            type="submit"
            disabled={!files.length || loading}
            className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed text-lg shadow-lg"
          >
            {loading ? (
              <div className="flex items-center gap-2">
                <Spinner size={20} />
                Procesando...
              </div>
            ) : (
              `Procesar ${files.length > 0 ? `${files.length} archivo${files.length > 1 ? 's' : ''}` : 'archivos'}`
            )}
          </button>
        </div>
      </form>

      {/* Progreso */}
      {progress && (
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center gap-2 text-blue-700">
            <div className="animate-spin h-4 w-4 border-2 border-blue-600 border-t-transparent rounded-full"></div>
            <span>Procesando {progress.current} de {progress.total} archivos...</span>
          </div>
        </div>
      )}

      {/* Feedback */}
      <Feedback status={feedback?.status} message={feedback?.message} />

      {/* Vista previa de archivos seleccionados */}
      {files.length > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-3">
            Archivos seleccionados ({files.length})
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {files.map((file, idx) => (
              <div key={idx} className="relative group">
                <div className="border border-gray-200 rounded-lg p-2 bg-gray-50 hover:bg-gray-100 transition">
                  {file.type.startsWith('image/') ? (
                    <img
                      src={URL.createObjectURL(file)}
                      alt={file.name}
                      className="w-full h-20 object-cover rounded"
                    />
                  ) : (
                    <div className="w-full h-20 bg-gray-200 rounded flex items-center justify-center">
                      <svg className="h-8 w-8 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M2 6a2 2 0 012-2h6l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                      </svg>
                    </div>
                  )}
                  <p className="text-xs text-gray-600 mt-1 truncate" title={file.name}>
                    {file.name}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
