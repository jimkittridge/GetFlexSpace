import { getImage } from 'astro:assets';
import type { ImageMetadata } from 'astro';

// Keep the CMS-selected image as the source, and ship compressed, sized images.
const images = import.meta.glob<{ default: ImageMetadata }>(
  '/public/images/*.{png,jpg,jpeg,JPG,PNG,webp}', { eager: true },
);

export async function homepageImage(path: string, width = 1200) {
  const source = images[`/public${path}`]?.default;
  if (!source) return path;
  const image = await getImage({ src: source, width, format: 'webp', quality: 80 });
  return image.src;
}

export function portfolioRange(ranges: string[]) {
  const sizes = ranges.flatMap(range => (range.match(/[\d,]+/g) || [])
    .map(size => Number(size.replaceAll(',', ''))).filter(size => size > 0));
  if (!sizes.length) return 'Suite sizes vary by location';
  return `${Math.min(...sizes).toLocaleString('en-US')}–${Math.max(...sizes).toLocaleString('en-US')} sq ft`;
}

// JSON-LD and client data are embedded in script elements, not HTML markup.
export function scriptJson(value: unknown) {
  return JSON.stringify(value).replaceAll('<', '\\u003c');
}
