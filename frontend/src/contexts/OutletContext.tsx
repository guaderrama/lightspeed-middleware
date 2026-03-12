import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/api';

interface Outlet {
  id: string;
  name: string;
  time_zone?: string;
}

interface OutletContextValue {
  outlets: Outlet[];
  selectedOutlet: Outlet | null;
  outletId: string;
  setSelectedOutletId: (id: string) => void;
  isLoading: boolean;
}

const OutletContext = createContext<OutletContextValue | null>(null);

export function OutletProvider({ children }: { children: ReactNode }) {
  const [selectedId, setSelectedId] = useState<string>(() => {
    return localStorage.getItem('selected_outlet_id') || '';
  });

  const { data: outlets = [], isLoading } = useQuery({
    queryKey: ['outlets'],
    queryFn: async () => {
      const response = await apiClient.getOutlets();
      return (response.data ?? []) as Outlet[];
    },
    staleTime: 1000 * 60 * 60, // 1 hour
  });

  // Auto-select first outlet if none selected or saved selection no longer exists
  useEffect(() => {
    if (outlets.length === 0) return;
    const exists = outlets.some((o) => o.id === selectedId);
    if (!selectedId || !exists) {
      setSelectedId(outlets[0].id);
    }
  }, [outlets, selectedId]);

  // Persist selection
  useEffect(() => {
    if (selectedId) {
      localStorage.setItem('selected_outlet_id', selectedId);
    }
  }, [selectedId]);

  const selectedOutlet = outlets.find((o) => o.id === selectedId) || null;

  return (
    <OutletContext.Provider
      value={{
        outlets,
        selectedOutlet,
        outletId: selectedId || '',
        setSelectedOutletId: setSelectedId,
        isLoading,
      }}
    >
      {children}
    </OutletContext.Provider>
  );
}

export function useOutlet() {
  const ctx = useContext(OutletContext);
  if (!ctx) throw new Error('useOutlet must be used within OutletProvider');
  return ctx;
}
