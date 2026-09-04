import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Served with `next start` on the VPS behind a reverse proxy. Deliberately
  // NOT `output: "standalone"` — Next refuses to combine the two, and the
  // standalone bundle needs .next/static copied in beside server.js plus an
  // explicit working directory, both of which the host's process manager undoes.
};

export default nextConfig;
