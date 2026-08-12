import { api } from "./client";

export interface AuditLog {
  id: string;
  company_id?: string;
  actor_type?: string;
  action: string;
  entity_type?: string;
  entity_id?: string;
  branch_id?: string;
  ip_address?: string;
  user_agent?: string;
  before_state?: unknown;
  after_state?: unknown;
  metadata?: unknown;
  created_at: string;
  company_user?: { id: string; first_name: string; last_name: string; email: string };
  platform_user?: { id: string; first_name: string; last_name: string; email: string };
}

export const auditApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<AuditLog[]>(`/audit-logs${qs}`);
  },
};
