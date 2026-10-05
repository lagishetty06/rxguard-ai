import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["localhost:3000", "127.0.0.1:3000", "192.168.137.70"],
  async rewrites() {
    return [
      {
        source: "/audit-prescription",
        destination: "https://rxguard-ai-1.onrender.com/audit-prescription",
      },
      {
        source: "/api/audit-prescription",
        destination: "https://rxguard-ai-1.onrender.com/audit-prescription",
      },
      {
        source: "/verify-loose-pill",
        destination: "https://rxguard-ai-1.onrender.com/verify-loose-pill",
      },
      {
        source: "/api/verify-loose-pill",
        destination: "https://rxguard-ai-1.onrender.com/api/verify-loose-pill",
      },
    ];
  },
};

export default nextConfig;