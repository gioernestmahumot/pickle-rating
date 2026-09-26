import type { MetadataRoute } from "next";

/** Lets phones add Pickle Rating to the home screen with its own icon. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Pickle Rating",
    short_name: "Pickle Rating",
    description: "Pickleball ratings for the Philippines, calculated from confirmed matches.",
    start_url: "/",
    display: "standalone",
    background_color: "#fbf7f1",
    theme_color: "#1b2a4a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
