// Tipos para análisis de inventario

export interface ProductMetrics {
  product_id: string;
  sku: string;
  name: string;
  category: string;
  location: string;

  // Stock
  stock_actual: number;
  stock_objetivo: number;

  // Demanda
  demanda_diaria: number;
  demanda_estacional: number;

  // Parámetros de reorden
  lead_time_dias: number;
  rop: number;  // Reorder Point
  safety_stock: number;

  // Cálculos
  cantidad_sugerida: number;
  cobertura_dias: number;
  rotacion_meses: number;

  // Clasificación
  abc_class: 'A' | 'B' | 'C';
  xyz_class: 'X' | 'Y' | 'Z';

  // Financiero
  costo: number;
  precio: number;
  margen_bruto: number;
}

export interface CriticalIssue {
  sku: string;
  nombre: string;
  categoria: string;
  ubicacion: string;
  motivo: 'quiebre' | 'reabastecer' | 'sobrestock' | 'lenta_rotacion';
  prioridad: 'alta' | 'media' | 'baja';
  stock_actual: number;
  dias_cobertura?: number;
  cantidad_sugerida?: number;
  notas: string;
}

export interface InventoryAnalysis {
  generado_el: string;
  temporada: 'alta' | 'baja';

  parametros: {
    nivel_servicio: {
      alta: number;
      baja: number;
    };
    multiplicadores: {
      alta: number;
      baja: number;
    };
  };

  resumen_ejecutivo: string[];

  metricas: ProductMetrics[];

  listas_rapidas: {
    quiebres_inminentes: Array<{
      sku: string;
      nombre: string;
      dias_cobertura: number;
      stock_actual: number;
    }>;
    sobrestock: Array<{
      sku: string;
      nombre: string;
      cobertura_dias: number;
      accion: string;
    }>;
    lenta_rotacion: Array<{
      sku: string;
      nombre: string;
      dias_sin_venta: number;
    }>;
  };

  recomendaciones: CriticalIssue[];

  aiInsights?: string;  // Análisis de Claude (opcional)

  ultima_actualizacion: string;
}

// FASE 6: Profit Analysis types

export interface ProfitAnalysis {
  period: { from: string; to: string };
  outlet_id: string;
  totals: {
    total_revenue: number;
    total_cost: number;
    total_profit: number;
    avg_margin_pct: number;
    products_with_sales: number;
    products_with_cost_data: number;
  };
  by_category: CategoryProfit[];
  top_by_profit: ProductProfit[];
  best_margins: ProductProfit[];
  worst_margins: ProductProfit[];
  margin_distribution: MarginBucket[];
}

export interface CategoryProfit {
  category: string;
  product_count: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_margin_pct: number;
  quantity_sold: number;
}

export interface ProductProfit {
  product_id: string;
  name: string;
  category: string;
  precio: number;
  costo: number;
  margin_pct: number;
  quantity_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  abc_class: 'A' | 'B' | 'C';
}

export interface MarginBucket {
  range: string;
  min: number;
  max: number;
  count: number;
  total_profit: number;
}

// FASE 6: Category Intelligence types

export interface CategoryIntelligence {
  period: { from: string; to: string };
  total_categories: number;
  categories: CategoryDetail[];
}

export interface CategoryDetail {
  category: string;
  product_count: number;
  products_with_stock: number;
  products_with_sales: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  avg_margin_pct: number;
  inventory_value: number;
  inventory_units: number;
  quantity_sold: number;
  abc_distribution: { A: number; B: number; C: number };
  top_product: { name: string; revenue: number };
}

export interface ChatContext {
  brand?: string;
  user?: string;
  temporada?: 'alta' | 'baja';
}

export interface ChatRequest {
  question: string;
  context?: ChatContext;
}

export interface ChatResponse {
  answer: string;
  cost: number;
  timestamp: string;
}
