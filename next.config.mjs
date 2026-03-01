import withPWA from 'next-pwa'

const isGitHub = process.env.DEPLOY_TARGET === 'github'

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  basePath: isGitHub ? '/forest-finder' : '',
  assetPrefix: isGitHub ? '/forest-finder/' : '',
  images: { unoptimized: true },
  trailingSlash: true,
  env: {
    NEXT_PUBLIC_BASE_PATH: isGitHub ? '/forest-finder' : '',
  },
}

const config = withPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)

export default config
