import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import type { InventoryAnalysis } from '@/types/inventory';
import { AlertTriangle, TrendingUp, Package, RefreshCw, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

export function Dashboard() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['inventory-status'],
    queryFn: async () => {
      const response = await apiClient.getInventoryStatus();
      return response.data as InventoryAnalysis;
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

  const { resumen, listas_rapidas, recomendaciones, aiInsights, meta } = data;

  // Datos para gráficos
  const priorityData = [
    { name: 'Alta', value: recomendaciones.filter(r => r.prioridad === 'alta').length, color: '#ef4444' },
    { name: 'Media', value: recomendaciones.filter(r => r.prioridad === 'media').length, color: '#f59e0b' },
    { name: 'Baja', value: recomendaciones.filter(r => r.prioridad === 'baja').length, color: '#10b981' },
  ];

  const topStockouts = listas_rapidas.quiebres_inminentes.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard de Inventario</h1>
          <p className="text-gray-500 mt-1">
            {meta.cached ? (
              <>Datos en caché • Actualizado hace {Math.round((meta.cacheAge || 0) / 60)} min</>
            ) : (
              <>Datos en tiempo real</>
            )}
          </p>
        </div>
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

      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Productos"
          value={resumen.total_productos}
          icon={Package}
          color="blue"
        />
        <MetricCard
          title="Alertas Críticas"
          value={resumen.alertas_criticas}
          icon={AlertTriangle}
          color="red"
        />
        <MetricCard
          title="Stock Saludable"
          value={resumen.stock_saludable}
          icon={TrendingUp}
          color="green"
        />
        <MetricCard
          title="Rotación Promedio"
          value={`${resumen.rotacion_promedio.toFixed(1)}x`}
          icon={RefreshCw}
          color="purple"
        />
      </div>

      {/* AI Insights */}
      {aiInsights && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg p-6">
          <div className="flex items-start gap-3">
            <Sparkles className="h-6 w-6 text-purple-600 mt-1 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Análisis IA (Gemini 3 Flash)
              </h3>
              <div className="prose prose-sm max-w-none text-gray-700 whitespace-pre-wrap">
                {aiInsights}
              </div>
            </div>
          </div>
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

        {/* Quiebres inminentes */}
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Top 5 Quiebres Inminentes
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={topStockouts} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="nombre" type="category" width={150} />
              <Tooltip />
              <Bar dataKey="dias_restantes" fill="#ef4444" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Listas rápidas */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quiebres inminentes */}
        <QuickListCard
          title="Quiebres Inminentes"
          items={listas_rapidas.quiebres_inminentes.slice(0, 5)}
          color="red"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">{item.ubicacion}</p>
              <p className="text-sm font-semibold text-red-600 mt-1">
                {item.dias_restantes} días restantes
              </p>
            </>
          )}
        />

        {/* Exceso de inventario */}
        <QuickListCard
          title="Exceso de Inventario"
          items={listas_rapidas.exceso_inventario.slice(0, 5)}
          color="orange"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">{item.ubicacion}</p>
              <p className="text-sm font-semibold text-orange-600 mt-1">
                Stock: {item.stock} • Rotación: {item.rotacion_anual.toFixed(1)}x
              </p>
            </>
          )}
        />

        {/* Productos críticos */}
        <QuickListCard
          title="Productos Críticos"
          items={listas_rapidas.productos_criticos.slice(0, 5)}
          color="purple"
          renderItem={(item) => (
            <>
              <p className="font-medium text-gray-900">{item.nombre}</p>
              <p className="text-sm text-gray-500">
                {item.clasificacion} • {item.status}
              </p>
            </>
          )}
        />
      </div>

      {/* Recomendaciones */}
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Recomendaciones ({recomendaciones.length})
        </h3>
        <div className="space-y-3">
          {recomendaciones.slice(0, 10).map((rec, idx) => (
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
                  <p className="font-medium text-gray-900">{rec.accion}</p>
                  <p className="text-sm text-gray-600 mt-1">{rec.detalles}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    {rec.producto} • {rec.ubicacion} • {rec.tipo}
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
function MetricCard({ title, value, icon: Icon, color }: {
  title: string;
  value: string | number;
  icon: any;
  color: 'blue' | 'red' | 'green' | 'purple';
}) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center gap-3">
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickListCard({ title, items, color, renderItem }: {
  title: string;
  items: any[];
  color: 'red' | 'orange' | 'purple';
  renderItem: (item: any) => React.ReactNode;
}) {
  const borderColor: Record<string, string> = {
    red: 'border-red-200',
    orange: 'border-orange-200',
    purple: 'border-purple-200',
  };

  if (items.length === 0) {
    return (
      <div className={cn('bg-white border rounded-lg p-6', borderColor[color])}>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <p className="text-gray-500 text-center py-8">No hay items en esta lista</p>
      </div>
    );
  }

  return (
    <div className={cn('bg-white border rounded-lg p-6', borderColor[color])}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-3">
        {items.map((item: any, idx: number) => (
          <div key={idx} className="p-3 bg-gray-50 rounded-lg">
            {renderItem(item)}
          </div>
        ))}
      </div>
    </div>
  );
}
