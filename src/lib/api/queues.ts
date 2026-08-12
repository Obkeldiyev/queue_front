import { api } from "./client";

export interface QueueGroup {
  id: string;
  company_id: string;
  branch_id: string;
  service_id?: string;
  name_uz: string;
  name_ru?: string;
  name_en?: string;
  prefix: string;
  number_format: string;
  queue_type: "SEQUENTIAL" | "PRIORITY" | "SMART" | "APPOINTMENT";
  daily_limit?: number;
  priority_weight: number;
  online_enabled: boolean;
  auto_recall_enabled: boolean;
  auto_recall_after_sec: number;
  no_show_after_sec: number;
  is_active: boolean;
  sort_order: number;
  current_number: number;
  created_at: string;
  service?: { id: string; name_uz: string; name_ru?: string; name_en?: string; estimated_time_mins?: number; description_uz?: string; description_ru?: string; description_en?: string };
  _count?: { tickets: number };
}

export interface Ticket {
  id: string;
  queue_group_id: string;
  branch_id: string;
  counter_id?: string;
  customer_id?: string;
  ticket_number: string;
  status: "WAITING" | "CALLED" | "SERVING" | "COMPLETED" | "CANCELLED" | "NO_SHOW" | "TRANSFERRED";
  priority: number;
  is_online: boolean;
  notes?: string;
  called_at?: string;
  serving_started_at?: string;
  completed_at?: string;
  wait_time_sec?: number;
  created_at: string;
  queue_group?: QueueGroup;
  counter?: { id: string; name_uz: string; name_ru?: string; name_en?: string; number: number };
  customer?: { id: string; first_name?: string; last_name?: string; phone?: string };
}

export const queuesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<QueueGroup[]>(`/queues${qs}`);
  },
  create: (data: Partial<QueueGroup> & { name_uz: string; prefix: string; branch_id: string }) =>
    api.post<QueueGroup>("/queues", data),
  get: (id: string) => api.get<QueueGroup>(`/queues/${id}`),
  update: (id: string, data: Partial<QueueGroup>) =>
    api.patch<QueueGroup>(`/queues/${id}`, data),
  delete: (id: string) => api.delete(`/queues/${id}`),

  listTickets: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Ticket[]>(`/queues/tickets/list${qs}`);
  },
  issueTicket: (data: { queue_group_id: string; branch_id: string; customer_id?: string; priority?: number; notes?: string; is_online?: boolean }) =>
    api.post<Ticket>("/queues/tickets/issue", data),
  callNext: (counter_id: string) =>
    api.post<Ticket>("/queues/tickets/call-next", { counter_id }),
  startServing: (id: string) =>
    api.patch<Ticket>(`/queues/tickets/${id}/serve`),
  getTicket: (id: string) => api.get<Ticket>(`/queues/tickets/${id}`),
  completeTicket: (id: string) => api.patch<Ticket>(`/queues/tickets/${id}/complete`),
  recallTicket: (id: string) => api.patch<Ticket>(`/queues/tickets/${id}/recall`),
  noShow: (id: string) => api.patch<Ticket>(`/queues/tickets/${id}/no-show`),
  cancelTicket: (id: string) => api.patch<Ticket>(`/queues/tickets/${id}/cancel`),
  transferTicket: (id: string, data: { to_counter_id?: string; to_queue_group_id?: string; notes?: string }) =>
    api.patch<Ticket>(`/queues/tickets/${id}/transfer`, data),
  assignTicket: (id: string, data: { counter_id?: string; served_by_id?: string }) =>
    api.post<Ticket>(`/queues/tickets/${id}/assign`, data),
};
