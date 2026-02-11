import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { AlertTriangle, TrendingUp, Package, RefreshCw, Sparkles, Search, ChevronDown, ChevronUp, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend } from 'recharts';
import { PeriodSelector, getPeriodDates, type Period } from '@/components/PeriodSelector';
import { MetricCardWithChange } from '@/components/MetricCardWithChange';
import { useOutlet } from '@/contexts/OutletContext';
import { exportToExcel } from '@/lib/export-excel';
import { AlertPanel } from '@/components/AlertPanel';

export function Dashboard() {
  const [period, setPeriod] = useState<Period>('month');
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');
  const periodDates = getPeriodDates(period, customFrom, customTo);
  const { outletId } = useOutlet();
  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['inventory-status'],
    queryFn: async () => {
      const response = await apiClient.getInventoryStatus();
      return {
        ...response.data,
        _meta: {
          cached: response.meta?.fromCache ?? false,
          cacheAge: 0,
        }
      };
    },
  });

  // New query for sales comparison data
  const { data: salesData, isLoading: salesLoading } = useQuery({
    queryKey: ['sales-comparison', periodDates.from, periodDates.to, outletId],
    queryFn: async () => {
      const response = await apiClient.getSalesComparison({
        date_from: periodDates.from,
        date_to: periodDates.to,
        outlet_id: outletId,
      });
      return response.data;
    },
  });

  const handleRefresh = async () => {
    await apiClient.refreshInventoryAnalysis();
    refetch();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin text-gray-400 mx-auto mb-2" />
          <p className="text-gray-500">Cargando análisis de inventario...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-800">Error al cargar datos: {(error as Error).message}</p>
      </div>
    );
  }

  if (!data) return null;

  // Extract data matching actual backend response structure
  const metricas = data.metricas ?? [];
  const recomendaciones = data.recomendaciones ?? [];
  const listas_rapidas = data.listas_rapidas ?? {};
  const resumen_ejecutivo = data.resumen_ejecutivo ?? [];
  const cacheMeta = data._meta ?? { cached: false, cacheAge: 0 };

  // Compute summary stats from metricas
  const totalProductos = metricas.length;
  const alertasCriticas = recomendaciones.filter((r: any) => r.prioridad === 'alta').length;
  const stockSaludable = metricas.filter((m: any) => m.cobertura_dias > 14).length;
  const rotacionPromedio = metricas.length > 0
    ? metricas.reduce((sum: number, m: any) => sum + (m.rotacion_meses || 0), 0) / metricas.length
    : 0;

  // Datos para gráficos
  const priorityData = [
    { name: 'Alta', value: recomendaciones.filter((r: any) => r.prioridad === 'alta').length, color: '#ef4444' },
    { name: 'Media', value: recomendaciones.filter((r: any) => r.prioridad === 'media').length, color: '#f59e0b' },
    { name: 'Baja', value: recomendaciones.filter((r: any) => r.prioridad === 'baja').length, color: '#10b981' },
  ];

  // Use actual backend field names
  const quiebres = listas_rapidas.quiebres_inminentes ?? [];
  const sobrestock = listas_rapidas.sobrestock ?? [];
  const lentaRotacion = listas_rapidas.lenta_rotacion ?? [];
  const topStockouts = quiebres.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard de Inventario</h1>
            <p className="text-gray-500 mt-1">
              {cacheMeta.cached ? (
                <>Datos en caché • Actualizado hace {Math.round((cacheMeta.cacheAge || 0) / 60)} min</>
              ) : (
                <>Datos en tiempo real</>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (metricas.length > 0) {
                  exportToExcel(metricas, { filename: 'inventario-metricas', sheetName: 'Métricas' });
                }
              }}
              disabled={metricas.length === 0}
              className="flex items-center gap-2 px-4 py-2 border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <Download className="h-4 w-4" />
              Excel
            </button>
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              className={cn(
                'flex items-center gap-2 px-4 py-2 bg-gray-900 text-white rounded-lg hover:bg-gray-800 transition-colors',
                isFetching && 'opacity-50 cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
              Actualizar
            </button>
          </div>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar productos, SKU, recomendaciones..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300 placeholder:text-gray-400"
          />
        </div>

        {/* Period Selector */}
        <PeriodSelector
          value={period}
          onChange={setPeriod}
          customFrom={customFrom}
          customTo={customTo}
          onCustomChange={(from, to) => { setCustomFrom(from); setCustomTo(to); }}
        />
      </div>

      {/* Resumen Ejecutivo */}
      {resumen_ejecutivo.length > 0 && (
        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-3">Resumen Ejecutivo</h3>
          <ul className="space-y-1">
            {resumen_ejecutivo.map((item: string, idx: number) => (
              <li key={idx} className="text-sm text-gray-700">{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* AI Alerts Panel */}
      <AlertPanel />

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {salesLoading ? (
          <div className="col-span-4 text-center py-8 text-gray-500">
            Cargando métricas de ventas...
          </div>
        ) : salesData ? (
          <>
            <MetricCardWithChange
              title="Ventas del Período"
              value={`$${salesData.current?.summary?.amount?.toLocaleString() ?? '0'}`}
              change={salesData.changes?.amount}
              icon={TrendingUp}
              color="green"
            />
            <MetricCardWithChange
              title="Transacciones"
              value={salesData.current?.summary?.tickets?.toLocaleString() ?? '0'}
              change={salesData.changes?.tickets}
              icon={Package}
              color="blue"
            />
            <MetricCardWithChange
              title="Ticket Promedio"
              value={`$${salesData.current?.summary?.avg_ticket?.toLocaleString() ?? '0'}`}
              change={salesData.changes?.avg_ticket}
              icon={RefreshCw}
              color="purple"
            />
            <MetricCardWithChange
              title="Alertas Críticas"
              value={alertasCriticas}
              icon={AlertTriangle}
              color="red"
            />
          </>
        ) : (
          <>
            <MetricCardWithChange
              title="Total Productos"
              value={totalProductos}
              icon={Package}
              color="blue"
            />
            <MetricCardWithChange
              title="Alertas Críticas"
              value={alertasCriticas}
              icon={AlertTriangle}
              color="red"
            />
            <MetricCardWithChange
              title="Stock Saludable"
              value={stockSaludable}
              icon={TrendingUp}
              color="green"
            />
            <MetricCardWithChange
              title="Rotación Promedio"
              value={`${rotacionPromedio.toFixed(1)}x`}
              icon={RefreshCw}
              color="purple"
            />
          </>
        )}
      </div>

      {/* Sales Trend Graph */}
      {salesData && salesData.daily_sales && salesData.daily_sales.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Tendencia de Ventas Diarias
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={salesData.daily_sales}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getDate()}/${date.getMonth() + 1}`;
                }}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${value.toLocaleString()}`}
              />
              <Tooltip
                formatter={(value: any) => [`$${value.toLocaleString()}`, 'Ventas']}
                labelFormatter={(label) => {
                  const date = new Date(label);
                  return date.toLocaleDateString('es-MX', {
                    weekday: 'short',
                    month: 'short',
                    day: 'numeric'
                  });
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="amount"
                stroke="#10b981"
                strokeWidth={2}
                name="Ventas Diarias"
                dot={{ fill: '#10b981', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prioridades */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Recomendaciones por Prioridad
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={priorityData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, value }) => `${name}: ${value}`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {priorityData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Quiebres inminentes chart */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 5 Quiebres Inminentes
          </h3>
          {topStockouts.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={topStockouts} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="nombre" type="category" width={150} />
                <Tooltip />
                <Bar dataKey="dias_cobertura" fill="#ef4444" name="Días de cobertura" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-500 text-center py-8">Sin quiebres inminentes</p>
          )}
        </div>
      </div>

      {/* Listas rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiebres inminentes */}
        <QuickListCard
          title="Quiebres Inminentes"
          items={quiebres}
          color="red"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
              <p className="text-sm font-semibold text-red-600 mt-1">
                {item.dias_cobertura} días de cobertura • Stock: {item.stock_actual}
              </p>
            </>
          )}
        />

        {/* Sobrestock */}
        <QuickListCard
          title="Sobrestock"
          items={sobrestock}
          color="orange"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
              <p className="text-sm font-semibold text-orange-600 mt-1">
                Stock: {item.stock_actual}
              </p>
            </>
          )}
        />

        {/* Lenta rotación */}
        <QuickListCard
          title="Lenta Rotación"
          items={lentaRotacion}
          color="purple"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">SKU: {item.sku}</p>
            </>
          )}
        />
      </div>

      {/* Recomendaciones */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            Recomendaciones ({recomendaciones.length})
          </h3>
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {['all', 'alta', 'media', 'baja'].map((p) => (
              <button
                key={p}
                onClick={() => setPriorityFilter(p)}
                className={cn(
                  'px-3 py-1 text-xs font-medium rounded-md transition-all',
                  priorityFilter === p
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-900'
                )}
              >
                {p === 'all' ? 'Todas' : p.charAt(0).toUpperCase() + p.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          {recomendaciones
            .filter((rec: any) => priorityFilter === 'all' || rec.prioridad === priorityFilter)
            .filter((rec: any) => {
              if (!searchQuery) return true;
              const q = searchQuery.toLowerCase();
              return (
                rec.nombre?.toLowerCase().includes(q) ||
                rec.notas?.toLowerCase().includes(q) ||
                rec.motivo?.toLowerCase().includes(q)
              );
            })
            .slice(0, 15)
            .map((rec: any, idx: number) => (
            <div
              key={idx}
              className={cn(
                'border-l-4 p-4 rounded-r-lg',
                rec.prioridad === 'alta' && 'border-red-500 bg-red-50',
                rec.prioridad === 'media' && 'border-orange-500 bg-orange-50',
                rec.prioridad === 'baja' && 'border-green-500 bg-green-50'
              )}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{rec.notas}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {rec.nombre} • {rec.ubicacion} • {rec.motivo}
                    {rec.cantidad_sugerida > 0 && ` • Ordenar: ${rec.cantidad_sugerida} uds`}
                  </p>
                </div>
                <span
                  className={cn(
                    'px-2 py-1 text-xs font-semibold rounded-full',
                    rec.prioridad === 'alta' && 'bg-red-100 text-red-800',
                    rec.prioridad === 'media' && 'bg-orange-100 text-orange-800',
                    rec.prioridad === 'baja' && 'bg-green-100 text-green-800'
                  )}
                >
                  {rec.prioridad}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Componentes auxiliares
function QuickListCard({ title, items, color, renderItem, totalCount }: {
  title: string;
  items: any[];
  color: 'red' | 'orange' | 'purple';
  renderItem: (item: any) => React.ReactNode;
  totalCount?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const borderColor: Record<string, string> = {
    red: 'border-red-200',
    orange: 'border-orange-200',
    purple: 'border-purple-200',
  };

  const total = totalCount ?? items.length;
  const displayItems = expanded ? items : items.slice(0, 5);
  const hasMore = items.length > 5;

  if (items.length === 0) {
    return (
      <div className={cn('bg-white border rounded-lg p-6', borderColor[color])}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title} <span className="text-sm font-normal text-gray-400">({total})</span></h3>
        <p className="text-gray-500 text-center py-8">No hay items en esta lista</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border rounded-lg p-6', borderColor[color])}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title} <span className="text-sm font-normal text-gray-400">({total})</span></h3>
      <div className="space-y-3">
        {displayItems.map((item: any, idx: number) => (
          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
            {renderItem(item)}
          </div>
        ))}
      </div>
      {hasMore && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 w-full flex items-center justify-center gap-1 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          {expanded ? <><ChevronUp className="h-4 w-4" /> Ver menos</> : <><ChevronDown className="h-4 w-4" /> Ver todos ({items.length})</>}
        </button>
      )}
    </div>
  );
}
