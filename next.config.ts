import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH === "/" ? "" : (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/u, "");

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath,
};

export default nextConfig;
