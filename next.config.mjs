import withPWA from 'next-pwa'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: process.env.NODE_ENV === 'production' ? '/forest-finder' : '',
  assetPrefix: process.env.NODE_ENV === 'production' ? '/forest-finder/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
}

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)

export default config
