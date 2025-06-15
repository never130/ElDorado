import React, { useEffect, useState } from "react";
import axios from "axios";
import Spinner from "./Spinner";
import { API_BASE_URL, API_ENDPOINTS } from "../config/api"; // Corregida la importación

const Historial = () => {
  const [registros, setRegistros] = useState([]);
  const [numero, setNumero] = useState("");
  const [fecha, setFecha] = useState("");
  const [loading, setLoading] = useState(false);
  const fetchRegistros = async () => {
    setLoading(true);
    try {
      const params = { limit: 10, skip: 0 }; // Add pagination params
      if (numero) params.filtro = numero; // Changed from 'numero' to 'filtro' to match backend
      // Note: fecha filter needs to be implemented on backend
      if (fecha) {
        params.fecha_inicio = fecha + 'T00:00:00Z';
        params.fecha_fin = fecha + 'T23:59:59Z';
      }

      // Use the historial endpoint
      const res = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.vagonetas}`, { params }); 
      console.log("Datos crudos de la API:", res.data); // Para depuración
      
      // Handle new response structure with HistorialResponse
      const responseData = res.data;
      let data = [];
      
      if (responseData && responseData.registros && Array.isArray(responseData.registros)) {
        data = responseData.registros.map(item => ({
          ...item,
          // Map new field names to old ones for compatibility
          numero: item.numero_detectado || item.numero,
          // Handle timestamp properly
          timestamp: new Date(item.timestamp && !item.timestamp.endsWith('Z') ? item.timestamp + 'Z' : item.timestamp),
          confianza: item.confianza,
          // Map additional fields
          origen_deteccion: item.origen_deteccion || 'desconocido'
        }));
      } else if (Array.isArray(responseData)) {
        // Fallback for old response format
        data = responseData.map(item => ({
          ...item,
          timestamp: new Date(item.timestamp && !item.timestamp.endsWith('Z') ? item.timestamp + 'Z' : item.timestamp),
          confianza: item.confianza
        }));
      }
      
      setRegistros(data);
    } catch (err) {
      console.error("Error fetching historial:", err);
      setRegistros([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchRegistros();
    // eslint-disable-next-line
  }, []);

  const handleFiltrar = (e) => {
    e.preventDefault();
    fetchRegistros();
  };

  return (
    <div className="w-full flex flex-col items-center px-2 md:px-0">
      <h2 className="text-2xl font-extrabold text-orange-600 mb-4 tracking-tight drop-shadow-sm uppercase letter-spacing-wide">Historial de Vagonetas</h2>
      <form onSubmit={handleFiltrar} className="mb-4 w-full max-w-3xl">
        <div className="flex flex-col md:flex-row md:space-x-4">
          <input
            type="text"
            placeholder="Número de vagoneta"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            className="flex-1 px-4 py-2 border border-cyan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <input
            type="date"
            value={fecha}
            onChange={e => setFecha(e.target.value)}
            className="flex-1 px-4 py-2 border border-cyan-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500"
          />
          <button type="submit" className="mt-2 md:mt-0 bg-orange-600 text-white font-bold py-2 px-4 rounded-lg shadow hover:bg-orange-500 transition-all">
            Filtrar
          </button>
        </div>
      </form>
      {loading ? (
        <div className="flex justify-center items-center py-8"><Spinner size={32} /></div>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="min-w-full bg-white border border-cyan-200 rounded-xl shadow text-cyan-900 text-base">
            <thead className="bg-cyan-100">
              <tr>
                <th className="px-4 py-2 font-bold text-orange-600">N°</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Evento</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Túnel</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Modelo</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Merma</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Confianza</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Origen</th>                <th className="px-4 py-2 font-bold text-cyan-700">Fecha</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Imagen</th>
              </tr>
            </thead>
            <tbody>
              {registros.length > 0 ? registros.map((r, idx) => (
                <tr key={r.id || idx} className={r.auto_captured ? 'bg-green-50' : ''}>
                  <td className="px-4 py-2 border-b font-semibold text-orange-700">{r.numero || r.numero_detectado || "-"}</td>
                  <td className="px-4 py-2 border-b">
                    <span className={`px-2 py-1 rounded text-xs font-semibold ${
                      r.evento === 'ingreso' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
                    }`}>
                      {r.evento || "-"}
                    </span>
                  </td>
                  <td className="px-4 py-2 border-b">{r.tunel || "-"}</td>
                  <td className="px-4 py-2 border-b">
                    {r.modelo_ladrillo ? (
                      <span className="px-2 py-1 bg-cyan-100 text-cyan-800 rounded text-xs font-semibold">
                        {r.modelo_ladrillo}
                      </span>
                    ) : <>{"-"}</>}
                  </td>
                  <td className="px-4 py-2 border-b">{r.merma !== null && r.merma !== undefined ? `${r.merma}%` : "-"}</td>
                  <td className="px-4 py-2 border-b">
                    {r.confianza !== null && r.confianza !== undefined ? 
                      (typeof r.confianza === 'number' ? (r.confianza * 100).toFixed(1) + '%' : r.confianza) : "-"}
                  </td>
                  <td className="px-4 py-2 border-b">{r.origen_deteccion || "-"}</td>
                  <td className="px-4 py-2 border-b">
                    {r.timestamp instanceof Date ? r.timestamp.toLocaleString("es-CL", {
                      year: "numeric",
                      month: "2-digit",
                      day: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                      second: "2-digit",
                      hour12: false
                    }) : String(r.timestamp)}
                  </td>
                  <td className="px-4 py-2 border-b">
                    {r.url_video_frame ? (
                      <a href={`${API_BASE_URL}/${r.url_video_frame}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                        Ver Frame
                      </a>
                    ) : r.ruta_video_original ? (
                      <a href={`${API_BASE_URL}/${r.ruta_video_original}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                        Ver Video
                      </a>
                    ) : r.imagen_path ? (
                      <a href={`${API_BASE_URL}/${r.imagen_path}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                        Ver Imagen
                      </a>
                    ) : (
                      <span className="text-gray-500">Sin archivo</span>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    No se encontraron registros
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Historial;
