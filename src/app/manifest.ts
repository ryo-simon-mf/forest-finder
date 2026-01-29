import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Forest Finder',
    short_name: 'Forest Finder',
    description: '近くの森林までの距離を表示するアプリ',
    start_url: '/',
    display: 'standalone',
    background_color: '#1a1a1a',
    theme_color: '#22c55e',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
    ],
  }
}
