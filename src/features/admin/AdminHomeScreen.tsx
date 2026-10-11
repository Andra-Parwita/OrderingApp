import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { appVersion } from '../../../shared/buildInfo';
import type { AdminSeller, DeviceView, TeamMember } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { DEVICE_NAME_MAX, SELLER_NAME_MAX } from '../../../shared/authContract';
import { SLUG_MAX } from '../../../shared/seller';
import {
  createDeviceCode,
  createInviteKey,
  createRecoveryKey,
  createSeller,
  fetchMyDevices,
  fetchSellerMembers,
  fetchSellers,
  removeSellerMember,
  renameMyDevice,
  signOut,
  signOutDevice,
  setSellerDemo,
} from '../../api/auth';
import type { ApiFailure } from '../../api/http';
import {
  Button,
  ConfirmButton,
  PageHeader,
  Table,
  TableCell,
  TableRow,
  TextField,
  type TableColumn,
} from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { KeyBox } from './KeyBox';
import { slugProblem } from './slug';
import { failureText, FormSection, Message, Muted, Page, Row, Section, Sub } from './shared';

export type AdminHomeScreenProps = Readonly<{
  /** The admin ended this session. */
  onSignedOut?: () => void;
  /** The session is missing or not an admin's: the route sends the visitor to sign-in. */
  onSignInNeeded?: () => void;
}>;

type ShownKey = Readonly<{ sellerId: string; kind: 'invite' | 'recovery' }>;

const DeviceList = styled.ul`
  display: flex;
  flex-direction: column;
  align-self: stretch;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const DeviceItem = styled.li`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3.5rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Panel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  align-self: stretch;
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.md};
`;
const SmallHeading = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Check = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  cursor: pointer;
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  align-self: stretch;
`;

/** The admin page: sellers, keys, seller devices and the admin's own devices. No order data. */
export function AdminHomeScreen({ onSignedOut, onSignInNeeded }: AdminHomeScreenProps) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [sellers, setSellers] = useState<Array<AdminSeller> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [members, setMembers] = useState<Array<TeamMember> | null>(null);
  const [shown, setShown] = useState<ShownKey | null>(null);
  const [keyProblem, setKeyProblem] = useState<string | null>(null);
  const [mine, setMine] = useState<Array<DeviceView> | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [addProblem, setAddProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refusedHere = useCallback(
    (failure: ApiFailure): string => {
      if (failure.error === 'unauthorized' || failure.error === 'forbidden') onSignInNeeded?.();
      return failureText(t, failure);
    },
    [onSignInNeeded, t],
  );

  const loadSellers = useCallback(async () => {
    const result = await fetchSellers();
    if (!result.ok) {
      setLoadProblem(refusedHere(result));
      return;
    }
    setLoadProblem(null);
    setSellers(result.data.sellers);
    const entries = await Promise.all(
      result.data.sellers.map(async (seller) => {
        const list = await fetchSellerMembers(seller.id);
        const count = list.ok ? list.data.members.reduce((sum, m) => sum + m.devices, 0) : 0;
        return [seller.id, count] as const;
      }),
    );
    setCounts(Object.fromEntries(entries));
  }, [refusedHere]);

  const loadMine = useCallback(async () => {
    const result = await fetchMyDevices();
    if (result.ok) setMine(result.data.devices);
  }, []);

  useEffect(() => {
    // Calls that set state after a network round trip, started once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSellers();
    void loadMine();
  }, [loadSellers, loadMine]);

  const loadMembers = useCallback(async (sellerId: string) => {
    const result = await fetchSellerMembers(sellerId);
    if (!result.ok) return;
    setMembers(result.data.members);
    const devices = result.data.members.reduce((sum, member) => sum + member.devices, 0);
    setCounts((current) => ({ ...current, [sellerId]: devices }));
  }, []);

  const select = useCallback(
    (sellerId: string) => {
      setSelectedId(sellerId);
      setMembers(null);
      setShown(null);
      setKeyProblem(null);
      void loadMembers(sellerId);
    },
    [loadMembers],
  );

  const selected = sellers?.find((seller) => seller.id === selectedId) ?? null;
  const slugs = useMemo(() => (sellers ?? []).map((seller) => seller.slug), [sellers]);
  const problem = slugProblem(slug, slugs);
  const canAdd = name.trim() !== '' && slug !== '' && problem === null && !busy;

  const addSeller = useCallback(
    async (event: FormEvent) => {
      event.preventDefault();
      if (!canAdd) return;
      setBusy(true);
      setAddProblem(null);
      setAdded(null);
      const result = await createSeller(name.trim(), slug);
      setBusy(false);
      if (!result.ok) {
        setAddProblem(result.error === 'slug_taken' ? t('home.add.taken') : refusedHere(result));
        return;
      }
      const { seller } = result.data;
      setSellers((current) => [...(current ?? []), seller]);
      setCounts((current) => ({ ...current, [seller.id]: 0 }));
      setName('');
      setSlug('');
      setAdded(t('home.add.added', { name: seller.name, slug: seller.slug }));
      select(seller.id);
    },
    [canAdd, name, slug, refusedHere, select, t],
  );

  /** The invite box calls this with the typed name; the key itself stays inside the box. */
  const makeKey = useCallback(
    async (kind: 'invite' | 'recovery', displayName: string): Promise<string | null> => {
      if (!selected) return null;
      setKeyProblem(null);
      const make = kind === 'invite' ? createInviteKey : createRecoveryKey;
      const result = await make(selected.id, displayName || undefined);
      if (result.ok) return result.data.key;
      setKeyProblem(refusedHere(result));
      return null;
    },
    [selected, refusedHere],
  );

  const removeMember = useCallback(
    async (accountId: string) => {
      if (!selected) return;
      const result = await removeSellerMember(selected.id, accountId);
      if (result.ok) await loadMembers(selected.id);
      else setKeyProblem(refusedHere(result));
    },
    [selected, loadMembers, refusedHere],
  );

  const changeDemo = useCallback(
    async (demo: boolean) => {
      if (!selected) return;
      setBusy(true);
      setKeyProblem(null);
      const result = await setSellerDemo(selected.id, demo);
      setBusy(false);
      if (!result.ok) {
        setKeyProblem(refusedHere(result));
        return;
      }
      const { seller } = result.data;
      setSellers((current) => (current ?? []).map((row) => (row.id === seller.id ? seller : row)));
    },
    [selected, refusedHere],
  );

  const signOutMine = useCallback(
    async (deviceId: string) => {
      const result = await signOutDevice(deviceId);
      if (result.ok) await loadMine();
    },
    [loadMine],
  );

  const renameMine = useCallback(
    async (deviceId: string, next: string) => {
      const result = await renameMyDevice(deviceId, next);
      if (result.ok) await loadMine();
    },
    [loadMine],
  );

  const addDevice = useCallback(async () => {
    const result = await createDeviceCode();
    if (result.ok) setCode(result.data.code);
  }, []);

  const leave = useCallback(async () => {
    await signOut();
    onSignedOut?.();
  }, [onSignedOut]);

  const columns: ReadonlyArray<TableColumn> = [
    { id: 'name', header: t('home.colName'), width: '100%' },
    { id: 'link', header: t('home.colLink') },
    { id: 'created', header: t('home.colCreated') },
    { id: 'devices', header: t('home.colDevices'), align: 'end' },
  ];

  const when = (device: DeviceView) =>
    t('home.seller.lastUsed', { when: formatDayTime(device.lastUsedAt, lang) });

  return (
    <>
      <PageHeader
        title={t('home.title')}
        trailing={
          <Button variant="quiet" onClick={() => void leave()}>
            {t('home.signOut')}
          </Button>
        }
      />
      <Page>
        <Section>
          <Sub>{t('home.sellers')}</Sub>
          {loadProblem ? <Message $bad>{loadProblem}</Message> : null}
          {sellers === null && !loadProblem ? <Muted>{t('loading')}</Muted> : null}
          {sellers && sellers.length === 0 ? <Muted>{t('home.noSellers')}</Muted> : null}
          {sellers && sellers.length > 0 ? (
            <>
              <Table label={t('home.sellersTable')} columns={columns}>
                {sellers.map((seller) => (
                  <TableRow
                    key={seller.id}
                    rowId={seller.id}
                    selected={seller.id === selectedId}
                    onOpen={select}
                  >
                    <TableCell strong>{seller.name}</TableCell>
                    <TableCell>{`/${seller.slug}`}</TableCell>
                    <TableCell>{formatDay(seller.createdAt, lang)}</TableCell>
                    <TableCell align="end">{counts[seller.id] ?? '…'}</TableCell>
                  </TableRow>
                ))}
              </Table>
              {selected ? null : <Muted>{t('home.selectHint')}</Muted>}
            </>
          ) : null}

          {selected ? (
            <Panel role="region" aria-label={selected.name}>
              <SmallHeading>{t('home.seller.title', { name: selected.name })}</SmallHeading>
              <Muted>{t('home.seller.link', { slug: selected.slug })}</Muted>
              <Row>
                <Button
                  variant="primary"
                  disabled={busy}
                  onClick={() => setShown({ sellerId: selected.id, kind: 'invite' })}
                >
                  {t('home.seller.invite')}
                </Button>
                <Button
                  disabled={busy}
                  onClick={() => setShown({ sellerId: selected.id, kind: 'recovery' })}
                >
                  {t('home.seller.recovery')}
                </Button>
              </Row>
              <Check>
                <input
                  type="checkbox"
                  checked={selected.demo === true}
                  disabled={busy}
                  onChange={(event) => void changeDemo(event.target.checked)}
                />
                {t('home.seller.demo')}
              </Check>
              <Muted>{t('home.seller.demoNote')}</Muted>
              {keyProblem ? <Message $bad>{keyProblem}</Message> : null}
              {shown && shown.sellerId === selected.id ? (
                <KeyBox
                  title={t(
                    shown.kind === 'invite' ? 'home.key.inviteTitle' : 'home.key.recoveryTitle',
                    { name: selected.name },
                  )}
                  key={shown.kind}
                  slug={selected.slug}
                  create={(displayName) => makeKey(shown.kind, displayName)}
                  onDone={() => setShown(null)}
                />
              ) : null}
              <SmallHeading>{t('home.seller.members')}</SmallHeading>
              {members === null ? <Muted>{t('loading')}</Muted> : null}
              {members && members.length === 0 ? <Muted>{t('home.seller.noMembers')}</Muted> : null}
              {members && members.length > 0 ? (
                <DeviceList aria-label={t('home.seller.members')}>
                  {members.map((member) => (
                    <DeviceItem key={member.accountId}>
                      <span>
                        <strong>{member.displayName}</strong>
                        <Muted>
                          {t('home.seller.memberLine', {
                            role: t(`home.seller.role.${member.role}`),
                            count: member.devices,
                          })}
                        </Muted>
                      </span>
                      <ConfirmButton
                        label={t('home.seller.remove')}
                        confirmLabel={t('home.seller.removeConfirm')}
                        onConfirm={() => void removeMember(member.accountId)}
                      />
                    </DeviceItem>
                  ))}
                </DeviceList>
              ) : null}
            </Panel>
          ) : null}
        </Section>

        <FormSection onSubmit={(event) => void addSeller(event)}>
          <Sub>{t('home.add.title')}</Sub>
          <Fields>
            <TextField
              label={t('home.add.name')}
              value={name}
              maxLength={SELLER_NAME_MAX}
              onChange={(event) => setName(event.target.value)}
            />
            <TextField
              label={t('home.add.slug')}
              helper={t('home.add.slugHelper')}
              error={problem ? t(`home.add.${problem}`) : undefined}
              value={slug}
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="none"
              maxLength={SLUG_MAX + 10}
              onChange={(event) => setSlug(event.target.value)}
            />
          </Fields>
          {addProblem ? <Message $bad>{addProblem}</Message> : null}
          {added ? <Message role="status">{added}</Message> : null}
          <Button type="submit" variant="primary" disabled={!canAdd}>
            {t('home.add.button')}
          </Button>
        </FormSection>

        <Section>
          <Sub>{t('home.mine.title')}</Sub>
          {mine && mine.length === 0 ? <Muted>{t('home.mine.none')}</Muted> : null}
          {mine && mine.length > 0 ? (
            <DeviceList aria-label={t('home.mine.title')}>
              {mine.map((device) => (
                <DeviceItem key={device.id}>
                  {renaming?.id === device.id ? (
                    <FormSection
                      onSubmit={(event) => {
                        event.preventDefault();
                        const next = renaming.name.trim();
                        setRenaming(null);
                        if (next !== '' && next !== device.name) void renameMine(device.id, next);
                      }}
                    >
                      <TextField
                        label={t('home.mine.renameField', { name: device.name })}
                        value={renaming.name}
                        maxLength={DEVICE_NAME_MAX}
                        autoComplete="off"
                        onChange={(event) =>
                          setRenaming({ id: device.id, name: event.target.value })
                        }
                      />
                      <Row>
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={renaming.name.trim() === ''}
                        >
                          {t('home.mine.saveName')}
                        </Button>
                        <Button onClick={() => setRenaming(null)}>{t('home.mine.cancel')}</Button>
                      </Row>
                    </FormSection>
                  ) : (
                    <>
                      <span>
                        <strong>{device.name}</strong>
                        {device.current ? ` · ${t('home.mine.thisDevice')}` : ''}
                        <Muted>{when(device)}</Muted>
                      </span>
                      <Row>
                        <Button onClick={() => setRenaming({ id: device.id, name: device.name })}>
                          {t('home.mine.rename')}
                        </Button>
                        {device.current ? null : (
                          <ConfirmButton
                            label={t('home.seller.signOut')}
                            confirmLabel={t('home.seller.signOutConfirm')}
                            onConfirm={() => void signOutMine(device.id)}
                          />
                        )}
                      </Row>
                    </>
                  )}
                </DeviceItem>
              ))}
            </DeviceList>
          ) : null}
          <Button onClick={() => void addDevice()}>{t('home.mine.addDevice')}</Button>
          {code ? <Message role="status">{t('home.mine.code', { code })}</Message> : null}
        </Section>

        <Muted>{t('home.privacy')}</Muted>
        <Muted>{t('version', { version: appVersion() })}</Muted>
      </Page>
    </>
  );
}
