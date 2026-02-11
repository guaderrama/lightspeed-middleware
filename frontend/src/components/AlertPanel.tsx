import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';
import { AlertTriangle, TrendingUp, Package, Zap, Info, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

const severityConfig = {
  critical: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-800', badge: 'bg-red-100 text-red-700' },
  warning: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800', badge: 'bg-amber-100 text-amber-700' },
  info: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800', badge: 'bg-blue-100 text-blue-700' },
};

const typeIcons: Record<string, any> = {
  stockout_risk: AlertTriangle,
  overstock: Package,
  trending_up: TrendingUp,
  slow_moving: Zap,
};

export function AlertPanel() {
  const { data, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['ai-alerts'],
    queryFn: async () => {
      const response = await apiClient.getAlerts();
      return response.data;
    },
    staleTime: 1000 * 60 * 15, // 15 min
  });

  if (isLoading) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-4">
          <Zap className="h-5 w-5 text-gray-400 animate-pulse" />
          <h3 className="text-lg font-semibold text-gray-900">Alertas IA</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Alertas IA</h3>
          </div>
        </div>
        <p className="text-gray-500 text-center py-4">No se pudieron cargar las alertas</p>
      </div>
    );
  }

  const alerts = data.alerts ?? [];
  const summary = data.forecast_summary ?? '';
  const recommendations = data.top_recommendations ?? [];

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-amber-500" />
          <h3 className="text-lg font-semibold text-gray-900">
            Alertas IA <span className="text-sm font-normal text-gray-400">({alerts.length})</span>
          </h3>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="text-gray-400 hover:text-gray-600 transition-colors"
          title="Regenerar alertas"
        >
          <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
        </button>
      </div>

      {/* Forecast Summary */}
      {summary && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-lg p-4 mb-4">
          <div className="flex items-start gap-2">
            <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
            <p className="text-sm text-amber-900">{summary}</p>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 ? (
        <div className="space-y-2">
          {alerts.map((alert: any, idx: number) => {
            const config = severityConfig[alert.severity as keyof typeof severityConfig] || severityConfig.info;
            const Icon = typeIcons[alert.type] || AlertTriangle;

            return (
              <div key={idx} className={cn('border rounded-lg p-3', config.bg, config.border)}>
                <div className="flex items-start gap-3">
                  <Icon className={cn('h-4 w-4 mt-0.5 shrink-0', config.text)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', config.badge)}>
                        {alert.severity}
                      </span>
                      {alert.product && (
                        <span className="text-xs text-gray-500 truncate">{alert.product}</span>
                      )}
                    </div>
                    <p className={cn('text-sm font-medium', config.text)}>{alert.message}</p>
                    {alert.action && (
                      <p className="text-xs text-gray-600 mt-1">{alert.action}</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-4">Sin alertas en este momento</p>
      )}

      {/* Top Recommendations */}
      {recommendations.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Recomendaciones Top</h4>
          <ul className="space-y-1">
            {recommendations.map((rec: string, idx: number) => (
              <li key={idx} className="text-sm text-gray-600 flex items-start gap-2">
                <span className="text-amber-500 mt-1 shrink-0">&#8226;</span>
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
