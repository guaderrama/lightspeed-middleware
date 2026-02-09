import { Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';

export type Period = 'week' | 'month' | '3months' | 'custom';

interface PeriodSelectorProps {
  value: Period;
  onChange: (period: Period) => void;
  className?: string;
}

export function PeriodSelector({ value, onChange, className }: PeriodSelectorProps) {
  const periods: { value: Period; label: string }[] = [
    { value: 'week', label: 'Esta Semana' },
    { value: 'month', label: 'Este Mes' },
    { value: '3months', label: 'Últimos 3 Meses' },
    { value: 'custom', label: 'Personalizado' },
  ];

  return (
    <div className={cn('flex items-center gap-2', className)}>
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
    </div>
  );
}

/**
 * Helper function to calculate date range based on period
 */
export function getPeriodDates(period: Period): { from: string; to: string } {
  const today = new Date();
  const to = today.toISOString().split('T')[0];
  let from: Date;

  switch (period) {
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
      // For custom, return last 30 days as default
      from = new Date(today);
      from.setDate(today.getDate() - 30);
      break;
  }

  return {
    from: from.toISOString().split('T')[0],
    to,
  };
}
