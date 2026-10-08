import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lightTheme } from '../theme/themes';
import { ConfirmButton } from './ConfirmButton';
import { Pill } from './Pill';
import { Segmented, type SegmentedOption } from './Segmented';
import { Stepper } from './Stepper';
import { TabBar } from './TabBar';
import { TextField } from './TextField';

function renderThemed(ui: ReactElement) {
  return render(<ThemeProvider theme={lightTheme}>{ui}</ThemeProvider>);
}

afterEach(() => vi.useRealTimers());

describe('Stepper', () => {
  function Harness({ max }: { max: number }) {
    const [value, setValue] = useState(1);
    return (
      <Stepper
        label="Lemper"
        decreaseLabel="Less"
        increaseLabel="More"
        value={value}
        onChange={setValue}
        min={0}
        max={max}
      />
    );
  }

  it('has labelled buttons and respects min and max', () => {
    renderThemed(<Harness max={2} />);
    const less = screen.getByRole('button', { name: 'Less' });
    const more = screen.getByRole('button', { name: 'More' });
    expect(screen.getByRole('group', { name: 'Lemper' })).toBeInTheDocument();
    fireEvent.click(more);
    expect(screen.getByRole('status')).toHaveTextContent('2');
    expect(more).toBeDisabled();
    fireEvent.click(less);
    fireEvent.click(less);
    expect(screen.getByRole('status')).toHaveTextContent('0');
    expect(less).toBeDisabled();
  });

  it('disables both buttons when disabled', () => {
    renderThemed(
      <Stepper
        label="x"
        decreaseLabel="Less"
        increaseLabel="More"
        value={1}
        onChange={vi.fn()}
        disabled
      />,
    );
    expect(screen.getByRole('button', { name: 'Less' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'More' })).toBeDisabled();
  });
});

describe('Segmented', () => {
  const options: ReadonlyArray<SegmentedOption<'a' | 'b' | 'c'>> = [
    { value: 'a', label: 'A' },
    { value: 'b', label: 'B' },
    { value: 'c', label: 'C' },
  ];
  function Harness() {
    const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
    return <Segmented options={options} value={value} onChange={setValue} label="Pick" />;
  }

  it('uses roving tabindex and arrow keys select and move focus', () => {
    renderThemed(<Harness />);
    const a = screen.getByRole('radio', { name: 'A' });
    const b = screen.getByRole('radio', { name: 'B' });
    expect(a).toHaveAttribute('tabindex', '0');
    expect(b).toHaveAttribute('tabindex', '-1');
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    expect(b).toHaveAttribute('aria-checked', 'true');
    expect(b).toHaveFocus();
    fireEvent.keyDown(b, { key: 'ArrowLeft' });
    fireEvent.keyDown(a, { key: 'ArrowLeft' });
    expect(screen.getByRole('radio', { name: 'C' })).toHaveAttribute('aria-checked', 'true');
  });
});

describe('ConfirmButton', () => {
  it('fires only on the second tap', () => {
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton label="Cancel order" confirmLabel="Tap again" onConfirm={onConfirm} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Cancel order' }));
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Tap again' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Cancel order' })).toBeInTheDocument();
  });

  it('resets on Escape, on blur and after the timeout', () => {
    vi.useFakeTimers();
    const onConfirm = vi.fn();
    renderThemed(
      <ConfirmButton label="Cancel order" confirmLabel="Tap again" onConfirm={onConfirm} />,
    );
    const click = () => fireEvent.click(screen.getByRole('button'));
    click();
    fireEvent.keyDown(screen.getByRole('button'), { key: 'Escape' });
    expect(screen.getByRole('button')).toHaveTextContent('Cancel order');
    click();
    fireEvent.blur(screen.getByRole('button'));
    expect(screen.getByRole('button')).toHaveTextContent('Cancel order');
    click();
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByRole('button')).toHaveTextContent('Cancel order');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('TabBar', () => {
  it('renders a disabled tab as inert text with an accessible hint', () => {
    renderThemed(
      <TabBar
        label="Seller"
        activeId="a"
        items={[
          { id: 'a', label: 'Orders', href: '/seller' },
          { id: 'b', label: 'Cook list', href: '#b', disabled: true, hint: 'coming soon' },
        ]}
      />,
    );
    expect(screen.getByRole('link', { name: 'Orders' })).toHaveAttribute('href', '/seller');
    const inert = screen.getByRole('link', { name: 'Cook list, coming soon' });
    expect(inert).toHaveAttribute('aria-disabled', 'true');
    expect(inert).not.toHaveAttribute('href');
  });
});

describe('TextField', () => {
  it('links error and helper through aria-describedby and shows the counter', () => {
    renderThemed(
      <TextField
        label="Name"
        helper="Shown on the order"
        error="Required"
        value="Ri"
        onChange={vi.fn()}
        maxLength={200}
        showCounter
      />,
    );
    const input = screen.getByLabelText('Name');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAccessibleDescription('Required Shown on the order');
    expect(screen.getByText('2/200')).toBeInTheDocument();
  });

  it('has no description or invalid flag without helper or error', () => {
    renderThemed(<TextField label="Name" value="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Name');
    expect(input).not.toHaveAttribute('aria-describedby');
    expect(input).not.toHaveAttribute('aria-invalid');
  });
});

describe('Pill', () => {
  it('renders its text', () => {
    renderThemed(<Pill tone="ready">Ready</Pill>);
    expect(screen.getByText('Ready')).toBeInTheDocument();
  });
});
