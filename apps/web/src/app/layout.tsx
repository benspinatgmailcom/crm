import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProviderWrapper } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { env } from "@/lib/env";

const themeColor = env.NEXT_PUBLIC_ACCENT_1.startsWith("#") ? env.NEXT_PUBLIC_ACCENT_1 : "#2563eb";

export const metadata: Metadata = {
  title: "CRM",
  description: "AI-native CRM",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon.ico", sizes: "any" },
    ],
    apple: "/apple-touch-icon.png",
  },
  manifest: "/site.webmanifest",
};

export const viewport: Viewport = {
  themeColor,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">
        <ThemeProvider>
          <AuthProviderWrapper>{children}</AuthProviderWrapper>
        </ThemeProvider>
      </body>
    </html>
  );
}
