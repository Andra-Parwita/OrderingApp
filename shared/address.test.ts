import { describe, expect, it } from 'vitest';
import { textDirectionsUrl, textMapUrl } from './address';

describe('free-text address links', () => {
  it('builds Google and Apple directions and map-search links from the text', () => {
    const text = ' 5 Rundle St, Kent Town 5067 ';
    const q = encodeURIComponent('5 Rundle St, Kent Town 5067');
    expect(textDirectionsUrl(text)).toBe(`https://www.google.com/maps/dir/?api=1&destination=${q}`);
    expect(textDirectionsUrl(text, true)).toBe(`https://maps.apple.com/?daddr=${q}`);
    expect(textMapUrl(text)).toBe(`https://www.google.com/maps/search/?api=1&query=${q}`);
    expect(textMapUrl(text, true)).toBe(`https://maps.apple.com/?q=${q}`);
  });
});
