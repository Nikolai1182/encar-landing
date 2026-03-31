import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright", "playwright-core", "@sparticuz/chromium"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "ci.encar.com", pathname: "/**" },
      { protocol: "https", hostname: "www.encar.com", pathname: "/**" },
    ],
  },
};

export default nextConfig;
