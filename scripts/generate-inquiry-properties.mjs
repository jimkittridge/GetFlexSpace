import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import yaml from 'js-yaml';
import { inquiryProperty } from '../src/lib/inquiry-property.js';

const directory = new URL('../src/content/locations/', import.meta.url);
const properties = readdirSync(directory).filter(file => file.endsWith('.md')).sort().map(file => {
  const source = readFileSync(new URL(file, directory), 'utf8');
  const frontmatter = source.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1];
  if (!frontmatter) throw new Error(`Missing location frontmatter: ${file}`);
  return yaml.load(frontmatter);
}).filter(data => data.published !== false).map(inquiryProperty);
if (new Set(properties.map(property => property.slug)).size !== properties.length) throw new Error('Duplicate property slug');
mkdirSync(new URL('../server/generated/', import.meta.url), { recursive: true });
writeFileSync(new URL('../server/generated/inquiry-properties.json', import.meta.url), `${JSON.stringify(properties, null, 2)}\n`);
console.log(`Prepared inquiry details for ${properties.length} published properties.`);
