import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @blues-inc/notehub-js is CommonJS and talks HTTP through superagent.
  // Keeping it external stops the bundler from trying to trace it.
  serverExternalPackages: ["@blues-inc/notehub-js"],
};

export default nextConfig;
