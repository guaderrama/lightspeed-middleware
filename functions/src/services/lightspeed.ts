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

  constructor(accessToken: string) {
    this.accessToken = accessToken;
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

    // Enrich with product names
    const sortedProducts = Object.entries(productSales)
      .map(([productId, data]) => ({
        productId,
        quantity: data.quantity,
        revenue: parseFloat(data.revenue.toFixed(2)),
      }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, limit);

    // Try to get product names
    for (const product of sortedProducts) {
      try {
        const productData: any = await this.makeRequest(`/products/${product.productId}`);
        if (productData && productData.data) {
          (product as any).name = productData.data.name || productData.data.handle || product.productId;
          (product as any).sku = productData.data.sku || "";
        }
      } catch {
        (product as any).name = product.productId;
        (product as any).sku = "";
      }
    }

    return sortedProducts;
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
            const date = saleDate.substring(0, 10);
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
            const hour = new Date(saleDate).getHours();
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
            const dayOfWeek = new Date(saleDate).getDay();
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
  ): Promise<{ productId: string; name: string; quantity: number; revenue: number }[]> {
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

    const sorted = Object.entries(productSales)
      .map(([productId, d]) => ({ productId, name: productId, quantity: d.quantity, revenue: parseFloat(d.revenue.toFixed(2)) }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    // Enrich with product names
    for (const product of sorted) {
      try {
        const productData: any = await this.makeRequest(`/products/${product.productId}`);
        if (productData?.data) {
          product.name = productData.data.name || productData.data.handle || product.productId;
        }
      } catch { /* keep productId as name */ }
    }

    return sorted;
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
            const month = saleDate.substring(0, 7); // YYYY-MM
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
}
