import { useCallback, useId, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { checkPassword } from '../../../shared/authContract';
import { setMyPassword } from '../../api/auth';
import { useMediaQuery } from '../../components/useMediaQuery';
import { Button, SlideOver } from '../../ui';
import { LayerBar, LayerBody, LayerShell } from '../../components/layer/LayerShell';
import { failureMessage } from './authText';
import { AUTH_NS } from './i18n/register';
import { Actions, Failure, Hint, PasswordField, Section, SectionTitle } from './parts';

// Plan 128: Settings → Devices, "Backup password". A signed-in person adds or changes their own
// password (no old one asked). The tablet shows a side panel; the phone a full-screen layer with Save
// in the top bar, so the keyboard never covers it (the phone-menu LayerShell of plan 124).

// Same width as DESKTOP_QUERY in app/layout.ts (a feature may not import app).
const TABLET_QUERY = '(min-width: 600px)';

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Panel = styled(Form)`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xl};
`;
const Title = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
const Row = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const State = styled.p`
  margin: 0;
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type FormProps = Readonly<{ onSaved: () => void; onClose: () => void }>;

/** The two boxes and their checks; the caller places the form and its Save button. */
function usePasswordForm(onSaved: () => void) {
  const { t } = useTranslation(AUTH_NS);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [tried, setTried] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const strength = checkPassword(password);
  const passwordError =
    tried && strength !== 'ok'
      ? t(strength === 'too_short' ? 'password.tooShort' : 'password.tooLong')
      : undefined;
  const confirmError =
    tried && strength === 'ok' && confirm !== password ? t('password.mismatch') : undefined;
  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      setTried(true);
      setError(null);
      if (checkPassword(password) !== 'ok' || confirm !== password) return;
      setBusy(true);
      const result = await setMyPassword(password);
      setBusy(false);
      if (result.ok) onSaved();
      else setError(failureMessage(t, result));
    },
    [confirm, onSaved, password, t],
  );
  const fields = (
    <>
      <Hint>{t('backup.formHelp')}</Hint>
      <PasswordField
        label={t('password.label')}
        {...(passwordError ? {} : { helper: t('password.helper') })}
        value={password}
        onChange={setPassword}
        autoComplete="new-password"
        {...(passwordError ? { error: passwordError } : {})}
      />
      <PasswordField
        label={t('password.confirm')}
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        {...(confirmError ? { error: confirmError } : {})}
      />
      {error ? <Failure role="alert">{error}</Failure> : null}
    </>
  );
  return { submit, fields, busy };
}

function TabletForm({ onSaved, onClose }: FormProps) {
  const { t } = useTranslation(AUTH_NS);
  const { submit, fields, busy } = usePasswordForm(onSaved);
  return (
    <SlideOver label={t('backup.formTitle')} closeLabel={t('devices.close')} onClose={onClose}>
      <Panel onSubmit={(event: FormEvent) => void submit(event)} noValidate>
        <Title>{t('backup.formTitle')}</Title>
        {fields}
        <Actions>
          <Button type="submit" variant="primary" disabled={busy}>
            {busy ? t('backup.saving') : t('backup.save')}
          </Button>
          <Button onClick={onClose}>{t('devices.cancel')}</Button>
        </Actions>
      </Panel>
    </SlideOver>
  );
}

function PhoneForm({ onSaved, onClose }: FormProps) {
  const { t } = useTranslation(AUTH_NS);
  const id = useId();
  const { submit, fields, busy } = usePasswordForm(onSaved);
  return (
    <LayerShell label={t('backup.formTitle')} onClose={onClose}>
      <LayerBar>
        <Button variant="quiet" onClick={onClose}>
          {t('devices.cancel')}
        </Button>
        <h2>{t('backup.layerTitle')}</h2>
        <Button
          type="submit"
          form={id}
          variant="primary"
          disabled={busy}
          aria-label={t('backup.save')}
        >
          {busy ? t('backup.saving') : t('backup.saveShort')}
        </Button>
      </LayerBar>
      <LayerBody>
        <Form id={id} onSubmit={(event: FormEvent) => void submit(event)} noValidate>
          {fields}
        </Form>
      </LayerBody>
    </LayerShell>
  );
}

/** "Backup password · Not set / Set" with Add or Change, and the "Saved" line after saving. */
export function BackupPassword({
  has,
  onChanged,
}: Readonly<{ has: boolean; onChanged: () => void }>) {
  const { t } = useTranslation(AUTH_NS);
  const tablet = useMediaQuery(TABLET_QUERY);
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const done = useCallback(() => {
    setOpen(false);
    setSaved(true);
    onChanged();
  }, [onChanged]);
  const close = useCallback(() => setOpen(false), []);
  return (
    <Section aria-label={t('backup.title')}>
      <SectionTitle>{t('backup.title')}</SectionTitle>
      <Row>
        <State>{t('backup.row', { state: t(has ? 'backup.set' : 'backup.notSet') })}</State>
        <Button
          aria-haspopup="dialog"
          onClick={() => {
            setSaved(false);
            setOpen(true);
          }}
        >
          {t(has ? 'backup.change' : 'backup.add')}
        </Button>
      </Row>
      <Hint>{t(has ? 'backup.setHelp' : 'backup.notSetHelp')}</Hint>
      {saved ? <Hint role="status">{t('backup.saved')}</Hint> : null}
      {open ? (
        tablet ? (
          <TabletForm onSaved={done} onClose={close} />
        ) : (
          <PhoneForm onSaved={done} onClose={close} />
        )
      ) : null}
    </Section>
  );
}
