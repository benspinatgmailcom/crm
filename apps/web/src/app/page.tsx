"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/auth-context";

export default function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (isAuthenticated) {
      if (user?.mustChangePassword) {
        router.replace("/change-password");
      } else if (user?.role === "GLOBAL_ADMIN") {
        router.replace("/platform");
      } else {
        router.replace("/accounts");
      }
    } else {
      router.replace("/login");
    }
  }, [isAuthenticated, isLoading, user?.mustChangePassword, user?.role, router]);

  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-gray-500">Redirecting...</p>
    </main>
  );
}
