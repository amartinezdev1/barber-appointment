import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {default:"Ritual · Tu próximo buen corte",template:"%s · Ritual"},
  description: "Reserva tu servicio, elige a tu barbero y encuentra el horario que va contigo.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
