import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { FaFileCsv, FaRedo } from 'react-icons/fa';
import Spinner from './Spinner';

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
  const [agruparPorNumero, setAgruparPorNumero] = useState(true); // Por defecto agrupado
  const [maxPorNumero, setMaxPorNumero] = useState(2);

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
      let url = `http://localhost:8000/historial/?skip=${skip}&limit=${recordsPerPage}`;
      
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
  }, [fechaInicio, fechaFin, searchTerm, recordsPerPage, agruparPorNumero, maxPorNumero]);  // Incluir dependencias de agrupación
  
  useEffect(() => {
    fetchHistorial(1, true);
  }, [fetchHistorial]); // Incluir fetchHistorial

  // Efecto separado para manejar cambios en filtros y agrupación
  useEffect(() => {
    // Solo ejecutar si hay filtros activos para evitar loops
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchHistorial(1, true);
    }, 300);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, fechaInicio, fechaFin, agruparPorNumero, maxPorNumero]); // Incluir nuevas dependencias

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
  const clearFilters = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
    setCurrentPage(1);
    // Mantener agrupación por defecto
    setAgruparPorNumero(true);
    setMaxPorNumero(2);
  };
  const downloadCSV = () => {
    const headers = ["Numero Detectado", "Evento", "Túnel", "Modelo", "Confianza (%)", "Fecha"];    const rows = sortedHistorial.map(item => [
      item.numero_detectado || 'N/A',
      item.evento,
      getTunel(item),
      item.modelo_ladrillo || 'N/A',
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
      <div className="flex justify-center items-center min-h-[400px]">
        <Spinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="text-center">
          <p className="text-xl font-medium text-slate-900 mb-2">Error</p>
          <p className="text-slate-600 mb-4">{error}</p>
          <button 
            onClick={() => fetchHistorial(1, true)} 
            className="inline-flex items-center px-4 py-2 bg-orange-600 text-white font-medium rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
          >
            <FaRedo className="mr-2 h-4 w-4" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="bg-white border border-slate-200 rounded-lg p-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-slate-900">📊 Historial de Detecciones</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Buscar por número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          />
          
          <input
            type="date"
            placeholder="Fecha inicio"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          />
          
          <input
            type="date"
            placeholder="Fecha fin"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-slate-300 rounded-md bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors"
          />
          
          <button 
            onClick={clearFilters}
            className="px-3 py-2 bg-slate-600 text-white font-medium rounded-md hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-500 transition-colors whitespace-nowrap"
          >
            Limpiar
          </button>
        </div>
      </div>
        {/* Controles de agrupación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mb-6 p-4 bg-slate-50 border border-slate-200 rounded-lg">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="agrupar"
            checked={agruparPorNumero}
            onChange={(e) => setAgruparPorNumero(e.target.checked)}
            className="h-4 w-4 text-orange-600 focus:ring-orange-500 border-slate-300 rounded"
          />
          <label htmlFor="agrupar" className="text-sm font-medium text-slate-700">
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
              className="px-2 py-1 border border-slate-300 rounded-md text-sm bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            >
              <option value={1}>1</option>
              <option value={2}>2</option>
              <option value={3}>3</option>
            </select>
          </div>
        )}
          <div className="text-xs text-slate-500">
          {agruparPorNumero 
            ? `📊 Mostrando máximo ${maxPorNumero} registro(s) por número (los de mayor confianza)`
            : "📄 Mostrando todos los registros sin agrupación"
          }
        </div>
        
        <div className="text-xs text-slate-400 mt-2 flex items-center gap-4">
          <span>📝 Referencia túneles:</span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-purple-100 border border-purple-200 rounded"></span>
            <span>1 = Proc. Imágenes</span>
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 bg-teal-100 border border-teal-200 rounded"></span>
            <span>2 = Monitor Vivo</span>
          </span>
        </div>
      </div>      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-slate-200 rounded-lg overflow-hidden">
          <thead className="bg-slate-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('numero_detectado')}
              >
                Numero Detectado {sortConfig.key === 'numero_detectado' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Túnel
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Modelo
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('confianza')}
              >
                Confianza {sortConfig.key === 'confianza' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider cursor-pointer hover:bg-slate-100 transition-colors"
                onClick={() => handleSort('timestamp')}
              >
                Fecha {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                Imagen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {sortedHistorial.map((item, index) => (
              <tr key={item._id || index} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-lg font-bold text-orange-600">
                    {item.numero_detectado || 'N/A'}
                  </span>
                </td>                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    item.evento === 'ingreso' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.evento}
                  </span>
                </td>                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                    getTunel(item) === '1'
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-teal-100 text-teal-800'
                  }`}>
                    {getTunel(item)}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {item.modelo_ladrillo || 'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                  {item.confianza ? `${(item.confianza * 100).toFixed(1)}%` : 
                   item.confianza_numero ? `${(item.confianza_numero * 100).toFixed(1)}%` : 
                   item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : 
                   'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {new Date(item.timestamp).toLocaleString('es-ES', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                  {item.imagen_path ? (
                    <div className="flex items-center gap-2">
                      <img 
                        src={`http://localhost:8000/${item.imagen_path}`}
                        alt={`Detección ${item.numero_detectado || 'N/A'}`}
                        className="w-12 h-12 object-cover rounded-md cursor-pointer hover:opacity-75 transition-opacity border border-slate-200"
                        onClick={() => setSelectedImage(`http://localhost:8000/${item.imagen_path}`)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'inline-block';
                        }}
                      />
                      <button
                        onClick={() => setSelectedImage(`http://localhost:8000/${item.imagen_path}`)}
                        className="text-orange-600 hover:text-orange-800 underline text-xs hidden"
                      >
                        Ver imagen
                      </button>
                    </div>
                  ) : (
                    <span className="text-slate-400 italic text-xs">Sin imagen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>      {/* Información de paginación y controles */}
      <div className="mt-6 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={downloadCSV} 
            className="inline-flex items-center px-4 py-2 bg-green-600 text-white font-medium rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition-colors"
          >
            <FaFileCsv className="mr-2 h-4 w-4" />
            Descargar CSV
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-slate-500 text-sm">
            Página {currentPage} | Mostrando {sortedHistorial.length} de {totalRecords} registros
          </span>
          
          <div className="flex gap-2">
            <button 
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 bg-orange-600 text-white font-medium rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              ← Anterior
            </button>
            
            <button 
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="px-3 py-1 bg-orange-600 text-white font-medium rounded-md disabled:bg-slate-300 disabled:cursor-not-allowed hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>      {/* Modal para mostrar imagen ampliada */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-full p-4">
            <img 
              src={selectedImage} 
              alt="Imagen ampliada" 
              className="max-w-full max-h-full object-contain rounded-lg"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Historial;
