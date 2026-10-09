import {
  useCallback,
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import {
  createDeviceCode,
  fetchMyDevices,
  renameMyDevice,
  signOut,
  signOutDevice,
} from '../../api/auth';
import { DEVICE_NAME_MAX, type DeviceView } from '../../../shared/authContract';
import { Button, ConfirmButton, TextField } from '../../ui';
import { failureMessage, formatCountdown } from './authText';
import { AUTH_NS } from './i18n/register';
import {
  Actions,
  Body,
  Centered,
  Failure,
  Hint,
  Page,
  Section,
  SectionTitle,
  Title,
} from './parts';

const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Name = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
  overflow-wrap: anywhere;
`;
const Code = styled.output`
  display: block;
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  font-size: ${({ theme }) => theme.type.size.xl};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  letter-spacing: 0.2em;
  text-align: center;
`;

type CodeState = Readonly<{ code: string; expiresAt: number }>;

/** Ticks once a second while `active`, so a countdown re-reads the clock. */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return undefined;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

function whenText(iso: string, language: string): string {
  return new Date(iso).toLocaleString(language, { dateStyle: 'medium', timeStyle: 'short' });
}

type RowProps = Readonly<{
  device: DeviceView;
  onChanged: () => void;
  onError: (message: string) => void;
}>;

function DeviceRow({ device, onChanged, onError }: RowProps) {
  const { t, i18n } = useTranslation(AUTH_NS);
  const [name, setName] = useState<string | null>(null);

  const submit = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      const next = (name ?? '').trim();
      if (next === '') return;
      if (next !== device.name) {
        const result = await renameMyDevice(device.id, next);
        if (!result.ok) onError(failureMessage(t, result));
        else onChanged();
      }
      setName(null);
    },
    [device.id, device.name, name, onChanged, onError, t],
  );

  const remove = useCallback(async () => {
    const result = await signOutDevice(device.id);
    if (!result.ok) onError(failureMessage(t, result));
    else onChanged();
  }, [device.id, onChanged, onError, t]);

  if (name !== null) {
    return (
      <Item>
        <form onSubmit={(event) => void submit(event)} noValidate>
          <TextField
            label={t('devices.renameField', { name: device.name })}
            value={name}
            maxLength={DEVICE_NAME_MAX}
            autoComplete="off"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          />
          <Actions>
            <Button type="submit" variant="primary" disabled={name.trim() === ''}>
              {t('devices.saveName')}
            </Button>
            <Button onClick={() => setName(null)}>{t('devices.cancel')}</Button>
          </Actions>
        </form>
      </Item>
    );
  }
  return (
    <Item>
      <Name>{device.name}</Name>
      <Hint>
        {device.current
          ? t('devices.activeNow')
          : t('devices.lastUsed', { when: whenText(device.lastUsedAt, i18n.language) })}
      </Hint>
      <Actions>
        <Button onClick={() => setName(device.name)}>{t('devices.rename')}</Button>
        {device.current ? null : (
          <ConfirmButton
            label={t('devices.signOutDevice')}
            confirmLabel={t('devices.signOutDeviceConfirm')}
            onConfirm={() => void remove()}
          />
        )}
      </Actions>
    </Item>
  );
}

function AddDevice({ onError }: Readonly<{ onError: (message: string) => void }>) {
  const { t } = useTranslation(AUTH_NS);
  const [state, setState] = useState<CodeState | null>(null);
  const [busy, setBusy] = useState(false);
  const now = useNow(state !== null);

  const make = useCallback(async () => {
    setBusy(true);
    const result = await createDeviceCode();
    setBusy(false);
    if (result.ok) {
      setState({ code: result.data.code, expiresAt: Date.parse(result.data.expiresAt) });
    } else onError(failureMessage(t, result));
  }, [onError, t]);

  if (state === null) {
    return (
      <Button fullWidth disabled={busy} onClick={() => void make()}>
        {t('devices.add')}
      </Button>
    );
  }
  const remaining = state.expiresAt - now;
  return (
    <>
      {remaining > 0 ? (
        <>
          <Hint>{t('devices.addHelp')}</Hint>
          <Code aria-label={t('devices.codeLabel')}>{state.code}</Code>
          <Hint role="timer">{t('devices.expiresIn', { time: formatCountdown(remaining) })}</Hint>
        </>
      ) : (
        <Failure>{t('devices.expired')}</Failure>
      )}
      <Actions>
        {remaining <= 0 ? (
          <Button variant="primary" disabled={busy} onClick={() => void make()}>
            {t('devices.newCode')}
          </Button>
        ) : null}
        <Button variant="quiet" onClick={() => setState(null)}>
          {t('devices.hideCode')}
        </Button>
      </Actions>
    </>
  );
}

/** Devices per page in the list of other devices (stage 10). */
export const DEVICES_PAGE_SIZE = 20;

function OtherDevices({
  others,
  row,
}: Readonly<{ others: ReadonlyArray<DeviceView>; row: (device: DeviceView) => ReactNode }>) {
  const { t } = useTranslation(AUTH_NS);
  const [page, setPage] = useState(0);
  const pages = Math.max(1, Math.ceil(others.length / DEVICES_PAGE_SIZE));
  const shown = Math.min(page, pages - 1);
  const slice = others.slice(shown * DEVICES_PAGE_SIZE, (shown + 1) * DEVICES_PAGE_SIZE);
  return (
    <>
      <List>{slice.map(row)}</List>
      {pages > 1 ? (
        <Actions>
          <Button disabled={shown === 0} onClick={() => setPage(shown - 1)}>
            {t('devices.previous')}
          </Button>
          <Hint role="status">{t('devices.pageOf', { page: shown + 1, pages })}</Hint>
          <Button disabled={shown >= pages - 1} onClick={() => setPage(shown + 1)}>
            {t('devices.next')}
          </Button>
        </Actions>
      ) : null}
    </>
  );
}

export type DevicesScreenProps = Readonly<{
  /** This device signed out (its token is forgotten). Send the person to sign-in. */
  onSignedOut: () => void;
  /** Signs this device out. The app passes the session's `end`, which also stops the seller sagas. */
  signOutHere?: () => Promise<void>;
  /** Inside a Settings pane: the pane has the title. */
  embedded?: boolean;
}>;

/** This device, the others, rename and sign out, and "Add a device" with its 6-digit code. */
export function DevicesScreen({
  onSignedOut,
  signOutHere: endSession,
  embedded = false,
}: DevicesScreenProps) {
  const { t } = useTranslation(AUTH_NS);
  const [devices, setDevices] = useState<ReadonlyArray<DeviceView> | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumping `round` loads the list again (after a rename, a sign-out or "Try again").
  const [round, setRound] = useState(0);
  const load = useCallback(() => setRound((current) => current + 1), []);
  useEffect(() => {
    let live = true;
    void fetchMyDevices().then((result) => {
      if (!live) return;
      if (result.ok) {
        setDevices(result.data.devices);
        setLoadFailed(false);
      } else setLoadFailed(true);
    });
    return () => {
      live = false;
    };
  }, [round]);

  const retry = useCallback(() => {
    setLoadFailed(false);
    load();
  }, [load]);
  const signOutHere = useCallback(async () => {
    if (endSession) await endSession();
    else await signOut();
    onSignedOut();
  }, [onSignedOut, endSession]);

  if (loadFailed) {
    return (
      <Page>
        {embedded ? null : <Title>{t('devices.title')}</Title>}
        <Body>
          <Failure role="alert">{t('devices.loadFailed')}</Failure>
          <Button onClick={retry}>{t('devices.retry')}</Button>
        </Body>
      </Page>
    );
  }
  if (devices === null) {
    return (
      <Page>
        {embedded ? null : <Title>{t('devices.title')}</Title>}
        <Centered>{t('devices.loading')}</Centered>
      </Page>
    );
  }
  const here = devices.filter((device) => device.current);
  const others = devices.filter((device) => !device.current);
  const row = (device: DeviceView) => (
    <DeviceRow key={device.id} device={device} onChanged={load} onError={setError} />
  );
  return (
    <Page>
      {embedded ? null : <Title>{t('devices.title')}</Title>}
      <Body>
        {error ? <Failure role="alert">{error}</Failure> : null}
        <Section>
          <SectionTitle>{t('devices.thisDevice')}</SectionTitle>
          <List>{here.map(row)}</List>
        </Section>
        <Section>
          <SectionTitle>{t('devices.others')}</SectionTitle>
          {others.length === 0 ? (
            <Hint>{t('devices.none')}</Hint>
          ) : (
            <OtherDevices others={others} row={row} />
          )}
          <AddDevice onError={setError} />
        </Section>
        <Section>
          <ConfirmButton
            label={t('devices.signOutHere')}
            confirmLabel={t('devices.signOutHereConfirm')}
            fullWidth
            onConfirm={() => void signOutHere()}
          />
          <Hint>{t('devices.signOutHereHint')}</Hint>
        </Section>
      </Body>
    </Page>
  );
}
