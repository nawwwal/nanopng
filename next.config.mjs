/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: true,
  },
  turbopack: {
    rules: {
      '*.wasm': {
        loaders: [],
        as: '*.webassembly',
      },
    },
  },
  // Webpack config (used for production builds)
  webpack: (config) => {
    config.experiments = {
      asyncWebAssembly: true,
      layers: true,
    };
    return config;
  },
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
      ],
    }];
  },
}

export default nextConfig