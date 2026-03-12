import * as logger from 'firebase-functions/logger';
import { LightspeedClient } from './lightspeed';
import {
  InventoryAnalysis, ProductMetrics, CriticalIssue,
  ProfitAnalysis, ProductProfit, CategoryProfit, MarginBucket,
  CategoryIntelligence, CategoryDetail,
} from '../types/analytics';

export class AnalyticsService {
  private lightspeedClient: LightspeedClient;

  constructor(lightspeedToken: string) {
    this.lightspeedClient = new LightspeedClient(lightspeedToken);
  }

  /**
   * Calcula metricas completas del inventario usando datos REALES de Lightspeed.
   * Fetches all products + 90-day sales velocity to compute ABC, ROP, coverage, etc.
   */
  async calculateMetrics(outletId: string): Promise<InventoryAnalysis> {
    try {
      logger.info('Starting REAL inventory metrics calculation', { outletId });

      const temporada = this.getCurrentSeason();

      // 1. Fetch all products (no inventory inline)
      const products = await this.lightspeedClient.getProducts();
      logger.info(`Fetched ${products.length} products`);

      // 2. Fetch inventory for this outlet
      const inventoryMap = await this.lightspeedClient.getInventoryMap(outletId);
      logger.info(`Inventory map has ${inventoryMap.size} entries for outlet ${outletId}`);

      // 3. Fetch 90-day sales velocity
      const now = new Date();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const dateFrom = ninetyDaysAgo.toISOString().substring(0, 10);
      const dateTo = now.toISOString().substring(0, 10);

      const salesMap = await this.lightspeedClient.getProductSalesMap(dateFrom, dateTo, outletId);
      logger.info(`Sales map has ${salesMap.size} products with sales`);

      // 4. Combine products + inventory + sales into ProductMetrics
      const daysInPeriod = 90;
      const metrics = this.buildProductMetrics(products, inventoryMap, salesMap, outletId, daysInPeriod, temporada);
      logger.info(`Built ${metrics.length} product metrics`);

      // 4. Apply ABC classification based on real revenue
      this.applyAbcClassification(metrics);

      // 5. Detect critical issues
      const criticalIssues = this.detectCriticalIssues(metrics);

      // 6. Build executive summary
      const resumenEjecutivo = this.generateExecutiveSummary(metrics, criticalIssues);

      // 7. Build quick lists
      const listasRapidas = this.buildQuickLists(metrics);

      const analysis: InventoryAnalysis = {
        generado_el: new Date().toISOString(),
        temporada,
        parametros: {
          nivel_servicio: { alta: 0.97, baja: 0.93 },
          multiplicadores: { alta: 1.25, baja: 0.80 },
        },
        resumen_ejecutivo: resumenEjecutivo,
        metricas: metrics,
        listas_rapidas: listasRapidas,
        recomendaciones: criticalIssues,
        ultima_actualizacion: new Date().toISOString(),
      };

      logger.info('REAL inventory metrics calculated successfully', {
        productCount: metrics.length,
        criticalIssuesCount: criticalIssues.length,
      });

      return analysis;
    } catch (error: any) {
      logger.error('Error calculating metrics', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  /**
   * Builds ProductMetrics from real product data + sales velocity.
   */
  private buildProductMetrics(
    products: Awaited<ReturnType<LightspeedClient['getProducts']>>,
    inventoryMap: Map<string, { inventory_level: number; reorder_point: number; reorder_amount: number }>,
    salesMap: Map<string, { quantity_sold: number; revenue: number; last_sale_date: string }>,
    outletId: string,
    daysInPeriod: number,
    temporada: 'alta' | 'baja',
  ): ProductMetrics[] {
    const multiplicador = temporada === 'alta' ? 1.25 : 0.80;
    const zScore = temporada === 'alta' ? 2.17 : 1.81; // 97% vs 93% service level

    return products.map((product) => {
      // Get stock for this outlet from inventory map
      const inv = inventoryMap.get(product.id);
      const stockActual = inv?.inventory_level ?? 0;
      const reorderPoint = inv?.reorder_point ?? 0;
      const restockLevel = inv?.reorder_amount ?? 0;

      // Get sales velocity
      const sales = salesMap.get(product.id);
      const quantitySold = sales?.quantity_sold ?? 0;
      const revenue = sales?.revenue ?? 0;
      const lastSaleDate = sales?.last_sale_date ?? "";

      // Calculate daily demand
      const demandaDiaria = daysInPeriod > 0 ? quantitySold / daysInPeriod : 0;
      const demandaEstacional = demandaDiaria * multiplicador;

      // Lead time: use 14 days default (art gallery typical)
      const leadTimeDias = 14;
      const dlt = demandaEstacional * leadTimeDias;
      const stdDev = demandaEstacional * 0.3; // 30% variability assumption
      const safetyStock = Math.ceil(zScore * stdDev * Math.sqrt(leadTimeDias));

      // ROP: use Lightspeed's reorder_point if set, otherwise calculate
      const calculatedRop = Math.ceil(dlt + safetyStock);
      const rop = reorderPoint > 0 ? reorderPoint : calculatedRop;

      // Stock target: 2 weeks of seasonal demand + safety stock
      const stockObjetivo = restockLevel > 0
        ? restockLevel
        : Math.ceil(demandaEstacional * 14 + safetyStock);

      const cantidadSugerida = Math.max(0, stockObjetivo - stockActual);

      // Coverage days
      const coberturaDias = demandaEstacional > 0
        ? Math.round(stockActual / demandaEstacional)
        : (stockActual > 0 ? 999 : 0);

      // Rotation months
      const rotacionMeses = demandaEstacional > 0
        ? Math.round((stockActual / (demandaEstacional * 30)) * 10) / 10
        : (stockActual > 0 ? 12 : 0);

      // Days since last sale
      let diasSinVenta = 999;
      if (lastSaleDate) {
        const now = new Date();
        const lastSale = new Date(lastSaleDate);
        diasSinVenta = Math.floor((now.getTime() - lastSale.getTime()) / (1000 * 60 * 60 * 24));
      }

      // Margin
      const costo = product.supply_price || 0;
      const precio = product.retail_price || 0;
      const margenBruto = precio > 0 ? Math.round(((precio - costo) / precio) * 100) / 100 : 0;

      // XYZ classification based on coefficient of variation (simplified)
      // X = stable (high sales), Y = moderate, Z = sporadic
      let xyzClass: 'X' | 'Y' | 'Z' = 'Z';
      if (quantitySold >= 10) xyzClass = 'X';
      else if (quantitySold >= 3) xyzClass = 'Y';

      return {
        product_id: product.id,
        sku: product.sku || product.id,
        name: product.name,
        category: product.category_name || 'Sin categoría',
        location: outletId,
        stock_actual: stockActual,
        stock_objetivo: stockObjetivo,
        demanda_diaria: parseFloat(demandaDiaria.toFixed(3)),
        demanda_estacional: parseFloat(demandaEstacional.toFixed(3)),
        lead_time_dias: leadTimeDias,
        rop,
        safety_stock: safetyStock,
        cantidad_sugerida: cantidadSugerida,
        cobertura_dias: coberturaDias,
        rotacion_meses: rotacionMeses,
        abc_class: 'C' as 'A' | 'B' | 'C', // Will be set by applyAbcClassification
        xyz_class: xyzClass,
        costo,
        precio,
        margen_bruto: margenBruto,
      };
    });
  }

  /**
   * Applies ABC classification based on cumulative revenue contribution.
   * A = top 80% of revenue, B = next 15%, C = remaining 5%.
   */
  private applyAbcClassification(metrics: ProductMetrics[]): void {
    // Sort by revenue (precio * demanda_diaria as proxy for contribution)
    const totalRevenue = metrics.reduce((sum, m) => sum + (m.demanda_diaria * m.precio), 0);
    if (totalRevenue === 0) return;

    // Sort descending by revenue contribution
    const sorted = [...metrics].sort((a, b) =>
      (b.demanda_diaria * b.precio) - (a.demanda_diaria * a.precio)
    );

    let cumulative = 0;
    for (const item of sorted) {
      cumulative += (item.demanda_diaria * item.precio);
      const pct = cumulative / totalRevenue;

      // Find the original metric and set its class
      const original = metrics.find((m) => m.product_id === item.product_id);
      if (original) {
        if (pct <= 0.80) original.abc_class = 'A';
        else if (pct <= 0.95) original.abc_class = 'B';
        else original.abc_class = 'C';
      }
    }
  }

  /**
   * Detecta situaciones criticas en el inventario
   */
  detectCriticalIssues(metrics: ProductMetrics[]): CriticalIssue[] {
    const issues: CriticalIssue[] = [];

    // Only analyze products with some demand or stock
    const relevantProducts = metrics.filter(
      (m) => m.demanda_diaria > 0 || m.stock_actual > 0
    );

    for (const product of relevantProducts) {
      // Stockout risk: class A/B with <7 days coverage and positive demand
      if (product.cobertura_dias < 7 && product.demanda_diaria > 0 &&
          (product.abc_class === 'A' || product.abc_class === 'B')) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'quiebre',
          prioridad: product.abc_class === 'A' ? 'alta' : 'media',
          stock_actual: product.stock_actual,
          dias_cobertura: product.cobertura_dias,
          cantidad_sugerida: product.cantidad_sugerida,
          notas: `Stock critico: solo ${product.cobertura_dias} dias de cobertura. Reabastecer urgente.`,
        });
      }

      // Stock below ROP
      if (product.stock_actual < product.rop && product.demanda_diaria > 0) {
        // Avoid duplicate with stockout risk
        if (product.cobertura_dias >= 7 || (product.abc_class !== 'A' && product.abc_class !== 'B')) {
          issues.push({
            sku: product.sku,
            nombre: product.name,
            categoria: product.category,
            ubicacion: product.location,
            motivo: 'reabastecer',
            prioridad: product.abc_class === 'A' ? 'alta' : 'media',
            stock_actual: product.stock_actual,
            cantidad_sugerida: product.cantidad_sugerida,
            notas: `Stock actual (${product.stock_actual}) por debajo del ROP (${product.rop}). Ordenar ${product.cantidad_sugerida} unidades.`,
          });
        }
      }

      // Overstock: >120 days coverage with positive stock
      if (product.cobertura_dias > 120 && product.stock_actual > 0 && product.demanda_diaria > 0) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'sobrestock',
          prioridad: 'baja',
          stock_actual: product.stock_actual,
          dias_cobertura: product.cobertura_dias,
          notas: `Sobrestock: ${product.cobertura_dias} dias de cobertura. Considerar promocion o bundle.`,
        });
      }

      // Slow rotation: stock > 0 but 0 demand in 90 days
      if (product.stock_actual > 0 && product.demanda_diaria === 0) {
        issues.push({
          sku: product.sku,
          nombre: product.name,
          categoria: product.category,
          ubicacion: product.location,
          motivo: 'lenta_rotacion',
          prioridad: 'media',
          stock_actual: product.stock_actual,
          notas: `Sin ventas en 90 dias con ${product.stock_actual} unidades en stock. Evaluar descontinuar o promocionar.`,
        });
      }
    }

    // Sort by priority
    return issues.sort((a, b) => {
      const prioridadOrder = { alta: 0, media: 1, baja: 2 };
      return prioridadOrder[a.prioridad] - prioridadOrder[b.prioridad];
    });
  }

  /**
   * FASE 6: Profit analysis for a date range.
   * Reuses cached calculateMetrics() + fetches period-specific sales.
   */
  async getProfitAnalysis(outletId: string, dateFrom: string, dateTo: string): Promise<ProfitAnalysis> {
    logger.info('Calculating profit analysis', { outletId, dateFrom, dateTo });

    // Reuse cached inventory metrics for product data (costo, precio, abc_class, category)
    const analysis = await this.calculateMetrics(outletId);
    const metricsMap = new Map(analysis.metricas.map((m) => [m.product_id, m]));

    // Fetch period-specific sales
    const salesMap = await this.lightspeedClient.getProductSalesMap(dateFrom, dateTo, outletId);

    // Build per-product profit data
    const productProfits: ProductProfit[] = [];
    let totalRevenue = 0;
    let totalCost = 0;
    let marginSum = 0;
    let productsWithCost = 0;

    for (const [productId, sales] of salesMap.entries()) {
      const metric = metricsMap.get(productId);
      if (!metric || !sales || sales.quantity_sold <= 0) continue;

      const costo = metric.costo;
      const precio = metric.precio;
      const profitPerUnit = precio - costo;
      const prodRevenue = sales.revenue > 0 ? sales.revenue : precio * sales.quantity_sold;
      const prodCost = costo * sales.quantity_sold;
      const prodProfit = prodRevenue - prodCost;
      const marginPct = precio > 0 && costo > 0 ? ((precio - costo) / precio) * 100 : 0;

      if (costo > 0) {
        productsWithCost++;
        marginSum += marginPct;
      }

      totalRevenue += prodRevenue;
      totalCost += prodCost;

      productProfits.push({
        product_id: productId,
        name: metric.name,
        category: metric.category,
        precio,
        costo,
        margin_pct: Math.round(marginPct * 10) / 10,
        quantity_sold: sales.quantity_sold,
        total_revenue: Math.round(prodRevenue * 100) / 100,
        total_cost: Math.round(prodCost * 100) / 100,
        total_profit: Math.round(prodProfit * 100) / 100,
        abc_class: metric.abc_class,
      });
    }

    // Aggregations
    const totalProfit = totalRevenue - totalCost;
    const avgMargin = productsWithCost > 0 ? marginSum / productsWithCost : 0;

    // By category
    const catMap = new Map<string, CategoryProfit>();
    for (const pp of productProfits) {
      const cat = pp.category || 'Sin categoria';
      const existing = catMap.get(cat) || {
        category: cat, product_count: 0, total_revenue: 0,
        total_cost: 0, total_profit: 0, avg_margin_pct: 0, quantity_sold: 0,
      };
      existing.product_count++;
      existing.total_revenue += pp.total_revenue;
      existing.total_cost += pp.total_cost;
      existing.total_profit += pp.total_profit;
      existing.quantity_sold += pp.quantity_sold;
      catMap.set(cat, existing);
    }
    const byCategory = Array.from(catMap.values())
      .map((c) => ({
        ...c,
        total_revenue: Math.round(c.total_revenue * 100) / 100,
        total_cost: Math.round(c.total_cost * 100) / 100,
        total_profit: Math.round(c.total_profit * 100) / 100,
        avg_margin_pct: c.total_revenue > 0
          ? Math.round(((c.total_revenue - c.total_cost) / c.total_revenue) * 1000) / 10
          : 0,
      }))
      .sort((a, b) => b.total_profit - a.total_profit);

    // Top by profit
    const topByProfit = [...productProfits]
      .sort((a, b) => b.total_profit - a.total_profit)
      .slice(0, 20);

    // Best/worst margins (only products with costo > 0 and sales)
    const withCostData = productProfits.filter((p) => p.costo > 0);
    const bestMargins = [...withCostData]
      .sort((a, b) => b.margin_pct - a.margin_pct)
      .slice(0, 10);
    const worstMargins = [...withCostData]
      .sort((a, b) => a.margin_pct - b.margin_pct)
      .slice(0, 10);

    // Margin distribution buckets
    const buckets: MarginBucket[] = [
      { range: '0-20%', min: 0, max: 20, count: 0, total_profit: 0 },
      { range: '20-40%', min: 20, max: 40, count: 0, total_profit: 0 },
      { range: '40-60%', min: 40, max: 60, count: 0, total_profit: 0 },
      { range: '60-80%', min: 60, max: 80, count: 0, total_profit: 0 },
      { range: '80-100%', min: 80, max: 100, count: 0, total_profit: 0 },
    ];
    for (const pp of withCostData) {
      // Last bucket uses <= to capture exactly 100% margin; clamp negatives to first bucket
      const clampedMargin = Math.max(0, pp.margin_pct);
      const bucket = buckets.find((b, i) =>
        i === buckets.length - 1
          ? clampedMargin >= b.min
          : clampedMargin >= b.min && clampedMargin < b.max
      ) || buckets[buckets.length - 1];
      bucket.count++;
      bucket.total_profit += pp.total_profit;
    }
    buckets.forEach((b) => { b.total_profit = Math.round(b.total_profit * 100) / 100; });

    return {
      period: { from: dateFrom, to: dateTo },
      outlet_id: outletId,
      totals: {
        total_revenue: Math.round(totalRevenue * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        total_profit: Math.round(totalProfit * 100) / 100,
        avg_margin_pct: Math.round(avgMargin * 10) / 10,
        products_with_sales: productProfits.length,
        products_with_cost_data: productsWithCost,
      },
      by_category: byCategory,
      top_by_profit: topByProfit,
      best_margins: bestMargins,
      worst_margins: worstMargins,
      margin_distribution: buckets,
    };
  }

  /**
   * FASE 6: Category intelligence - deep metrics per product category.
   */
  async getCategoryIntelligence(outletId: string, dateFrom: string, dateTo: string): Promise<CategoryIntelligence> {
    logger.info('Calculating category intelligence', { outletId, dateFrom, dateTo });

    const analysis = await this.calculateMetrics(outletId);
    const salesMap = await this.lightspeedClient.getProductSalesMap(dateFrom, dateTo, outletId);

    // Group metrics by category
    const catMap = new Map<string, {
      metrics: ProductMetrics[];
      totalRevenue: number;
      totalCost: number;
      totalQty: number;
      topProduct: { name: string; revenue: number };
    }>();

    for (const m of analysis.metricas) {
      const cat = m.category || 'Sin categoria';
      if (!catMap.has(cat)) {
        catMap.set(cat, { metrics: [], totalRevenue: 0, totalCost: 0, totalQty: 0, topProduct: { name: '', revenue: 0 } });
      }
      const entry = catMap.get(cat)!;
      entry.metrics.push(m);

      const sales = salesMap.get(m.product_id);
      if (sales && sales.quantity_sold > 0) {
        const rev = sales.revenue > 0 ? sales.revenue : m.precio * sales.quantity_sold;
        entry.totalRevenue += rev;
        entry.totalCost += m.costo * sales.quantity_sold;
        entry.totalQty += sales.quantity_sold;
        if (rev > entry.topProduct.revenue) {
          entry.topProduct = { name: m.name, revenue: Math.round(rev * 100) / 100 };
        }
      }
    }

    const categories: CategoryDetail[] = Array.from(catMap.entries()).map(([cat, data]) => {
      const profit = data.totalRevenue - data.totalCost;
      const avgMargin = data.totalRevenue > 0
        ? ((data.totalRevenue - data.totalCost) / data.totalRevenue) * 100
        : 0;
      const invValue = data.metrics.reduce((s, m) => s + m.stock_actual * m.costo, 0);
      const invUnits = data.metrics.reduce((s, m) => s + m.stock_actual, 0);
      const withStock = data.metrics.filter((m) => m.stock_actual > 0).length;
      const withSales = data.metrics.filter((m) => salesMap.has(m.product_id)).length;
      const coverages = data.metrics.filter((m) => m.cobertura_dias < 999 && m.cobertura_dias > 0);
      const avgCov = coverages.length > 0
        ? coverages.reduce((s, m) => s + m.cobertura_dias, 0) / coverages.length
        : 0;

      return {
        category: cat,
        product_count: data.metrics.length,
        products_with_stock: withStock,
        products_with_sales: withSales,
        total_revenue: Math.round(data.totalRevenue * 100) / 100,
        total_cost: Math.round(data.totalCost * 100) / 100,
        total_profit: Math.round(profit * 100) / 100,
        avg_margin_pct: Math.round(avgMargin * 10) / 10,
        inventory_value: Math.round(invValue * 100) / 100,
        inventory_units: invUnits,
        quantity_sold: data.totalQty,
        abc_distribution: {
          A: data.metrics.filter((m) => m.abc_class === 'A').length,
          B: data.metrics.filter((m) => m.abc_class === 'B').length,
          C: data.metrics.filter((m) => m.abc_class === 'C').length,
        },
        top_product: data.topProduct,
      };
    }).sort((a, b) => b.total_revenue - a.total_revenue);

    return {
      period: { from: dateFrom, to: dateTo },
      total_categories: categories.length,
      categories,
    };
  }

  /**
   * Determina la temporada actual
   */
  private getCurrentSeason(): 'alta' | 'baja' {
    const month = new Date().getMonth() + 1;
    // Alta: Oct-Jun, Baja: Jul-Sep
    return (month >= 10 || month <= 6) ? 'alta' : 'baja';
  }

  /**
   * Genera resumen ejecutivo
   */
  private generateExecutiveSummary(metrics: ProductMetrics[], issues: CriticalIssue[]): string[] {
    const summary: string[] = [];

    const totalProducts = metrics.length;
    const withStock = metrics.filter((m) => m.stock_actual > 0).length;
    const withDemand = metrics.filter((m) => m.demanda_diaria > 0).length;
    const quiebres = issues.filter((i) => i.motivo === 'quiebre').length;
    const reabastecimiento = issues.filter((i) => i.motivo === 'reabastecer').length;
    const sobrestock = issues.filter((i) => i.motivo === 'sobrestock').length;
    const sinMovimiento = issues.filter((i) => i.motivo === 'lenta_rotacion').length;

    summary.push(`Inventario total: ${totalProducts} productos activos (${withStock} con stock, ${withDemand} con ventas en 90 dias)`);

    if (quiebres > 0) {
      summary.push(`CRITICO: ${quiebres} productos en riesgo de quiebre (<7 dias)`);
    }
    if (reabastecimiento > 0) {
      summary.push(`${reabastecimiento} productos requieren reabastecimiento (bajo ROP)`);
    }
    if (sobrestock > 0) {
      summary.push(`${sobrestock} productos con sobrestock (>120 dias de cobertura)`);
    }
    if (sinMovimiento > 0) {
      summary.push(`${sinMovimiento} productos sin movimiento en 90 dias`);
    }

    const productoA = metrics.filter((m) => m.abc_class === 'A').length;
    const productoB = metrics.filter((m) => m.abc_class === 'B').length;
    summary.push(`Clasificacion ABC: ${productoA} clase A (80% ventas), ${productoB} clase B (15% ventas), ${totalProducts - productoA - productoB} clase C`);

    // Total inventory value
    const totalValue = metrics.reduce((sum, m) => sum + (m.stock_actual * m.costo), 0);
    if (totalValue > 0) {
      summary.push(`Valor total de inventario (costo): $${totalValue.toLocaleString()}`);
    }

    return summary;
  }

  /**
   * Construye listas rapidas para acceso inmediato
   */
  private buildQuickLists(metrics: ProductMetrics[]) {
    return {
      quiebres_inminentes: metrics
        .filter((m) => m.cobertura_dias < 7 && m.demanda_diaria > 0)
        .sort((a, b) => a.cobertura_dias - b.cobertura_dias)
        .slice(0, 10)
        .map((m) => ({
          sku: m.sku,
          nombre: m.name,
          dias_cobertura: m.cobertura_dias,
          stock_actual: m.stock_actual,
        })),

      sobrestock: metrics
        .filter((m) => m.cobertura_dias > 120 && m.stock_actual > 0 && m.demanda_diaria > 0)
        .sort((a, b) => b.cobertura_dias - a.cobertura_dias)
        .slice(0, 10)
        .map((m) => ({
          sku: m.sku,
          nombre: m.name,
          cobertura_dias: m.cobertura_dias,
          stock_actual: m.stock_actual,
          accion: 'Promocion o descuento',
        })),

      lenta_rotacion: metrics
        .filter((m) => m.stock_actual > 0 && m.demanda_diaria === 0)
        .sort((a, b) => b.stock_actual - a.stock_actual)
        .slice(0, 10)
        .map((m) => ({
          sku: m.sku,
          nombre: m.name,
          dias_sin_venta: 90,
          stock_actual: m.stock_actual,
        })),
    };
  }
}
