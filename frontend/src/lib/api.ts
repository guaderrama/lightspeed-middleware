/**
 * API Client for Lightspeed Middleware
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/inventario-is/us-central1/api';
const API_KEY = import.meta.env.VITE_API_KEY || '';

interface ApiResponse<T> {
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta: {
    timestamp: string;
    requestId: string;
    version?: string;
    fromCache?: boolean;
  };
}

class ApiClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint}`;

    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
      ...options.headers,
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error?.message || 'Request failed');
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async getInventoryStatus(params?: { outlet_id?: string }) {
    const queryParams = params?.outlet_id
      ? `?outlet_id=${encodeURIComponent(params.outlet_id)}`
      : '';
    return this.request<any>(`/analytics/inventory-status${queryParams}`);
  }

  async refreshInventoryAnalysis(params?: { outlet_id?: string }) {
    const queryParams = params?.outlet_id
      ? `?outlet_id=${encodeURIComponent(params.outlet_id)}`
      : '';
    return this.request<any>(`/analytics/refresh${queryParams}`, {
      method: 'POST',
    });
  }

  async chat(question: string) {
    return this.request<{ answer: string; cost: number }>('/chat/ask', {
      method: 'POST',
      body: JSON.stringify({ question }),
    });
  }

  async getSalesSummary(params: {
    date_from: string;
    date_to: string;
    outlet_id: string;
    include_returns?: boolean;
  }) {
    const queryParams = new URLSearchParams({
      date_from: params.date_from,
      date_to: params.date_to,
      outlet_id: params.outlet_id,
      include_returns: String(params.include_returns ?? true),
    });

    return this.request<any>(`/reports/sales-summary?${queryParams}`);
  }

  async getTopSellingProducts(params: {
    date_from: string;
    date_to: string;
    outlet_id: string;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams({
      date_from: params.date_from,
      date_to: params.date_to,
      outlet_id: params.outlet_id,
      limit: String(params.limit ?? 10),
    });

    return this.request<any>(`/reports/sales-top?${queryParams}`);
  }

  async getSalesComparison(params: {
    date_from: string;
    date_to: string;
    outlet_id: string;
  }) {
    const queryParams = new URLSearchParams({
      date_from: params.date_from,
      date_to: params.date_to,
      outlet_id: params.outlet_id,
    });

    return this.request<any>(`/reports/sales-comparison?${queryParams}`);
  }

  async getOutlets() {
    return this.request<any[]>('/analytics/outlets');
  }

  async getAlerts() {
    return this.request<any>('/analytics/alerts');
  }

  async getHourlySales(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/reports/sales-hourly?${queryParams}`);
  }

  async getWeekdaySales(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/reports/sales-weekday?${queryParams}`);
  }

  async getCategorySales(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/reports/sales-category?${queryParams}`);
  }

  async getMonthlySales(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/reports/sales-monthly?${queryParams}`);
  }

  async getCustomerAnalytics(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/customers/analytics?${queryParams}`);
  }

  async getTopCustomers(params: { date_from: string; date_to: string; outlet_id: string; limit?: number }) {
    const queryParams = new URLSearchParams({
      date_from: params.date_from,
      date_to: params.date_to,
      outlet_id: params.outlet_id,
      limit: String(params.limit ?? 20),
    });
    return this.request<any>(`/customers/top?${queryParams}`);
  }

  async getReturnsSummary(params: { date_from: string; date_to: string; outlet_id: string }) {
    const queryParams = new URLSearchParams(params);
    return this.request<any>(`/customers/returns-summary?${queryParams}`);
  }
}

export const apiClient = new ApiClient(API_BASE_URL, API_KEY);
