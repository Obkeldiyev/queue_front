import { api } from "./client";

export interface Device {
  id: string;
  company_id: string;
  branch_id: string;
  counter_id?: string;
  device_type: "TICKET_KIOSK" | "TICKET_PRINTER" | "QUEUE_DISPLAY" | "COUNTER_DISPLAY" | "OPERATOR_KEYBOARD" | "QR_SCANNER" | "MEDIA_DISPLAY";
  name: string;
  serial_number?: string;
  ip_address?: string;
  mac_address?: string;
  firmware_version?: string;
  settings?: Record<string, unknown>;
  status: "ONLINE" | "OFFLINE" | "MAINTENANCE" | "UNREGISTERED";
  last_heartbeat?: string;
  created_at: string;
  branch?: { id: string; name: string };
  counter?: { id: string; name: string };
}

export const devicesApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Device[]>(`/devices${qs}`);
  },

  create: (data: Partial<Device> & { name: string; device_type: Device["device_type"]; branch_id: string }) =>
    api.post<Device & { auth_token: string }>("/devices", data),

  get: (id: string) => api.get<Device>(`/devices/${id}`),

  update: (id: string, data: Partial<Device>) =>
    api.patch<Device>(`/devices/${id}`, data),

  delete: (id: string) => api.delete(`/devices/${id}`),

  heartbeat: (id: string, data: { status: string; cpu_usage?: number; memory_usage?: number }) =>
    api.post<Device>(`/devices/${id}/heartbeat`, data),
};
