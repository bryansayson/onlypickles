import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Only Pickles",
    short_name: "Only Pickles",
    description: "Pickleball round robin scheduler",
    start_url: "/",
    display: "standalone",
    background_color: "#09090b",
    theme_color: "#09090b",
    orientation: "portrait",
    icons: [
      { src: "/icon?size=192", sizes: "192x192", type: "image/png" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon?size=512", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
