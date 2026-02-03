import * as logger from 'firebase-functions/logger';
// import { LightspeedClient } from './lightspeed';
import { InventoryAnalysis, ProductMetrics, CriticalIssue } from '../types/analytics';

export class AnalyticsService {
  // lightspeedClient será usado cuando integremos datos reales
  // private lightspeedClient: LightspeedClient;

  constructor(_lightspeedToken?: string) {
    // TODO: Inicializar cuando se integren datos reales de Lightspeed
    // this.lightspeedClient = new LightspeedClient(
    //   lightspeedToken || process.env.LIGHTSPEED_PERSONAL_TOKEN || ''
    // );
  }

  /**
   * Calcula métricas completas del inventario
   */
  async calculateMetrics(): Promise<InventoryAnalysis> {
    try {
      logger.info('Starting inventory metrics calculation');

      // Determinar temporada actual
      const temporada = this.getCurrentSeason();

      // Obtener datos de Lightspeed (stub por ahora)
      // En producción, aquí irían las llamadas reales a Lightspeed API
      const mockMetrics = this.generateMockMetrics(temporada);

      // Detectar issues críticos
      const criticalIssues = this.detectCriticalIssues(mockMetrics);

      // Generar resumen ejecutivo
      const resumenEjecutivo = this.generateExecutiveSummary(mockMetrics, criticalIssues);

      // Construir listas rápidas
      const listasRapidas = this.buildQuickLists(mockMetrics);

      const analysis: InventoryAnalysis = {
        generado_el: new Date().toISOString(),
        temporada,
        parametros: {
          nivel_servicio: {
            alta: 0.97,
            baja: 0.93
          },
          multiplicadores: {
            alta: 1.25,
            baja: 0.80
          }
        },
        resumen_ejecutivo: resumenEjecutivo,
        metricas: mockMetrics,
        listas_rapidas: listasRapidas,
        recomendaciones: criticalIssues,
        ultima_actualizacion: new Date().toISOString()
      };

      logger.info('Inventory metrics calculated successfully', {
        productCount: mockMetrics.length,
        criticalIssuesCount: criticalIssues.length
      });

      return analysis;
    } catch (error: any) {
      logger.error('Error calculating metrics', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  /**
   * Detecta situaciones críticas en el inventario
   */
  detectCriticalIssues(metrics: ProductMetrics[]): CriticalIssue[] {
    const issues: CriticalIssue[] = [];

    metrics.forEach(product => {
      // Quiebre inminente (<7 días de cobertura)
      if (product.cobertura_dias < 7 && product.abc_class === 'A') {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'quiebre',
          prioridad: 'alta',
          stock_actual: product.stock_actual,
          dias_cobertura: product.cobertura_dias,
          cantidad_sugerida: product.cantidad_sugerida,
          notas: `Stock crítico: solo ${product.cobertura_dias} días de cobertura. Reabastecer urgente.`
        });
      }

      // Stock bajo ROP
      if (product.stock_actual < product.rop) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'reabastecer',
          prioridad: product.abc_class === 'A' ? 'alta' : 'media',
          stock_actual: product.stock_actual,
          cantidad_sugerida: product.cantidad_sugerida,
          notas: `Stock actual (${product.stock_actual}) por debajo del ROP (${product.rop}). Ordenar ${product.cantidad_sugerida} unidades.`
        });
      }

      // Sobrestock (>120 días de cobertura en temporada alta)
      if (product.cobertura_dias > 120) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'sobrestock',
          prioridad: 'baja',
          stock_actual: product.stock_actual,
          dias_cobertura: product.cobertura_dias,
          notas: `Sobrestock: ${product.cobertura_dias} días de cobertura. Considerar promoción o bundle.`
        });
      }

      // Lenta rotación (>6 meses sin movimiento)
      if (product.rotacion_meses > 6) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'lenta_rotacion',
          prioridad: 'media',
          stock_actual: product.stock_actual,
          notas: `Sin rotación significativa en ${product.rotacion_meses} meses. Evaluar descontinuar o promocionar.`
        });
      }
    });

    // Ordenar por prioridad
    return issues.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    });
  }

  /**
   * Determina la temporada actual
   */
  private getCurrentSeason(): 'alta' | 'baja' {
    const month = new Date().getMonth() + 1;  // 1-12
    // Alta: Oct-Jun (10,11,12,1,2,3,4,5,6)
    // Baja: Jul-Sep (7,8,9)
    return (month >= 10 || month <= 6) ? 'alta' : 'baja';
  }

  /**
   * Genera resumen ejecutivo
   */
  private generateExecutiveSummary(metrics: ProductMetrics[], issues: CriticalIssue[]): string[] {
    const summary: string[] = [];

    const totalProducts = metrics.length;
    const quiebres = issues.filter(i => i.motivo === 'quiebre').length;
    const reabastecimiento = issues.filter(i => i.motivo === 'reabastecer').length;
    const sobrestock = issues.filter(i => i.motivo === 'sobrestock').length;

    summary.push(`Inventario total: ${totalProducts} productos activos`);

    if (quiebres > 0) {
      summary.push(`🚨 CRÍTICO: ${quiebres} productos en riesgo de quiebre (<7 días)`);
    }

    if (reabastecimiento > 0) {
      summary.push(`⚠️ ${reabastecimiento} productos requieren reabastecimiento`);
    }

    if (sobrestock > 0) {
      summary.push(`📦 ${sobrestock} productos con sobrestock (>120 días)`);
    }

    const productoA = metrics.filter(m => m.abc_class === 'A').length;
    summary.push(`Productos clase A (80% ventas): ${productoA}`);

    return summary;
  }

  /**
   * Construye listas rápidas para acceso inmediato
   */
  private buildQuickLists(metrics: ProductMetrics[]) {
    return {
      quiebres_inminentes: metrics
        .filter(m => m.cobertura_dias < 7)
        .slice(0, 10)
        .map(m => ({
          sku: m.sku,
          nombre: m.name,
          dias_cobertura: m.cobertura_dias,
          stock_actual: m.stock_actual
        })),

      sobrestock: metrics
        .filter(m => m.cobertura_dias > 120)
        .slice(0, 10)
        .map(m => ({
          sku: m.sku,
          nombre: m.name,
          cobertura_dias: m.cobertura_dias,
          accion: 'Promoción o descuento'
        })),

      lenta_rotacion: metrics
        .filter(m => m.rotacion_meses > 6)
        .slice(0, 10)
        .map(m => ({
          sku: m.sku,
          nombre: m.name,
          dias_sin_venta: m.rotacion_meses * 30
        }))
    };
  }

  /**
   * Genera datos mock para desarrollo
   * TODO: Reemplazar con datos reales de Lightspeed API
   */
  private generateMockMetrics(temporada: 'alta' | 'baja'): ProductMetrics[] {
    const mockProducts = [
      {
        product_id: '1', sku: 'ART-001', name: 'Pintura Océano', category: 'Obras de arte',
        location: 'galeria', stock_actual: 3, demanda_diaria: 0.5, lead_time_dias: 14,
        costo: 500, precio: 1200, abc_class: 'A', xyz_class: 'X'
      },
      {
        product_id: '2', sku: 'JOY-045', name: 'Collar Plata Turquesa', category: 'Joyería',
        location: 'galeria', stock_actual: 8, demanda_diaria: 1.2, lead_time_dias: 7,
        costo: 300, precio: 750, abc_class: 'A', xyz_class: 'Y'
      },
      {
        product_id: '3', sku: 'SOU-112', name: 'Magneto Cabo', category: 'Souvenirs de arte',
        location: 'bodega', stock_actual: 150, demanda_diaria: 3.0, lead_time_dias: 21,
        costo: 15, precio: 45, abc_class: 'B', xyz_class: 'X'
      }
    ] as const;

    const multiplicador = temporada === 'alta' ? 1.25 : 0.80;

    return mockProducts.map(p => {
      const demandaEstacional = p.demanda_diaria * multiplicador;
      const dlt = demandaEstacional * p.lead_time_dias;
      const zScore = temporada === 'alta' ? 2.17 : 1.81;  // 97% vs 93% service level
      const stdDev = demandaEstacional * 0.3;  // Asumiendo 30% de variabilidad
      const safetyStock = Math.ceil(zScore * stdDev * Math.sqrt(p.lead_time_dias));
      const rop = Math.ceil(dlt + safetyStock);
      const stockObjetivo = Math.ceil(demandaEstacional * 14 + safetyStock);  // 2 semanas
      const cantidadSugerida = Math.max(0, stockObjetivo - p.stock_actual);
      const coberturaDias = Math.round(p.stock_actual / demandaEstacional);
      const rotacionMeses = p.stock_actual > 0 ? (p.stock_actual / (demandaEstacional * 30)) : 12;
      const margenBruto = (p.precio - p.costo) / p.precio;

      return {
        product_id: p.product_id,
        sku: p.sku,
        name: p.name,
        category: p.category,
        location: p.location as 'galeria' | 'bodega',
        stock_actual: p.stock_actual,
        stock_objetivo: stockObjetivo,
        demanda_diaria: p.demanda_diaria,
        demanda_estacional: demandaEstacional,
        lead_time_dias: p.lead_time_dias,
        rop,
        safety_stock: safetyStock,
        cantidad_sugerida: cantidadSugerida,
        cobertura_dias: coberturaDias,
        rotacion_meses: Math.round(rotacionMeses * 10) / 10,
        abc_class: p.abc_class as 'A' | 'B' | 'C',
        xyz_class: p.xyz_class as 'X' | 'Y' | 'Z',
        costo: p.costo,
        precio: p.precio,
        margen_bruto: Math.round(margenBruto * 100) / 100
      };
    });
  }
}
