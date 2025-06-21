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
  }, [fechaInicio, fechaFin, searchTerm, recordsPerPage]);
  useEffect(() => {
    fetchHistorial(1, true);
  }, [fetchHistorial]);
  // Efecto para resetear la página cuando cambien los filtros
  useEffect(() => {
    if (currentPage > 1) {
      setCurrentPage(1);
      fetchHistorial(1, true);
    }
  }, [searchTerm, fechaInicio, fechaFin, currentPage, fetchHistorial]);
  // Simplificar el filtrado ya que ahora se hace en el servidor
  const filteredHistorial = useMemo(() => {
    return historial; // Los filtros se aplican en el servidor
  }, [historial]);

  // Simplificar el ordenamiento ya que se hace en el servidor
  const sortedHistorial = useMemo(() => {
    return filteredHistorial; // El ordenamiento se hace en el servidor
  }, [filteredHistorial]);  const handleSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
    // Recargar datos con nuevo ordenamiento
    fetchHistorial(1, true);
  };

  // Función comentada ya que no se usa actualmente
  // const handleLoadMore = () => {
  //   if (hasMore && !loading) {
  //     fetchHistorial(currentPage + 1, false);
  //   }
  // };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      const newPage = currentPage - 1;
      setCurrentPage(newPage);
      fetchHistorial(newPage, true);
    }
  };

  const handleNextPage = () => {
    if (hasMore) {
      const newPage = currentPage + 1;
      setCurrentPage(newPage);
      fetchHistorial(newPage, true);
    }
  };

  const clearFilters = () => {
    setSearchTerm('');
    setFechaInicio('');
    setFechaFin('');
    setCurrentPage(1);
  };  const downloadCSV = () => {
    const headers = ["N°", "Evento", "Modelo", "Confianza (%)", "Fecha"];
    const rows = sortedHistorial.map(item => [
      item.numero_detectado || 'N/A',
      item.evento,
      item.modelo_ladrillo || 'N/A',
      (item.confianza * 100).toFixed(1),
      new Date(item.timestamp).toLocaleString()
    ]);

    let csvContent = "data:text/csv;charset=utf-8," 
      + headers.join(",") + "\n" 
      + rows.map(e => e.join(",")).join("\n");

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
        <p className="text-red-500">{error}</p>
      </div>
    );
  }

  return (    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-3xl font-bold text-gray-800">Historial de Detecciones</h1>
        <button 
          onClick={() => fetchHistorial(1, true)} 
          className="flex items-center bg-cyan-600 text-white px-4 py-2 rounded-md shadow hover:bg-cyan-500 transition-all"
        >
          <FaRedo className="mr-2" />
          Actualizar
        </button>
      </div>

      {/* Filtros */}
      <div className="bg-gray-50 p-4 rounded-lg mb-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar</label>
            <input
              type="text"
              placeholder="Número, evento, modelo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Inicio</label>
            <input
              type="date"
              value={fechaInicio}
              onChange={(e) => setFechaInicio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fecha Fin</label>
            <input
              type="date"
              value={fechaFin}
              onChange={(e) => setFechaFin(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
          </div>
          <div>
            <button 
              onClick={clearFilters}
              className="w-full px-4 py-2 bg-gray-500 text-white rounded-md shadow hover:bg-gray-600 transition-all"
            >
              Limpiar Filtros
            </button>
          </div>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full bg-blue rounded-lg shadow-md">          <thead className="bg-blue-600 text-black">
            <tr>              <th className="py-3 px-4 text-center cursor-pointer font-semibold" onClick={() => handleSort('numero_detectado')}>
                N° {sortConfig.key === 'numero_detectado' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
              </th>
              <th className="py-3 px-4 text-left cursor-pointer font-semibold" onClick={() => handleSort('evento')}>
                Evento {sortConfig.key === 'evento' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
              </th>
              <th className="py-3 px-4 text-left cursor-pointer font-semibold" onClick={() => handleSort('modelo_ladrillo')}>
                Modelo {sortConfig.key === 'modelo_ladrillo' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
              </th>
              <th className="py-3 px-4 text-left cursor-pointer font-semibold" onClick={() => handleSort('confianza')}>
                Confianza {sortConfig.key === 'confianza' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
              </th>
              <th className="py-3 px-4 text-left cursor-pointer font-semibold" onClick={() => handleSort('timestamp')}>
                Fecha {sortConfig.key === 'timestamp' && (sortConfig.direction === 'asc' ? '🔼' : '🔽')}
              </th>
              <th className="py-3 px-4 text-left font-semibold">Imagen</th>
            </tr>
          </thead>          <tbody className="text-gray-900 text-sm">
            {sortedHistorial.map((item, index) => (
              <tr key={item.id || index} className="border-b border-blue-200 hover:bg-gray-50 transition-colors duration-150">
                <td className="py-3 px-4 font-bold text-gray-800 text-center bg-gray-50">
                  {item.numero_detectado || 'N/A'}
                </td>
                <td className="py-3 px-4 font-semibold text-gray-800">{item.evento}</td>
                <td className="py-3 px-4 font-semibold text-blue-700">{item.modelo_ladrillo || "Sin ladrillo detectado"}</td>
                <td className="py-3 px-4 font-semibold text-green-700">{(item.confianza * 100).toFixed(1)}%</td>
                <td className="py-3 px-4 text-gray-700">{new Date(item.timestamp).toLocaleString()}</td>
                <td className="py-3 px-4">
                  <img 
                    src={`http://localhost:8000/${item.imagen_path}`}
                    alt={`Detección ${item.id}`}
                    className="h-16 w-24 object-cover cursor-pointer rounded-md shadow-sm border border-gray-200 hover:shadow-md transition-shadow duration-200" 
                    onClick={() => setSelectedImage(`http://localhost:8000/${item.imagen_path}`)}
                  />
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
