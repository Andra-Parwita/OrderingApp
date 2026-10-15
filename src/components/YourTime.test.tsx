import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { afterEach, describe, expect, it } from 'vitest';
import { setViewedKitchenZone } from '../../shared/zone';
import { lightTheme } from '../theme/themes';
import { YourTime } from './YourTime';

// The tests' device is in Adelaide (vitest.config.ts).
const show = (kitchenZone?: string) =>
  render(
    <ThemeProvider theme={lightTheme}>
      <YourTime label="your time" kitchenZone={kitchenZone} />
    </ThemeProvider>,
  );

afterEach(() => setViewedKitchenZone('Australia/Adelaide'));

describe('the "your time" label', () => {
  it('is not shown when the device is in the kitchen zone', () => {
    show('Australia/Adelaide');
    expect(screen.queryByText('your time')).toBeNull();
  });

  it('is shown when the zones differ', () => {
    show('Asia/Jakarta');
    expect(screen.getByText('your time')).toBeInTheDocument();
  });

  it('follows the kitchen on screen when no zone is given', () => {
    const { unmount } = show();
    expect(screen.queryByText('your time')).toBeNull();
    unmount();
    setViewedKitchenZone('Asia/Jakarta');
    show();
    expect(screen.getByText('your time')).toBeInTheDocument();
  });
});
