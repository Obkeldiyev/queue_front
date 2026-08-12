import { api } from "./client";

export interface Product {
  id: string;
  company_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  discount_price?: number;
  sku?: string;
  preparation_time_mins?: number;
  sort_order: number;
  is_available: boolean;
  status: string;
  category?: { id: string; name: string };
  modifiers?: Array<{ id: string; name: string; price: number; is_required: boolean }>;
}

export interface Order {
  id: string;
  company_id: string;
  branch_id: string;
  customer_id?: string;
  order_number: string;
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  payment_method?: string;
  payment_status: string;
  status: "PENDING" | "ACCEPTED" | "PREPARING" | "READY" | "COMPLETED" | "CANCELLED" | "REFUNDED";
  notes?: string;
  completed_at?: string;
  created_at: string;
  items?: Array<{
    id: string;
    product: Product;
    quantity: number;
    unit_price: number;
    total_price: number;
    notes?: string;
  }>;
  customer?: { id: string; first_name?: string; last_name?: string; phone?: string };
  branch?: { id: string; name: string };
}

export const ordersApi = {
  list: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Order[]>(`/orders${qs}`);
  },

  create: (data: {
    company_id?: string;
    branch_id: string;
    customer_id?: string;
    items: Array<{ product_id: string; quantity: number; notes?: string }>;
    payment_method?: string;
    notes?: string;
  }) => api.post<Order>("/orders", data),

  get: (id: string) => api.get<Order>(`/orders/${id}`),

  updateStatus: (id: string, status: Order["status"]) =>
    api.patch<Order>(`/orders/${id}/status`, { status }),

  listProducts: (params?: Record<string, string>) => {
    const qs = params ? "?" + new URLSearchParams(params).toString() : "";
    return api.get<Product[]>(`/orders/products/list${qs}`);
  },

  createProduct: (data: Partial<Product> & { name: string; price: number }) =>
    api.post<Product>("/orders/products", data),
};
