import React, { useState } from "react";
import axios from "axios";

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
      const res = await axios.get(`http://localhost:8000/trayectoria/${numero}`);
      setRegistros(res.data);
    } catch (err) {
      setError("No se encontró trayectoria para ese número de vagoneta.");
    }
    setLoading(false);
  };

  return (
    <div className="w-full max-w-5xl mx-auto bg-white rounded-2xl p-8 shadow-lg mt-6 mb-8 border border-cyan-200">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-extrabold text-orange-600 mb-2">
          🛤️ Consultar Trayectoria de Vagoneta
        </h2>
        <p className="text-gray-600">
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
            className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400 text-center text-lg font-mono"
          />
          <button 
            type="submit" 
            disabled={!numero.trim() || loading}
            className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white font-bold rounded-lg transition disabled:bg-gray-300 disabled:cursor-not-allowed shadow-lg"
          >
            {loading ? '🔍' : '🔍 Buscar'}
          </button>
        </div>
      </form>

      {/* Estado de carga */}
      {loading && (
        <div className="text-center py-8">
          <div className="animate-spin h-8 w-8 border-4 border-orange-500 border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-gray-600">Buscando trayectoria...</p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center mb-6">
          <div className="text-red-600 font-semibold">❌ {error}</div>
          <p className="text-red-500 text-sm mt-2">
            Verifica que el número de vagoneta sea correcto
          </p>
        </div>
      )}

      {/* Resultados */}
      {registros.length > 0 && (
        <div>
          <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
            <h3 className="text-lg font-bold text-green-800 mb-2">
              ✅ Trayectoria encontrada para la vagoneta #{numero}
            </h3>
            <p className="text-green-700">
              Se encontraron {registros.length} registro{registros.length > 1 ? 's' : ''} de movimiento
            </p>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Evento</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Imagen</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha y Hora</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Túnel</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Detalles</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {registros.map((registro, index) => (
                    <tr key={index} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
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
                            src={`http://localhost:8000/${registro.imagen_path}`}
                            alt="vagoneta"
                            className="h-12 w-16 object-cover rounded border border-gray-200"
                          />
                        ) : (
                          <span className="text-gray-400 text-sm">Sin imagen</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(registro.timestamp).toLocaleString('es-ES')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {registro.tunel || <span className="text-gray-400">-</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {registro.merma && (
                          <div className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded mb-1">
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

            <div className="mt-6 text-center bg-gray-50 p-4 rounded-lg">
              <p className="text-gray-700 font-semibold">
                📊 Total de registros: <span className="text-orange-600">{registros.length}</span>
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trayectoria;
