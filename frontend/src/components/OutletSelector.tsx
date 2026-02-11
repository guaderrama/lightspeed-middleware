import { Store } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { cn } from '@/lib/utils';

export function OutletSelector() {
  const { outlets, selectedOutlet, setSelectedOutletId, isLoading } = useOutlet();

  if (isLoading) {
    return (
      <div className="px-3 py-2">
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
    );
  }

  if (outlets.length <= 1) return null;

  return (
    <div className="px-3 py-2">
      <label className="flex items-center gap-2 text-xs font-medium text-gray-500 mb-1.5 px-1">
        <Store className="h-3.5 w-3.5" />
        Tienda
      </label>
      <select
        value={selectedOutlet?.id ?? ''}
        onChange={(e) => setSelectedOutletId(e.target.value)}
        className={cn(
          'w-full px-3 py-2 text-sm font-medium rounded-lg border border-gray-200',
          'bg-white text-gray-900',
          'focus:outline-none focus:ring-2 focus:ring-gray-300',
          'transition-colors cursor-pointer'
        )}
      >
        {outlets.map((outlet) => (
          <option key={outlet.id} value={outlet.id}>
            {outlet.name}
          </option>
        ))}
      </select>
    </div>
  );
}
