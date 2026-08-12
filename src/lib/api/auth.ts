import { api, setTokens, clearTokens } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  type: "platform_user" | "company_user";
  company_id?: string;
  branch_id?: string;
  default_counter_id?: string;
  roles?: string[];
  roleTypes?: string[];
  company?: { id: string; name: string; slug: string };
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// The backend returns { success: true, data: LoginResponse }.
// apiRequest already unwraps the envelope so res.data === LoginResponse.
export const authApi = {
  platformLogin: async (email: string, password: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>("/auth/platform/login", { email, password });
    const payload = res.data;
    if (!payload?.accessToken) {
      // Backend might nest under a second `data` key — handle both shapes
      const nested = (payload as unknown as { data?: LoginResponse })?.data;
      if (nested?.accessToken) {
        setTokens(nested.accessToken, nested.refreshToken);
        return nested;
      }
      throw new Error("Invalid login response from server");
    }
    setTokens(payload.accessToken, payload.refreshToken);
    return payload;
  },

  companyLogin: async (email: string, password: string, companySlug?: string): Promise<LoginResponse> => {
    const res = await api.post<LoginResponse>("/auth/company/login", { email, password, companySlug });
    const payload = res.data;
    if (!payload?.accessToken) {
      const nested = (payload as unknown as { data?: LoginResponse })?.data;
      if (nested?.accessToken) {
        setTokens(nested.accessToken, nested.refreshToken);
        return nested;
      }
      throw new Error("Invalid login response from server");
    }
    setTokens(payload.accessToken, payload.refreshToken);
    return payload;
  },

  logout: async () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("qms_refresh_token") : null;
    try {
      await api.post("/auth/logout", { refreshToken: token });
    } finally {
      clearTokens();
    }
  },

  me: async (): Promise<AuthUser> => {
    const res = await api.get<AuthUser>("/auth/me");
    // Handle both { id, email, ... } and { data: { id, email, ... } }
    const payload = res.data;
    if ((payload as unknown as { id?: string })?.id) return payload;
    const nested = (payload as unknown as { data?: AuthUser })?.data;
    if (nested?.id) return nested;
    return payload;
  },
};
