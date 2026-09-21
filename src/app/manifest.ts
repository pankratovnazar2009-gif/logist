import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pozna.logist",
    short_name: "Pozna.logist",
    description: "Ładunki i przewoźnicy — dopasowanie w czasie rzeczywistym",
    start_url: "/",
    display: "standalone",
    background_color: "#f5f7fb",
    theme_color: "#1d4fd6",
    lang: "pl",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
