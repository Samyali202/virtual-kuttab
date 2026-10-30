/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export — nginx serves `out/`; ASR proxied at /asr
  output: "export",
  // Avoid Windows "spawn UNKNOWN" during static page generation
  experimental: {
    cpus: 1,
    workerThreads: false,
  },
};

export default nextConfig;
