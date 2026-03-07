"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";
import { isGlobalAdmin } from "@/lib/roles";
import { Building2, LayoutDashboard, ShieldCheck } from "lucide-react";

export default function PlatformLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated) {
      router.replace("/login");
      return;
    }
    if (!isGlobalAdmin(user?.role)) {
      router.replace("/accounts");
    }
  }, [isAuthenticated, isLoading, user?.role, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <p className="text-white/80">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated || !isGlobalAdmin(user?.role)) {
    return null;
  }

  const navItems = [
    { href: "/platform", label: "Dashboard", icon: LayoutDashboard },
    { href: "/platform/tenants", label: "Tenants", icon: Building2 },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950">
      <aside className="w-56 flex-shrink-0 border-r border-white/10 bg-slate-900 shadow-lg">
        <div className="flex h-14 items-center border-b border-white/10 px-4">
          <Link
            href="/platform"
            className="flex items-center gap-2 font-semibold text-white"
          >
            <ShieldCheck className="h-5 w-5 text-white/90" />
            Platform Admin
          </Link>
        </div>
        <nav className="flex flex-col gap-0.5 p-3">
          {navItems.map((item) => {
            const isActive =
              item.href === "/platform"
                ? pathname === "/platform"
                : pathname?.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-white/15 text-white"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
          {user?.tenantId && (
            <Link
              href="/accounts"
              className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-white/60 hover:bg-white/5 hover:text-white/90"
            >
              Back to CRM
            </Link>
          )}
        </nav>
      </aside>
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center justify-end gap-4 border-b border-white/10 bg-slate-900/50 px-6 shadow-sm">
          <span className="text-sm text-white/80">{user?.email}</span>
          <button
            type="button"
            onClick={() => logout()}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 hover:bg-white/10 hover:text-white"
          >
            Logout
          </button>
        </header>
        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
