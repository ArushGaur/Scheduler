// Soft tints for classes. Each subject always gets the same one.
const PALETTE = [
  { bg: '#DCEBE2', fg: '#1D4A39', bar: '#4C9A77' },
  { bg: '#E3E1F6', fg: '#34308A', bar: '#7870D4' },
  { bg: '#F5E2D5', fg: '#74381A', bar: '#D4854F' },
  { bg: '#D8E8F5', fg: '#17456D', bar: '#4E92CA' },
  { bg: '#F3DCE4', fg: '#762040', bar: '#CB5B83' },
  { bg: '#EFE9C8', fg: '#5A510F', bar: '#B9A82F' },
];

export function colorFor(name = '') {
  let h = 0;
  const s = name.toLowerCase().trim();
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}
