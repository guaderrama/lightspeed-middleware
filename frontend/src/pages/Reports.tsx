import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { Calendar, TrendingUp, Download } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export function Reports() {
  const [dateFrom, setDateFrom] = useState(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [outletId] = useState('1'); // Default outlet

  const { data: salesSummary, isLoading: loadingSummary } = useQuery({
    queryKey: ['sales-summary', dateFrom, dateTo, outletId],
    queryFn: async () => {
      const response = await apiClient.getSalesSummary({
        date_from: dateFrom,
        date_to: dateTo,
        outlet_id: outletId,
        include_returns: true,
      });
      return response.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  const { data: topProducts, isLoading: loadingTop } = useQuery({
    queryKey: ['top-products', dateFrom, dateTo, outletId],
    queryFn: async () => {
      const response = await apiClient.getTopSellingProducts({
        date_from: dateFrom,
        date_to: dateTo,
        outlet_id: outletId,
        limit: 10,
      });
      return response.data;
    },
    enabled: !!dateFrom && !!dateTo,
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Reportes de Ventas</h1>
          <p className="text-gray-500 mt-1">Análisis y métricas de ventas</p>
        </div>
      </div>

      {/* Filtros de fecha */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Calendar className="h-5 w-5" />
          Período de análisis
        </h3>
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha inicio
            </label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fecha fin
            </label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button className="px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors flex items-center gap-2">
            <Download className="h-4 w-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* Resumen de ventas */}
      {loadingSummary ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500">Cargando resumen de ventas...</p>
        </div>
      ) : salesSummary ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricCard
            title="Ventas Totales"
            value={`$${salesSummary.total_sales?.toLocaleString() || 0}`}
            change="+12.5%"
            positive
          />
          <MetricCard
            title="Transacciones"
            value={salesSummary.total_transactions?.toLocaleString() || 0}
            change="+8.3%"
            positive
          />
          <MetricCard
            title="Ticket Promedio"
            value={`$${salesSummary.avg_ticket?.toLocaleString() || 0}`}
            change="-2.1%"
            positive={false}
          />
        </div>
      ) : null}

      {/* Top productos */}
      {loadingTop ? (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500">Cargando productos más vendidos...</p>
        </div>
      ) : topProducts && topProducts.length > 0 ? (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Top 10 Productos Más Vendidos
          </h3>
          <ResponsiveContainer width="100%" height={400}>
            <BarChart data={topProducts}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={120} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="quantity_sold" fill="#8b5cf6" name="Cantidad Vendida" />
              <Bar dataKey="revenue" fill="#10b981" name="Ingreso ($)" />
            </BarChart>
          </ResponsiveContainer>

          <div className="mt-6 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Producto
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Cantidad
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ingreso
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Precio Prom.
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topProducts.map((product: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {product.name}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      {product.quantity_sold}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${product.revenue?.toLocaleString()}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 text-right">
                      ${product.avg_price?.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg p-12 text-center">
          <p className="text-gray-500">No hay datos de productos para este período</p>
        </div>
      )}
    </div>
  );
}

function MetricCard({ title, value, change, positive }: any) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className="text-3xl font-bold text-gray-900 mb-2">{value}</p>
      <p className={`text-sm font-semibold ${positive ? 'text-green-600' : 'text-red-600'}`}>
        {change} vs período anterior
      </p>
    </div>
  );
}
