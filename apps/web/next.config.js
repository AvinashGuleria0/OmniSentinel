/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@omnisentinel/shared'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**',
      },
    ],
  },
};

module.exports = nextConfig;
