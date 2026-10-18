import { fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it, vi } from 'vitest';
import { lightTheme } from '../theme/themes';
import { Notice } from './Notice';

function renderNotice(ui: React.ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

describe('Notice', () => {
  it('is polite by default and an alert for errors', () => {
    const { rerender } = renderNotice(<Notice tone="warn">Paused</Notice>);
    expect(screen.getByRole('status')).toHaveTextContent('Paused');
    rerender(
      <ThemeProvider theme={lightTheme}>
        <Notice tone="error">Failed</Notice>
      </ThemeProvider>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Failed');
  });

  it('shows the action and calls it', () => {
    const onClick = vi.fn();
    renderNotice(
      <Notice tone="info" action={{ label: 'Retry', onClick }}>
        Offline
      </Notice>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
