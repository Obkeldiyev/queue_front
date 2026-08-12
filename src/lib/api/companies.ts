import { api } from "./client";

export interface Company {
  id: string;
  name: string;
  slug: string;
  phone?: string;
  email?: string;
  website?: string;
  address?: string;
  timezone: string;
  locale: string;
  primary_color?: string;
  secondary_color?: string;
  status: string;
  created_at: string;
  updated_at: string;
  settings?: Record<string, unknown>;
  _count?: { branches: number; users: number; devices: number };
}

export interface Subscription {
  id: string;
  name: string;
  description?: string;
  monthly_price: number;
  yearly_price: number;
  max_branches: number;
  max_users: number;
  max_devices: number;
  online_queue_enabled: boolean;
  ordering_enabled: boolean;
  analytics_enabled: boolean;
  is_active: boolean;
}

export const companiesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Company[]>(`/companies${qs}`);
  },

  create: (data: Partial<Company> & { slug: string; name: string }) =>
    api.post<Company>("/companies", data),

  get: (id: string) => api.get<Company>(`/companies/${id}`),

  update: (id: string, data: Partial<Company>) =>
    api.patch<Company>(`/companies/${id}`, data),

  delete: (id: string) => api.delete(`/companies/${id}`),

  listSubscriptions: () => api.get<Subscription[]>("/companies/subscriptions"),

  assignSubscription: (id: string, data: {
    subscription_id: string;
    expires_at: string;
    payment_method?: string;
    amount_paid?: number;
  }) => api.post(`/companies/${id}/subscription`, data),
};
