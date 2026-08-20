import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/', '/auth/login'],
      disallow: ['/admin/', '/api/', '/tv/'],
    },
    sitemap: 'https://alagoasmotos.netlify.app/sitemap.xml',
  }
}
