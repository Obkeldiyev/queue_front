import { api } from "./client";

export interface Menu {
  id: string;
  company_id: string;
  parent_id?: string | null;
  name: string;
  label?: string;
  icon_class?: string;
  url?: string | null;
  page_id?: string | null;
  queue_group_id?: string | null;
  target?: "_blank" | "_self";
  sort_order: number;
  is_visible: boolean;
  requires_auth: boolean;
  children?: Menu[];
  queue_group?: {
    id: string;
    name_uz: string;
    name_ru?: string;
    name_en?: string;
    prefix: string;
  } | null;
}

export const menusApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Menu[]>(`/menus${qs}`);
  },

  create: (data: Partial<Menu> & { name: string }) =>
    api.post<Menu>("/menus", data),

  update: (id: string, data: Partial<Menu>) =>
    api.patch<Menu>(`/menus/${id}`, data),

  delete: (id: string) => api.delete(`/menus/${id}`),

  reorder: (items: Array<{ id: string; sort_order: number }>) =>
    api.patch("/menus/reorder", { items }),
};
