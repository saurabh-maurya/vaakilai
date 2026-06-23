import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import { PlanGateProvider } from "@/contexts/PlanGateContext";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "VakilAI — India's Legal AI Platform",
  description:
    "Instant AI legal guidance, verified lawyer matching, and professional practice tools for India.",
  keywords: ["legal AI", "lawyer", "India law", "legal advice", "vakilai"],
  icons: { icon: "/favicon.ico" },
  openGraph: {
    title: "VakilAI",
    description: "Democratising access to justice in India",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body>
        <AuthProvider>
          <PlanGateProvider>
          {children}
          </PlanGateProvider>
          <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: "var(--vk-navy-light)",
                color: "var(--vk-text)",
                border: "1px solid var(--vk-border)",
                borderRadius: "0.75rem",
                fontSize: "0.875rem",
              },
              success: {
                iconTheme: { primary: "var(--vk-gold)", secondary: "var(--vk-navy)" },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}
