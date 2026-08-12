import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, clearTokens, type AuthUser } from "./api";
import { refreshTokens } from "./api/client";
import { useStore } from "./store";

interface AuthState {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hydrated: boolean;

  platformLogin: (email: string, password: string) => Promise<void>;
  companyLogin: (email: string, password: string, companySlug?: string) => Promise<void>;
  logout: () => Promise<void>;
  loadUser: () => Promise<void>;
  setUser: (user: AuthUser | null) => void;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      _hydrated: false,

      platformLogin: async (email, password) => {
        set({ isLoading: true });
        try {
          const res = await authApi.platformLogin(email, password);
          set({ user: res.user, isAuthenticated: true });
        } finally {
          set({ isLoading: false });
        }
      },

      companyLogin: async (email, password, companySlug) => {
        set({ isLoading: true });
        try {
          const res = await authApi.companyLogin(email, password, companySlug);
          set({ user: res.user, isAuthenticated: true });
          // Sync company + branch into UI store
          const store = useStore.getState();
          if (res.user.company_id) store.setCurrentCompany(res.user.company_id);
          if (res.user.branch_id) store.setCurrentBranch(res.user.branch_id);
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        try { await authApi.logout(); } catch { /* ignore network errors on logout */ }
        clearTokens();
        set({ user: null, isAuthenticated: false });
      },

      loadUser: async () => {
        if (typeof window === "undefined") return;

        const accessToken  = localStorage.getItem("qms_access_token");
        const refreshToken = localStorage.getItem("qms_refresh_token");

        // Nothing stored — not logged in
        if (!accessToken && !refreshToken) {
          set({ isLoading: false });
          return;
        }

        // No access token but refresh token exists → try to refresh first
        if (!accessToken && refreshToken) {
          const ok = await refreshTokens();
          if (!ok) {
            clearTokens();
            set({ user: null, isAuthenticated: false, isLoading: false });
            return;
          }
          // refreshTokens() stored the new access token — fall through to /me
        }

        // Validate access token with /auth/me
        set({ isLoading: true });
        try {
          const user = await authApi.me();
          set({ user, isAuthenticated: true });
          // Keep UI store in sync
          const store = useStore.getState();
          if (user.company_id) store.setCurrentCompany(user.company_id);
          if (user.branch_id) store.setCurrentBranch(user.branch_id);
        } catch {
          // /me failed — try persisted user as a fallback so UI doesn't flash logout
          const persisted = getUserFromStorage();
          if (persisted) {
            set({ user: persisted, isAuthenticated: true });
          } else {
            clearTokens();
            set({ user: null, isAuthenticated: false });
          }
        } finally {
          set({ isLoading: false });
        }
      },

      setUser: (user) => set({ user, isAuthenticated: !!user }),
      setHydrated: () => set({ _hydrated: true }),
    }),
    {
      name: "qms-auth-v1",
      partialize: (state) => ({ user: state.user, isAuthenticated: state.isAuthenticated }),
      skipHydration: true,
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    }
  )
);

export function getUserFromStorage(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("qms-auth-v1");
    if (!raw) return null;
    const data = JSON.parse(raw) as { state?: { user?: AuthUser } };
    return data.state?.user ?? null;
  } catch {
    return null;
  }
}
