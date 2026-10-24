import { useCallback, useRef, type KeyboardEvent } from 'react';
import { styled } from 'styled-components';
import { Icon, type SegmentedOption } from '../../ui';

/** Phones: below this width the three options stack as full-width rows. */
const NARROW = '(max-width: 40rem)';

type Props<T extends string> = Readonly<{
  options: ReadonlyArray<SegmentedOption<T> & { aria?: string }>;
  value: T;
  onChange: (next: T) => void;
  label: string;
  /** Greyed and out of the tab order; the chosen value is kept. */
  disabled?: boolean;
}>;

const Group = styled.div<{ $kind: 'list' | 'grid' }>`
  display: ${({ $kind }) => ($kind === 'grid' ? 'grid' : 'flex')};
  ${({ $kind }) =>
    $kind === 'grid' ? 'grid-template-columns: repeat(6, minmax(0, 1fr));' : 'flex-direction: row;'}
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;

  @media ${NARROW} {
    ${({ $kind }) => ($kind === 'list' ? 'flex-direction: column;' : '')}
  }
`;

const Option = styled.button<{ $selected: boolean; $kind: 'list' | 'grid' }>`
  display: flex;
  align-items: center;
  justify-content: ${({ $kind }) => ($kind === 'grid' ? 'center' : 'space-between')};
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: 0;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: ${({ theme, $selected }) => ($selected ? theme.colour.accent : 'transparent')};
  color: ${({ theme, $selected }) => ($selected ? theme.colour.onAccent : theme.colour.text)};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    background: ${({ theme, $selected }) => ($selected ? theme.c.surf2 : 'transparent')};
    color: ${({ theme }) => theme.c.ctrl};
    cursor: default;
  }
  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
  svg {
    width: 1.125rem;
    height: 1.125rem;
    flex: none;
    display: none;
  }
  @media ${NARROW} {
    ${({ $kind, theme }) =>
      $kind === 'list'
        ? `border-top: 1px solid ${theme.colour.outline}; &:first-child { border-top: 0; }
           svg { display: block; }`
        : ''}
  }
`;

/**
 * A radio group: "list" is the three options (a row on tablets, one per row with a check on
 * phones); "grid" is the minutes row, six equal buttons that show only the number.
 */
export function MessageChoices<T extends string>({
  kind,
  options,
  value,
  onChange,
  label,
  disabled = false,
}: Props<T> & { kind: 'list' | 'grid' }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (step === 0 || disabled) return;
      event.preventDefault();
      const current = options.findIndex((option) => option.value === value);
      const next = options[(current + step + options.length) % options.length];
      if (!next) return;
      onChange(next.value);
      refs.current.get(next.value)?.focus();
    },
    [options, value, onChange, disabled],
  );
  return (
    <Group
      role="radiogroup"
      aria-label={label}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      $kind={kind}
    >
      {options.map((option) => (
        <Option
          key={option.value}
          ref={(node) => {
            if (node) refs.current.set(option.value, node);
            else refs.current.delete(option.value);
          }}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          aria-label={option.aria}
          disabled={disabled}
          tabIndex={option.value === value && !disabled ? 0 : -1}
          $selected={option.value === value}
          $kind={kind}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {kind === 'list' && option.value === value ? <Icon name="check" /> : null}
        </Option>
      ))}
    </Group>
  );
}
