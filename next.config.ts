
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'placehold.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  experimental: {
    allowedDevOrigins: ["https://9003-firebase-studio-1760725187143.cluster-gizzoza7hzhfyxzo5d76y3flkw.cloudworkstations.dev", "https://9004-firebase-studio-1760725187143.cluster-gizzoza7hzhfyxzo5d76y3flkw.cloudworkstations.dev"],
  }
};

export default nextConfig;
