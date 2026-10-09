import { act, fireEvent, render, screen } from '@testing-library/react';
import i18n from 'i18next';
import { useState, type ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { initI18n } from '../../i18n/init';
import { lightTheme } from '../../theme/themes';
import { EmptyState } from './EmptyState';
import { ListWithPanel } from './ListWithPanel';
import { PAGE_SIZE, Pager, pageItems } from './Pager';
import { SlideOverEditor } from './SlideOverEditor';
import { UndoToast } from './UndoToast';
import { WarningDialog } from './WarningDialog';

beforeAll(async () => {
  await initI18n();
  await i18n.changeLanguage('en');
});
afterEach(() => vi.useRealTimers());

const themed = (ui: ReactElement) => render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);

describe('UndoToast', () => {
  it('calls back on Undo', () => {
    const onUndo = vi.fn();
    themed(<UndoToast message="Rina confirmed" onUndo={onUndo} onDismiss={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it('closes after 6 seconds', () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    themed(<UndoToast message="Rina confirmed" onUndo={vi.fn()} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(5900);
    });
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('keeps its live region when there is no message', () => {
    themed(<UndoToast message={null} onUndo={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });
});

describe('WarningDialog', () => {
  it('continues anyway with the default label', () => {
    const onContinue = vi.fn();
    const onCancel = vi.fn();
    themed(
      <WarningDialog title="Delete Rendang?" onCancel={onCancel} onContinue={onContinue}>
        3 people ordered Rendang.
      </WarningDialog>,
    );
    expect(screen.getByRole('alertdialog', { name: 'Delete Rendang?' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue anyway' }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('cancels with the button and with Escape, and starts on the safe button', () => {
    const onCancel = vi.fn();
    themed(
      <WarningDialog
        title="Delete Rendang?"
        cancelLabel="Keep dish"
        continueLabel="Delete anyway"
        onCancel={onCancel}
        onContinue={vi.fn()}
      >
        3 people ordered Rendang.
      </WarningDialog>,
    );
    expect(screen.getByRole('button', { name: 'Keep dish' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Keep dish' }));
    fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });

  it('speaks Indonesian', async () => {
    await i18n.changeLanguage('id');
    themed(
      <WarningDialog title="Hapus?" onCancel={vi.fn()} onContinue={vi.fn()}>
        x
      </WarningDialog>,
    );
    expect(screen.getByRole('button', { name: 'Lanjutkan saja' })).toBeInTheDocument();
    await i18n.changeLanguage('en');
  });
});

describe('SlideOverEditor', () => {
  it('closes at once when nothing changed', () => {
    const onCancel = vi.fn();
    themed(
      <SlideOverEditor title="Edit Rendang" onCancel={onCancel} onSave={vi.fn()}>
        fields
      </SlideOverEditor>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it('asks before closing with unsaved changes, and Keep editing stays', () => {
    const onCancel = vi.fn();
    themed(
      <SlideOverEditor title="Edit Rendang" dirty onCancel={onCancel} onSave={vi.fn()}>
        fields
      </SlideOverEditor>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Keep editing' }));
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: 'Discard changes' }));
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe('Pager', () => {
  const items = Array.from({ length: 64 }, (_, index) => index);

  it('slices pages of 20', () => {
    expect(PAGE_SIZE).toBe(20);
    expect(pageItems(items, 3)).toHaveLength(4);
  });

  it('shows "21–40 of 64" and moves with Next / Previous', () => {
    function Host() {
      const [page, setPage] = useState(1);
      return <Pager page={page} total={64} onPage={setPage} />;
    }
    themed(<Host />);
    expect(screen.getByText('21–40 of 64')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Next/ }));
    expect(screen.getByText('41–60 of 64')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Previous/ }));
    expect(screen.getByText('21–40 of 64')).toBeInTheDocument();
  });

  it('renders nothing for one page', () => {
    const { container } = themed(<Pager page={0} total={20} onPage={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ListWithPanel', () => {
  it('keeps the list mounted but hidden while a phone shows the panel, and Back returns', () => {
    const onBack = vi.fn();
    themed(
      <ListWithPanel
        stacked
        onBack={onBack}
        list={<p>the list</p>}
        panel={<p>the detail</p>}
        panelLabel="Order detail"
      />,
    );
    expect(screen.getByText('the list').parentElement).toHaveAttribute('hidden');
    fireEvent.click(screen.getByRole('button', { name: /Back/ }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});

describe('EmptyState', () => {
  it('marks each step with an icon and a word', () => {
    themed(
      <EmptyState
        title="No menu yet"
        steps={[
          { id: 'a', label: 'Add pictures', done: true },
          { id: 'b', label: 'Make a menu', done: false },
        ]}
      />,
    );
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('To do')).toBeInTheDocument();
  });
});
