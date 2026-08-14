import { api } from "./client";

export interface Employee {
  id: string;
  company_id: string;
  branch_id?: string;
  default_counter_id?: string;
  allowed_service_ids?: string[] | null;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  status: string;
  last_login_at?: string;
  created_at: string;
  roles?: Array<{ company_role: { id: string; name: string; type: string } }>;
  branch?: { id: string; name: string };
}

export interface CompanyRole {
  id: string;
  company_id: string;
  name: string;
  type: string;
  description?: string;
  is_system: boolean;
  permissions?: Array<{ company_permission: { id: string; code: string; name: string; module: string } }>;
}

export const employeesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Employee[]>(`/employees${qs}`);
  },

  create: (data: {
    first_name: string;
    last_name: string;
    email: string;
    password: string;
    branch_id?: string;
    phone?: string;
    role_ids?: string[];
    company_id?: string;
  }) => api.post<Employee>("/employees", data),

  get: (id: string) => api.get<Employee>(`/employees/${id}`),

  update: (id: string, data: Partial<Employee> & { password?: string }) =>
    api.patch<Employee>(`/employees/${id}`, data),

  delete: (id: string) => api.delete(`/employees/${id}`),

  listRoles: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<CompanyRole[]>(`/employees/roles/list${qs}`);
  },

  createRole: (data: {
    name: string;
    description?: string;
    permission_codes?: string[];
    company_id?: string;
  }) => api.post<CompanyRole>("/employees/roles", data),

  listPermissions: () => api.get("/employees/permissions/list"),
};
