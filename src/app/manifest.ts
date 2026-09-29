import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Smart Exam Practice",
    short_name: "Smart Exam",
    description: "Smart learning. Better practice. Better preparation.",
    start_url: "/dashboard",
    display: "standalone",
    background_color: "#f7f8f4",
    theme_color: "#28745c",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}