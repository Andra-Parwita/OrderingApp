import { act, fireEvent, render, screen } from '@testing-library/react';
import { useState, type ReactElement } from 'react';
import { ThemeProvider } from 'styled-components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lightTheme } from '../theme/themes';
import { ConfirmButton } from './ConfirmButton';
import { ImageSlot } from './ImageSlot';
import { Pill } from './Pill';
import { Segmented, type SegmentedOption } from './Segmented';
import { Stepper } from './Stepper';
import { TabBar } from './TabBar';
import { TextField } from './TextField';
import { Tooltip } from './Tooltip';

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

describe('Tooltip', () => {
  it('shows its text on hover and on focus, closes on Escape, and is a no-op without text', () => {
    renderThemed(
      <Tooltip text="Orders">
        <a href="/x">Orders link</a>
      </Tooltip>,
    );
    const link = screen.getByRole('link', { name: 'Orders link' });
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    fireEvent.focus(link);
    expect(screen.getByText('Orders')).toHaveAttribute('aria-hidden', 'true');
    fireEvent.keyDown(link, { key: 'Escape' });
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
    fireEvent.blur(link);
    fireEvent.mouseEnter(link);
    expect(screen.getByText('Orders')).toBeInTheDocument();
    fireEvent.mouseLeave(link);
    expect(screen.queryByText('Orders')).not.toBeInTheDocument();
  });

  it('renders just the children without text', () => {
    renderThemed(
      <Tooltip>
        <span>plain</span>
      </Tooltip>,
    );
    fireEvent.focus(screen.getByText('plain'));
    expect(screen.getByText('plain').parentElement?.tagName).toBe('DIV');
  });
});

describe('ImageSlot', () => {
  it('shows the placeholder label, named by its alt, when there is no image', () => {
    const { container } = renderThemed(
      <ImageSlot
        aspectRatio="5 / 2"
        alt="Kitchen banner"
        placeholder="Banner image — coming soon"
      />,
    );
    expect(screen.getByRole('img', { name: 'Kitchen banner' })).toBeInTheDocument();
    expect(screen.getByText('Banner image — coming soon')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the image with its alt text, lazily loaded, and keeps the aspect ratio', () => {
    renderThemed(
      <ImageSlot aspectRatio="5 / 1" src="/samples/x.jpg" alt="Onde Onde" placeholder="soon" />,
    );
    const img = screen.getByRole('img', { name: 'Onde Onde' });
    expect(img).toHaveAttribute('src', '/samples/x.jpg');
    expect(img).toHaveAttribute('loading', 'lazy');
    expect(screen.queryByText('soon')).toBeNull();
    // jsdom drops aspect-ratio from computed styles, so the slot also exposes it as data.
    expect(img.parentElement).toHaveAttribute('data-ratio', '5 / 1');
  });

  it('never crops by default: contain fit on a background colour, never stretched', () => {
    renderThemed(
      <ImageSlot
        aspectRatio="2 / 1"
        background="#835937"
        src="/samples/x.jpg"
        alt="Onde Onde"
        placeholder="soon"
      />,
    );
    const img = screen.getByRole('img', { name: 'Onde Onde' });
    expect(img).toHaveStyle({ objectFit: 'contain' });
    expect(img.parentElement).toHaveAttribute('data-fit', 'contain');
    expect(img.parentElement).toHaveStyle({ background: 'rgb(131, 89, 55)' });
  });

  it('crops only when asked to, and rounds into a circle', () => {
    renderThemed(
      <ImageSlot aspectRatio="1 / 1" fit="cover" round src="/i.png" alt="Icon" placeholder="" />,
    );
    const img = screen.getByRole('img', { name: 'Icon' });
    expect(img).toHaveStyle({ objectFit: 'cover' });
    expect(img.parentElement).toHaveStyle({ borderRadius: '50%' });
  });
});
