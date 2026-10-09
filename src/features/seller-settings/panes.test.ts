import { describe, expect, it } from 'vitest';
import { PANE_IDS, SECOND_GROUP, paneHref, parsePane } from './panes';

describe('panes', () => {
  it('lists the eight panes, with Chefs, Devices and Backup in the second group', () => {
    expect(PANE_IDS).toEqual([
      'kitchen',
      'post',
      'pickup',
      'defaults',
      'look',
      'chefs',
      'devices',
      'backup',
    ]);
    expect(SECOND_GROUP).toEqual(['chefs', 'devices', 'backup']);
  });

  it('parses a pane from the URL and builds its href', () => {
    expect(parsePane('look')).toBe('look');
    expect(parsePane('images')).toBeNull();
    expect(parsePane(undefined)).toBeNull();
    expect(paneHref('pickup')).toBe('/seller/settings/pickup');
  });
});
