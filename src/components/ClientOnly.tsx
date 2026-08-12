import { useEffect, useState, type ReactNode } from "react";

/**
 * Renders children only after the client has mounted.
 * Use this around any content that reads from localStorage / persisted stores
 * to avoid SSR/hydration mismatches.
 */
export function ClientOnly({
  children,
  fallback = null,
}: {
  children: ReactNode;
  fallback?: ReactNode;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? <>{children}</> : <>{fallback}</>;
}
