import { api } from "./client";

export interface DashboardData {
  today: {
    waiting: number;
    called: number;
    serving: number;
    completed: number;
    noShow: number;
    online: number;
    kiosk: number;
  };
  hourly: Array<{ hour: number; count: number }>;
  avg_wait_sec?: number;
  operatorPerformance?: Array<{
    operator_id: string;
    operator_name: string;
    completed_tickets: number;
    avg_service_sec?: number;
    avg_wait_sec?: number;
  }>;
  employeeHours?: Array<{
    employee_id: string;
    employee_name: string;
    hours_worked: number;
    sessions_count?: number;
    tickets_served?: number;
  }>;
}

export interface AnalyticsSnapshot {
  id: string;
  company_id: string;
  branch_id?: string;
  snapshot_date: string;
  total_tickets: number;
  completed_tickets: number;
  cancelled_tickets: number;
  no_show_tickets: number;
  online_tickets: number;
  avg_wait_time_sec?: number;
  avg_service_time_sec?: number;
  peak_hour?: number;
  total_orders: number;
  total_revenue?: number;
}

export const analyticsApi = {
  dashboard: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<DashboardData>(`/analytics/dashboard${qs}`);
  },

  snapshots: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<AnalyticsSnapshot[]>(`/analytics/snapshots${qs}`);
  },

  generateSnapshot: (data: { company_id?: string; date?: string }) =>
    api.post("/analytics/snapshots/generate", data),

  operatorStats: (operatorId: string, params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<any>(`/analytics/operator/${operatorId}${qs}`);
  },
};
