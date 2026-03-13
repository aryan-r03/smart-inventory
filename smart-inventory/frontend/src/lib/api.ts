import axios from "axios";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export const api = axios.create({
  baseURL: API_BASE,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token) config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 globally → redirect to login
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    if (error.response?.status === 401) {
      if (typeof window !== "undefined") {
        localStorage.removeItem("access_token");
        localStorage.removeItem("refresh_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login: (email: string, password: string) =>
    api.post("/api/auth/login", { email, password }),
  register: (data: object) => api.post("/api/auth/register", data),
  me: () => api.get("/api/users/me"),
};

// ─── Inventory ────────────────────────────────────────────────────────────────
export const inventoryApi = {
  list: (params?: object) => api.get("/api/inventory/", { params }),
  get: (id: string) => api.get(`/api/inventory/${id}`),
  create: (data: object) => api.post("/api/inventory/", data),
  update: (id: string, data: object) => api.patch(`/api/inventory/${id}`, data),
  delete: (id: string) => api.delete(`/api/inventory/${id}`),
  logUsage: (id: string, data: object) => api.post(`/api/inventory/${id}/usage`, data),
  getUsage: (id: string) => api.get(`/api/inventory/${id}/usage`),
  scanBarcode: (code: string) => api.get(`/api/inventory/scan/barcode/${code}`),
};

// ─── Analytics ────────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard: () => api.get("/api/analytics/dashboard"),
  monthlyConsumption: (months?: number) =>
    api.get("/api/analytics/consumption/monthly", { params: { months } }),
  topItems: (days?: number, limit?: number) =>
    api.get("/api/analytics/top-items", { params: { days, limit } }),
  departmentUsage: (days?: number) =>
    api.get("/api/analytics/department-usage", { params: { days } }),
  turnover: (days?: number) =>
    api.get("/api/analytics/inventory-turnover", { params: { days } }),
};

// ─── Predictions ──────────────────────────────────────────────────────────────
export const predictionsApi = {
  item: (id: string) => api.get(`/api/predictions/item/${id}`),
  bulk: () => api.get("/api/predictions/bulk"),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────
export const alertsApi = {
  list: (params?: object) => api.get("/api/alerts/", { params }),
  acknowledge: (id: string) => api.post(`/api/alerts/${id}/acknowledge`),
  resolve: (id: string) => api.post(`/api/alerts/${id}/resolve`),
  myNotifications: (unreadOnly?: boolean) =>
    api.get("/api/alerts/notifications/mine", { params: { unread_only: unreadOnly } }),
  markRead: (id: string) => api.post(`/api/alerts/notifications/${id}/read`),
};

// ─── Procurement ──────────────────────────────────────────────────────────────
export const procurementApi = {
  list: (params?: object) => api.get("/api/procurement/", { params }),
  create: (data: object) => api.post("/api/procurement/", data),
  update: (id: string, data: object) => api.patch(`/api/procurement/${id}`, data),
  autoSuggest: () => api.post("/api/procurement/auto-suggest"),
};

// ─── Users ────────────────────────────────────────────────────────────────────
export const usersApi = {
  list: () => api.get("/api/users/"),
  updateMe: (data: object) => api.patch("/api/users/me", data),
  update: (id: string, data: object) => api.patch(`/api/users/${id}`, data),
};
