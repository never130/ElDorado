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
  const [overallProgress, setOverallProgress] = useState(0); 
  const [evento, setEvento] = useState("ingreso");
  const [tunel, setTunel] = useState("");
  const [merma, setMerma] = useState("");
  const [loading, setLoading] = useState(false);
  const [modelInfo, setModelInfo] = useState(null);
  const [abortController, setAbortController] = useState(null);
  const [fileProgress, setFileProgress] = useState({}); // { fileId: { name, loaded, total, status, serverMessage, result } }
  const [activeEventSources, setActiveEventSources] = useState({}); // { fileId: EventSource_instance }
  const [allFilesResults, setAllFilesResults] = useState([]); // MODIFIED: allFilesResults is now a state variable

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
    // Limpiar event sources activos si se cambian los archivos
    Object.values(activeEventSources).forEach(source => source.close());
    setActiveEventSources({});
  };

  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;

    setLoading(true);
    setFeedback(null);
    setOverallProgress(0);
    setAllFilesResults([]); // MODIFIED: Clear allFilesResults state
    // Limpiar fileProgress antes de una nueva subida, manteniendo la estructura
    const initialFileProgress = {};
    files.forEach(file => {
        const fileId = generateFileId(); // Generar ID aquí para consistencia
        initialFileProgress[fileId] = { 
            name: file.name, 
            loaded: 0, 
            total: file.size, 
            status: 'pending', 
            serverMessage: '',
            processingId: null // Añadir para rastrear el ID de procesamiento del video
        };
    });
    setFileProgress(initialFileProgress);
    
    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    let totalUploadedSize = 0;
    const totalSizeAllFiles = files.reduce((acc, file) => acc + file.size, 0);
    
    // const allFilesResults = []; // REMOVED: No longer a local variable
    // Usar una copia de las claves de initialFileProgress para iterar,
    // ya que los fileId se generan una vez al inicio de handleUpload.
    const fileIdsToProcess = Object.keys(initialFileProgress);

    for (let i = 0; i < fileIdsToProcess.length; i++) {
      const fileId = fileIdsToProcess[i];
      const file = files.find(f => f.name === initialFileProgress[fileId].name); // Encontrar el archivo original
      if (!file) continue; // Si el archivo no se encuentra, saltar

      const totalChunks = Math.ceil(file.size / CHUNK_SIZE);
      let ChunksUploadedCurrentFile = 0;

      setFileProgress(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'uploading', serverMessage: 'Iniciando subida...' }
      }));

      for (let chunkNumber = 0; chunkNumber < totalChunks; chunkNumber++) {
        if (newAbortController.signal.aborted) {
          setFeedback({ status: "error", message: "Carga cancelada por el usuario." });
          setLoading(false);
          // Cerrar todos los EventSource activos
          Object.values(activeEventSources).forEach(source => source.close());
          setActiveEventSources({});
          return;
        }

        const start = chunkNumber * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunk = file.slice(start, end);
        
        const chunkFormData = new FormData();
        chunkFormData.append("fileChunk", chunk);
        chunkFormData.append("fileId", fileId); // Usar el fileId generado consistentemente
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
                const chunkLoaded = progressEvent.loaded; 
                const currentFileLoaded = start + chunkLoaded;
                setFileProgress(prev => {
                  // Asegurarse de que prev[fileId] existe
                  if (!prev[fileId]) return prev;
                  return {
                    ...prev,
                    [fileId]: { 
                      ...prev[fileId],
                      loaded: currentFileLoaded, 
                    }
                  }
                });
                const overallLoaded = totalUploadedSize + progressEvent.loaded;
                setOverallProgress(Math.round((overallLoaded / totalSizeAllFiles) * 100));
              }
            }
          );
          ChunksUploadedCurrentFile++;
          totalUploadedSize += chunk.size; 
          setOverallProgress(Math.round((totalUploadedSize / totalSizeAllFiles) * 100));
        } catch (err) {
          if (axios.isCancel(err)) {
            setFeedback({ status: "error", message: `Carga cancelada para ${file.name}.` });
          } else {
            setFeedback({ status: "error", message: `Error subiendo chunk ${chunkNumber + 1}/${totalChunks} de ${file.name}: ${err.message}` });
          }
          setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error', serverMessage: 'Error en subida.' } }));
          setLoading(false);
          Object.values(activeEventSources).forEach(source => source.close());
          setActiveEventSources({});
          return; // Stop if a chunk fails
        }
      }

      // All chunks uploaded for this file, now finalize
      if (ChunksUploadedCurrentFile === totalChunks) {
        setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'finalizing', serverMessage: 'Ensamblando archivo en servidor...' } }));
        const finalizeFormData = new FormData();
        finalizeFormData.append("fileId", fileId); // Usar el fileId generado consistentemente
        finalizeFormData.append("originalFilename", file.name);
        finalizeFormData.append("totalChunks", totalChunks);
        finalizeFormData.append("evento", evento);
        finalizeFormData.append("tunel", tunel);
        finalizeFormData.append("merma", merma);
        // finalizeFormData.append("metadata_str", JSON.stringify({ /* your metadata */ }));

        try {
          const res = await axios.post(
            "http://localhost:8000/finalize-upload/",
            finalizeFormData,
            { signal: newAbortController.signal }
          );
          
          const resultData = res.data;

          if (resultData.status === "video_processing_pending" && resultData.processing_id) {
            setFileProgress(prev => ({ 
              ...prev, 
              [fileId]: { 
                ...prev[fileId], 
                status: 'server_processing', 
                serverMessage: 'Video en cola para procesamiento...',
                processingId: resultData.processing_id // Guardar el processing_id
              } 
            }));
            // Iniciar EventSource para este video
            setupEventSource(fileId, resultData.processing_id, file.name);
          } else {
            // Para imágenes o si el video se procesó síncronamente (aunque ahora no debería)
            // allFilesResults.push({ fileId, ...resultData }); // MODIFIED: Update state instead
            setAllFilesResults(prevResults => [...prevResults, { fileId, ...resultData }]);
            setFileProgress(prev => ({ 
              ...prev, 
              [fileId]: { 
                ...prev[fileId], 
                status: resultData.status === 'ok' ? 'completed' : resultData.status === 'ignored' ? 'ignored' : 'error', 
                serverMessage: resultData.message || (resultData.status === 'ok' ? 'Completado' : 'Error/Ignorado'),
                result: resultData 
              } 
            }));
          }
        } catch (err) {
           if (axios.isCancel(err)) {
            setFeedback({ status: "error", message: `Finalización cancelada para ${file.name}.` });
          } else {
            setFeedback({ status: "error", message: `Error finalizando ${file.name}: ${err.response?.data?.detail || err.message}` });
          }
          setFileProgress(prev => ({ ...prev, [fileId]: { ...prev[fileId], status: 'error', serverMessage: 'Error en finalización.' } }));
          // No establecer setLoading(false) aquí si otros archivos o SSE están pendientes.
          // Se manejará en checkAllFilesProcessed
        }
      }
    } // End of loop for files

    checkAllFilesProcessed(); // Verificar si todos los archivos (no SSE) han terminado para potencialmente mostrar feedback.
  };

  const setupEventSource = (fileId, processingId, filename) => {
    const eventSource = new EventSource(`http://localhost:8000/stream-video-processing/${processingId}`);
    setActiveEventSources(prev => ({ ...prev, [fileId]: eventSource }));

    eventSource.onopen = () => {
      setFileProgress(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'server_processing', serverMessage: `Conectado al stream para ${filename}...` }
      }));
    };

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        let serverMessage = data.message || '';
        let currentProgressState = {};

        if (data.type === 'progress') {
          serverMessage = `${data.message} (${data.current_frame}/${data.total_frames})`;
        } else if (data.type === 'detection_update') {
          serverMessage = `Frame ${data.frame}: Detectado ${data.numero} (Confianza: ${(data.confianza * 100).toFixed(1)}%)`;
        } else if (data.type === 'final_result') {
          // Este evento solo da los datos, el registro en BD viene después
          serverMessage = data.message || "Análisis de video completado, esperando registro en BD.";
          // Podríamos almacenar data.data en fileProgress si es necesario mostrarlo antes del db_record
        } else if (data.type === 'db_record_created' || data.type === 'no_detection_final' || data.type === 'db_error' || data.type === 'completion_error') {
          // Estos son eventos terminales para el procesamiento del video
          // allFilesResults.push({ fileId, ...data }); // MODIFIED: Update state instead
          setAllFilesResults(prevResults => [...prevResults, { fileId, ...data }]);
          currentProgressState = {
            status: data.status === 'ok' ? 'completed' : data.status === 'ignored' ? 'ignored' : 'error',
            result: data,
          };
          serverMessage = data.message || "Procesamiento finalizado.";
          eventSource.close(); // Cerrar SSE
          setActiveEventSources(prev => {
            const newSources = {...prev};
            delete newSources[fileId];
            return newSources;
          });
        } else if (data.type === 'stream_end') {
          serverMessage = data.message || "Stream finalizado.";
          eventSource.close(); // Asegurarse de cerrar
           setActiveEventSources(prev => {
            const newSources = {...prev};
            delete newSources[fileId];
            return newSources;
          });
        } else if (data.type === 'error') { // Error desde el stream mismo
            serverMessage = `Error en stream: ${data.message}`;
            currentProgressState = { status: 'error', result: data };
            eventSource.close();
            setActiveEventSources(prev => {
                const newSources = {...prev};
                delete newSources[fileId];
                return newSources;
            });
        }


        setFileProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], ...currentProgressState, serverMessage }
        }));
        
        // Si el evento es terminal, verificar si todos los archivos han terminado
        if (data.type === 'db_record_created' || data.type === 'no_detection_final' || data.type === 'db_error' || data.type === 'stream_end' || data.type === 'completion_error' || data.type === 'error') {
            checkAllFilesProcessed();
        }

      } catch (error) {
        console.error("Error parseando SSE data o actualizando estado:", error);
        setFileProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], status: 'error', serverMessage: 'Error procesando respuesta del servidor.' }
        }));
        eventSource.close();
        setActiveEventSources(prev => {
            const newSources = {...prev};
            delete newSources[fileId];
            return newSources;
        });
        checkAllFilesProcessed();
      }
    };

    eventSource.onerror = (err) => {
      console.error("EventSource failed for fileId:", fileId, err);
      setFileProgress(prev => ({
        ...prev,
        [fileId]: { ...prev[fileId], status: 'error', serverMessage: `Error de conexión con el stream de ${filename}.` }
      }));
      eventSource.close();
      setActiveEventSources(prev => {
        const newSources = {...prev};
        delete newSources[fileId];
        return newSources;
      });
      checkAllFilesProcessed();
    };
  };

  const checkAllFilesProcessed = () => {
    // Verifica si todos los archivos en fileProgress tienen un estado terminal
    // y no hay EventSources activos.
    const allDone = Object.values(fileProgress).every(fp => 
        fp.status === 'completed' || fp.status === 'error' || fp.status === 'ignored'
    ) && Object.keys(activeEventSources).length === 0;

    if (allDone) {
        setLoading(false);
        // Consolidar feedback de allFilesResults (now read from state)
        // Esta lógica necesita ser robusta para manejar resultados de imágenes y videos (que vienen de SSE)
        const finalResultsForFeedback = allFilesResults.map(res => { // allFilesResults is now from state
            // Normalizar la estructura si es necesario, ya que algunos vienen de /finalize-upload directamente
            // y otros del stream. El `fileId` ayuda a mapearlos al `fileProgress` si es necesario.
            return {
                filename: fileProgress[res.fileId]?.name || res.filename || 'Archivo desconocido', // Tomar el nombre de fileProgress
                status: res.status, // 'ok', 'ignored', 'error'
                numero_detectado: res.numero_detectado,
                confianza: res.confianza,
                message: res.message,
                error: res.error // Si existe
            };
        });


        const okCount = finalResultsForFeedback.filter(r => r.status === "ok" && r.numero_detectado).length;
        const errorCount = finalResultsForFeedback.filter(r => r.status === "error" || r.error).length;
        const ignoredCount = finalResultsForFeedback.filter(r => r.status === "ignored").length;
        const totalProcessedFiles = finalResultsForFeedback.length; // Debería ser igual a files.length

        let msg = "";
        if (files.length === 1 && totalProcessedFiles === 1) {
            const result = finalResultsForFeedback[0];
            if (result.status === "ok" && result.numero_detectado) {
                msg = `✅ ${result.filename}: Procesado. Número: ${result.numero_detectado}`;
                if (result.confianza) msg += ` (Confianza: ${(result.confianza * 100).toFixed(1)}%)`;
            } else if (result.status === "ignored") {
                msg = `⚠️ ${result.filename}: ${result.message || 'Procesado, pero no se detectó número.'}`;
            } else if (result.status === "error") {
                msg = `❌ ${result.filename}: Error - ${result.message || result.error || 'Error desconocido'}`;
            } else { // Otros estados que puedan venir del stream
                 msg = `ℹ️ ${result.filename}: ${result.message || 'Estado desconocido.'}`;
            }
        } else {
            msg = `Procesados: ${totalProcessedFiles}/${files.length}. ✅ Detectados: ${okCount}`;
            if (ignoredCount > 0) msg += `, ⚠️ Sin detección: ${ignoredCount}`;
            if (errorCount > 0) msg += `, ❌ Con errores: ${errorCount}`;
        }
        
        const errorDetails = finalResultsForFeedback
            .filter(r => r.status === "error" || r.error)
            .map(r => `${r.filename}: ${r.error || r.message || 'Error desconocido'}`)
            .join('\n');

        setFeedback({
            status: errorCount > 0 ? "error" : ignoredCount > 0 && okCount === 0 && totalProcessedFiles > 0 ? "warning" : (okCount > 0 || totalProcessedFiles === 0) ? "success" : "info",
            message: msg,
            details: errorDetails ? `Detalles de errores:\n${errorDetails}` : null
        });
        
        setFiles([]); 
        setOverallProgress(0); 
        setAbortController(null);
        // No limpiar fileProgress aquí para que la UI pueda mostrar los estados finales de cada archivo.
        // Se limpiará en handleChange.
    }
  };


  const handleCancelUpload = () => {
    if (abortController) {
      abortController.abort(); // Esto cancelará las subidas de chunks y las llamadas a /finalize-upload
    }
    // Cerrar todos los EventSource activos
    Object.values(activeEventSources).forEach(source => source.close());
    setActiveEventSources({});
    
    setFeedback({ status: "error", message: "Carga cancelada por el usuario." });
    setLoading(false);
    // Actualizar el estado de los archivos en progreso a 'error' o 'cancelled'
    const updatedFileProgress = { ...fileProgress };
    Object.keys(updatedFileProgress).forEach(fileId => {
        if (updatedFileProgress[fileId].status === 'uploading' || updatedFileProgress[fileId].status === 'finalizing' || updatedFileProgress[fileId].status === 'server_processing') {
            updatedFileProgress[fileId].status = 'error'; // o 'cancelled'
            updatedFileProgress[fileId].serverMessage = 'Cancelado por usuario.';
        }
    });
    setFileProgress(updatedFileProgress);
  };

  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-2xl p-8 shadow-lg mt-6 mb-8 border border-cyan-200">
      <div className="text-center mb-6">
        <h2 className="text-3xl font-extrabold text-orange-600 mb-2">
          📤 Procesar Imágenes y Videos de Vagonetas
        </h2>
        <p className="text-gray-600">
          Sube una o múltiples imágenes/videos para detectar automáticamente los números de las vagonetas.
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
        {files.length > 0 && Object.keys(fileProgress).length > 0 && ( // Asegurar que fileProgress esté poblado
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-700 mb-3">
              📁 Archivos ({files.length})
            </h3>
            <div className="space-y-3">
              {Object.keys(fileProgress).map((fileId) => { // Iterar sobre fileProgress
                const currentFile = fileProgress[fileId];
                if (!currentFile || !currentFile.name) return null; // Si no hay datos, no renderizar

                const originalFile = files.find(f => f.name === currentFile.name); // Encontrar el tipo del archivo original
                const isVideo = originalFile?.type.startsWith('video/');
                const isImage = originalFile?.type.startsWith('image/');
                const fileSize = (currentFile.total / (1024 * 1024)).toFixed(2);
                const progressPercent = currentFile.total > 0 ? Math.round((currentFile.loaded / currentFile.total) * 100) : 0;

                let statusMessage = '';
                let progressBarClass = 'bg-blue-500';

                switch (currentFile.status) {
                  case 'uploading':
                    statusMessage = `Subiendo: ${progressPercent}%`;
                    break;
                  case 'finalizing':
                    statusMessage = 'Ensamblando en servidor...';
                    progressBarClass = 'bg-yellow-500 animate-pulse';
                    break;
                  case 'server_processing':
                    statusMessage = currentFile.serverMessage || 'Procesando en servidor...';
                    progressBarClass = 'bg-purple-500 animate-pulse'; // Nuevo color para SSE
                    break;
                  case 'completed':
                    statusMessage = `✅ ${currentFile.serverMessage || 'Completado'}`;
                    progressBarClass = 'bg-green-500';
                    break;
                  case 'error':
                    statusMessage = `❌ ${currentFile.serverMessage || 'Error'}`;
                    progressBarClass = 'bg-red-500';
                    break;
                  case 'ignored':
                    statusMessage = `⚠️ ${currentFile.serverMessage || 'Ignorado/Sin detección'}`;
                    progressBarClass = 'bg-yellow-500';
                    break;
                  default:
                    statusMessage = currentFile.serverMessage || 'Pendiente...';
                }

                return (
                  <div key={fileId} className="flex items-center gap-3 bg-white p-3 rounded-lg border">
                    <div className="text-2xl">
                      {isVideo ? '🎬' : isImage ? '🖼️' : '📄'}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{currentFile.name}</div>
                      <div className="text-sm text-gray-500">
                        {isVideo ? '📹 Video' : isImage ? '🖼️ Imagen' : '📄 Archivo'} • {fileSize} MB
                      </div>
                      <div className="text-sm text-gray-600 mt-1 italic">{statusMessage}</div>
                      { (currentFile.status === 'uploading' || currentFile.status === 'finalizing' || currentFile.status === 'server_processing') && currentFile.total > 0 && (
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div
                            className={`${progressBarClass} h-2 rounded-full transition-all duration-150 ease-out`}
                            style={{ width: `${currentFile.status === 'completed' || currentFile.status === 'error' || currentFile.status === 'ignored' ? 100 : progressPercent}%` }} // Barra llena en estados finales
                          ></div>
                        </div>
                      )}
                       {/* Mostrar resultado de detección si está disponible y completado */}
                       {currentFile.status === 'completed' && currentFile.result && currentFile.result.numero_detectado && (
                        <div className="text-xs text-green-700 mt-1">
                            Detectado: <strong>{currentFile.result.numero_detectado}</strong>
                            {currentFile.result.confianza && ` (Conf: ${(currentFile.result.confianza * 100).toFixed(1)}%)`}
                        </div>
                       )}
                    </div>
                    {/* Botón para remover archivo (adaptar lógica si es necesario) */}
                    {!loading && !['uploading', 'finalizing', 'server_processing'].includes(currentFile.status) && (
                       <button
                        onClick={() => {
                            // Lógica para remover de `files` y `fileProgress`
                            setFiles(prevFiles => prevFiles.filter(f => f.name !== currentFile.name));
                            setFileProgress(prevFp => {
                                const newFp = {...prevFp};
                                delete newFp[fileId];
                                return newFp;
                            });
                        }}
                        className="text-red-500 hover:text-red-700 text-xl"
                        title="Eliminar archivo de la lista"
                       >
                        🗑️
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
