import { redirect } from "@tanstack/react-router";
import { getAccessToken } from "./api/client";
import { getUserFromStorage } from "./auth-store";

function hasSession(): boolean {
  const token = getAccessToken();
  const user = getUserFromStorage();
  const refreshToken =
    typeof window !== "undefined" ? localStorage.getItem("qms_refresh_token") : null;
  return !!(token || user || refreshToken);
}

export function requireCompanyUser() {
  if (!hasSession()) throw redirect({ to: "/login" as any });
  const user = getUserFromStorage();
  if (!user) return;
  if (user.type === "platform_user") throw redirect({ to: "/app/companies" as any });
}

export function isCompanyAdminRole(user = getUserFromStorage()): boolean {
  if (!user || user.type !== "company_user") return false;
  const roleTypes = user.roleTypes ?? [];
  return roleTypes.some((roleType) =>
    ["COMPANY_ADMIN", "BRANCH_MANAGER", "SUPERVISOR"].includes(roleType)
  );
}

export function isOperatorOnly(user = getUserFromStorage()): boolean {
  if (!user || user.type !== "company_user") return false;
  return !isCompanyAdminRole(user);
}

export function requireCompanyAdmin() {
  requireCompanyUser();
  if (isOperatorOnly()) throw redirect({ to: "/operator" as any });
}

export function requireSuperAdmin() {
  if (!hasSession()) throw redirect({ to: "/login" as any });
  const user = getUserFromStorage();
  if (!user) return;
  if (user.type === "company_user") throw redirect({ to: "/app" as any });
}

export function requireAuth() {
  if (!hasSession()) throw redirect({ to: "/login" as any });
}
