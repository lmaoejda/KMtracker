import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "leaflet/dist/leaflet.css";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "KMtracker · Tracking de rutas", template: "%s · KMtracker" },
  description:
    "Web personal de tracking: marca puntos a mano, sigue tu posición GPS en tiempo real y consulta tus estadísticas.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0B100E",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
