import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Inspecciones | Laboratorio U.",
  description: "Operación de inspecciones para laboratorios de cómputo universitarios"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es-MX">
      <body>{children}</body>
    </html>
  );
}
