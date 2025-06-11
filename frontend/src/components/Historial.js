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
      const params = {};
      if (numero) params.numero = numero;
      if (fecha) params.fecha = fecha;

      // Usar las constantes importadas directamente
      const res = await axios.get(`${API_BASE_URL}${API_ENDPOINTS.vagonetas}`, { params }); 
      console.log("Datos crudos de la API:", res.data); // Para depuración
      let data = res.data.map(item => ({
        ...item,
        // Asegurar que el timestamp se interprete como UTC añadiendo 'Z' si no está presente
        timestamp: new Date(item.timestamp && !item.timestamp.endsWith('Z') ? item.timestamp + 'Z' : item.timestamp),
        confianza: item.confianza // Asegurar que la propiedad se llame confianza consistentemente
      }));
      setRegistros(data);
    } catch (err) {
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
        <div className="w-full overflow-x-auto">          <table className="min-w-full bg-white border border-cyan-200 rounded-xl shadow text-cyan-900 text-base">
            <thead className="bg-cyan-100">
              <tr>
                <th className="px-4 py-2 font-bold text-orange-600">N°</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Evento</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Túnel</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Modelo</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Merma</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Confianza</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Origen</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Fecha</th>
                <th className="px-4 py-2 font-bold text-cyan-700">Imagen</th>
              </tr>
            </thead>
            <tbody>
              {registros.map((r, idx) => (
                <tr key={idx} className={r.auto_captured ? 'bg-green-50' : ''}>
                  <td className="px-4 py-2 border-b font-semibold text-orange-700">{r.numero || "-"}</td>
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
                    {r.confianza !== null && r.confianza !== undefined ? r.confianza.toFixed(4) : "-"}
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
                    {r.imagen_path ? (
                      <a href={`${API_BASE_URL}/${r.imagen_path}`} target="_blank" rel="noopener noreferrer" className="text-cyan-600 hover:underline">
                        Ver Video
                      </a>
                    ) : (
                      <span className="text-gray-500">Sin video</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Historial;
