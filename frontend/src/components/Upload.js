import React, { useState, useEffect, useCallback } from "react";
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
    setAllFilesResults([]); // Clear results when files change
  };

  const generateFileId = () => `file-${Date.now()}-${Math.random().toString(36).substring(2, 15)}`;

  const CHUNK_SIZE = 5 * 1024 * 1024; // 5MB chunks

  const checkAllFilesProcessed = useCallback(() => {
    const allOriginalFileNames = files.map(f => f.name);
    const processedFileProgressEntries = Object.values(fileProgress).filter(fp => allOriginalFileNames.includes(fp.name));

    const allFilesHaveTerminalStatusInPorgress = processedFileProgressEntries.length === files.length &&
      processedFileProgressEntries.every(fp =>
        fp.status === 'completed' || fp.status === 'error' || fp.status === 'ignored'
      );

    const noActiveEventSources = Object.keys(activeEventSources).length === 0;

    console.log("CheckAllFilesProcessed:", 
        { allFilesHaveTerminalStatusInPorgress, noActiveEventSources, filesLength: files.length, fileProgressCount: Object.keys(fileProgress).length }
    );
    // console.log("Current fileProgress state:", JSON.parse(JSON.stringify(fileProgress)));
    // console.log("Current allFilesResults state:", JSON.parse(JSON.stringify(allFilesResults)));

    if (allFilesHaveTerminalStatusInPorgress && noActiveEventSources && files.length > 0) {
      setLoading(false);
      console.log("All files definitively processed. Generating final feedback.");

      const finalResultsForFeedback = files.map(originalFile => {
        const fileProgressEntryKey = Object.keys(fileProgress).find(key => fileProgress[key].name === originalFile.name);
        const associatedFileId = fileProgressEntryKey;

        const resultFromAllResults = allFilesResults.find(res => res.fileId === associatedFileId);

        if (resultFromAllResults) {
          return {
            filename: originalFile.name,
            status: resultFromAllResults.status || 'unknown',
            numero_detectado: resultFromAllResults.numero_detectado,
            confianza: resultFromAllResults.confianza,
            message: resultFromAllResults.message || fileProgress[associatedFileId]?.serverMessage,
            error: resultFromAllResults.errorDetail || (resultFromAllResults.status === 'error' ? resultFromAllResults.message : undefined)
          };
        } else {
          const progressEntry = fileProgress[associatedFileId];
          if (progressEntry) {
            return {
              filename: originalFile.name,
              status: progressEntry.status,
              numero_detectado: progressEntry.result?.numero || progressEntry.result?.numero_detectado,
              confianza: progressEntry.result?.confianza,
              message: progressEntry.serverMessage || 'No specific result from server processing.',
              error: progressEntry.status === 'error' ? progressEntry.serverMessage : undefined
            };
          }
          return { filename: originalFile.name, status: 'unknown', message: 'No processing information found.' };
        }
      });

      console.log("Formatted feedback results for UI:", finalResultsForFeedback);

      const okCount = finalResultsForFeedback.filter(r => r.status === "ok" || r.status === "completed").length;
      const errorCount = finalResultsForFeedback.filter(r => r.status === "error").length;
      const ignoredCount = finalResultsForFeedback.filter(r => r.status === "ignored").length;
      const totalAttemptedFiles = files.length;

      let msg = "";
      if (totalAttemptedFiles === 1 && finalResultsForFeedback.length >= 1) {
        const result = finalResultsForFeedback[0];
        if (result.status === "ok" || result.status === "completed") {
          msg = `✅ ${result.filename}: Procesado.`;
          if (result.numero_detectado) msg += ` Número: ${result.numero_detectado}`;
          if (typeof result.confianza === 'number') msg += ` (Confianza: ${(result.confianza * 100).toFixed(1)}%)`;
        } else if (result.status === "ignored") {
          msg = `⚠️ ${result.filename}: ${result.message || 'Procesado, pero no se generó un resultado guardable.'}`;
        } else if (result.status === "error") {
          msg = `❌ ${result.filename}: Error - ${result.message || result.error || 'Error desconocido'}`;
        } else {
          msg = `ℹ️ ${result.filename}: ${result.message || 'Estado: ' + result.status}`;
        }
      } else if (totalAttemptedFiles > 0) {
        msg = `Procesamiento finalizado para ${totalAttemptedFiles} archivo(s). ✅ Detectados: ${okCount}`;
        if (ignoredCount > 0) msg += `, ⚠️ Sin resultado guardado: ${ignoredCount}`;
        if (errorCount > 0) msg += `, ❌ Con errores: ${errorCount}`;
      } else {
        msg = "No hay archivos para mostrar feedback.";
      }

      const errorDetails = finalResultsForFeedback
        .filter(r => r.status === "error" && (r.error || r.message))
        .map(r => `${r.filename}: ${r.error || r.message || 'Error desconocido'}`)
        .join('\n');

      setFeedback({
        status: errorCount > 0 ? "error" : ignoredCount > 0 && okCount === 0 ? "warning" : okCount > 0 ? "success" : "info",
        message: msg,
        details: errorDetails ? `Detalles de errores:\n${errorDetails}` : null
      });

      setAbortController(null);
    }
  }, [files, fileProgress, activeEventSources, allFilesResults]);

  const setupEventSource = useCallback((fileId, processingId, filename) => {
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
        let shouldCloseEventSource = false;
        let isTerminalEvent = false;

        console.log(`SSE (${fileId} - ${filename}):`, data); // Log para depuración

        if (data.type === 'status' && data.stage === 'stream_init') {
          serverMessage = data.message || 'Stream iniciado.';
        } else if (data.type === 'progress') {
          serverMessage = `${data.message} (${data.current_frame}/${data.total_frames})`;
        } else if (data.type === 'detection_update') {
          serverMessage = `Frame ${data.frame}: Detectado ${data.numero} (Confianza: ${(data.confianza * 100).toFixed(1)}%)`;
        } else if (data.type === 'final_result') {
          serverMessage = data.message || "Análisis de video completado, esperando registro en BD.";
          currentProgressState = { resultDataFromStream: data.data }; 
        } else if (data.type === 'db_record_created') {
          isTerminalEvent = true;
          shouldCloseEventSource = true;
          const recordData = data.data;
          setAllFilesResults(prevResults => [...prevResults, {
            fileId,
            filename,
            status: 'ok',
            message: data.message || `Registro creado: ${recordData.numero} (Conf: ${recordData.confianza ? (recordData.confianza * 100).toFixed(1) + '%' : 'N/A'})`,
            numero_detectado: recordData.numero,
            confianza: recordData.confianza,
            // ... any other relevant fields from recordData
          }]);
          currentProgressState = {
            status: 'completed',
            result: recordData,
          };
          serverMessage = data.message || `Registro creado: ${recordData.numero} (Conf: ${recordData.confianza ? (recordData.confianza * 100).toFixed(1) + '%' : 'N/A'})`;
        } else if (data.type === 'status' && (data.stage === 'completion' || data.stage === 'finalization')) {
          serverMessage = data.message || 'Proceso completado en servidor.';
          if (data.message && data.message.includes("no se identificó un número") && !fileProgress[fileId]?.result) {
            // This is a soft terminal state for this file if no db record is coming.
            // We'll let stream_end confirm this.
          }
        } else if (data.type === 'error') {
          isTerminalEvent = true;
          shouldCloseEventSource = true;
          serverMessage = `Error en stream: ${data.message}`;
          setAllFilesResults(prevResults => [...prevResults, {
            fileId,
            filename,
            status: 'error',
            message: serverMessage,
            errorDetail: data.message
          }]);
          currentProgressState = { status: 'error', result: data };
        } else if (data.type === 'stream_end') {
          isTerminalEvent = true;
          shouldCloseEventSource = true;
          serverMessage = data.message || "Stream finalizado.";

          const existingResultIndex = allFilesResults.findIndex(r => r.fileId === fileId);

          if (existingResultIndex === -1) {
            const statusToSet = data.error_occurred ? 'error' : 'ignored';
            setAllFilesResults(prevResults => [...prevResults, {
              fileId,
              filename,
              status: statusToSet,
              message: data.message || "Stream finalizado.",
              errorDetail: data.error_occurred ? data.message : undefined
            }]);
            currentProgressState = { status: statusToSet, serverMessage: data.message };
          } else {
            if (data.error_occurred && allFilesResults[existingResultIndex].status !== 'error') {
              setAllFilesResults(prevResults => prevResults.map((r, index) =>
                index === existingResultIndex ? { ...r, status: 'error', message: data.message || "Error reportado al final del stream.", errorDetail: data.message } : r
              ));
              currentProgressState = { status: 'error', serverMessage: data.message };
            } else if (!data.error_occurred && allFilesResults[existingResultIndex].status === 'ok') {
              currentProgressState = { serverMessage: data.message };
            } else if (!allFilesResults[existingResultIndex].status && !data.error_occurred) {
              setAllFilesResults(prevResults => prevResults.map((r, index) =>
                index === existingResultIndex ? { ...r, status: 'ignored', message: data.message || "Stream finalizado, resultado no concluyente." } : r
              ));
              currentProgressState = { status: 'ignored', serverMessage: data.message };
            } else {
              currentProgressState = { serverMessage: data.message };
            }
          }
        }

        setFileProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], ...currentProgressState, serverMessage }
        }));
        
        if (shouldCloseEventSource) {
          eventSource.close();
          setActiveEventSources(prev => {
            const newSources = { ...prev };
            delete newSources[fileId];
            return newSources;
          });
        }
        
        if (isTerminalEvent) {
            checkAllFilesProcessed();
        }

      } catch (error) {
        console.error("Error parseando SSE data o actualizando estado:", error, "Data:", event.data);
        setFileProgress(prev => ({
          ...prev,
          [fileId]: { ...prev[fileId], status: 'error', serverMessage: 'Error crítico procesando respuesta del servidor.' }
        }));
        eventSource.close();
        setActiveEventSources(prev => {
            const newSources = { ...prev };
            delete newSources[fileId];
            return newSources;
        });
        setAllFilesResults(prevResults => {
          if (!prevResults.find(r => r.fileId === fileId)) {
            return [...prevResults, { fileId, filename, status: 'error', message: 'Error crítico procesando respuesta del servidor.', errorDetail: error.message }];
          }
          return prevResults;
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
        const newSources = { ...prev };
        delete newSources[fileId];
        return newSources;
      });
      // Add a result to allFilesResults to signify this connection error
      setAllFilesResults(prevResults => {
        if (!prevResults.find(r => r.fileId === fileId)) {
            return [...prevResults, { fileId, filename, status: 'error', message: `Error de conexión con el stream de ${filename}.`, errorDetail: 'EventSource onerror' }];
        }
        return prevResults;
      });
      checkAllFilesProcessed();
    };
  }, [checkAllFilesProcessed, allFilesResults, fileProgress]); // Added dependencies

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!files.length) return;

    setLoading(true);
    setFeedback(null);
    setOverallProgress(0);
    setAllFilesResults([]);
    
    const initialFileProgress = {};
    files.forEach(file => {
      const fileId = generateFileId();
      initialFileProgress[fileId] = {
        name: file.name,
        loaded: 0,
        total: file.size,
        status: 'pending',
        serverMessage: '',
        processingId: null
      };
    });
    setFileProgress(initialFileProgress);

    const newAbortController = new AbortController();
    setAbortController(newAbortController);

    let totalUploadedSize = 0;
    const totalSizeAllFiles = files.reduce((acc, file) => acc + file.size, 0);
    const fileIdsToProcess = Object.keys(initialFileProgress);

    for (let i = 0; i < fileIdsToProcess.length; i++) {
      const fileId = fileIdsToProcess[i];
      const file = files.find(f => f.name === initialFileProgress[fileId].name);
      if (!file) continue;

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
        // chunkFormData.append("fileChunk", chunk); // OLD
        chunkFormData.append("chunk", chunk); // NEW - Match backend expected field name
        chunkFormData.append("fileId", fileId);
        // chunkFormData.append("chunkNumber", chunkNumber); // OLD
        chunkFormData.append("chunkIndex", chunkNumber); // NEW - Match backend expected field name
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
    checkAllFilesProcessed();
  };

  const handleCancelUpload = () => {
    if (abortController) {
      abortController.abort();
      setLoading(false);
      // Update feedback for any files that were in 'uploading' or 'pending' state
      const updatedFileProgress = { ...fileProgress };
      Object.keys(updatedFileProgress).forEach(fileId => {
        if (updatedFileProgress[fileId].status === 'uploading' || updatedFileProgress[fileId].status === 'pending' || updatedFileProgress[fileId].status === 'finalizing' || updatedFileProgress[fileId].status === 'server_processing') {
          updatedFileProgress[fileId].status = 'error'; // or 'cancelled'
          updatedFileProgress[fileId].serverMessage = 'Carga/Procesamiento cancelado por el usuario.';
        }
      });
      setFileProgress(updatedFileProgress);
      setFeedback({ status: "info", message: "Carga y procesamiento cancelados por el usuario." });
      Object.values(activeEventSources).forEach(source => source.close());
      setActiveEventSources({});
      console.log("Upload and processing cancelled by user.");
      checkAllFilesProcessed(); // Re-check to update overall status
    }
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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="evento" className="block text-sm font-medium text-gray-700">Evento</label>
            <select id="evento" value={evento} onChange={(e) => setEvento(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500">
              <option value="ingreso">Ingreso</option>
              <option value="salida">Salida</option>
              <option value="otro">Otro</option>
            </select>
          </div>
          <div>
            <label htmlFor="tunel" className="block text-sm font-medium text-gray-700">Túnel (Opcional)</label>
            <input type="text" id="tunel" value={tunel} onChange={(e) => setTunel(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500" placeholder="Ej: Principal, Secundario" />
          </div>
          <div>
            <label htmlFor="merma" className="block text-sm font-medium text-gray-700">Merma (Opcional)</label>
            <input type="text" id="merma" value={merma} onChange={(e) => setMerma(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm focus:ring-cyan-500 focus:border-cyan-500" placeholder="Ej: 10%" />
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-4">
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="w-full sm:w-auto flex-grow justify-center items-center px-6 py-3 border border-transparent text-base font-medium rounded-lg shadow-sm text-white bg-orange-600 hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors duration-150 ease-in-out flex"
          >
            {loading ? <><Spinner size="sm" /> <span className="ml-2">Procesando...</span></> : "📤 Iniciar Procesamiento"}
          </button>
          {loading && (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="w-full sm:w-auto justify-center items-center mt-3 sm:mt-0 px-6 py-3 border border-gray-300 text-base font-medium rounded-lg shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-cyan-500 transition-colors duration-150 ease-in-out flex"
            >
              🛑 Cancelar
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <div className="mt-6">
          <Feedback status={feedback.status} message={feedback.message} details={feedback.details} />
        </div>
      )}

      {loading && overallProgress > 0 && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-700 mb-2">Progreso Total de Subida</h3>
          <div className="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700">
            <div className="bg-cyan-600 h-2.5 rounded-full transition-all duration-300 ease-out" style={{ width: `${overallProgress}%` }}></div>
          </div>
          <p className="text-sm text-gray-600 text-center mt-1">{overallProgress}%</p>
        </div>
      )}

      {Object.keys(fileProgress).length > 0 && (
        <div className="mt-6 bg-gray-50 rounded-lg p-4 shadow">
          <h3 className="text-xl font-semibold text-gray-800 mb-4 border-b pb-2">
            Detalle del Procesamiento:
          </h3>
          <div className="space-y-4">
            {Object.entries(fileProgress).map(([fileId, progress]) => {
              const originalFile = files.find(f => f.name === progress.name);
              // const isVideo = originalFile?.type.startsWith('video/'); // Not currently used, but kept for potential future use
              const fileSizeMB = progress.total ? (progress.total / (1024 * 1024)).toFixed(2) : 'N/A';
              const individualProgressPercent = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;

              let statusIcon = '⏳';
              let statusColor = 'text-gray-600';
              let statusText = progress.status; // Default to the raw status

              if (progress.status === 'completed') {
                statusIcon = '✅';
                statusColor = 'text-green-600';
                statusText = 'Completado';
              } else if (progress.status === 'error') {
                statusIcon = '❌';
                statusColor = 'text-red-600';
                statusText = 'Error';
              } else if (progress.status === 'ignored') {
                statusIcon = '⚠️';
                statusColor = 'text-yellow-600';
                statusText = 'Ignorado';
              } else if (progress.status === 'uploading') {
                statusIcon = '📤';
                statusColor = 'text-blue-600';
                statusText = 'Subiendo';
              } else if (progress.status === 'finalizing') {
                statusIcon = '⚙️';
                statusColor = 'text-blue-600';
                statusText = 'Finalizando';
              } else if (progress.status === 'server_processing') {
                statusIcon = '🧠';
                statusColor = 'text-purple-600';
                statusText = 'Procesando';
              } else if (progress.status === 'pending') {
                statusIcon = '⏳';
                statusColor = 'text-gray-500';
                statusText = 'Pendiente';
              }

              return (
                <div key={fileId} className="p-4 bg-white rounded-lg shadow border border-gray-200">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-semibold text-gray-700 truncate max-w-[calc(100%-120px)]" title={progress.name}>
                      {progress.name} ({fileSizeMB} MB)
                    </span>
                    <span className={`font-bold ${statusColor} flex items-center text-sm whitespace-nowrap`}>
                      {statusIcon} <span className="ml-1.5">{statusText}</span>
                    </span>
                  </div>

                  {(progress.status === 'uploading' || (progress.status === 'pending' && loading && files.map(f => f.name).includes(progress.name))) && progress.total > 0 && (
                    <div className="w-full bg-gray-200 rounded-full h-2 mb-1">
                      <div
                        className="bg-blue-500 h-2 rounded-full transition-all duration-150"
                        style={{ width: `${individualProgressPercent}%` }}
                      ></div>
                    </div>
                  )}
                  {progress.status === 'uploading' && progress.total > 0 && (
                    <p className="text-xs text-gray-500 text-right">{individualProgressPercent}% subido</p>
                  )}

                  {progress.serverMessage && (
                    <p className="text-xs text-gray-500 mt-1 bg-gray-100 p-2 rounded">
                      {progress.serverMessage}
                    </p>
                  )}

                  {progress.status === 'completed' && progress.result && (
                    <div className="mt-2 text-xs p-2 bg-green-50 rounded border border-green-200">
                      <p><strong>Número:</strong> {progress.result.numero || progress.result.numero_detectado || 'N/A'}</p>
                      <p><strong>Confianza:</strong> {progress.result.confianza ? (progress.result.confianza * 100).toFixed(1) + '%' : 'N/A'}</p>
                      {progress.result.message && !progress.serverMessage.includes(progress.result.message) && <p><strong>Msg:</strong> {progress.result.message}</p>}
                    </div>
                  )}
                  {progress.status === 'error' && progress.result && progress.result.message && (
                    <div className="mt-2 text-xs p-2 bg-red-50 rounded border border-red-200 text-red-700">
                      <p><strong>Error:</strong> {progress.result.message}</p>
                    </div>
                  )}
                  {progress.status === 'ignored' && progress.result && progress.result.message && (
                    <div className="mt-2 text-xs p-2 bg-yellow-50 rounded border border-yellow-200 text-yellow-700">
                      <p><strong>Info:</strong> {progress.result.message}</p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;
