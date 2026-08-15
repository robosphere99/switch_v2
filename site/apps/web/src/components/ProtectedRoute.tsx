import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export function ProtectedRoute({
  children,
  adminOnly = false,
  customerOnly = false,
}: {
  children: ReactNode;
  /** Sirf system_admin ke liye (redirect /login for others). */
  adminOnly?: boolean;
  /** Customer pages — system_admin ko /admin pe bhejo (admin khud nahi kharidta). */
  customerOnly?: boolean;
}) {
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  if (!accessToken) return <Navigate to="/login" replace />;
  if (adminOnly && user?.role !== "system_admin") return <Navigate to="/login" replace />;
  if (customerOnly && user?.role === "system_admin") return <Navigate to="/admin" replace />;
  return <>{children}</>;
}
