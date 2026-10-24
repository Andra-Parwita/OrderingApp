import { describe, expect, it } from 'vitest';
import { PANE_IDS, SECOND_GROUP, paneHref, parsePane } from './panes';

describe('panes', () => {
  it('lists the eleven panes, with Chefs, Devices and Backup in the second group', () => {
    expect(PANE_IDS).toEqual([
      'link',
      'kitchen',
      'post',
      'pickup',
      'defaults',
      'look',
      'language',
      'chefs',
      'devices',
      'customers',
      'backup',
    ]);
    expect(SECOND_GROUP).toEqual(['chefs', 'devices', 'customers', 'backup']);
  });

  it('parses a pane from the URL and builds its href', () => {
    expect(parsePane('look')).toBe('look');
    expect(parsePane('images')).toBeNull();
    expect(parsePane(undefined)).toBeNull();
    expect(paneHref('pickup')).toBe('/seller/settings/pickup');
  });
});
