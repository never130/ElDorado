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
        setHistorial(prev => [...prev, ...(response.data.registros || [])]);
      }
      
      setTotalRecords(response.data.total || 0);
      setHasMore(response.data.has_more || false);
      setCurrentPage(page);
    } catch (err) {
      setError('Error al cargar el historial');
      console.error(err);
    }
    setLoading(false);
  }, [fechaInicio, fechaFin, searchTerm, recordsPerPage]);  // Cargar historial inicial solo una vez
  useEffect(() => {
    fetchHistorial(1, true);
  }, [fetchHistorial]); // Incluir fetchHistorial

  // Efecto separado para manejar cambios en filtros
  useEffect(() => {
    // Solo ejecutar si hay filtros activos para evitar loops
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchHistorial(1, true);
    }, 300);
    
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, fechaInicio, fechaFin]); // Solo depender de los filtros, no de currentPage o fetchHistorial

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
  };

  const downloadCSV = () => {
    const headers = ["N°", "Evento", "Modelo", "Confianza (%)", "Fecha"];    const rows = sortedHistorial.map(item => [
      item.numero_detectado || 'N/A',
      item.evento,
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
      <div className="flex justify-center items-center h-screen">
        <Spinner size={40} />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-red-500 text-center">
          <p className="text-xl font-semibold mb-2">Error</p>
          <p>{error}</p>
          <button 
            onClick={() => fetchHistorial(1, true)} 
            className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition-all"
          >
            <FaRedo className="inline mr-2" />
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white shadow-lg rounded-lg p-6">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center mb-6 gap-4">
        <h2 className="text-2xl font-bold text-gray-800">📊 Historial de Detecciones</h2>
        
        <div className="flex flex-col sm:flex-row gap-3 w-full lg:w-auto">
          <input
            type="text"
            placeholder="Buscar por número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <input
            type="date"
            placeholder="Fecha inicio"
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <input
            type="date"
            placeholder="Fecha fin"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          
          <button 
            onClick={clearFilters}
            className="px-3 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-all whitespace-nowrap"
          >
            Limpiar
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full bg-white border border-gray-200 rounded-lg overflow-hidden">
          <thead className="bg-gray-50">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('numero_detectado')}
              >
                N° {sortConfig.key === 'numero_detectado' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Evento
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Modelo
              </th>              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('confianza')}
              >
                Confianza {sortConfig.key === 'confianza' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                onClick={() => handleSort('timestamp')}
              >
                Fecha {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '↑' : '↓')}
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Imagen
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {sortedHistorial.map((item, index) => (
              <tr key={item._id || index} className="hover:bg-gray-50 transition-colors">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className="text-lg font-bold text-blue-600">
                    {item.numero_detectado || 'N/A'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    item.evento === 'ingreso' 
                      ? 'bg-green-100 text-green-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {item.evento}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.modelo_ladrillo || 'N/A'}
                </td>                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.confianza ? `${(item.confianza * 100).toFixed(1)}%` : 
                   item.confianza_numero ? `${(item.confianza_numero * 100).toFixed(1)}%` : 
                   item.confidence ? `${(item.confidence * 100).toFixed(1)}%` : 
                   'N/A'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(item.timestamp).toLocaleString('es-ES', {
                    year: 'numeric', month: '2-digit', day: '2-digit',
                    hour: '2-digit', minute: '2-digit', second: '2-digit'
                  })}
                </td>                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {item.imagen_path ? (
                    <div className="flex items-center gap-2">
                      <img 
                        src={`http://localhost:8000/${item.imagen_path}`}
                        alt={`Detección ${item.numero_detectado || 'N/A'}`}
                        className="w-12 h-12 object-cover rounded-md cursor-pointer hover:opacity-75 transition-opacity border border-gray-200"                        onClick={() => setSelectedImage(`http://localhost:8000/${item.imagen_path}`)}
                        onError={(e) => {
                          e.target.style.display = 'none';
                          e.target.nextSibling.style.display = 'inline-block';
                        }}
                      />
                      <button
                        onClick={() => setSelectedImage(`http://localhost:8000/${item.imagen_path}`)}
                        className="text-blue-600 hover:text-blue-800 underline text-xs hidden"
                      >
                        Ver imagen
                      </button>
                    </div>
                  ) : (
                    <span className="text-gray-400 italic text-xs">Sin imagen</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Información de paginación y controles */}
      <div className="mt-4 flex flex-col sm:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={downloadCSV} 
            className="flex items-center bg-green-600 text-white px-4 py-2 rounded-md shadow hover:bg-green-500 transition-all"
          >
            <FaFileCsv className="mr-2" />
            Descargar CSV
          </button>
        </div>
        
        <div className="flex items-center gap-4">
          <span className="text-gray-500 text-sm">
            Página {currentPage} | Mostrando {sortedHistorial.length} de {totalRecords} registros
          </span>
          
          <div className="flex gap-2">
            <button 
              onClick={handlePreviousPage}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
            >
              ← Anterior
            </button>
            
            <button 
              onClick={handleNextPage}
              disabled={!hasMore || loading}
              className="px-3 py-1 bg-blue-600 text-white rounded-md disabled:bg-gray-300 disabled:cursor-not-allowed hover:bg-blue-700 transition-all"
            >
              Siguiente →
            </button>
          </div>
        </div>
      </div>

      {/* Modal para mostrar imagen ampliada */}
      {selectedImage && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50" onClick={() => setSelectedImage(null)}>
          <div className="relative max-w-4xl max-h-full p-4">
            <img 
              src={selectedImage} 
              alt="Imagen ampliada" 
              className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            />
            <button 
              onClick={() => setSelectedImage(null)}
              className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-red-700 transition-colors"
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
