import { api } from "./client";

export interface Service {
  id: string;
  company_id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  description_uz?: string;
  description_ru?: string;
  description_en?: string;
  estimated_time_mins?: number;
  priority_level: number;
  color?: string;
  status: string;
  created_at: string;
  _count?: { queue_groups: number };
}

export const servicesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Service[]>(`/services${qs}`);
  },
  create: (data: Partial<Service> & { name_uz: string }) =>
    api.post<Service>("/services", data),
  get: (id: string) => api.get<Service>(`/services/${id}`),
  update: (id: string, data: Partial<Service>) =>
    api.patch<Service>(`/services/${id}`, data),
  delete: (id: string) => api.delete(`/services/${id}`),
};
