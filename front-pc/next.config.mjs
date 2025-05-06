/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  experimental: {
    appDir: true,
    largePageDataBytes: 128 * 100000,
  },
};

export default nextConfig;
