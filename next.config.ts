
import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  // Force Node.js to resolve Firebase using its `node` export instead of
  // Turbopack loading the browser bundle, which calls localStorage at module level.
  serverExternalPackages: ['firebase', '@firebase/auth', '@firebase/firestore', '@firebase/app'],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
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
};

export default nextConfig;
