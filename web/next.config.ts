import type { NextConfig } from "next";

// Sitio 100 % estático: `next build` deja todo en web/out/ (HTML + JSON), sin servidor.
// Se publica en Vercel, Netlify o cualquier hosting estático.
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true }, // las fotos vienen de iNaturalist con su crédito; no se procesan
};

export default nextConfig;
