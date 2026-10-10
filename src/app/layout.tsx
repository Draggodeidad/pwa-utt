import type { Metadata, Viewport } from "next";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import { SessionMemory } from "@/components/pwa/session-memory";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspecciones | Laboratorio U.",
  description: "Operación de inspecciones para laboratorios de cómputo universitarios",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Inspecciones"
  },
  icons: {
    icon: "/icons/icon.svg",
    apple: "/apple-touch-icon.png"
  }
};

export const viewport: Viewport = {
  themeColor: "#1B3737",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>
        {children}
        <ServiceWorkerRegistration />
        <SessionMemory />
      </body>
    </html>
  );
}
