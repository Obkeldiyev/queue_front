import { api } from "./client";

export interface Branch {
  id: string;
  company_id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  phone?: string;
  email?: string;
  address_uz?: string;
  address_ru?: string;
  address_en?: string;
  latitude?: number;
  longitude?: number;
  working_hours?: Record<string, { open: string; close: string }>;
  timezone?: string;
  status: string;
  created_at: string;
  updated_at: string;
  _count?: { queue_groups: number; devices: number; users: number };
}

export const branchesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Branch[]>(`/branches${qs}`);
  },
  create: (data: Partial<Branch> & { name_uz: string }) =>
    api.post<Branch>("/branches", data),
  get: (id: string) => api.get<Branch>(`/branches/${id}`),
  update: (id: string, data: Partial<Branch>) =>
    api.patch<Branch>(`/branches/${id}`, data),
  delete: (id: string) => api.delete(`/branches/${id}`),
};
