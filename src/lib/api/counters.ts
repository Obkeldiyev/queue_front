import { api } from "./client";

export interface Counter {
  id: string;
  company_id: string;
  branch_id: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  number: number;
  description?: string;
  is_active: boolean;
  created_at: string;
  queue_groups?: Array<{ queue_group: { id: string; name_uz: string; name_ru?: string; name_en?: string; service?: { name_uz: string; estimated_time_mins?: number } } }>;
  sessions?: Array<{
    id: string;
    company_user: { id: string; first_name: string; last_name: string };
  }>;
}

export const countersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Counter[]>(`/counters${qs}`);
  },
  create: (data: { name_uz: string; name_ru?: string; name_en?: string; number: number; branch_id: string; company_id?: string; description?: string }) =>
    api.post<Counter>("/counters", data),
  get: (id: string) => api.get<Counter>(`/counters/${id}`),
  update: (id: string, data: Partial<Counter>) =>
    api.patch<Counter>(`/counters/${id}`, data),
  delete: (id: string) => api.delete(`/counters/${id}`),
  assignQueue: (id: string, queue_group_id: string, sort_order?: number) =>
    api.post(`/counters/${id}/queues`, { queue_group_id, sort_order }),
  removeQueue: (id: string, queueGroupId: string) =>
    api.delete(`/counters/${id}/queues/${queueGroupId}`),
  openSession: (counter_id?: string) =>
    api.post("/counters/sessions/open", counter_id ? { counter_id } : {}),
  closeSession: () =>
    api.post("/counters/sessions/close"),
};
