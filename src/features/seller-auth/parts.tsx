import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button, TextField } from '../../ui';
import { guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';

// Shared look of the sign-in screens: tokens only, spacing and hairlines, no heavy borders.

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  max-width: min(100%, 32rem);
  margin: 0 auto;
`;
export const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
export const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.xxl};
`;
export const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.md};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
export const SectionTitle = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
export const Hint = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
export const Failure = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.status.cancelled.fg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
export const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colour.textMuted};
`;
export const Actions = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
export const Banner = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surfaceAlt};
`;
export const Steps = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;

  & > li {
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    counter-increment: step;
  }
  & > li::before {
    content: counter(step);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.75rem;
    height: 1.75rem;
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => theme.colour.surfaceAlt};
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
`;
export const FieldRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};

  & > :first-child {
    flex: 1;
    min-width: 0;
  }
`;
const Toggle = styled.div`
  padding-top: 1.35rem;
`;

/** Device name, pre-guessed from the browser and editable. */
export function useDeviceName() {
  const { t } = useTranslation(AUTH_NS);
  const [name, setName] = useState(() => t(`deviceName.${guessDevice()}`));
  return { name, setName };
}

export function DeviceNameField({
  value,
  onChange,
  error,
}: Readonly<{ value: string; onChange: (next: string) => void; error?: string }>) {
  const { t } = useTranslation(AUTH_NS);
  return (
    <TextField
      label={t('deviceName.label')}
      helper={t('deviceName.helper')}
      value={value}
      maxLength={40}
      autoComplete="off"
      {...(error ? { error } : {})}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
    />
  );
}

/** A password box with a Show / Hide button beside it. */
export function PasswordField({
  label,
  value,
  onChange,
  helper,
  error,
  autoComplete,
}: Readonly<{
  label: string;
  value: string;
  onChange: (next: string) => void;
  helper?: string;
  error?: string;
  autoComplete: 'new-password' | 'current-password';
}>) {
  const { t } = useTranslation(AUTH_NS);
  const [shown, setShown] = useState(false);
  return (
    <FieldRow>
      <TextField
        label={label}
        type={shown ? 'text' : 'password'}
        value={value}
        maxLength={200}
        autoComplete={autoComplete}
        {...(helper ? { helper } : {})}
        {...(error ? { error } : {})}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      />
      <Toggle>
        <Button
          variant="quiet"
          aria-label={`${shown ? t('password.hide') : t('password.show')}: ${label}`}
          aria-pressed={shown}
          onClick={() => setShown((current) => !current)}
        >
          {shown ? t('password.hide') : t('password.show')}
        </Button>
      </Toggle>
    </FieldRow>
  );
}
