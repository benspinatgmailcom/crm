"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/auth-context";

const navItems = [
  { href: "/accounts", label: "Accounts" },
  { href: "/contacts", label: "Contacts" },
  { href: "/leads", label: "Leads" },
  { href: "/opportunities", label: "Opportunities" },
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
    }
  }, [isAuthenticated, isLoading, router]);

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
      <aside className="w-56 flex-shrink-0 border-r border-gray-200 bg-gray-50">
        <div className="flex h-full flex-col">
          <div className="border-b border-gray-200 p-4">
            <Link href="/" className="text-lg font-semibold text-gray-900">
              CRM
            </Link>
          </div>
          <nav className="flex-1 space-y-0.5 p-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  pathname === item.href
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-14 items-center justify-between border-b border-gray-200 bg-white px-4">
          <div className="flex-1" />
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">{user?.email}</span>
            <button
              onClick={() => logout()}
              className="rounded-md px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
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
