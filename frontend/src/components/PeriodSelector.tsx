import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Period = 'today' | 'week' | 'month' | '3months' | 'custom';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  customFrom?: string;
  customTo?: string;
  onCustomChange?: (from: string, to: string) => void;
  className?: string;
}

export function PeriodSelector({ value, onChange, customFrom, customTo, onCustomChange, className }: PeriodSelectorProps) {
  const today = new Date().toISOString().split('T')[0];

  const periods: { value: Period; label: string }[] = [
    { value: 'today', label: 'Hoy' },
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: '3months', label: 'Últimos 3 Meses' },
    { value: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className={cn('flex flex-wrap items-center gap-3', className)}>
      <Calendar className="h-5 w-5 text-gray-500" />
      <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
        {periods.map((period) => (
          <button
            key={period.value}
            onClick={() => onChange(period.value)}
            className={cn(
              'px-4 py-2 rounded-md text-sm font-medium transition-all',
              value === period.value
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            )}
          >
            {period.label}
          </button>
        ))}
      </div>

      {value === 'custom' && onCustomChange && (
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={customFrom || ''}
            max={customTo || today}
            onChange={(e) => onCustomChange(e.target.value, customTo || today)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
          <span className="text-gray-400 text-sm">a</span>
          <input
            type="date"
            value={customTo || ''}
            min={customFrom || ''}
            max={today}
            onChange={(e) => onCustomChange(customFrom || '', e.target.value)}
            className="px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-gray-300"
          />
        </div>
      )}
    </div>
  );
}

/**
 * Helper function to calculate date range based on period
 */
export function getPeriodDates(period: Period, customFrom?: string, customTo?: string): { from: string; to: string } {
  if (period === 'custom' && customFrom && customTo) {
    return { from: customFrom, to: customTo };
  }

  const today = new Date();
  const to = today.toISOString().split('T')[0];
  let from: Date;

  switch (period) {
    case 'today':
      from = new Date(today);
      break;
    case 'week':
      from = new Date(today);
      from.setDate(today.getDate() - 7);
      break;
    case 'month':
      from = new Date(today);
      from.setMonth(today.getMonth() - 1);
      break;
    case '3months':
      from = new Date(today);
      from.setMonth(today.getMonth() - 3);
      break;
    case 'custom':
      from = new Date(today);
      from.setDate(today.getDate() - 30);
      break;
  }

  return {
    from: from.toISOString().split('T')[0],
    to,
  };
}
