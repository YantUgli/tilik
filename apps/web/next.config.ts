import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Jangan biarkan `next dev` menulis AGENTS.md ke working tree.
  agentRules: false,
};

export default nextConfig;
