import { fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { describe, expect, it } from 'vitest';
import { lightTheme } from '../theme/themes';
import { SlideOver } from './SlideOver';
import { Table, TableCell, TableRow } from './Table';

function renderThemed(ui: ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

describe('Table', () => {
  it('has labelled column headers and rows that open with Enter or a click', () => {
    const opened: Array<string> = [];
    renderThemed(
      <Table
        label="Things"
        columns={[
          { id: 'a', header: 'Name' },
          { id: 'b', header: 'Total', align: 'end' },
        ]}
      >
        <TableRow rowId="r1" onOpen={(id) => opened.push(id)}>
          <TableCell strong>One</TableCell>
          <TableCell align="end">$1</TableCell>
        </TableRow>
      </Table>,
    );
    expect(screen.getByRole('table', { name: 'Things' })).toBeInTheDocument();
    expect(screen.getAllByRole('columnheader')).toHaveLength(2);
    const row = screen.getByRole('row', { name: /One/ });
    expect(row).toHaveAttribute('tabindex', '0');
    fireEvent.keyDown(row, { key: 'Enter' });
    fireEvent.click(row);
    expect(opened).toEqual(['r1', 'r1']);
  });
});

describe('SlideOver', () => {
  function Harness() {
    const [open, setOpen] = useState(false);
    return (
      <>
        <button type="button" onClick={() => setOpen(true)}>
          Open it
        </button>
        {open ? (
          <SlideOver label="Details" closeLabel="Close" onClose={() => setOpen(false)}>
            <button type="button">Inside</button>
          </SlideOver>
        ) : null}
      </>
    );
  }

  it('is a modal dialog: focus goes in, Escape closes, focus returns to the opener', () => {
    renderThemed(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open it' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Details' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('closes with its labelled Close button', () => {
    renderThemed(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Open it' }));
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
