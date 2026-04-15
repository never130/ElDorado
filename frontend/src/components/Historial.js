import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Download, RefreshCw, Search, Calendar, FilterX, Layers, Activity, AlertCircle, FileSpreadsheet, ChevronLeft, ChevronRight, BarChart3, Image as ImageIcon, X } from 'lucide-react';
import Spinner from './Spinner';
import { API_BASE_URL, assetUrl } from '../config/api';

const Historial = () => {
  const [historial, setHistorial] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'timestamp', direction: 'desc' });
  
  // Estados para paginación
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const recordsPerPage = 20;
  
  // Estados para filtros de fecha
  const [fechaInicio, setFechaInicio] = useState('');
  const [fechaFin, setFechaFin] = useState('');
  
  // Nuevo estado para agrupación
  const [agruparPorNumero, setAgruparPorNumero] = useState(true); // Por defecto CON agrupación para evitar duplicados
  const [maxPorNumero, setMaxPorNumero] = useState(1); // Solo mostrar el mejor por número por defecto

  // Helper function para determinar el túnel
  const getTunel = (item) => {
    if (item.tunel) return item.tunel;
    // Túnel 1 para procesamiento de imágenes y videos
    const procesamientoOrigins = ['image_upload', 'image_upload_multiple', 'image_chunk_upload', 'video_processing'];
    return procesamientoOrigins.includes(item.origen_deteccion) ? '1' : '2';
  };
  const fetchHistorial = useCallback(async (page = 1, resetData = false) => {
    setLoading(true);
    setError('');
    
    try {
      const skip = (page - 1) * recordsPerPage;
      let url = `${API_BASE_URL}/historial/?skip=${skip}&limit=${recordsPerPage}`;
      
      // Agregar filtros de fecha si están definidos
      const params = new URLSearchParams();
      if (fechaInicio) {
        params.append('fecha_inicio', fechaInicio);
      }
      if (fechaFin) {
        params.append('fecha_fin', fechaFin);
      }
      if (searchTerm) {
        params.append('filtro', searchTerm);
      }
      
      // Agregar parámetros de agrupación
      if (agruparPorNumero) {
        params.append('agrupar_por_numero', 'true');
        params.append('max_por_numero', maxPorNumero.toString());
      }
      
      if (params.toString()) {
        url += '&' + params.toString();
      }
        console.log("Fetching URL:", url);
      const response = await axios.get(url);
      console.log("Datos recibidos de la API:", response.data);
      
      // Log detallado de la estructura de un registro para debug
      if (response.data.registros && response.data.registros.length > 0) {
        console.log("Estructura del primer registro:", response.data.registros[0]);
        console.log("Campos disponibles:", Object.keys(response.data.registros[0]));
      }
      
      if (resetData || page === 1) {
        setHistorial(response.data.registros || []);
      } else {
        setHistorial(prev => [...prev, ...(response.data.registros || [])]);      }
      
      setTotalRecords(response.data.total || 0);
      setHasMore(response.data.has_more || false);
      setCurrentPage(page);
    } catch (err) {
      setError('Error al cargar el historial');
      console.error(err);
    }
    setLoading(false);
  }, [fechaInicio, fechaFin, searchTerm, recordsPerPage, agruparPorNumero, maxPorNumero]);

  // Efecto principal: cargar datos iniciales
  useEffect(() => {
    fetchHistorial(1, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Efecto unificado para manejar cambios en todos los filtros y agrupación
  useEffect(() => {
    // Solo ejecutar si hay datos cargados previamente (evitar carga inicial duplicada)
    // y si realmente hay cambios en los filtros
    if (historial.length > 0) {
      console.log("🔄 Detectado cambio en filtros o agrupación, recargando datos...");
      
      const timeoutId = setTimeout(() => {
        setCurrentPage(1);
        fetchHistorial(1, true);
      }, 300); // Debounce para evitar llamadas múltiples
      
      return () => clearTimeout(timeoutId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, fechaInicio, fechaFin, agruparPorNumero, maxPorNumero]);

  // Simplificar el filtrado ya que ahora se hace en el servidor
  const filteredHistorial = useMemo(() => {
    return historial; // Los filtros se aplican en el servidor
  }, [historial]);

  // Simplificar el ordenamiento ya que se hace en el servidor
  const sortedHistorial = useMemo(() => {
    return filteredHistorial; // El ordenamiento se hace en el servidor
  }, [filteredHistorial]);

  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    
    console.log(`Ordenando por ${key} en dirección ${direction}`);
    
    // Recargar datos con nuevo ordenamiento
    fetchHistorial(1, true);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      console.log(`Navegando a página anterior: ${newPage}`);
      setCurrentPage(newPage);
      fetchHistorial(newPage, true);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newPage = currentPage + 1;
      console.log(`Navegando a página siguiente: ${newPage}`);
      setCurrentPage(newPage);
      fetchHistorial(newPage, true);
    }
  };
  const clearFilters = useCallback(async () => {
    console.log("🧹 Limpiando filtros del historial...");
    
    // Resetear todos los filtros
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
    setCurrentPage(1);
    
    // Mantener agrupación por defecto para mostrar vista optimizada
    setAgruparPorNumero(true);
    setMaxPorNumero(1);
    
    // Limpiar cualquier error previo
    setError('');
    
    console.log("✅ Filtros limpiados, recargando datos...");
    
    // Recargar datos directamente para evitar dependencia de useEffect
    await fetchHistorial(1, true);
  }, [fetchHistorial]);
  const downloadCSV = () => {
    const headers = ["Numero Detectado", "Evento", "Túnel", "Modelo", "Confianza (%)", "Fecha"];    const rows = sortedHistorial.map(item => [
      item.numero_detectado || 'N/A',
      item.evento,
      getTunel(item),
      (item.modelo_ladrillo && item.modelo_ladrillo !== 'None' && item.modelo_ladrillo !== 'null') 
        ? item.modelo_ladrillo 
        : 'Sin clasificar',
      item.confianza ? (item.confianza * 100).toFixed(1) : 
      item.confianza_numero ? (item.confianza_numero * 100).toFixed(1) : 
      item.confidence ? (item.confidence * 100).toFixed(1) : 'N/A',
      new Date(item.timestamp).toLocaleString('es-ES', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit'
      })
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + 
      [headers, ...rows].map(e => e.join(",")).join("\\n");

    const link = document.createElement("a");
    link.setAttribute("href", encodeURI(csvContent));
    link.setAttribute("download", "historial_detecciones.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[400px] w-full">
        <Spinner size={40} color="#ea580c" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-red-500 mb-3" />
          <p className="text-xl font-semibold text-slate-900 mb-2">Ha ocurrido un error</p>
          <p className="text-slate-600 mb-6">{error}</p>
          <button 
            onClick={() => fetchHistorial(1, true)} 
            className="btn-primary"
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="card p-6 w-full max-w-7xl mx-auto">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6 text-orange-600" /> Historial de Detecciones
        </h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar número..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="date"
              placeholder="Fecha inicio"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          
          <div className="relative">
            <Calendar className="w-4 h-4 absolute left-3 top-3 text-slate-400" />
            <input
              type="date"
              placeholder="Fecha fin"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="input-field pl-9"
            />
          </div>
          
          <button 
            onClick={clearFilters}
            className="btn-secondary whitespace-nowrap"
          >
            <FilterX className="w-4 h-4 mr-2" />
            Limpiar
          </button>
        </div>
      </div>
      
      {/* Controles de agrupación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="agrupar"
            checked={agruparPorNumero}
            onChange={(e) => setAgruparPorNumero(e.target.checked)}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-slate-300 rounded cursor-pointer"
          />
          <label htmlFor="agrupar" className="text-sm font-medium text-slate-700 cursor-pointer">
            Agrupar duplicados
          </label>
        </div>
        
        {agruparPorNumero && (
          <div className="flex items-center gap-2">
            <label htmlFor="maxPorNumero" className="text-sm text-slate-600">
              Máximo por número:
            </label>
            <select
              id="maxPorNumero"
              value={maxPorNumero}
              onChange={(e) => setMaxPorNumero(parseInt(e.target.value))}
              className="input-field py-1 text-sm"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        )}
        
        <div className="text-xs text-slate-500">
          {agruparPorNumero 
            ? <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" /> Vista optimizada: máximo {maxPorNumero} registro(s) por número</span>
            : <span className="flex items-center gap-1.5"><Layers className="w-3 h-3" /> Vista completa: todos los registros sin agrupación</span>
          }
        </div>
        
        <div className="text-xs text-slate-500 mt-2 sm:mt-0 sm:ml-auto flex items-center gap-3">
          <span className="font-medium text-slate-600">Túneles:</span>
          <span className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200">
            <span className="inline-block w-2 h-2 bg-orange-400 rounded-full"></span>
            <span>1 = Proc. Imágenes</span>
          </span>
          <span className="inline-flex items-center gap-1.5 bg-white px-2 py-1 rounded-md border border-slate-200">
            <span className="inline-block w-2 h-2 bg-emerald-400 rounded-full"></span>
            <span>2 = Monitor Vivo</span>
          </span>
        </div>
      </div>      
      
      <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
        {sortedHistorial.length === 0 ? (
          <div className="text-center py-16">
            <div className="mx-auto w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4">
              <Search className="w-8 h-8 text-slate-400" />
            </div>
            <p className="text-slate-900 text-lg font-semibold mb-1">No hay registros que mostrar</p>
            <p className="text-slate-500 text-sm">
              {searchTerm || fechaInicio || fechaFin ? 
                'Intenta ajustar los filtros de búsqueda' : 
                'Aún no se han procesado imágenes o videos'
              }
            </p>
            {(searchTerm || fechaInicio || fechaFin) && (
              <button 
                onClick={clearFilters}
                className="mt-6 btn-secondary"
              >
                Limpiar filtros
              </button>
            )}
          </div>
        ) : (
        <table className="min-w-full divide-y divide-slate-200">
          <thead className="bg-slate-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('numero_detectado')}
              >
                Numero {sortConfig.key === 'numero_detectado' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Túnel
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Modelo
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('confianza')}
              >
                Confianza {sortConfig.key === 'confianza' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                Fecha {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-semibold text-slate-600 uppercase tracking-wider">
                Imagen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedHistorial.map((item, index) => (
              <tr key={item._id || index} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-lg font-bold text-orange-700 bg-orange-50 px-3 py-1 rounded-lg border border-orange-100">
                    {item.numero_detectado || 'N/A'}
                  </span>
                </td>                
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    item.evento === 'ingreso' 
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' 
                      : 'bg-blue-100 text-blue-800 border border-blue-200'
                  }`}>
                    {item.evento}
                  </span>
                </td>                
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">                  
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    getTunel(item) === '1'
                      ? 'bg-orange-100 text-orange-800 border border-orange-200' 
                      : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                  }`}>
                    Túnel {getTunel(item)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${
                    item.modelo_ladrillo && item.modelo_ladrillo !== 'None' && item.modelo_ladrillo !== 'null'
                      ? 'bg-slate-100 text-slate-800 border border-slate-200'
                      : 'bg-slate-50 text-slate-500 border border-slate-200'
                  }`}>
                    {item.modelo_ladrillo && item.modelo_ladrillo !== 'None' && item.modelo_ladrillo !== 'null' 
                      ? item.modelo_ladrillo 
                      : 'Sin clasificar'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 font-medium">
                  {item.confianza ? `${(item.confianza * 100).toFixed(1)}%` : 
                   item.confianza_numero ? `${(item.confianza_numero * 100).toFixed(1)}%` : 
                   item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : 
                   'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {new Date(item.timestamp).toLocaleString('es-ES', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {item.imagen_path ? (
                    <div className="flex items-center gap-2">
                      <img
                        src={assetUrl(item.imagen_path)}
                        alt={`Detección ${item.numero_detectado || 'N/A'}`}
                        className="w-12 h-12 object-cover rounded-lg cursor-pointer hover:ring-2 hover:ring-orange-500 hover:ring-offset-1 transition-all shadow-sm"
                        onClick={() => setSelectedImage(assetUrl(item.imagen_path))}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          const fallbackElement = e.target.nextSibling;
                          if (fallbackElement) {
                            fallbackElement.style.display = 'flex';
                          }
                        }}
                      />
                      <div
                        className="w-12 h-12 bg-slate-100 rounded-lg hidden items-center justify-center border border-slate-200"
                        style={{display: 'none'}}
                      >
                        <ImageIcon className="w-5 h-5 text-slate-400" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-12 h-12 bg-slate-50 rounded-lg flex items-center justify-center border border-slate-200">
                      <ImageIcon className="w-5 h-5 text-slate-300" />
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        )}
      </div>      {/* Información de paginación y controles */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={downloadCSV} 
            className="inline-flex items-center px-4 py-2 bg-emerald-600 text-white font-medium rounded-lg hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-500 transition-colors shadow-sm"
          >
            <Download className="mr-2 h-4 w-4" />
            Descargar CSV
          </button>
        </div>
        
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <span className="text-slate-500 text-sm font-medium">
            Página {currentPage} | Mostrando {sortedHistorial.length} de {totalRecords}
          </span>
          
          <div className="flex gap-2">
            <button 
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
              className="btn-secondary px-3"
            >
              {loading ? <Spinner size={16} color="#ea580c" /> : <ChevronLeft className="w-5 h-5" />}
            </button>
            
            <button 
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="btn-secondary px-3"
            >
              {loading ? <Spinner size={16} color="#ea580c" /> : <ChevronRight className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>      

      {/* Modal para mostrar imagen ampliada */}
      {selectedImage && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-5xl w-full flex justify-center animate-in fade-in zoom-in duration-200">
            <img 
              src={selectedImage} 
              alt="Imagen ampliada" 
              className="max-w-full max-h-[85vh] object-contain rounded-xl shadow-2xl border-4 border-white/10"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute -top-4 -right-4 bg-white text-slate-900 rounded-full p-2 shadow-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Historial;
