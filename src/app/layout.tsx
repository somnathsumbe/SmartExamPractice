import type { Metadata } from "next";
import type { Viewport } from "next";
import type { ReactNode } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap-icons/font/bootstrap-icons.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Smart Exam Practice", template: "%s | Smart Exam Practice" },
  description: "Smart learning. Better practice. Better preparation.",
  applicationName: "Smart Exam Practice",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "Smart Exam", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#28745c",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
