import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import { Button, type ButtonVariant } from './Button';

export type ConfirmButtonProps = Readonly<{
  label: string;
  /** Shown after the first tap, e.g. "Tap again to confirm". */
  confirmLabel: string;
  onConfirm: () => void;
  variant?: ButtonVariant;
  fullWidth?: boolean;
  disabled?: boolean;
  /** Test/harness hook: start already armed. */
  initiallyArmed?: boolean;
}>;

const ARM_MS = 3000;

export function ConfirmButton({
  label,
  confirmLabel,
  onConfirm,
  variant = 'secondary',
  fullWidth,
  disabled,
  initiallyArmed = false,
}: ConfirmButtonProps) {
  const [armed, setArmed] = useState(initiallyArmed);

  useEffect(() => {
    if (!armed) return undefined;
    const timer = window.setTimeout(() => setArmed(false), ARM_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const onClick = useCallback(() => {
    if (armed) {
      setArmed(false);
      onConfirm();
    } else {
      setArmed(true);
    }
  }, [armed, onConfirm]);

  const reset = useCallback(() => setArmed(false), []);
  const onKeyDown = useCallback((event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'Escape') setArmed(false);
  }, []);

  return (
    <Button
      variant={armed ? 'destructive' : variant}
      fullWidth={fullWidth}
      disabled={disabled}
      onClick={onClick}
      onBlur={reset}
      onKeyDown={onKeyDown}
    >
      {armed ? confirmLabel : label}
    </Button>
  );
}
