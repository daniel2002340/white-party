import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained build for `next start` on the VPS behind a reverse proxy.
  output: "standalone",
};

export default nextConfig;
