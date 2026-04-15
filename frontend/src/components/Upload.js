import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import Spinner from "./Spinner";
import { API_BASE_URL } from "../config/api";
import { UploadCloud, FileImage, FileVideo, CheckCircle2, XCircle, AlertTriangle, Info, Brain, Target, Activity, Check, RefreshCw, X } from "lucide-react";

const Feedback = ({ status, message, details }) => {
  if (!status) return null;
  let color = "text-slate-700";
  let Icon = Info;
  let bgColor = "bg-slate-50 border-slate-200";
  
  if (status === "success" || status === "ok") { 
    color = "text-green-700"; 
    Icon = CheckCircle2; 
    bgColor = "bg-green-50 border-green-200";
  }
  if (status === "error") { 
    color = "text-red-700"; 
    Icon = XCircle; 
    bgColor = "bg-red-50 border-red-200";
  }
  if (status === "warning" || status === "ignored") { 
    color = "text-amber-700"; 
    Icon = AlertTriangle; 
    bgColor = "bg-amber-50 border-amber-200";
  }
  
  return (
    <div className={`mt-6 p-4 rounded-xl border ${bgColor} ${color}`}>
      <div className="flex items-start gap-3 font-medium">
        <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
        <div className="flex-1">
          <span>{message}</span>
          {details && (
            <pre className="text-xs font-mono mt-3 p-3 bg-white/50 border border-slate-200/50 rounded-lg text-left overflow-x-auto max-h-60 text-slate-800 whitespace-pre-wrap">
              {details}
            </pre>
          )}
        </div>
      </div>
    </div>
  );
};

const Upload = () => {  const [files, setFiles] = useState([]);  const [feedback, setFeedback] = useState(null);
  const [evento, setEvento] = useState("ingreso");
  // eslint-disable-next-line no-unused-vars
  const [tunel, setTunel] = useState("");
  // eslint-disable-next-line no-unused-vars
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
        const response = await axios.get(`${API_BASE_URL}/model/info`);
        setModelInfo(response.data);
      } catch (error) {
        console.error('Error loading model info:', error);
      }
    };
    fetchModelInfo();
  }, []);

  // Monitor changes in fileProgress and activeEventSources to check if processing is complete
  useEffect(() => {
    // Only check if we're currently loading and have files to process
    if (loading && files.length > 0) {
      const allOriginalFileNames = files.map(f => f.name);
      const processedFileProgressEntries = Object.values(fileProgress).filter(fp => allOriginalFileNames.includes(fp.name));

      const allFilesHaveTerminalStatus = processedFileProgressEntries.length === files.length &&
        processedFileProgressEntries.every(fp =>
          fp.status === 'completed' || fp.status === 'error' || fp.status === 'ignored'
        );

      const noActiveEventSources = Object.keys(activeEventSources).length === 0;

      console.log("Auto-checking completion:", 
          { allFilesHaveTerminalStatus, noActiveEventSources, filesLength: files.length }
      );

      if (allFilesHaveTerminalStatus && noActiveEventSources) {
        console.log("Auto-detection: All files processed, stopping spinner.");
        setLoading(false);
      }
    }
  }, [fileProgress, activeEventSources, loading, files]);

  // Calculate overall progress
  const getOverallProgress = () => {
    if (!loading || files.length === 0) return 100;
    
    const progressEntries = Object.values(fileProgress);
    if (progressEntries.length === 0) return 0;
    
    const totalFiles = files.length;
    const completedFiles = progressEntries.filter(p => 
      p.status === 'completed' || p.status === 'error' || p.status === 'ignored'
    ).length;
    
    return Math.round((completedFiles / totalFiles) * 100);
  };

  const handleChange = (e) => {
    setFiles(Array.from(e.target.files));
    setFeedback(null); // Clear previous feedback
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

    const allFilesHaveTerminalStatus = processedFileProgressEntries.length === files.length &&
      processedFileProgressEntries.every(fp =>
        fp.status === 'completed' || fp.status === 'error' || fp.status === 'ignored'
      );

    const noActiveEventSources = Object.keys(activeEventSources).length === 0;      console.log("Manual checkAllFilesProcessed:", 
        { allFilesHaveTerminalStatus, noActiveEventSources, filesLength: files.length }
      );

    if (allFilesHaveTerminalStatus && noActiveEventSources && files.length > 0) {
      setLoading(false);
      console.log("Manual check: All files definitively processed. Generating final feedback.");

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
          msg = `${result.filename}: Procesado.`;
          if (result.numero_detectado) msg += ` Número: ${result.numero_detectado}`;
          if (typeof result.confianza === 'number') msg += ` (Confianza: ${(result.confianza * 100).toFixed(1)}%)`;
        } else if (result.status === "ignored") {
          msg = `${result.filename}: ${result.message || 'Procesado, pero no se generó un resultado guardable.'}`;
        } else if (result.status === "error") {
          msg = `${result.filename}: Error - ${result.message || result.error || 'Error desconocido'}`;
        } else {
          msg = `${result.filename}: ${result.message || 'Estado: ' + result.status}`;
        }
      } else if (totalAttemptedFiles > 0) {
        msg = `Procesamiento finalizado para ${totalAttemptedFiles} archivo(s). Detectados: ${okCount}`;
        if (ignoredCount > 0) msg += `, Sin resultado guardado: ${ignoredCount}`;
        if (errorCount > 0) msg += `, Con errores: ${errorCount}`;
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
    const eventSource = new EventSource(`${API_BASE_URL}/stream-video-processing/${processingId}`);
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
        let currentProgressState = {};        let shouldCloseEventSource = false;
        let isTerminalEvent = false;

        // Solo loggear eventos importantes para evitar spam
        if (data.type === 'error' || data.type === 'stream_end' || data.type === 'final_result') {
          console.log(`SSE (${fileId} - ${filename}):`, data);
        }        if (data.type === 'status' && data.stage === 'stream_init') {
          serverMessage = data.message || 'Stream iniciado.';
        } else if (data.type === 'progress') {
          serverMessage = `${data.message} (${data.current_frame}/${data.total_frames})`;
          // Agregar información de progreso para mostrar barra visual
          if (data.current_frame !== undefined && data.total_frames && data.total_frames > 0) {
            currentProgressState.frameProgress = {
              current: data.current_frame,
              total: data.total_frames,
              percentage: Math.round((data.current_frame / data.total_frames) * 100)
            };
          }
        } else if (data.type === 'detection_update') {
          serverMessage = `Frame ${data.frame}: Detectado ${data.numero} (Confianza: ${(data.confianza * 100).toFixed(1)}%)`;
        } else if (data.type === 'final_result') {
          serverMessage = data.message || "Análisis de video completado, esperando registro en BD.";
          currentProgressState = { resultDataFromStream: data.data }; 
        } else if (data.type === 'processing_complete') {
          // Manejar registros consolidados creados
          isTerminalEvent = true;
          shouldCloseEventSource = true;
          const records = data.records || [];
          const totalRecords = data.total_records || records.length;
          
          if (totalRecords > 0) {
            const recordsSummary = records.map(r => {
              const consolidatedText = r.consolidado ? ` (${r.total_detecciones} det.)` : '';
              return `N°${r.numero}${consolidatedText}`;
            }).join(', ');
            
            setAllFilesResults(prevResults => [...prevResults, {
              fileId,
              filename,
              status: 'ok',
              message: `${totalRecords} registro(s) creado(s): ${recordsSummary}`,
              records: records,
              total_records: totalRecords
            }]);
            
            currentProgressState = {
              status: 'completed',
              result: { records: records, total_records: totalRecords },
            };
            serverMessage = `${totalRecords} registro(s) creado(s): ${recordsSummary}`;
          } else {
            setAllFilesResults(prevResults => [...prevResults, {
              fileId,
              filename,
              status: 'ignored',
              message: 'Procesamiento completado pero no se crearon registros'
            }]);
            currentProgressState = { status: 'ignored' };
            serverMessage = 'Procesamiento completado pero no se crearon registros';
          }
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
      
      // Cerrar la conexión de forma segura
      try {
        eventSource.close();
      } catch (e) {
        console.warn("Error cerrando EventSource:", e);
      }
      
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
    if (!files.length) return;    setLoading(true);
    setFeedback(null);
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
    setFileProgress(initialFileProgress);    const newAbortController = new AbortController();
    setAbortController(newAbortController);

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
            `${API_BASE_URL}/upload-chunk/`,
            chunkFormData,
            { 
              signal: newAbortController.signal,              // eslint-disable-next-line no-loop-func
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
              }
            }          );
          ChunksUploadedCurrentFile++;
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
            `${API_BASE_URL}/finalize-upload/`,
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
                processingId: resultData.processing_id, // Guardar el processing_id
                frameProgress: { current: 0, total: 1, percentage: 0 } // Inicializar progreso en 0%
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
    console.log("Cancelando procesamiento...");
    
    if (abortController) {
      try {
        abortController.abort();
      } catch (e) {
        console.warn("Error abortando controlador:", e);
      }
    }
    
    setLoading(false);
    
    // Cerrar todas las conexiones EventSource de forma segura
    Object.values(activeEventSources).forEach(source => {
      try {
        source.close();
      } catch (e) {
        console.warn("Error cerrando EventSource:", e);
      }
    });
    setActiveEventSources({});
    
    // Update feedback for any files that were in 'uploading' or 'pending' state
    const updatedFileProgress = { ...fileProgress };
    Object.keys(updatedFileProgress).forEach(fileId => {
      if (updatedFileProgress[fileId].status === 'uploading' || 
          updatedFileProgress[fileId].status === 'pending' || 
          updatedFileProgress[fileId].status === 'finalizing' || 
          updatedFileProgress[fileId].status === 'server_processing') {
        updatedFileProgress[fileId].status = 'error';
        updatedFileProgress[fileId].serverMessage = 'Carga/Procesamiento cancelado por el usuario.';
      }
    });
    setFileProgress(updatedFileProgress);
    setFeedback({ status: "info", message: "Carga y procesamiento cancelados por el usuario." });
    
    console.log("Procesamiento cancelado exitosamente.");
    checkAllFilesProcessed(); // Re-check to update overall status
  };
  return (
    <div className="w-full max-w-4xl mx-auto bg-white rounded-xl shadow-sm border border-slate-200 p-8 mt-6 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          Procesar Imágenes y Videos
        </h2>
        <p className="text-slate-600 text-lg">
          Sube una o múltiples imágenes/videos para detectar automáticamente los números de las vagonetas.
        </p>
        {modelInfo && (
          <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl inline-flex flex-wrap items-center justify-center gap-4 text-sm text-slate-700">
            <span className="flex items-center gap-1.5"><Brain className="w-4 h-4 text-orange-600" /> <span className="font-medium">Modelo:</span> {modelInfo.model_type}</span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5"><Target className="w-4 h-4 text-orange-600" /> <span className="font-medium">{modelInfo.classes_count} clases</span></span>
            <span className="text-slate-300">|</span>
            <span className="flex items-center gap-1.5"><Activity className="w-4 h-4 text-orange-600" /> <span className="font-medium">Confianza:</span> {modelInfo.confidence_threshold}</span>
          </div>
        )}
      </div>

      <form onSubmit={handleUpload} className="space-y-6">
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 text-center bg-slate-50 hover:bg-slate-100 transition-colors duration-200 group">
          <div className="mb-4 flex justify-center">
            <UploadCloud className="h-12 w-12 text-slate-400 group-hover:text-orange-500 transition-colors" />
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
            <span className="text-lg font-medium text-orange-600 hover:text-orange-700">
              {files.length > 0 ? 'Cambiar archivos seleccionados' : 'Haz clic para seleccionar archivos'}
            </span>
            <p className="text-slate-500 mt-2 text-sm">
              Soporta imágenes (JPG, PNG) y videos (MP4, AVI)
            </p>
          </label>
        </div>

        {/* Mostrar archivos seleccionados */}
        {files.length > 0 && !loading && (
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-4">
            <div className="flex items-center mb-3">
              <CheckCircle2 className="h-5 w-5 text-orange-600 mr-2" />
              <h3 className="text-sm font-medium text-orange-900">
                {files.length} archivo{files.length > 1 ? 's' : ''} seleccionado{files.length > 1 ? 's' : ''}
              </h3>
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={index} className="flex items-center text-sm text-orange-800 bg-white rounded-lg px-3 py-2 border border-orange-100 shadow-sm">
                  {file.type.startsWith('video/') ? (
                    <FileVideo className="w-4 h-4 mr-2 text-orange-500" />
                  ) : (
                    <FileImage className="w-4 h-4 mr-2 text-orange-500" />
                  )}
                  <span className="flex-1 truncate font-medium">{file.name}</span>
                  <span className="text-xs text-orange-500 ml-2">
                    {(file.size / (1024 * 1024)).toFixed(2)} MB
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4">
          <div>
            <label htmlFor="evento" className="block text-sm font-medium text-slate-700 mb-2">Evento</label>
            <select 
              id="evento" 
              value={evento} 
              onChange={(e) => setEvento(e.target.value)} 
              className="input-field bg-white"
            >
              <option value="ingreso">Ingreso</option>
              <option value="salida">Salida</option>
              <option value="otro">Otro</option>
            </select>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 pt-6">
          <button
            type="submit"
            disabled={loading || files.length === 0}
            className="btn-primary flex-grow text-lg py-3"
          >
            {loading ? (
              <>
                <Spinner size={20} color="#ffffff" />
                <span className="ml-2">
                  Procesando... {getOverallProgress()}%
                </span>
              </>
            ) : (
              <>
                <UploadCloud className="w-5 h-5 mr-2" />
                Iniciar Procesamiento
              </>
            )}
          </button>
          
          {loading && (
            <button
              type="button"
              onClick={handleCancelUpload}
              className="btn-secondary py-3 text-lg"
            >
              <X className="w-5 h-5 mr-2" />
              Cancelar
            </button>
          )}
          
          {!loading && Object.keys(fileProgress).length > 0 && (
            <button
              type="button"
              onClick={() => {
                Object.values(activeEventSources).forEach(source => {
                  try { source.close(); } catch (e) {}
                });
                if (abortController) {
                  try { abortController.abort(); } catch (e) {}
                }
                setFiles([]);
                setFileProgress({});
                setFeedback(null);
                setAllFilesResults([]);
                setActiveEventSources({});
                setAbortController(null);
                setLoading(false);
              }}
              className="inline-flex items-center justify-center px-6 py-3 bg-green-600 text-white font-medium rounded-lg shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors text-lg"
            >
              <RefreshCw className="w-5 h-5 mr-2" />
              Procesar Nuevos Archivos
            </button>
          )}
        </div>
      </form>

      {feedback && (
        <Feedback status={feedback.status} message={feedback.message} details={feedback.details} />
      )}

      {Object.keys(fileProgress).length > 0 && (
        <div className="mt-8 bg-slate-50 border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-200">
            <h3 className="text-xl font-semibold text-slate-800">
              Detalle del Procesamiento
            </h3>
            {!loading && (
              <div className="flex items-center text-green-600 bg-green-50 px-3 py-1 rounded-full border border-green-200">
                <Check className="h-4 w-4 mr-1.5" />
                <span className="text-sm font-medium">Procesamiento Completado</span>
              </div>
            )}
          </div>
          <div className="space-y-4">{Object.entries(fileProgress).map(([fileId, progress]) => {
              // eslint-disable-next-line no-unused-vars
              const originalFile = files.find(f => f.name === progress.name);
              const fileSizeMB = progress.total ? (progress.total / (1024 * 1024)).toFixed(2) : 'N/A';
              const individualProgressPercent = progress.total > 0 ? Math.round((progress.loaded / progress.total) * 100) : 0;              
              
              let StatusIcon = Activity;
              let statusColor = 'text-slate-600';
              let statusText = progress.status;

              if (progress.status === 'completed') {
                StatusIcon = CheckCircle2;
                statusColor = 'text-green-600';
                statusText = 'Completado';
              } else if (progress.status === 'error') {
                StatusIcon = XCircle;
                statusColor = 'text-red-600';
                statusText = 'Error';
              } else if (progress.status === 'ignored') {
                StatusIcon = AlertTriangle;
                statusColor = 'text-amber-600';
                statusText = 'Ignorado';
              } else if (progress.status === 'uploading') {
                StatusIcon = UploadCloud;
                statusColor = 'text-blue-600';
                statusText = 'Subiendo';
              } else if (progress.status === 'finalizing') {
                StatusIcon = RefreshCw;
                statusColor = 'text-blue-600';
                statusText = 'Finalizando';
              } else if (progress.status === 'server_processing') {
                StatusIcon = Brain;
                statusColor = 'text-purple-600';
                statusText = 'Procesando';
              } else if (progress.status === 'pending') {
                StatusIcon = Activity;
                statusColor = 'text-slate-500';
                statusText = 'Pendiente';
              }

              return (
                <div key={fileId} className="p-4 bg-white rounded-xl shadow-sm border border-slate-200 transition-all">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-slate-700 truncate max-w-[calc(100%-140px)]" title={progress.name}>
                      {progress.name} <span className="text-slate-400 text-sm font-normal ml-1">({fileSizeMB} MB)</span>
                    </span>
                    <span className={`font-medium ${statusColor} flex items-center text-sm whitespace-nowrap bg-slate-50 px-2 py-1 rounded-md border border-slate-100`}>
                      <StatusIcon className="w-4 h-4 mr-1.5" /> <span>{statusText}</span>
                    </span>
                  </div>

                  {(progress.status === 'uploading' || (progress.status === 'pending' && loading && files.map(f => f.name).includes(progress.name))) && progress.total > 0 && (
                    <div className="w-full bg-slate-100 rounded-full h-2 mb-1 overflow-hidden">
                      <div
                        className="bg-orange-500 h-2 rounded-full transition-all duration-150"
                        style={{ width: `${individualProgressPercent}%` }}
                      ></div>
                    </div>
                  )}                  
                  
                  {progress.status === 'uploading' && progress.total > 0 && (
                    <p className="text-xs text-slate-500 text-right mt-1">{individualProgressPercent}% subido</p>
                  )}

                  {/* Barra de progreso para procesamiento de video por frame */}
                  {progress.status === 'server_processing' && progress.frameProgress && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs font-medium text-purple-600 mb-1.5">
                        <span>Procesando frames</span>
                        <span>{progress.frameProgress.current}/{progress.frameProgress.total} ({progress.frameProgress.percentage}%)</span>
                      </div>
                      <div className="w-full bg-purple-100 rounded-full h-2 overflow-hidden">
                        <div
                          className="bg-purple-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.frameProgress.percentage}%` }}
                        ></div>
                      </div>
                    </div>
                  )}

                  {progress.serverMessage && (
                    <div className="mt-3 bg-slate-50 border border-slate-100 p-3 rounded-lg flex items-start gap-2">
                      <Info className="w-4 h-4 text-slate-400 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-slate-600">
                        {progress.serverMessage}
                      </p>
                    </div>
                  )}

                  {progress.status === 'completed' && progress.result && (
                    <div className="mt-3 text-sm p-3 bg-green-50 border border-green-200 rounded-lg">
                      {progress.serverMessage && progress.serverMessage.includes('registro(s) creado(s)') ? (
                        <p className="text-green-800 font-medium">Procesamiento completado - Ver detalles arriba</p>
                      ) : (
                        <div className="grid grid-cols-2 gap-2">
                          {(progress.result.numero || progress.result.numero_detectado) && (
                            <div className="bg-white p-2 rounded border border-green-100">
                              <span className="text-green-600 text-xs font-semibold uppercase tracking-wider block">Número Detectado</span>
                              <span className="font-bold text-green-800">{progress.result.numero || progress.result.numero_detectado}</span>
                            </div>
                          )}
                          {progress.result.confianza && (
                            <div className="bg-white p-2 rounded border border-green-100">
                              <span className="text-green-600 text-xs font-semibold uppercase tracking-wider block">Confianza</span>
                              <span className="font-bold text-green-800">{(progress.result.confianza * 100).toFixed(1)}%</span>
                            </div>
                          )}
                        </div>
                      )}
                      {progress.result.message && !progress.serverMessage?.includes(progress.result.message) && (
                        <p className="mt-2 text-green-700 bg-white p-2 rounded border border-green-100 text-xs">{progress.result.message}</p>
                      )}
                    </div>
                  )}
                  {progress.status === 'error' && progress.result && progress.result.message && (
                    <div className="mt-3 text-sm p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700">
                      <XCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p><strong>Error:</strong> {progress.result.message}</p>
                    </div>
                  )}
                  {progress.status === 'ignored' && progress.result && progress.result.message && (
                    <div className="mt-3 text-sm p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-amber-700">
                      <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <p>{progress.result.message}</p>
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
