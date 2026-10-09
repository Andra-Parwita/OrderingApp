import { describe, expect, it } from 'vitest';
import { cssUrl } from './cssUrl';

describe('cssUrl', () => {
  it('quotes own-app paths and image data URLs', () => {
    expect(cssUrl('/images/sellers/s1/railIcon-0123456789abcdef.png')).toBe(
      'url("/images/sellers/s1/railIcon-0123456789abcdef.png")',
    );
    expect(cssUrl('/samples/banner-wide.jpg')).toBe('url("/samples/banner-wide.jpg")');
    expect(cssUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(
      'url("data:image/png;base64,iVBORw0KGgo=")',
    );
  });

  it('cannot be broken out of, and refuses other schemes', () => {
    for (const bad of [
      '/images/x")} body{display:none} a{b:url("',
      '/images/x\\")',
      '/images/x\ny',
      '/samples/../secret',
      'javascript:alert(1)',
      'https://evil.test/x.png',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      '',
    ]) {
      expect(cssUrl(bad)).toBe('none');
    }
    expect(cssUrl(undefined)).toBe('none');
  });
});
