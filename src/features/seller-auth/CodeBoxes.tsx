import { useId, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { cleanCode } from './authText';
import { AUTH_NS } from './i18n/register';
import { ErrorText } from './parts';

export const CODE_BOXES = 6;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Label = styled.span`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Row = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Box = styled.input<{ $invalid: boolean }>`
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  height: 3.5rem;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $invalid }) => ($invalid ? theme.c.danger : theme.c.ctrl)};
  border-radius: ${({ theme }) => theme.size.radiusControl / 16}rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font-family: ${({ theme }) => theme.font.mono};
  font-size: 1.5rem;
  font-weight: 600;
  text-align: center;
`;

export type CodeBoxesProps = Readonly<{
  /** Digits so far (0 to 6 of them). */
  value: string;
  onChange: (next: string) => void;
  label: string;
  error?: string | undefined;
}>;

/** Six one-digit boxes: typing moves on, Backspace moves back, a pasted code fills them all. */
export function CodeBoxes({ value, onChange, label, error }: CodeBoxesProps) {
  const { t } = useTranslation(AUTH_NS);
  const labelId = useId();
  const boxes = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: CODE_BOXES }, (_, index) => value[index] ?? '');

  const focus = (index: number) =>
    boxes.current[Math.min(Math.max(index, 0), CODE_BOXES - 1)]?.focus();

  // Put `typed` into the boxes from `from` on; the cursor lands after the last digit placed.
  const place = (from: number, typed: string) => {
    const clean = cleanCode(typed);
    if (clean === '') return;
    const next = (value.slice(0, from).padEnd(from, ' ') + clean).slice(0, CODE_BOXES);
    onChange(next.replaceAll(' ', ''));
    focus(from + clean.length);
  };

  const onBoxChange = (index: number) => (event: ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    if (raw === '') {
      onChange(value.slice(0, index) + value.slice(index + 1));
      return;
    }
    // A box that already held a digit now holds two: take what was just typed.
    place(index, cleanCode(raw).length > 1 ? cleanCode(raw).replace(digits[index] ?? '', '') : raw);
  };

  const onKeyDown = (index: number) => (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace' && digits[index] === '') {
      event.preventDefault();
      onChange(value.slice(0, Math.max(0, index - 1)) + value.slice(index));
      focus(index - 1);
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      focus(index - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      focus(index + 1);
    }
  };

  const onPaste = (index: number) => (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    // A pasted code is the whole code, wherever the cursor was.
    const pasted = cleanCode(event.clipboardData.getData('text'));
    place(pasted.length >= CODE_BOXES ? 0 : index, pasted);
  };

  return (
    <Wrap role="group" aria-labelledby={labelId}>
      <Label id={labelId}>{label}</Label>
      <Row>
        {digits.map((digit, index) => (
          <Box
            key={index} // the boxes never reorder
            ref={(node) => {
              boxes.current[index] = node;
            }}
            $invalid={error !== undefined}
            value={digit}
            inputMode="numeric"
            autoComplete={index === 0 ? 'one-time-code' : 'off'}
            aria-label={t('code.digit', { n: index + 1, total: CODE_BOXES })}
            aria-invalid={error !== undefined ? true : undefined}
            onChange={onBoxChange(index)}
            onKeyDown={onKeyDown(index)}
            onPaste={onPaste(index)}
            onFocus={(event) => event.target.select()}
          />
        ))}
      </Row>
      {error ? <ErrorText>{error}</ErrorText> : null}
    </Wrap>
  );
}
