import fetch from "node-fetch";
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
  // Add other relevant fields from Lightspeed Outlet API response
}

interface RetailerDetails {
  id: string;
  name: string;
  timezone: string;
  // Add other relevant fields from Lightspeed Retailer API response
}

export class LightspeedClient {
  private readonly baseUrl: string = "https://ivanguaderrama.retail.lightspeed.app/api/2.0";
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  private async makeRequest<T>(endpoint: string, params?: URLSearchParams): Promise<T> {
    const url = `${this.baseUrl}${endpoint}?${params?.toString() || ""}`;
    functions.logger.info(`Making Lightspeed API request to: ${url}`);

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

    const responseBody = await response.json(); // Get the JSON body
    functions.logger.info("Lightspeed API raw response:", { endpoint, responseBody }); // Add this line
    return responseBody as Promise<T>;
  }

  public async getOutletDetails(outletId: string): Promise<OutletDetails> {
    const data: any = await this.makeRequest(`/outlets/${outletId}`);
    // Assuming Lightspeed returns a single Outlet object directly for /outlets/{id}
    if (!data || !data.data || data.data.length === 0) {
      throw new Error(`Outlet with ID ${outletId} not found or no data.`);
    }
    return data.data[0]; // Lightspeed often returns single items in an array
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
   * Fetches sales data from Lightspeed API and aggregates it.
   * Handles pagination and returns a summary.
   */
  public async getSalesSummary(
    dateFrom: string, // ISO string, assumed UTC
    dateTo: string,   // ISO string, assumed UTC
    outletId: string,
    includeReturns: boolean = true,
  ): Promise<SalesSummary> {
    let totalAmount = 0;
    let totalTickets = 0;
    let currentPage = 0;
    const pageSize = 200; // Max page size for /search endpoint
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales",
        outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), // Extract YYYY-MM-DD
        date_to: dateTo.substring(0, 10),     // Extract YYYY-MM-DD
        offset: (currentPage * pageSize).toString(),
        limit: pageSize.toString(),
      });

      // Use /search endpoint for sales as per plan
      const data: any = await this.makeRequest("/search", params);
      functions.logger.info("Lightspeed /search (sales) response:", { data }); // Add this line

      // Lightspeed /search endpoint returns data under 'data' key, and sales under 'Sale' within that.
      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      // Iterate through the sales returned by the /search endpoint
      for (const item of data.data) {
        // The /search endpoint returns a generic 'data' array, each item has a 'type' and then the actual object.
        // We are looking for 'Sale' type items.
        if (item.type === "Sale" && item.Sale) {
          const sale = item.Sale;
          // Only process completed sales
          if (sale.completed) {
            totalTickets++;
            let saleTotal = parseFloat(sale.total);

            // Handle returns if includeReturns is false
            if (!includeReturns) {
              // Iterate through line items to identify returns (negative quantities)
              if (sale.SaleLines && Array.isArray(sale.SaleLines)) {
                for (const line of sale.SaleLines) {
                  if (line.quantity < 0) {
                    // Subtract the amount of the returned item from the sale total
                    saleTotal -= parseFloat(line.unitPrice) * Math.abs(line.quantity);
                  }
                }
              }
            }
            totalAmount += saleTotal;
          }
        }
      }

      currentPage++;
      // Assume no more data if the number of sales returned is less than page size.
      if (data.data.length < pageSize) {
        hasMore = false;
      }
    }

    const avgTicket = totalTickets > 0 ? totalAmount / totalTickets : 0;

    // TODO: Get actual timezone from outlet or use a default
    // For now, use the timezone from the retailer details if available, otherwise default.
    let timezone = "America/Mazatlan"; // Default placeholder
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
      timezone: timezone,
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
    dateFrom: string, // ISO string, assumed UTC
    dateTo: string,   // ISO string, assumed UTC
    outletId: string,
    limit: number = 10,
  ): Promise<any> { // TODO: Define a proper interface for the response
    const productSales: { [key: string]: { quantity: number, name: string } } = {};
    let currentPage = 0;
    const pageSize = 200; // Max page size for /search endpoint
    let hasMore = true;

    while (hasMore) {
      const params = new URLSearchParams({
        type: "sales",
        outlet_id: outletId,
        date_from: dateFrom.substring(0, 10), // Extract YYYY-MM-DD
        date_to: dateTo.substring(0, 10),     // Extract YYYY-MM-DD
        offset: (currentPage * pageSize).toString(),
        limit: pageSize.toString(),
        relations: "SaleLines.Item", // Include item details
      });

      const data: any = await this.makeRequest("/search", params);

      if (!data || !data.data || !Array.isArray(data.data) || data.data.length === 0) {
        hasMore = false;
        break;
      }

      for (const item of data.data) {
        if (item.type === "Sale" && item.Sale && item.Sale.SaleLines) {
          for (const line of item.Sale.SaleLines) {
            if (line.product_id && line.quantity > 0) { // Only count positive quantities
              const productId = line.product_id;
              const productName = line.product_id; // Placeholder for now
              if (productSales[productId]) {
                productSales[productId].quantity += line.quantity;
              } else {
                productSales[productId] = { quantity: line.quantity, name: productName };
              }
            }
          }
        }
      }

      currentPage++;
      if (data.data.length < pageSize) {
        hasMore = false;
      }
    }

    const sortedProducts = Object.entries(productSales)
      .map(([productId, data]) => ({ productId, name: data.name, quantity: data.quantity }))
      .sort((a, b) => b.quantity - a.quantity);

    return sortedProducts.slice(0, limit);
  }
}