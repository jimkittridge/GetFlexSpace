export const UNIT_SIZES = [
  { value: '500-1000', label: '500–1,000' },
  { value: '1000-1500', label: '1,000–1,500' },
  { value: '1500-2000', label: '1,500–2,000' },
  { value: '2000+', label: '2,000+' },
];

export function unitSizeLabel(value) {
  const size = UNIT_SIZES.find(size => size.value === value);
  return size ? `${size.label} sq ft` : 'Not provided';
}
