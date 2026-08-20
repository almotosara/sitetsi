import type { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: 'https://alagoasmotos.netlify.app',
      changeFrequency: 'monthly',
      priority: 1,
    },
  ]
}
