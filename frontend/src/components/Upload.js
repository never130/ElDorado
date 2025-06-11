import React, { useState, useEffect } from "react";
import axios from "axios";
import Spinner from "./Spinner";

const Feedback = ({ status, message, details }) => {
  if (!status) return null;
  let color = "text-cyan-700";
  let icon = "ℹ️";
  if (status === "success" || status === "ok") { color = "text-green-600"; icon = "✅"; } // Changed to "success" to match new feedback
  if (status === "error") { color = "text-red-600"; icon = "❌"; }
  if (status === "warning" || status === "ignored") { color = "text-yellow-600"; icon = "⚠️"; } // Changed to "warning"
  
  return (
    <div className={`font-bold text-center mt-4 p-4 rounded-lg ${status === 'success' ? 'bg-green-50' : status === 'error' ? 'bg-red-50' : status === 'warning' ? 'bg-yellow-50' : 'bg-cyan-50'} ${color}`}>
      <div className="flex items-center justify-center gap-2">
        <span>{icon}</span>
        <span>{message}</span>
      </div>
      {details && (
        <pre className="text-sm font-normal mt-2 p-3 bg-gray-100 rounded-lg text-left overflow-x-auto max-h-60">
          {details}
        </pre>
      )}
    </div>
  );
};

const Upload = () => {
  const [files, setFiles] = useState([]);
  const [feedback, setFeedback] = useState(null);
  // Progress state will now track overall progress of all files
  const [overallProgress, setOverallProgress] = useState(0); 
  const [evento, setEvento] = useState("ingreso");
  const [tunel, setTunel] = useState("");
  const [merma, setMerma] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  // Abort controller for cancellation
  const [abortController, setAbortController] = useState(null);
  // State to track individual file progress (optional, for more granular UI)
  const [fileProgress, setFileProgress] = useState({}); // { fileId: { loaded, total } }

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
    setFeedback(null); // Clear previous feedback
    setOverallProgress(0); // Reset progress
    setFileProgress({}); // Reset individual file progress
  };

  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;

    setLoading(true);
    setFeedback(null);
    setOverallProgress(0);
    setFileProgress({});
    
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    let totalUploadedSize = 0;
    const totalSizeAllFiles = files.reduce((acc, file) => acc + file.size, 0);
    
    const allFilesResults = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const fileId = generateFileId();
      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let ChunksUploadedCurrentFile = 0;

      setFileProgress(prev => ({
        ...prev,
        [fileId]: { name: file.name, loaded: 0, total: file.size, status: 'uploading' }
      }));

      for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
        if (newAbortController.signal.aborted) {
          setFeedback({ status: "error", message: "Carga cancelada por el usuario." });
          setLoading(false);
          return;
        }

        const start = chunkNumber * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const chunkFormData = new FormData();
        chunkFormData.append("fileChunk", chunk);
        chunkFormData.append("fileId", fileId);
        chunkFormData.append("chunkNumber", chunkNumber);
        chunkFormData.append("totalChunks", totalChunks);
        chunkFormData.append("originalFilename", file.name);

        try {
          await axios.post(
            "http://localhost:8000/upload-chunk/",
            chunkFormData,
            { 
              signal: newAbortController.signal,
              onUploadProgress: (progressEvent) => {
                // Calculate loaded for this specific chunk
                const chunkLoaded = progressEvent.loaded; 
                
                // Calculate total loaded for the current file so far
                const currentFileLoaded = start + chunkLoaded;

                // Update individual file progress
                setFileProgress(prev => ({
                  ...prev,
                  [fileId]: { 
                    ...prev[fileId],
                    loaded: currentFileLoaded, 
                  }
                }));

                // Calculate overall progress based on all files
                // Sum of (loaded bytes of all chunks so far for all files) / (total size of all files)
                let newTotalUploadedSizeAcrossAllFiles = 0;
                Object.values(prevFileProgress => { // Iterate over the latest fileProgress state
                    if (prevFileProgress.name === file.name) { // Current file being uploaded
                        newTotalUploadedSizeAcrossAllFiles += currentFileLoaded;
                    } else { // Other files
                        newTotalUploadedSizeAcrossAllFiles += prevFileProgress.loaded;
                    }
                    return prevFileProgress; // satisfy map
                });
                // Add sizes of files not yet started
                for (let k = i + 1; k < files.length; k++) {
                    // This part is tricky as unstarted files have 0 loaded.
                    // The totalUploadedSize variable is more reliable for overall progress.
                }
                 // More accurate overall progress:
                // totalUploadedSize (accumulated size of successfully uploaded chunks)
                // + (current chunk's progress for the currently uploading file, if not yet fully counted in totalUploadedSize)
                // This onUploadProgress is for the CURRENT CHUNK, so progressEvent.loaded is for this chunk only.
                // We need to sum up the sizes of fully uploaded chunks + the progress of the current chunk.
                
                // Let's refine overall progress update:
                // totalUploadedSize = sum of all fully uploaded chunks so far
                // currentChunkProgress = progressEvent.loaded (for the active chunk)
                // The overall progress should reflect totalUploadedSize + currentChunkProgress relative to totalSizeAllFiles
                
                // Update overall progress
                // The 'totalUploadedSize' state variable tracks fully sent chunks.
                // 'start' is the beginning of the current chunk for the current file.
                // 'progressEvent.loaded' is how much of the *current* chunk has been sent.
                const overallLoaded = totalUploadedSize + progressEvent.loaded;
                setOverallProgress(Math.round((overallLoaded / totalSizeAllFiles) * 100));
              }
            }
          );
          // After successful upload of the chunk:
          ChunksUploadedCurrentFile++;
          // totalUploadedSize should be updated *after* the chunk is confirmed uploaded.
          // The onUploadProgress gives progress *during* the chunk upload.
          // So, we add the full chunk.size here.
          totalUploadedSize += chunk.size; 
          // Recalculate overall progress based on the now fully uploaded chunk
          setOverallProgress(Math.round((totalUploadedSize / totalSizeAllFiles) * 100));


        } catch (err) {
          if (axios.isCancel(err)) {
            setFeedback({ status: "error", message: `Carga cancelada para ${file.name}.` });
          } else {
            setFeedback({ status: "error", message: `Error subiendo chunk ${chunkNumber + 1}/${totalChunks} de ${file.name}: ${err.message}` });
          }
          setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error' } }));
          setLoading(false);
          return; // Stop if a chunk fails
        }
      }

      // All chunks uploaded for this file, now finalize
      if (ChunksUploadedCurrentFile === totalChunks) {
        setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'finalizing' } }));
        const finalizeFormData = new FormData();
        finalizeFormData.append("fileId", fileId);
        finalizeFormData.append("originalFilename", file.name);
        finalizeFormData.append("totalChunks", totalChunks);
        finalizeFormData.append("evento", evento);
        finalizeFormData.append("tunel", tunel);
        finalizeFormData.append("merma", merma);
        // Add any other metadata your backend expects for finalization
        // finalizeFormData.append("metadata_str", JSON.stringify({ /* your metadata */ }));


        try {
          const res = await axios.post(
            "http://localhost:8000/finalize-upload/",
            finalizeFormData,
            { signal: newAbortController.signal }
          );
          allFilesResults.push(res.data); // Assuming res.data is the result for one file
          setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'completed', result: res.data } }));
        } catch (err) {
           if (axios.isCancel(err)) {
            setFeedback({ status: "error", message: `Finalización cancelada para ${file.name}.` });
          } else {
            setFeedback({ status: "error", message: `Error finalizando ${file.name}: ${err.response?.data?.detail || err.message}` });
          }
          setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error' } }));
          setLoading(false);
          return; // Stop if finalization fails
        }
      }
    } // End of loop for files

    // Process allFilesResults to set overall feedback
    if (allFilesResults.length === files.length) {
        const okCount = allFilesResults.filter(r => r.status === "ok" && r.numero_detectado).length;
        const errorCount = allFilesResults.filter(r => r.status === "error" || (r.error)).length;
        const ignoredCount = allFilesResults.filter(r => r.status === "ignored").length;

        let msg = "";
        if (files.length === 1) {
            const result = allFilesResults[0];
            if (result.status === "ok" && result.numero_detectado) {
                msg = `✅ ${result.filename}: Procesado exitosamente. Número: ${result.numero_detectado}`;
                if (result.confianza) msg += ` (Confianza: ${result.confianza.toFixed(2)})`;
            } else if (result.status === "ignored") {
                msg = `⚠️ ${result.filename}: Procesado, pero no se detectó número.`;
            } else if (result.status === "error") {
                msg = `❌ ${result.filename}: Error - ${result.message || result.error}`;
            } else {
                msg = `ℹ️ ${result.filename}: Estado desconocido.`;
            }
        } else {
            msg = `✅ Detectados: ${okCount}`;
            if (ignoredCount > 0) msg += `, ⚠️ Sin detección: ${ignoredCount}`;
            if (errorCount > 0) msg += `, ❌ Con errores: ${errorCount}`;
            msg += ` (de ${files.length} archivos)`;
        }
        
        const errorDetails = allFilesResults
            .filter(r => r.status === "error" || r.error)
            .map(r => `${r.filename || r.original_filename || 'Archivo desconocido'}: ${r.error || r.message || 'Error desconocido'}`)
            .join('\\\\n');

        setFeedback({
            status: errorCount > 0 ? "error" : ignoredCount > 0 && okCount === 0 ? "warning" : "success",
            message: msg,
            details: errorDetails ? `Detalles de errores:\\\\n${errorDetails}` : null
        });
    } else if (!newAbortController.signal.aborted) {
        // This case might happen if loop was exited due to an error but not cancellation
        setFeedback({ status: "error", message: "Algunos archivos no se procesaron completamente." });
    }


    setLoading(false);
    setFiles([]); // Clear files after processing
    // setOverallProgress(0); // Reset progress after completion or error
    setAbortController(null); // Clear abort controller
  };

  const handleCancelUpload = () => {
    if (abortController) {
      abortController.abort();
      setFeedback({ status: "error", message: "Carga cancelada por el usuario." });
      setLoading(false); // Ensure loading is set to false
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-lg mt-6 mb-8 border border-cyan-200">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-orange-600 mb-2">
          📤 Procesar Imágenes y Videos de Vagonetas
        </h2>
        <p className="text-gray-600">
          Sube archivos para detectar automáticamente números calados. Los videos grandes se subirán en partes.
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
            disabled={loading}
          />
          <label htmlFor="file-upload" className={`cursor-pointer ${loading ? 'cursor-not-allowed' : ''}`}>
            <span className="text-lg font-semibold text-cyan-700">
              Haz clic para seleccionar archivos
            </span>
            <p className="text-cyan-600 mt-1">
              Soporta imágenes (JPG, PNG) y videos (MP4, AVI)
            </p>
          </label>
        </div>


        {/* Archivos seleccionados y progreso individual */}
        {files.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              📁 Archivos seleccionados ({files.length})
            </h3>
            <div className="space-y-3">
              {files.map((file, index) => {
                const fileIdForProgress = Object.keys(fileProgress).find(fpId => fileProgress[fpId].name === file.name);
                const currentFileProgress = fileIdForProgress ? fileProgress[fileIdForProgress] : { loaded: 0, total: file.size, status: 'pending' };
                const isVideo = file.type.startsWith('video/');
                const isImage = file.type.startsWith('image/');
                const fileSize = (file.size / (1024 * 1024)).toFixed(2);
                const progressPercent = currentFileProgress.total > 0 ? Math.round((currentFileProgress.loaded / currentFileProgress.total) * 100) : 0;

                return (
                  <div key={index} className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                    <div className="text-2xl">
                      {isVideo ? '🎬' : isImage ? '🖼️' : '📄'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{file.name}</div>
                      <div className="text-sm text-gray-500">
                        {isVideo ? '📹 Video' : '🖼️ Imagen'} • {fileSize} MB
                        {currentFileProgress.status === 'uploading' && ` (Subiendo: ${progressPercent}%)`}
                        {currentFileProgress.status === 'finalizing' && ' (Ensamblando y Procesando en servidor...)'}
                        {currentFileProgress.status === 'completed' && ' (✅ Completado)'}
                        {currentFileProgress.status === 'error' && ' (❌ Error)'}
                      </div>
                      { (currentFileProgress.status === 'uploading' || currentFileProgress.status === 'finalizing') && currentFileProgress.total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`${currentFileProgress.status === 'finalizing' ? 'bg-green-500 animate-pulse' : 'bg-blue-500'} h-2 rounded-full transition-all duration-150 ease-out`}
                            style={{ width: `${progressPercent}%` }}
                          ></div>
                        </div>
                      )}
                    </div>
                    {!loading && ( // Show remove button only if not loading
                       <button
                        onClick={() => {
                            setFiles(files.filter((_, i) => i !== index));
                            // Optionally remove from fileProgress if needed
                            const idToRemove = Object.keys(fileProgress).find(fpId => fileProgress[fpId].name === file.name);
                            if (idToRemove) {
                                const newFileProgress = {...fileProgress};
                                delete newFileProgress[idToRemove];
                                setFileProgress(newFileProgress);
                            }
                        }}
                        className="text-red-500 hover:text-red-700 text-xl"
                        title="Eliminar archivo"
                       >
                        ❌
                       </button>
                    )}
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
              disabled={loading}
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
              disabled={loading}
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
              disabled={loading}
            />
          </div>
        </div>

        {/* Botón de subida y cancelación */}
        <div className="text-center space-y-4">
          <button
            type="submit"
            disabled={!files.length || loading}
            className="px-8 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed text-lg shadow-lg"
          >
            {
              loading ? (
                <div className="flex items-center gap-2">
                  <Spinner size={20} />
                  Procesando... ({`${overallProgress}%`})
                </div>
              ) : (
                `Procesar ${files.length > 0 ? `${files.length} archivo${files.length > 1 ? 's' : ''}` : 'archivos'}`
              )
            }
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="px-6 py-2 bg-red-500 hover:bg-red-600 text-white font-semibold rounded-lg transition text-md shadow"
            >
              Cancelar Carga
            </button>
          )}
        </div>
      </form>

      {/* Progreso General (replaces old progress section) */}
      {loading && overallProgress > 0 && overallProgress < 100 && (
        <div className="mt-6 bg-blue-50 p-4 rounded-lg">
          <div className="flex items-center justify-between text-blue-700 mb-1">
            <span>Progreso General de Subida</span>
            <span className="font-semibold">{`${overallProgress}%`}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div 
                className="bg-blue-600 h-2.5 rounded-full transition-all duration-150 ease-out" 
                style={{ width: `${overallProgress}%` }}>
            </div>
          </div>
        </div>
      )}
      
      {/* Feedback */}
      {feedback && (
        <Feedback 
            status={feedback.status} 
            message={feedback.message} 
            details={feedback.details ? (typeof feedback.details === 'string' ? feedback.details : JSON.stringify(feedback.details, null, 2)) : null}
        />
      )}

      {/* Vista previa de archivos seleccionados (removed as it's integrated above) */}
      
    </div>
  );
};

export default Upload;
