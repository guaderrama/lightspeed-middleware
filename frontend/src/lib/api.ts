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

  async getInventoryStatus() {
    return this.request<any>('/analytics/inventory-status');
  }

  async refreshInventoryAnalysis() {
    return this.request<any>('/analytics/refresh', {
      method: 'POST',
    });
  }

  async chat(question: string) {
    return this.request<{ answer: string; cost: number }>('/chat', {
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
}

export const apiClient = new ApiClient(API_BASE_URL, API_KEY);
