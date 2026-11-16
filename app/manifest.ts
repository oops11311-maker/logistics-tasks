import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "물류자동화 업무",
    short_name: "물류업무",
    description: "물류자동화팀 업무 추적",
    start_url: "/",
    display: "standalone",
    background_color: "#efe8dc",
    theme_color: "#243027",
    lang: "ko",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
