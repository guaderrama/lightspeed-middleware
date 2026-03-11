// Using Node.js 22 native fetch (no import needed)
import * as functions from "firebase-functions";

interface SalesSummary {
  generated_at: string;
  timezone: string;
  date_from: string;
  date_to: string;
  outlet_id: string;
  totals: {
    amount: number;
    tickets: number;
    avg_ticket: number;
  };
}

interface OutletDetails {
  id: string;
  name: string;
  time_zone: string;
}

interface RetailerDetails {
  id: string;
  name: string;
  timezone: string;
}

export class LightspeedClient {
  private readonly baseUrl: string = "https://ivanguaderrama.retail.lightspeed.app/api/2.0";
  private readonly accessToken: string;
  private readonly defaultTimezone: string = "America/Mazatlan";

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Converts a UTC date string from Lightspeed API to a Date object
   * representing the local time in the store's timezone.
   * Lightspeed API returns ALL dates in UTC.
   */
  private toLocalDate(utcDateStr: string, timezone?: string): Date {
    const tz = timezone || this.defaultTimezone;
    const utcDate = new Date(utcDateStr);
    const localStr = utcDate.toLocaleString('en-US', { timeZone: tz });
    return new Date(localStr);
  }

  /**
   * Formats a local Date as YYYY-MM-DD string
   */
  private formatLocalDate(localDate: Date): string {
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    const day = String(localDate.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Formats a local Date as YYYY-MM string
   */
  private formatLocalMonth(localDate: Date): string {
    const year = localDate.getFullYear();
    const month = String(localDate.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
  }

  private async makeRequest<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = `${this.baseUrl}${endpoint}${params ? '?' + params.toString() : ''}`;
    functions.logger.info(`Lightspeed API request: ${endpoint}`);

    const response = await fetch(url, {
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Accept": "application/json",
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      functions.logger.error(`Lightspeed API error: ${response.status} - ${errorText}`);
      throw new Error(`Lightspeed API error: ${response.status} - ${errorText}`);
    }

    return await response.json() as T;
  }

  /**
   * Batch fetch product names in parallel, in chunks of 10 to avoid overloading the API.
   * Returns a Map of product_id -> { name, sku }.
   */
  private async getProductNames(productIds: string[]): Promise<Map<string, { name: string; sku: string }>> {
    const nameMap = new Map<string, { name: string; sku: string }>();
    if (productIds.length === 0) return nameMap;

    // Split into chunks of 10 for parallel fetching
    const chunks: string[][] = [];
    for (let i = 0; i < productIds.length; i += 10) {
      chunks.push(productIds.slice(i, i + 10));
    }

    for (const chunk of chunks) {
      const results = await Promise.all(
        chunk.map(async (id) => {
          try {
            const data: any = await this.makeRequest(`/products/${id}`);
            return {
              id,
              name: data?.data?.name || data?.data?.handle || `Producto ${id}`,
              sku: data?.data?.sku || "",
            };
          } catch {
            return { id, name: `Producto ${id}`, sku: "" };
          }
        })
      );
      results.forEach((r) => nameMap.set(r.id, { name: r.name, sku: r.sku }));
    }

    return nameMap;
  }

  public async getOutletDetails(outletId: string): Promise<OutletDetails> {
    const data: any = await this.makeRequest(`/outlets/${outletId}`);
    if (!data || !data.data || data.data.length === 0) {
      throw new Error(`Outlet with ID ${outletId} not found.`);
    }
    return data.data[0];
  }

  public async listOutlets(): Promise<OutletDetails[]> {
    const data: any = await this.makeRequest("/outlets");
    if (!data || !data.data || !Array.isArray(data.data)) {
      throw new Error("Unexpected response format for listOutlets.");
    }
    return data.data;
  }

  public async getRetailerDetails(): Promise<RetailerDetails> {
    const data: any = await this.makeRequest("/retailer");
    if (!data || !data.data) {
      throw new Error("Unexpected response format for getRetailerDetails.");
    }
    return data.data;
  }

  /**
   * Fetches sales data from Lightspeed X-Series API and aggregates it.
   * Uses cursor-based pagination.
   */
  public async getSalesSummary(
    dateFrom: string,
    dateTo: string,
    outletId: string,
    includeReturns: boolean = true,
  ): Promise<SalesSummary> {
    let totalAmount = 0;
    let totalTickets = 0;
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales",
        outlet_id: outletId,
        date_from: dateFrom.substring(0, 10),
        date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(),
        status: "CLOSED",
      });

      if (afterCursor) {
        params.set("after", afterCursor);
      }

      const data: any = await this.makeRequest("/search", params);

      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const sale of data.data) {
        // X-Series: sales are flat objects, status CLOSED = completed
        if (sale.status === "CLOSED") {
          totalTickets++;
          let saleTotal = sale.total_price || 0;

          if (!includeReturns && sale.line_items) {
            for (const line of sale.line_items) {
              if (line.is_return || line.quantity < 0) {
                saleTotal -= Math.abs(line.price_total || 0);
              }
            }
          }

          totalAmount += saleTotal;
        }
      }

      // Cursor-based pagination
      if (data.page_info && data.page_info.has_next_page) {
        afterCursor = data.page_info.end_cursor;
      } else {
        hasMore = false;
      }
    }

    const avgTicket = totalTickets > 0 ? totalAmount / totalTickets : 0;

    let timezone = "America/Mazatlan";
    try {
      const retailerDetails = await this.getRetailerDetails();
      if (retailerDetails && retailerDetails.timezone) {
        timezone = retailerDetails.timezone;
      }
    } catch (e) {
      functions.logger.warn("Could not fetch retailer timezone, using default.");
    }

    return {
      generated_at: new Date().toISOString(),
      timezone,
      date_from: dateFrom,
      date_to: dateTo,
      outlet_id: outletId,
      totals: {
        amount: parseFloat(totalAmount.toFixed(2)),
        tickets: totalTickets,
        avg_ticket: parseFloat(avgTicket.toFixed(2)),
      },
    };
  }

  public async getTopSellingProducts(
    dateFrom: string,
    dateTo: string,
    outletId: string,
    limit: number = 10,
  ): Promise<any[]> {
    const productSales: { [key: string]: { quantity: number; revenue: number } } = {};
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales",
        outlet_id: outletId,
        date_from: dateFrom.substring(0, 10),
        date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(),
        status: "CLOSED",
      });

      if (afterCursor) {
        params.set("after", afterCursor);
      }

      const data: any = await this.makeRequest("/search", params);

      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const sale of data.data) {
        if (sale.status === "CLOSED" && sale.line_items) {
          for (const line of sale.line_items) {
            if (line.product_id && line.quantity > 0 && !line.is_return) {
              const pid = line.product_id;
              if (productSales[pid]) {
                productSales[pid].quantity += line.quantity;
                productSales[pid].revenue += (line.price_total || 0);
              } else {
                productSales[pid] = {
                  quantity: line.quantity,
                  revenue: line.price_total || 0,
                };
              }
            }
          }
        }
      }

      if (data.page_info && data.page_info.has_next_page) {
        afterCursor = data.page_info.end_cursor;
      } else {
        hasMore = false;
      }
    }

    // Fetch more variants than limit to account for name-based aggregation
    const fetchLimit = limit * 3;
    const sortedVariants = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        quantity: data.quantity,
        revenue: parseFloat(data.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, fetchLimit);

    // Enrich with product names (batch fetch in parallel)
    const productIds = sortedVariants.map((p) => p.productId);
    const productNamesMap = await this.getProductNames(productIds);
    for (const product of sortedVariants) {
      const info = productNamesMap.get(product.productId);
      (product as any).name = info?.name || `Producto ${product.productId}`;
      (product as any).sku = info?.sku || "";
    }

    // Aggregate variants by product name
    const nameMap: { [name: string]: { quantity: number; revenue: number; variants: number } } = {};
    for (const v of sortedVariants) {
      const name = (v as any).name;
      if (nameMap[name]) {
        nameMap[name].quantity += v.quantity;
        nameMap[name].revenue += v.revenue;
        nameMap[name].variants += 1;
      } else {
        nameMap[name] = { quantity: v.quantity, revenue: v.revenue, variants: 1 };
      }
    }

    return Object.entries(nameMap)
      .map(([name, d]) => ({
        name,
        quantity: d.quantity,
        revenue: parseFloat(d.revenue.toFixed(2)),
        variants: d.variants,
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);
  }

  /**
   * Get daily sales breakdown for a given period
   */
  public async getDailySales(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<{ date: string; amount: number; tickets: number }[]> {
    const dailySales: { [key: string]: { amount: number; tickets: number } } = {};
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales",
        outlet_id: outletId,
        date_from: dateFrom.substring(0, 10),
        date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(),
        status: "CLOSED",
      });

      if (afterCursor) {
        params.set("after", afterCursor);
      }

      const data: any = await this.makeRequest("/search", params);

      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const sale of data.data) {
        if (sale.status === "CLOSED") {
          const saleDate = sale.sale_date || sale.created_at;
          if (saleDate) {
            const localDate = this.toLocalDate(saleDate);
            const date = this.formatLocalDate(localDate);
            const amount = sale.total_price || 0;

            if (!dailySales[date]) {
              dailySales[date] = { amount: 0, tickets: 0 };
            }

            dailySales[date].amount += amount;
            dailySales[date].tickets += 1;
          }
        }
      }

      if (data.page_info && data.page_info.has_next_page) {
        afterCursor = data.page_info.end_cursor;
      } else {
        hasMore = false;
      }
    }

    return Object.entries(dailySales)
      .map(([date, data]) => ({
        date,
        amount: parseFloat(data.amount.toFixed(2)),
        tickets: data.tickets,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get sales grouped by hour (0-23)
   */
  public async getHourlySales(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<{ hour: number; amount: number; tickets: number }[]> {
    const hourlySales: { [key: number]: { amount: number; tickets: number } } = {};
    for (let i = 0; i < 24; i++) hourlySales[i] = { amount: 0, tickets: 0 };

    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status === "CLOSED") {
          const saleDate = sale.sale_date || sale.created_at;
          if (saleDate) {
            const localDate = this.toLocalDate(saleDate);
            const hour = localDate.getHours();
            hourlySales[hour].amount += sale.total_price || 0;
            hourlySales[hour].tickets += 1;
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    return Object.entries(hourlySales)
      .map(([hour, d]) => ({
        hour: parseInt(hour),
        amount: parseFloat(d.amount.toFixed(2)),
        tickets: d.tickets,
      }))
      .sort((a, b) => a.hour - b.hour);
  }

  /**
   * Get sales grouped by day of week
   */
  public async getWeekdaySales(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<{ day: number; dayName: string; amount: number; tickets: number }[]> {
    const dayNames = ["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"];
    const weekdaySales: { [key: number]: { amount: number; tickets: number } } = {};
    for (let i = 0; i < 7; i++) weekdaySales[i] = { amount: 0, tickets: 0 };

    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status === "CLOSED") {
          const saleDate = sale.sale_date || sale.created_at;
          if (saleDate) {
            const localDate = this.toLocalDate(saleDate);
            const dayOfWeek = localDate.getDay();
            weekdaySales[dayOfWeek].amount += sale.total_price || 0;
            weekdaySales[dayOfWeek].tickets += 1;
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    // Return starting from Monday (1) to Sunday (0)
    const order = [1, 2, 3, 4, 5, 6, 0];
    return order.map((day) => ({
      day,
      dayName: dayNames[day],
      amount: parseFloat(weekdaySales[day].amount.toFixed(2)),
      tickets: weekdaySales[day].tickets,
    }));
  }

  /**
   * Get sales grouped by product (top N by revenue)
   */
  public async getCategorySales(
    dateFrom: string,
    dateTo: string,
    outletId: string,
    limit: number = 10,
  ): Promise<{ name: string; quantity: number; revenue: number; variants: number }[]> {
    const productSales: { [key: string]: { quantity: number; revenue: number } } = {};
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status === "CLOSED" && sale.line_items) {
          for (const line of sale.line_items) {
            if (line.product_id && line.quantity > 0 && !line.is_return) {
              const pid = line.product_id;
              if (!productSales[pid]) productSales[pid] = { quantity: 0, revenue: 0 };
              productSales[pid].quantity += line.quantity;
              productSales[pid].revenue += (line.price_total || 0);
            }
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    // Fetch more variants than limit to account for name-based aggregation
    const fetchLimit = limit * 3;
    const sortedVariants = Object.entries(productSales)
      .map(([productId, d]) => ({ productId, name: productId, quantity: d.quantity, revenue: parseFloat(d.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, fetchLimit);

    // Enrich with product names (batch fetch in parallel)
    const categoryProductIds = sortedVariants.map((p) => p.productId);
    const categoryNamesMap = await this.getProductNames(categoryProductIds);
    for (const product of sortedVariants) {
      const info = categoryNamesMap.get(product.productId);
      product.name = info?.name || `Producto ${product.productId}`;
    }

    // Aggregate variants by product name
    const nameMap: { [name: string]: { quantity: number; revenue: number; variants: number } } = {};
    for (const v of sortedVariants) {
      if (nameMap[v.name]) {
        nameMap[v.name].quantity += v.quantity;
        nameMap[v.name].revenue += v.revenue;
        nameMap[v.name].variants += 1;
      } else {
        nameMap[v.name] = { quantity: v.quantity, revenue: v.revenue, variants: 1 };
      }
    }

    return Object.entries(nameMap)
      .map(([name, d]) => ({
        name,
        quantity: d.quantity,
        revenue: parseFloat(d.revenue.toFixed(2)),
        variants: d.variants,
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);
  }

  /**
   * Get sales grouped by month (YYYY-MM)
   */
  public async getMonthlySales(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<{ month: string; amount: number; tickets: number; avg_ticket: number }[]> {
    const monthlySales: { [key: string]: { amount: number; tickets: number } } = {};
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status === "CLOSED") {
          const saleDate = sale.sale_date || sale.created_at;
          if (saleDate) {
            const localDate = this.toLocalDate(saleDate);
            const month = this.formatLocalMonth(localDate);
            if (!monthlySales[month]) monthlySales[month] = { amount: 0, tickets: 0 };
            monthlySales[month].amount += sale.total_price || 0;
            monthlySales[month].tickets += 1;
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    return Object.entries(monthlySales)
      .map(([month, d]) => ({
        month,
        amount: parseFloat(d.amount.toFixed(2)),
        tickets: d.tickets,
        avg_ticket: d.tickets > 0 ? parseFloat((d.amount / d.tickets).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Get customer analytics from sales data.
   * Groups sales by customer_id to calculate spend, visits, and segmentation.
   */
  public async getCustomerAnalytics(
    dateFrom: string,
    dateTo: string,
    outletId: string,
    topLimit: number = 20,
  ): Promise<{
    total_customers: number;
    new_customers: number;
    returning_customers: number;
    total_revenue: number;
    avg_spend_per_customer: number;
    segments: { name: string; count: number; revenue: number }[];
    top_customers: {
      name: string;
      total_spent: number;
      visits: number;
      avg_ticket: number;
      last_purchase: string;
    }[];
  }> {
    const customers: { [id: string]: {
      name: string;
      total_spent: number;
      visits: number;
      first_purchase: string;
      last_purchase: string;
    }} = {};
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status !== "CLOSED") continue;
        const customerId = sale.customer_id || "anonymous";
        const customerName = sale.customer_name || "Cliente Sin Nombre";
        const saleDate = sale.sale_date || sale.created_at || "";
        const amount = sale.total_price || 0;

        if (!customers[customerId]) {
          customers[customerId] = {
            name: customerName,
            total_spent: 0,
            visits: 0,
            first_purchase: saleDate,
            last_purchase: saleDate,
          };
        }

        customers[customerId].total_spent += amount;
        customers[customerId].visits += 1;
        if (saleDate < customers[customerId].first_purchase) {
          customers[customerId].first_purchase = saleDate;
        }
        if (saleDate > customers[customerId].last_purchase) {
          customers[customerId].last_purchase = saleDate;
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    // Build results
    const allCustomers = Object.entries(customers)
      .filter(([id]) => id !== "anonymous")
      .map(([, c]) => ({
        name: c.name,
        total_spent: parseFloat(c.total_spent.toFixed(2)),
        visits: c.visits,
        avg_ticket: c.visits > 0 ? parseFloat((c.total_spent / c.visits).toFixed(2)) : 0,
        last_purchase: c.last_purchase,
        first_purchase: c.first_purchase,
      }));

    const totalCustomers = allCustomers.length;
    const totalRevenue = allCustomers.reduce((sum, c) => sum + c.total_spent, 0);

    // Segment: VIP (>$5K), Regular ($1K-$5K), Occasional (<$1K)
    const vip = allCustomers.filter(c => c.total_spent >= 5000);
    const regular = allCustomers.filter(c => c.total_spent >= 1000 && c.total_spent < 5000);
    const occasional = allCustomers.filter(c => c.total_spent < 1000);

    // New = only 1 visit in period, Returning = 2+ visits
    const newCustomers = allCustomers.filter(c => c.visits === 1).length;
    const returningCustomers = allCustomers.filter(c => c.visits >= 2).length;

    const topCustomers = [...allCustomers]
      .sort((a, b) => b.total_spent - a.total_spent)
      .slice(0, topLimit)
      .map(({ first_purchase, ...rest }) => rest);

    return {
      total_customers: totalCustomers,
      new_customers: newCustomers,
      returning_customers: returningCustomers,
      total_revenue: parseFloat(totalRevenue.toFixed(2)),
      avg_spend_per_customer: totalCustomers > 0 ? parseFloat((totalRevenue / totalCustomers).toFixed(2)) : 0,
      segments: [
        { name: "VIP (>$5K)", count: vip.length, revenue: parseFloat(vip.reduce((s, c) => s + c.total_spent, 0).toFixed(2)) },
        { name: "Regular ($1K-$5K)", count: regular.length, revenue: parseFloat(regular.reduce((s, c) => s + c.total_spent, 0).toFixed(2)) },
        { name: "Ocasional (<$1K)", count: occasional.length, revenue: parseFloat(occasional.reduce((s, c) => s + c.total_spent, 0).toFixed(2)) },
      ],
      top_customers: topCustomers,
    };
  }

  /**
   * Get all products from Lightspeed.
   * Uses version-based pagination on /products endpoint.
   * NOTE: Inventory is NOT included - use getInventoryMap() separately.
   */
  public async getProducts(): Promise<{
    id: string;
    name: string;
    sku: string;
    supply_price: number;
    retail_price: number;
    category_name: string;
    tag_ids: string[];
    active: boolean;
    variant_count: number;
  }[]> {
    const products: any[] = [];
    let hasMore = true;
    let afterVersion: number | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({ page_size: pageSize.toString() });
      if (afterVersion) params.set("after", String(afterVersion));

      const data: any = await this.makeRequest("/products", params);
      if (!data?.data?.length) { hasMore = false; break; }

      let lastVersion = 0;
      for (const product of data.data) {
        if (product.active === false || product.deleted_at) continue;

        // Track version for pagination
        if (product.version && product.version > lastVersion) {
          lastVersion = product.version;
        }

        // Extract category from product_category or categories
        let categoryName = "";
        if (product.product_category?.name) {
          categoryName = product.product_category.name;
        } else if (product.categories?.length > 0) {
          categoryName = product.categories[0].name || "";
        }

        products.push({
          id: product.id,
          name: product.name || product.handle || product.id,
          sku: product.sku || "",
          supply_price: parseFloat(product.supply_price || "0"),
          retail_price: parseFloat(product.price_including_tax || product.price_excluding_tax || "0"),
          category_name: categoryName,
          tag_ids: product.tag_ids || [],
          active: true,
          variant_count: product.variant_count || 1,
        });
      }

      // Version-based pagination: if we got a full page, there might be more
      if (data.data.length >= pageSize && lastVersion > 0) {
        afterVersion = lastVersion;
      } else {
        hasMore = false;
      }
    }

    functions.logger.info(`Fetched ${products.length} active products from Lightspeed`);
    return products;
  }

  /**
   * Get inventory levels for all products at a specific outlet.
   * Uses the bulk /inventory endpoint with version-based pagination.
   * Returns a Map of product_id -> { inventory_level, reorder_point, reorder_amount }
   */
  public async getInventoryMap(outletId: string): Promise<Map<string, {
    inventory_level: number;
    reorder_point: number;
    reorder_amount: number;
  }>> {
    const inventoryMap = new Map<string, {
      inventory_level: number;
      reorder_point: number;
      reorder_amount: number;
    }>();
    let hasMore = true;
    let afterVersion: number | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        page_size: pageSize.toString(),
      });
      if (afterVersion) params.set("after", String(afterVersion));

      const data: any = await this.makeRequest("/inventory", params);
      if (!data?.data?.length) { hasMore = false; break; }

      let lastVersion = 0;
      for (const inv of data.data) {
        if (inv.deleted_at) continue;
        if (inv.version && inv.version > lastVersion) lastVersion = inv.version;

        // Only include inventory for the requested outlet
        if (inv.outlet_id === outletId) {
          inventoryMap.set(inv.product_id, {
            inventory_level: inv.inventory_level ?? inv.current_amount ?? 0,
            reorder_point: inv.reorder_point ?? 0,
            reorder_amount: inv.reorder_amount ?? 0,
          });
        }
      }

      // Version-based pagination
      if (data.version?.max && data.data.length >= pageSize) {
        afterVersion = data.version.max;
      } else if (data.data.length >= pageSize && lastVersion > 0) {
        afterVersion = lastVersion;
      } else {
        hasMore = false;
      }
    }

    functions.logger.info(`Fetched inventory for ${inventoryMap.size} products at outlet ${outletId}`);
    return inventoryMap;
  }

  /**
   * Get per-product sales velocity map for a given period.
   * Returns a map of product_id -> { quantity_sold, revenue, last_sale_date }.
   * Used to calculate ABC classification, ROP, coverage days.
   */
  public async getProductSalesMap(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<Map<string, { quantity_sold: number; revenue: number; last_sale_date: string }>> {
    const salesMap = new Map<string, { quantity_sold: number; revenue: number; last_sale_date: string }>();
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status !== "CLOSED" || !sale.line_items) continue;
        const saleDate = sale.sale_date || sale.created_at || "";

        for (const line of sale.line_items) {
          if (!line.product_id || line.is_return || line.quantity <= 0) continue;

          const pid = line.product_id;
          const existing = salesMap.get(pid);
          if (existing) {
            existing.quantity_sold += line.quantity;
            existing.revenue += (line.price_total || 0);
            if (saleDate > existing.last_sale_date) existing.last_sale_date = saleDate;
          } else {
            salesMap.set(pid, {
              quantity_sold: line.quantity,
              revenue: line.price_total || 0,
              last_sale_date: saleDate,
            });
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    functions.logger.info(`Built sales map for ${salesMap.size} products`);
    return salesMap;
  }

  /**
   * Get returns summary from sales data.
   * Scans line_items for returns (is_return=true or quantity<0).
   */
  public async getReturnsSummary(
    dateFrom: string,
    dateTo: string,
    outletId: string,
  ): Promise<{
    total_returns_value: number;
    total_returns_count: number;
    total_sales_value: number;
    total_sales_count: number;
    return_rate_value: number;
    return_rate_count: number;
    top_returned_products: { product_id: string; name: string; quantity: number; value: number }[];
  }> {
    const returnedProducts: { [pid: string]: { quantity: number; value: number } } = {};
    let totalReturnsValue = 0;
    let totalReturnsCount = 0;
    let totalSalesValue = 0;
    let totalSalesCount = 0;
    let hasMore = true;
    let afterCursor: string | null = null;
    const pageSize = 200;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales", outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), date_to: dateTo.substring(0, 10),
        limit: pageSize.toString(), status: "CLOSED",
      });
      if (afterCursor) params.set("after", afterCursor);

      const data: any = await this.makeRequest("/search", params);
      if (!data?.data?.length) { hasMore = false; break; }

      for (const sale of data.data) {
        if (sale.status !== "CLOSED") continue;
        totalSalesValue += sale.total_price || 0;
        totalSalesCount += 1;

        if (sale.line_items) {
          for (const line of sale.line_items) {
            if (line.is_return || line.quantity < 0) {
              const returnValue = Math.abs(line.price_total || 0);
              const returnQty = Math.abs(line.quantity || 1);
              totalReturnsValue += returnValue;
              totalReturnsCount += returnQty;

              const pid = line.product_id || "unknown";
              if (!returnedProducts[pid]) returnedProducts[pid] = { quantity: 0, value: 0 };
              returnedProducts[pid].quantity += returnQty;
              returnedProducts[pid].value += returnValue;
            }
          }
        }
      }

      if (data.page_info?.has_next_page) { afterCursor = data.page_info.end_cursor; }
      else { hasMore = false; }
    }

    // Get top returned products with names
    const topReturned = Object.entries(returnedProducts)
      .map(([pid, d]) => ({ product_id: pid, name: pid, quantity: d.quantity, value: parseFloat(d.value.toFixed(2)) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10);

    // Enrich with product names (batch fetch in parallel)
    const returnProductIds = topReturned
      .filter((p) => p.product_id !== "unknown")
      .map((p) => p.product_id);
    const returnNamesMap = await this.getProductNames(returnProductIds);
    for (const product of topReturned) {
      if (product.product_id === "unknown") { product.name = "Desconocido"; continue; }
      const info = returnNamesMap.get(product.product_id);
      product.name = info?.name || `Producto ${product.product_id}`;
    }

    const grossSales = Math.abs(totalSalesValue) + totalReturnsValue;

    return {
      total_returns_value: parseFloat(totalReturnsValue.toFixed(2)),
      total_returns_count: totalReturnsCount,
      total_sales_value: parseFloat(totalSalesValue.toFixed(2)),
      total_sales_count: totalSalesCount,
      return_rate_value: grossSales > 0 ? parseFloat(((totalReturnsValue / grossSales) * 100).toFixed(2)) : 0,
      return_rate_count: totalSalesCount > 0 ? parseFloat(((totalReturnsCount / totalSalesCount) * 100).toFixed(2)) : 0,
      top_returned_products: topReturned,
    };
  }
}
