import type { Metadata } from "next";
import "./globals.css";
import { AuthProviderWrapper } from "@/components/auth-provider";

export const metadata: Metadata = {
  title: "CRM",
  description: "AI-native CRM",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <AuthProviderWrapper>{children}</AuthProviderWrapper>
      </body>
    </html>
  );
}
