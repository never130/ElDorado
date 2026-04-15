import React, { useState } from "react";
import axios from "axios";
import { API_BASE_URL, assetUrl } from "../config/api";

const Trayectoria = () => {
  const [numero, setNumero] = useState("");
  const [registros, setRegistros] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleBuscar = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setRegistros([]);
    try {
      const res = await axios.get(`${API_BASE_URL}/trayectoria/${numero}`);
      setRegistros(res.data);
    } catch (err) {
      setError("No se encontró trayectoria para ese número de vagoneta.");
    }
    setLoading(false);
  };
  return (
    <div className="w-full max-w-5xl mx-auto bg-white border border-slate-200 rounded-lg p-8 mt-6 mb-8">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">
          🛤️ Consultar Trayectoria de Vagoneta
        </h2>
        <p className="text-slate-600 text-lg">
          Ingresa el número de una vagoneta para ver su historial completo de movimientos
        </p>
      </div>

      <form onSubmit={handleBuscar} className="max-w-md mx-auto mb-8">
        <div className="flex gap-3">
          <input
            type="text"
            placeholder="Número de vagoneta (ej: 1234)"
            value={numero}
            onChange={e => setNumero(e.target.value)}
            className="flex-1 px-4 py-3 border border-slate-300 rounded-md bg-white text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-center text-lg font-mono transition-colors"
          />
          <button 
            type="submit" 
            disabled={!numero.trim() || loading}
            className="px-6 py-3 bg-orange-600 hover:bg-orange-700 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed"
          >
            {loading ? '🔍' : '🔍 Buscar'}
          </button>
        </div>
      </form>      {/* Estado de carga */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-slate-600">Buscando trayectoria...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
          <div className="text-red-600 font-medium">❌ {error}</div>
          <p className="text-red-500 text-sm mt-2">
            Verifica que el número de vagoneta sea correcto
          </p>
        </div>
      )}

      {/* Resultados */}
      {registros.length > 0 && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-green-800 mb-2">
              ✅ Trayectoria encontrada para la vagoneta #{numero}
            </h3>
            <p className="text-green-700">
              Se encontraron {registros.length} registro{registros.length > 1 ? 's' : ''} de movimiento
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Evento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Imagen</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Fecha y Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Túnel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Detalles</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {registros.map((registro, index) => (
                    <tr key={index} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                          registro.evento === 'ingreso' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {registro.evento === 'ingreso' ? '🟢 Ingreso' : '🔴 Egreso'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {registro.imagen_path ? (
                          <img 
                            src={assetUrl(registro.imagen_path)}
                            alt="vagoneta"
                            className="h-12 w-16 object-cover rounded border border-slate-200"
                          />
                        ) : (
                          <span className="text-slate-400 text-sm">Sin imagen</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {new Date(registro.timestamp).toLocaleString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                        {registro.tunel || <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500">
                        {registro.merma && (
                          <div className="text-xs bg-amber-100 text-amber-800 px-2 py-1 rounded mb-1">
                            Merma: {registro.merma}%
                          </div>
                        )}
                        {registro.modelo_ladrillo && (
                          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                            {registro.modelo_ladrillo}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-6 text-center bg-slate-50 p-4 rounded-lg">
              <p className="text-slate-700 font-medium">
                📊 Total de registros: <span className="text-orange-600 font-bold">{registros.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trayectoria;
