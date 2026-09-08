import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspecciones | Acceso institucional",
  description: "Acceso institucional para inspecciones de laboratorios universitarios"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
