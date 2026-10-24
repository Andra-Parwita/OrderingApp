import { useCallback, useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Me } from '../../../shared/authContract';
import { signInWithKey } from '../../api/auth';
import { Button, SlideOver, TextField } from '../../ui';
import { cleanKey, failureMessage } from './authText';
import { AUTH_NS } from './i18n/register';
import { Actions, MonoField } from './parts';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xl};
`;
const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;

export type JoinKitchenSheetProps = Readonly<{
  onClose: () => void;
  /** The key was accepted and the person is a full member of the kitchen: open it. */
  onJoined: (me: Me) => void;
}>;

/** Settings → Devices → "Join another kitchen" (plan 118): a signed-in person pastes an invite key. */
export function JoinKitchenSheet({ onClose, onJoined }: JoinKitchenSheetProps) {
  const { t } = useTranslation(AUTH_NS);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const key = cleanKey(value);
      if (key === '') {
        setError(t('key.empty'));
        return;
      }
      setBusy(true);
      setError(null);
      const result = await signInWithKey(key);
      setBusy(false);
      if (!result.ok) setError(failureMessage(t, result));
      else if (result.data.me.stage === 'full') onJoined(result.data.me);
      else setError(t('errors.generic'));
    },
    [onJoined, t, value],
  );

  return (
    <SlideOver label={t('join.sheetTitle')} closeLabel={t('devices.close')} onClose={onClose}>
      <Form onSubmit={(event: FormEvent) => void submit(event)} noValidate>
        <Title>{t('join.sheetTitle')}</Title>
        <MonoField>
          <TextField
            label={t('key.label')}
            helper={t('key.helper')}
            value={value}
            maxLength={60}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            {...(error ? { error } : {})}
            onChange={(event: ChangeEvent<HTMLInputElement>) => setValue(event.target.value)}
          />
        </MonoField>
        <Actions>
          <Button type="submit" variant="primary" fullWidth disabled={busy}>
            {busy ? t('key.checking') : t('join.submit')}
          </Button>
          <Button fullWidth onClick={onClose}>
            {t('devices.cancel')}
          </Button>
        </Actions>
      </Form>
    </SlideOver>
  );
}
