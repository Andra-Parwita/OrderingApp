import { memo, useCallback } from 'react';
import { styled } from 'styled-components';

export type StepperProps = Readonly<{
  value: number;
  onChange: (next: number) => void;
  /** Accessible name of the whole control, e.g. the item name. */
  label: string;
  decreaseLabel: string;
  increaseLabel: string;
  min?: number;
  max?: number;
  disabled?: boolean;
}>;

const Group = styled.div`
  display: inline-flex;
  align-items: center;
`;

const StepButton = styled.button`
  width: ${({ theme }) => theme.minTapTarget};
  height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.lg};
  cursor: pointer;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Value = styled.output`
  min-width: ${({ theme }) => theme.spacing.xxl};
  text-align: center;
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export const Stepper = memo(function Stepper({
  value,
  onChange,
  label,
  decreaseLabel,
  increaseLabel,
  min = 0,
  max = Number.POSITIVE_INFINITY,
  disabled = false,
}: StepperProps) {
  const decrease = useCallback(() => onChange(Math.max(min, value - 1)), [onChange, min, value]);
  const increase = useCallback(() => onChange(Math.min(max, value + 1)), [onChange, max, value]);
  return (
    <Group role="group" aria-label={label}>
      <StepButton
        type="button"
        aria-label={decreaseLabel}
        disabled={disabled || value <= min}
        onClick={decrease}
      >
        −
      </StepButton>
      <Value aria-live="polite">{value}</Value>
      <StepButton
        type="button"
        aria-label={increaseLabel}
        disabled={disabled || value >= max}
        onClick={increase}
      >
        +
      </StepButton>
    </Group>
  );
});
