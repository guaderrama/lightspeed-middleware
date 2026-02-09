import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MetricCardWithChangeProps {
  title: string;
  value: string | number;
  change?: number; // Percentage change
  icon: any;
  color: 'blue' | 'red' | 'green' | 'purple' | 'orange';
}

export function MetricCardWithChange({ title, value, change, icon: Icon, color }: MetricCardWithChangeProps) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-600',
    red: 'bg-red-50 text-red-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
  };

  const getChangeColor = () => {
    if (change === undefined || change === null) return 'text-gray-500';
    if (Math.abs(change) < 0.1) return 'text-gray-500'; // No significant change
    return change > 0 ? 'text-green-600' : 'text-red-600';
  };

  const getChangeIcon = () => {
    if (change === undefined || change === null) return null;
    if (Math.abs(change) < 0.1) return <Minus className="h-4 w-4" />;
    return change > 0
      ? <TrendingUp className="h-4 w-4" />
      : <TrendingDown className="h-4 w-4" />;
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-6 transition-shadow hover:shadow-md">
      <div className="flex items-center gap-3 mb-3">
        <div className={cn('p-3 rounded-lg', colorClasses[color])}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>

      {change !== undefined && change !== null && (
        <div className={cn('flex items-center gap-1 text-sm font-semibold', getChangeColor())}>
          {getChangeIcon()}
          <span>
            {change > 0 ? '+' : ''}{change.toFixed(1)}% vs período anterior
          </span>
        </div>
      )}
    </div>
  );
}
