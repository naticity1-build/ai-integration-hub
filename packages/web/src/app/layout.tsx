import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Integration Hub",
  description: "Secure multi-tenant bridge between enterprise data and AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
