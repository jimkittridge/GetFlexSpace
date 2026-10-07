import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const locations = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/locations' }),
  schema: z.object({
    name: z.string(),
    state: z.string(),
    fullName: z.string(),
    slug: z.string(),
    propertyType: z.enum(['flex', 'retail']).nullish().transform(v => v ?? 'flex'),
    tenantAccess: z.string().nullish().transform(v => v || '24/7'),
    heroLogo: z.string().nullish().transform(v => v || ''),
    availability: z.enum(['available', 'coming-soon', 'full']),
    availableUnits: z.string().optional().default(''),
    image: z.string().optional().default(''),
    gallery: z.array(z.string()).optional().default([]),
    seo: z.object({
      title: z.string(),
      description: z.string(),
    }),
    specs: z.object({
      ceilingHeight: z.string(),
      power: z.string(),
      doorSize: z.string(),
      hvac: z.string(),
      suiteRange: z.string(),
      lease: z.string().optional().default('1–3 years'),
    }),
    mapEmbedUrl: z.string().nullish().transform(v => v?.trim() || ''),
    localGuide: z.object({
      heading: z.string(),
      nearbyHighways: z.array(z.string()),
      airport: z.string(),
      submarkets: z.array(z.string()),
      demandDrivers: z.array(z.string()),
    }),
    tenantProfiles: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })),
    suites: z.array(z.object({
      name: z.string(),
      size: z.string(),
      status: z.enum(['available', 'waitlist']),
      description: z.string(),
      baseRent: z.string().optional().default(''),
      media: z.array(z.object({
        image: z.string(),
        label: z.string(),
        type: z.enum(['photo', 'floor-plan']).default('photo'),
      })).nullish().transform(v => v ?? []),
      brochure: z.string().nullish(),
    })).optional().default([]),
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })),
    schema: z.object({
      address: z.object({
        street: z.string(),
        city: z.string(),
        state: z.string(),
        zip: z.string(),
      }),
      geo: z.object({
        lat: z.number(),
        lng: z.number(),
      }).nullish(),
      phone: z.string(),
    }),
    tagline: z.string().optional().default(''),
    homepageCardTitle: z.string().nullish().transform(v => v?.trim() || ''),
    homepageDescription: z.string().nullish().transform(v => v || ''),
    heroH1: z.string().optional().default(''),
    heroSubtitle: z.string().optional().default(''),
    suitesHeading: z.string().optional().default(''),
    suitesSubheading: z.string().optional().default(''),
    tenantProfilesLabel: z.string().optional().default(''),
    tenantProfilesHeading: z.string().optional().default(''),
    tenantProfilesSubheading: z.string().optional().default(''),
    specsHeading: z.string().optional().default(''),
    specsSubheading: z.string().optional().default(''),
    faqHeading: z.string().optional().default(''),
    ctaHeading: z.string().optional().default(''),
    ctaSubheading: z.string().optional().default(''),
    galleryAltTexts: z.array(z.string()).optional().default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    seo: z.object({
      title: z.string(),
      description: z.string(),
    }),
    hero: z.object({
      headline: z.string(),
      subheadline: z.string().optional(),
    }).optional(),
    // Homepage fields
    heroBackgroundImage: z.string().optional(),
    // Sveltia CMS writes `null` (or an empty string) when these are cleared in
    // the admin UI. Zod's .default() only fills in for `undefined`, so a cleared
    // field would fail validation and break the build — coerce explicitly.
    heroOverlayColor: z.string().nullish().transform((v) => v || '#000000'),
    heroOverlayOpacity: z.number().nullish().transform((v) => v ?? 55),
    logo: z.string().optional(),
    bullets: z.array(z.string()).optional(),
    stats: z.array(z.object({
      label: z.string(),
      value: z.string(),
    })).optional(),
    citySection: z.object({
      heading: z.string(),
      subheading: z.string(),
    }).optional(),
    useCases: z.object({
      heading: z.string(),
      subheading: z.string(),
      items: z.array(z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
      })),
    }).optional(),
    highlights: z.object({
      heading: z.string(),
      subheading: z.string(),
      items: z.array(z.object({
        number: z.string(),
        label: z.string(),
      })),
    }).optional(),
    process: z.object({
      heading: z.string(),
      subheading: z.string(),
      steps: z.array(z.object({
        title: z.string(),
        description: z.string(),
      })),
    }).optional(),
    leadStrip: z.object({
      heading: z.string(),
      subheading: z.string(),
    }).optional(),
    faq: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    finalCta: z.object({
      heading: z.string(),
      subheading: z.string(),
    }).optional(),
    // About fields
    heroImage: z.string().optional(),
    values: z.array(z.object({
      title: z.string(),
      description: z.string(),
    })).optional(),
    cta: z.object({
      heading: z.string(),
      subheading: z.string(),
    }).optional(),
    // FAQ page fields
    items: z.array(z.object({
      question: z.string(),
      answer: z.string(),
    })).optional(),
    // Contact fields
    email: z.string().optional(),
    phone: z.string().optional(),
    phoneHref: z.string().optional(),
    officeHours: z.string().optional(),
    tenantAccess: z.string().optional(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    date: z.string(),
    categories: z.array(z.string()),
    image: z.string().optional().default(''),
    imageAlt: z.string().optional().default(''),
    author: z.string().optional().default('GetFlexSpace'),
  }),
});

export const collections = { locations, pages, blog };
