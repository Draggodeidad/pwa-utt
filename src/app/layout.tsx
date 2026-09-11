import type { Metadata, Viewport } from "next";
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
  maximumScale: 1
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
