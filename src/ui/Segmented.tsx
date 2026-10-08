import { memo, useCallback, useRef, type KeyboardEvent } from 'react';
import { styled } from 'styled-components';

export type SegmentedOption<T extends string> = Readonly<{ value: T; label: string }>;

export type SegmentedProps<T extends string> = Readonly<{
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (next: T) => void;
  /** Accessible name of the radio group. */
  label: string;
}>;

const Group = styled.div`
  display: inline-flex;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  overflow: hidden;
`;

const Option = styled.button<{ $selected: boolean }>`
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  background: ${({ theme, $selected }) => ($selected ? theme.colour.accent : 'transparent')};
  color: ${({ theme, $selected }) => ($selected ? theme.colour.onAccent : theme.colour.text)};
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;

  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;

type OptionButtonProps = Readonly<{
  value: string;
  label: string;
  selected: boolean;
  onSelect: (value: string) => void;
  register: (value: string, node: HTMLButtonElement | null) => void;
}>;

const OptionButton = memo(function OptionButton({
  value,
  label,
  selected,
  onSelect,
  register,
}: OptionButtonProps) {
  const setRef = useCallback(
    (node: HTMLButtonElement | null) => register(value, node),
    [register, value],
  );
  const onClick = useCallback(() => onSelect(value), [onSelect, value]);
  return (
    <Option
      ref={setRef}
      type="button"
      role="radio"
      aria-checked={selected}
      tabIndex={selected ? 0 : -1}
      $selected={selected}
      onClick={onClick}
    >
      {label}
    </Option>
  );
});

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: SegmentedProps<T>) {
  const refs = useRef(new Map<string, HTMLButtonElement>());

  const register = useCallback((key: string, node: HTMLButtonElement | null) => {
    if (node) refs.current.set(key, node);
    else refs.current.delete(key);
  }, []);

  const select = useCallback(
    (key: string) => {
      const option = options.find((candidate) => candidate.value === key);
      if (option) onChange(option.value);
    },
    [options, onChange],
  );

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (step === 0) return;
      event.preventDefault();
      const current = options.findIndex((option) => option.value === value);
      const next = options[(current + step + options.length) % options.length];
      if (!next) return;
      onChange(next.value);
      refs.current.get(next.value)?.focus();
    },
    [options, value, onChange],
  );

  return (
    <Group role="radiogroup" aria-label={label} onKeyDown={onKeyDown}>
      {options.map((option) => (
        <OptionButton
          key={option.value}
          value={option.value}
          label={option.label}
          selected={option.value === value}
          onSelect={select}
          register={register}
        />
      ))}
    </Group>
  );
}
