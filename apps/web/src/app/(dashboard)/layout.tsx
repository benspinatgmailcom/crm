"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useAuth } from "@/context/auth-context";
import { isAdmin } from "@/lib/roles";
import { ApiStatus } from "@/components/api-status";
import { GlobalSearch } from "@/components/global-search";
import { QuickCreateDropdown } from "@/components/quick-create-dropdown";
import { env } from "@/lib/env";

const logoUrl = env.NEXT_PUBLIC_LOGO_URL || null;

const navItems = [
  { href: "/accounts", label: "Accounts" },
  { href: "/contacts", label: "Contacts" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
  { href: "/settings/users", label: "Settings", adminOnly: true },
];


export default function DashboardLayout({
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
    if (user?.mustChangePassword) {
      router.replace("/change-password");
    }
  }, [isAuthenticated, isLoading, user?.mustChangePassword, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside className="relative w-56 flex-shrink-0 border-r border-white/10 bg-slate-950 shadow-[4px_0_12px_rgba(0,0,0,0.15)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-accent-1/10 before:via-transparent before:to-accent-2/10">
        <div className="relative flex h-full flex-col">
          <div className="flex h-14 shrink-0 items-center border-b border-white/10 px-6">
            <Link href="/" className="group flex items-center gap-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-1/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 rounded">
              {logoUrl ? (
                <Image
                  src={logoUrl}
                  alt="Logo"
                  width={120}
                  height={32}
                  className="logo-glow-hover h-8 w-auto max-h-[34px] object-contain transition-[filter] duration-200 ease-out"
                  unoptimized={logoUrl.startsWith("http")}
                />
              ) : (
                <span className="text-lg font-semibold text-white">CRM</span>
              )}
            </Link>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-4 py-3">
            {navItems.map((item) => {
              const adminOnly = "adminOnly" in item && item.adminOnly;
              if (adminOnly && !isAdmin(user?.role)) return null;
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-1/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                    isActive
                      ? "bg-accent-1/15 text-accent-1"
                      : "text-white/80 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAdmin(user?.role) && (
              <Link
                href="/dev"
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-1/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 ${
                  pathname === "/dev"
                    ? "bg-accent-1/15 text-accent-1"
                    : "text-white/80 hover:bg-white/5 hover:text-white"
                }`}
              >
                Dev Tools
              </Link>
            )}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="relative flex h-14 items-center justify-between gap-4 border-b border-white/10 bg-slate-950 px-6 shadow-[0_2px_8px_rgba(0,0,0,0.08)] before:pointer-events-none before:absolute before:inset-0 before:bg-gradient-to-r before:from-accent-1/8 before:via-transparent before:to-accent-2/8">
          <ApiStatus className="text-white/80" />
          <div className="flex-1" />
          <GlobalSearch />
          <QuickCreateDropdown />
          <div className="relative flex items-center gap-4">
            <span className="text-sm text-white/80">{user?.email}</span>
            <button
              onClick={() => logout()}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-white/80 transition-colors hover:bg-white/5 hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-1/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              Logout
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-6">{children}</main>
      </div>
    </div>
  );
}
