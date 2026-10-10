import { useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button, Icon, TextField } from '../../ui';
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

// The sign-in pages (plan 001 stage 5): one narrow column inside SignInFrame, colours from `theme.c`.
export const AuthPanel = styled.main`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.size.pagePadTablet / 16}rem ${({ theme }) => theme.spacing.xxl};
`;
export const AuthTitle = styled.h1`
  margin: 0;
  font-size: 1.75rem;
  font-weight: 700;
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
  letter-spacing: -0.01em;
  color: ${({ theme }) => theme.c.text};
`;
export const AuthSub = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
export const AuthNote = styled.p`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.c.muted};
`;
export const AuthForm = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
/** The one big filled button of a panel: 52 px tall (handoff: main action 48 to 56). */
export const BigAction = styled.div`
  display: flex;
  flex-direction: column;

  & > button {
    min-height: 3.25rem;
    font-size: ${({ theme }) => theme.type.size.base};
  }
`;
export const Divider = styled.hr`
  width: 100%;
  margin: ${({ theme }) => theme.spacing.xs} 0;
  border: 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const MonoField = styled.div`
  & input {
    font-family: ${({ theme }) => theme.font.mono};
    font-weight: 600;
    letter-spacing: 0.06em;
  }
`;
/** Left-aligned quiet button with a back arrow. */
export const BackRow = styled.div`
  align-self: flex-start;
  margin-left: -${({ theme }) => theme.spacing.lg};
`;
/** An inline error under the control it belongs to: plain words, never a popup. */
export const InlineError = styled.p`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  color: ${({ theme }) => theme.c.danger};
`;

/** Icon + words (never colour alone), announced when it appears. */
export function ErrorText({ children }: Readonly<{ children: string }>) {
  return (
    <InlineError role="alert">
      <Icon name="warning" />
      <span>{children}</span>
    </InlineError>
  );
}

export function BackButton({ onClick }: Readonly<{ onClick: () => void }>) {
  const { t } = useTranslation(AUTH_NS);
  return (
    <BackRow>
      <Button variant="quiet" onClick={onClick}>
        <Icon name="back" />
        {t('signIn.back')}
      </Button>
    </BackRow>
  );
}

/** Face-with-brackets mark of "face or fingerprint" (the Icon set has no such glyph). */
export function FaceIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="22"
      height="22"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 8V6a2 2 0 012-2h2M16 4h2a2 2 0 012 2v2M20 16v2a2 2 0 01-2 2h-2M8 20H6a2 2 0 01-2-2v-2M9 10v1M15 10v1M9 15a4 4 0 006 0" />
    </svg>
  );
}

// The Show / Hide button sits inside the box, at its right end (below the label line).
const PasswordWrap = styled.div`
  position: relative;

  & input {
    padding-right: 5.5rem;
  }
`;
const Toggle = styled.div`
  position: absolute;
  top: 1.45rem;
  right: 0;
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

/** A password box with a Show / Hide button inside it. */
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
    <PasswordWrap>
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
    </PasswordWrap>
  );
}
