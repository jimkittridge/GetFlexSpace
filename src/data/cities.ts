export interface CitySpecs {
  ceilingHeight: string;
  power: string;
  doorSize: string;
  hvac: string;
  suiteRange: string;
}

export interface CityFAQ {
  question: string;
  answer: string;
}

export interface TenantProfile {
  title: string;
  description: string;
}

export interface CityData {
  slug: string;
  name: string;
  state: string;
  fullName: string;
  availability: 'available' | 'full';
  availableUnits?: string;
  specs: CitySpecs;
  mapEmbedUrl: string;
  seo: {
    title: string;
    description: string;
  };
  localGuide: {
    heading: string;
    paragraphs: string[];
    nearbyHighways: string[];
    airport: string;
    submarkets: string[];
    demandDrivers: string[];
  };
  tenantProfiles: TenantProfile[];
  faq: CityFAQ[];
  schema: {
    address: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    geo: { lat: number; lng: number };
    phone: string;
  };
}

export const cities: CityData[] = [
  {
    slug: 'asheville-nc',
    name: 'Asheville',
    state: 'NC',
    fullName: 'Asheville, NC',
    availability: 'full',
    specs: {
      ceilingHeight: '18–24 ft clear',
      power: '200A 3-Phase',
      doorSize: "12' × 14' Drive-In",
      hvac: 'Full HVAC',
      suiteRange: '1,000–3,000 sq ft',
    },
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d104379.1!2d-82.6!3d35.6!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8859f36e2a989!2sAsheville%2C+NC!5e0!3m2!1sen!2sus!4v1',
    seo: {
      title: 'Flex Space for Lease in Asheville, NC | 1,000–3,000 SF | GetFlexSpace',
      description: 'Lease small bay flex space in Asheville, NC. 1,000–3,000 SF suites with drive-in doors, clear heights, HVAC, and 24/7 access. Get availability and pricing.',
    },
    localGuide: {
      heading: 'Why Asheville, NC',
      paragraphs: [
        'Asheville is a strong market for small bay flex users who need access to Western North Carolina, reliable road connections, and a practical base for operations. These suites are well suited for contractors, service businesses, local distribution, light industrial users, and growing companies that do not need a large warehouse footprint.',
        'With access to major routes including I-26 and I-40, Asheville offers connectivity across the region while still serving dense local demand. Businesses can efficiently reach surrounding communities, job sites, customers, and suppliers throughout the greater Asheville area.',
        'For companies that need flexible industrial space with functional loading, clear heights, and manageable square footage, Asheville can be a strong fit.',
      ],
      nearbyHighways: ['I-26', 'I-40', 'I-240', 'US-74'],
      airport: 'Asheville Regional Airport (AVL) – 10 min',
      submarkets: ['Biltmore area', 'South Asheville', 'Arden', 'Fletcher', 'Hendersonville corridor'],
      demandDrivers: ['Access to I-26 and I-40', 'Well positioned for Western NC service area', 'Strong fit for contractor, service, and light industrial users', 'Ideal for businesses needing 1,000–3,000 SF'],
    },
    tenantProfiles: [
      { title: 'Contractors & Trades', description: 'Space for tools, materials, vehicles, and daily dispatch.' },
      { title: 'E-Commerce & Fulfillment', description: 'Ideal for inventory storage, packing, shipping, and local distribution.' },
      { title: 'Light Manufacturing', description: 'A practical option for assembly, fabrication, and production uses.' },
      { title: 'Service Businesses', description: 'Good for plumbing, HVAC, electrical, cleaning, and field-based operations.' },
      { title: 'Showroom + Warehouse', description: 'A fit for businesses that need both storage and customer-facing space.' },
      { title: 'Creative / Industrial', description: 'Useful for makers, production users, and other businesses that need flexible industrial space.' },
    ],
    faq: [
      {
        question: 'What size suites are typically available?',
        answer: 'Most suites are between 1,000 and 3,000 square feet, depending on the property and current turnover.',
      },
      {
        question: 'What types of businesses are a good fit?',
        answer: 'These suites are often a strong fit for contractors, e-commerce users, service businesses, light manufacturing, and warehouse-style operations.',
      },
      {
        question: 'Are suites always immediately available?',
        answer: 'Not always. Many suites lease quickly, so we encourage businesses to submit their requirements to receive current matches and upcoming openings.',
      },
      {
        question: 'Can I request pricing even if nothing is available today?',
        answer: 'Yes. Submit your business details, size range, and timing, and we\'ll respond with relevant options when there is a fit.',
      },
      {
        question: 'How quickly can I get a response?',
        answer: 'We respond to all qualified inquiries within 1 business day, typically sooner.',
      },
      {
        question: 'Do you offer tours?',
        answer: 'Yes. When there is a likely fit, we can move to the next step and discuss a tour or application.',
      },
    ],
    schema: {
      address: { street: '100 Flex Way', city: 'Asheville', state: 'NC', zip: '28801' },
      geo: { lat: 35.5951, lng: -82.5515 },
      phone: '+19806002520',
    },
  },
  {
    slug: 'durham-nc',
    name: 'Durham',
    state: 'NC',
    fullName: 'Durham, NC',
    availability: 'available',
    availableUnits: '1 Unit Available – 2,500 sq ft',
    specs: {
      ceilingHeight: '20–24 ft clear',
      power: '400A 3-Phase',
      doorSize: "14' × 14' Drive-In",
      hvac: 'Full HVAC',
      suiteRange: '1,500–3,000 sq ft',
    },
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d103574.8!2d-78.9!3d35.99!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x89ace46d3bdb!2sDurham%2C+NC!5e0!3m2!1sen!2sus!4v1',
    seo: {
      title: 'Flex Space for Lease in Durham, NC | 1,500–3,000 SF | GetFlexSpace',
      description: 'Lease small bay flex space in Durham, NC. 1,500–3,000 SF suites with drive-in doors, 400A 3-phase power, and 24/7 access. Minutes from RTP. Get availability and pricing.',
    },
    localGuide: {
      heading: 'Why Durham, NC',
      paragraphs: [
        'Durham is one of the strongest markets in North Carolina for small bay flex users. Positioned at the center of the Research Triangle, these suites give your business access to a fast-growing metro, deep logistics infrastructure, and a customer base that spans the Triangle and beyond.',
        'Demand for small bay industrial space in Durham is driven by construction activity, e-commerce fulfillment, and a growing base of service and light manufacturing businesses. The area\'s proximity to RTP, Duke University, and RDU Airport creates a steady pipeline of operators who need professional, functional space.',
        'For businesses that need high ceilings, heavy power, and drive-in access without committing to a large warehouse, Durham offers some of the strongest flex suites in the Carolinas.',
      ],
      nearbyHighways: ['I-40', 'I-85', 'NC-147', 'US-70'],
      airport: 'RDU International Airport – 15 min',
      submarkets: ['South Durham', 'RTP corridor', 'East Durham', 'Chapel Hill border', 'Morrisville area'],
      demandDrivers: ['Research Triangle Park proximity', 'Duke University & medical center', 'Tech & biotech growth corridor', 'Residential construction surge', 'RDU airport logistics'],
    },
    tenantProfiles: [
      { title: 'Contractors & Trades', description: 'Space for tools, materials, vehicles, and daily dispatch across the Triangle.' },
      { title: 'E-Commerce & Fulfillment', description: 'Ideal for inventory storage, packing, and shipping across NC and VA.' },
      { title: 'Light Manufacturing', description: 'High ceilings and 400A 3-phase power for assembly and production workflows.' },
      { title: 'Biotech & Scientific Services', description: 'Support and equipment operations near RTP and Duke.' },
      { title: 'Service Businesses', description: 'Combined warehouse and office space for field-based operations.' },
      { title: 'Showroom + Warehouse', description: 'A fit for businesses that need storage and customer-facing space in one location.' },
    ],
    faq: [
      {
        question: 'What size suites are typically available?',
        answer: 'Most suites are between 1,500 and 3,000 square feet. These are the strongest-spec suites in our portfolio, with 20–24 ft ceilings and 400A 3-phase power.',
      },
      {
        question: 'What types of businesses are a good fit?',
        answer: 'These suites work well for contractors, e-commerce operators, light manufacturers, biotech support services, and businesses that need combined warehouse and office space.',
      },
      {
        question: 'Is there space available now in Durham?',
        answer: 'Yes—we currently have availability in Durham. Submit your requirements for pricing and to schedule a tour.',
      },
      {
        question: 'How close is this to Research Triangle Park?',
        answer: 'Minutes from RTP, with direct access to I-40 and NC-147. RDU International Airport is approximately 15 minutes away.',
      },
      {
        question: 'How quickly can I get a response?',
        answer: 'We respond to all qualified inquiries within 1 business day, typically sooner.',
      },
      {
        question: 'Do you offer tours?',
        answer: 'Yes. When there is a likely fit, we can move to the next step and discuss a tour or application.',
      },
    ],
    schema: {
      address: { street: '200 Industrial Blvd', city: 'Durham', state: 'NC', zip: '27701' },
      geo: { lat: 35.994, lng: -78.8986 },
      phone: '+19806002520',
    },
  },
  {
    slug: 'columbia-sc',
    name: 'Columbia',
    state: 'SC',
    fullName: 'Columbia, SC',
    availability: 'full',
    specs: {
      ceilingHeight: '18–22 ft clear',
      power: '200A 3-Phase',
      doorSize: "12' × 14' Drive-In",
      hvac: 'Full HVAC',
      suiteRange: '1,000–2,500 sq ft',
    },
    mapEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d106042.4!2d-81.1!3d34.0!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x88f8a5b4!2sColumbia%2C+SC!5e0!3m2!1sen!2sus!4v1',
    seo: {
      title: 'Flex Space for Lease in Columbia, SC | 1,000–2,500 SF | GetFlexSpace',
      description: 'Lease small bay flex space in Columbia, SC. 1,000–2,500 SF suites with drive-in doors, high ceilings, and 24/7 access. I-26, I-77, and I-20 corridor. Get availability and pricing.',
    },
    localGuide: {
      heading: 'Why Columbia, SC',
      paragraphs: [
        'Columbia sits at the intersection of I-26, I-77, and I-20—three major interstates that make it one of the best-connected logistics points in the Southeast. Businesses in these suites can reach Charlotte, Charleston, Atlanta, and Savannah within a few hours, making it a practical base for regional distribution and service operations.',
        'As South Carolina\'s capital, Columbia offers a stable economy, affordable operating costs, and a growing workforce. The metro has attracted steady industrial and distribution investment, creating strong demand for small bay flex space from contractors, service businesses, and fulfillment operators.',
        'For operators who need professional industrial space with drive-in access, high ceilings, and manageable square footage, Columbia is a strong fit.',
      ],
      nearbyHighways: ['I-26', 'I-77', 'I-20', 'US-1'],
      airport: 'Columbia Metropolitan Airport (CAE) – 15 min',
      submarkets: ['Cayce/West Columbia', 'Northeast Columbia', 'Irmo area', 'Forest Acres', 'Lexington corridor'],
      demandDrivers: ['Interstate logistics hub (I-26/I-77/I-20)', 'State government & university', 'Fort Jackson military base', 'Southeast distribution corridor'],
    },
    tenantProfiles: [
      { title: 'Contractors & Trades', description: 'Space for tools, materials, and daily dispatch across the Midlands.' },
      { title: 'Distribution & Fulfillment', description: 'Leverage the I-26/I-77/I-20 corridor for regional shipping and logistics.' },
      { title: 'Light Manufacturing', description: 'A practical option for assembly, fabrication, and production uses.' },
      { title: 'Service Businesses', description: 'Combined warehouse and office space for field-based operations.' },
      { title: 'Government & Military', description: 'Support contractors serving state government and Fort Jackson.' },
      { title: 'Showroom + Warehouse', description: 'A fit for businesses that need both storage and customer-facing space.' },
    ],
    faq: [
      {
        question: 'What size suites are typically available?',
        answer: 'Most suites are between 1,000 and 2,500 square feet, with 18–22 ft clear height ceilings and drive-in door access.',
      },
      {
        question: 'What types of businesses are a good fit?',
        answer: 'These suites work well for contractors, distribution operators, service businesses, light manufacturers, and government support contractors.',
      },
      {
        question: 'Are suites always immediately available?',
        answer: 'Not always. Many suites lease quickly, so we encourage businesses to submit their requirements to receive current matches and upcoming openings.',
      },
      {
        question: 'Can I request pricing even if nothing is available today?',
        answer: 'Yes. Submit your business details, size range, and timing, and we\'ll respond with relevant options when there is a fit.',
      },
      {
        question: 'How quickly can I get a response?',
        answer: 'We respond to all qualified inquiries within 1 business day, typically sooner.',
      },
      {
        question: 'Do you offer tours?',
        answer: 'Yes. When there is a likely fit, we can move to the next step and discuss a tour or application.',
      },
    ],
    schema: {
      address: { street: '300 Commerce Dr', city: 'Columbia', state: 'SC', zip: '29201' },
      geo: { lat: 34.0007, lng: -81.0348 },
      phone: '+19806002520',
    },
  },
];

export function getCityBySlug(slug: string): CityData | undefined {
  return cities.find(city => city.slug === slug);
}
