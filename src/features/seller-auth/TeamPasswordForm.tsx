import { useCallback, useEffect, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { fetchTeamNames, signInWithPassword } from '../../api/auth';
import type { Me, TeamName } from '../../../shared/authContract';
import { Button } from '../../ui';
import { fieldControlStyle } from '../../ui/Field';
import { failureMessage, guessDevice } from './authText';
import { AUTH_NS } from './i18n/register';
import { AuthForm, AuthNote, BigAction, ErrorText, PasswordField } from './parts';

const Pick = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;
const PickLabel = styled.label`
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Select = styled.select<{ $invalid: boolean }>`
  ${fieldControlStyle}
`;

/**
 * Password sign-in for a kitchen's team (plan 033): pick your name from the people of that kitchen
 * who have a password, then type it. Nobody with a password: say so and point to face or fingerprint.
 */
export function TeamPasswordForm({
  slug,
  preferName,
  initialError,
  onDone,
}: Readonly<{
  slug: string;
  /** Preselects the person with this display name (the setup session's own). */
  preferName?: string | undefined;
  initialError?: string | null;
  onDone: (me: Me) => void;
}>) {
  const { t } = useTranslation(AUTH_NS);
  const selectId = useId();
  const [names, setNames] = useState<ReadonlyArray<TeamName> | null>(null);
  const [accountId, setAccountId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    void fetchTeamNames(slug).then((result) => {
      if (!live) return;
      const list = result.ok ? result.data.names : [];
      setNames(list);
      const pick = list.length === 1 ? list[0] : list.find((e) => e.displayName === preferName);
      setAccountId(pick?.accountId ?? '');
    });
    return () => {
      live = false;
    };
  }, [preferName, slug]);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (accountId === '') {
        setError(t('signIn.pickName'));
        return;
      }
      if (password === '') {
        setError(t('signIn.empty'));
        return;
      }
      setError(null);
      setBusy(true);
      // A returning device is added under its guessed name; Devices lets the person rename it.
      const result = await signInWithPassword({
        slug,
        accountId,
        password,
        deviceName: t(`deviceName.${guessDevice()}`),
      });
      setBusy(false);
      if (result.ok) onDone(result.data.me);
      else setError(failureMessage(t, result));
    },
    [accountId, onDone, password, slug, t],
  );

  if (names === null) return <AuthNote>{t('signIn.working')}</AuthNote>;
  if (names.length === 0) {
    return (
      <>
        <AuthNote>{t('signIn.nobodyPassword')}</AuthNote>
        {initialError ? <ErrorText>{initialError}</ErrorText> : null}
      </>
    );
  }
  return (
    <AuthForm onSubmit={(event: FormEvent) => void submit(event)} noValidate>
      <Pick>
        <PickLabel htmlFor={selectId}>{t('signIn.who')}</PickLabel>
        <Select
          id={selectId}
          $invalid={false}
          value={accountId}
          onChange={(event) => {
            setAccountId(event.target.value);
            setError(null);
          }}
        >
          <option value="">{t('signIn.pickName')}</option>
          {names.map((entry) => (
            <option key={entry.accountId} value={entry.accountId}>
              {entry.displayName}
            </option>
          ))}
        </Select>
      </Pick>
      <PasswordField
        label={t('signIn.passwordLabel')}
        value={password}
        onChange={(next) => {
          setPassword(next);
          setError(null);
        }}
        autoComplete="current-password"
        {...(error ? { error } : {})}
      />
      <BigAction>
        <Button type="submit" variant="primary" fullWidth disabled={busy}>
          {busy ? t('signIn.working') : t('signIn.submit')}
        </Button>
      </BigAction>
    </AuthForm>
  );
}
