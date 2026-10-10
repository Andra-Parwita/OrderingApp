import { useId, type ReactNode } from 'react';
import { css, styled } from 'styled-components';

/** Shared label / helper / error / counter wiring for TextField and TextArea. */
export type FieldProps = Readonly<{
  label: string;
  helper?: string;
  error?: string;
  /** With `maxLength`, shows a "0/200" counter. */
  showCounter?: boolean;
}>;

export function useFieldIds(helper: string | undefined, error: string | undefined) {
  const id = useId();
  const helperId = helper ? `${id}-helper` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [errorId, helperId].filter(Boolean).join(' ') || undefined;
  return { id, helperId, errorId, describedBy };
}

export const fieldControlStyle = css<{ $invalid: boolean }>`
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid
    ${({ theme, $invalid }) => ($invalid ? theme.status.cancelled.fg : theme.colour.outline)};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.bg};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Label = styled.label`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const Foot = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const Message = styled.span<{ $error?: boolean }>`
  color: ${({ theme, $error }) => ($error ? theme.status.cancelled.fg : theme.colour.textMuted)};
  font-weight: ${({ theme, $error }) =>
    $error ? theme.type.weight.strong : theme.type.weight.regular};
`;

export type FieldFrameProps = FieldProps &
  Readonly<{
    id: string;
    helperId: string | undefined;
    errorId: string | undefined;
    counter: string | undefined;
    children: ReactNode;
  }>;

export function FieldFrame({
  label,
  helper,
  error,
  id,
  helperId,
  errorId,
  counter,
  children,
}: FieldFrameProps) {
  return (
    <Wrap>
      <Label htmlFor={id}>{label}</Label>
      {children}
      <Foot>
        <span>
          {error ? (
            <Message id={errorId} $error>
              {error}
            </Message>
          ) : null}
          {helper ? <Message id={helperId}>{helper}</Message> : null}
        </span>
        {counter ? <span>{counter}</span> : null}
      </Foot>
    </Wrap>
  );
}
