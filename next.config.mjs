/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: ['192.168.254.125'],
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      '@radix-ui/react-tabs',
      '@radix-ui/react-select',
      'recharts',
    ],
  },
}

export default nextConfig
