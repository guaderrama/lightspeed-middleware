export interface ProductMetrics {
  product_id: string;
  name: string;
  sku: string;
  location: string;
  stock_actual: number;
  avg_daily_sales: number;
  lead_time_days: number;
  service_level_target: number;
  reorder_point: number;
  safety_stock: number;
  days_until_stockout: number | null;
  clasificacion_abc: 'A' | 'B' | 'C';
  clasificacion_xyz: 'X' | 'Y' | 'Z';
  status: 'ok' | 'warning' | 'critical';
  recomendacion?: string;
}

export interface Recommendation {
  tipo: string;
  producto: string;
  ubicacion: string;
  prioridad: 'alta' | 'media' | 'baja';
  accion: string;
  detalles: string;
}

export interface QuickList {
  quiebres_inminentes: Array<{
    nombre: string;
    ubicacion: string;
    stock: number;
    dias_restantes: number;
  }>;
  exceso_inventario: Array<{
    nombre: string;
    ubicacion: string;
    stock: number;
    rotacion_anual: number;
  }>;
  productos_criticos: Array<{
    nombre: string;
    clasificacion: string;
    status: string;
  }>;
}

export interface InventoryAnalysis {
  metricas: ProductMetrics[];
  recomendaciones: Recommendation[];
  listas_rapidas: QuickList;
  resumen: {
    total_productos: number;
    alertas_criticas: number;
    stock_saludable: number;
    rotacion_promedio: number;
  };
  aiInsights?: string;
  meta: {
    timestamp: string;
    cached: boolean;
    cacheAge?: number;
  };
}
