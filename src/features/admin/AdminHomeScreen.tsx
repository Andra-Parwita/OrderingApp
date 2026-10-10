import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { appVersion } from '../../../shared/buildInfo';
import type { AdminSeller, ChefAccess, DeviceView } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatDay, formatDayTime } from '../../../shared/dates';
import { SELLER_NAME_MAX } from '../../../shared/authContract';
import { SLUG_MAX } from '../../../shared/seller';
import {
  createDeviceCode,
  createInviteKey,
  createRecoveryKey,
  createSeller,
  fetchMyDevices,
  fetchSellerChefs,
  fetchSellerDevices,
  fetchSellers,
  signOut,
  signOutChefEverywhere,
  signOutDevice,
  signOutSellerDevice,
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

type ShownKey = Readonly<{ sellerId: string; kind: 'invite' | 'recovery'; key: string }>;

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
  const [devices, setDevices] = useState<Array<DeviceView> | null>(null);
  const [chefs, setChefs] = useState<Array<ChefAccess> | null>(null);
  const [shown, setShown] = useState<ShownKey | null>(null);
  const [keyProblem, setKeyProblem] = useState<string | null>(null);
  const [mine, setMine] = useState<Array<DeviceView> | null>(null);
  const [code, setCode] = useState<string | null>(null);
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
        const list = await fetchSellerDevices(seller.id);
        return [seller.id, list.ok ? list.data.devices.length : 0] as const;
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

  const loadDevices = useCallback(async (sellerId: string) => {
    const result = await fetchSellerDevices(sellerId);
    if (result.ok) {
      setDevices(result.data.devices);
      setCounts((current) => ({ ...current, [sellerId]: result.data.devices.length }));
    }
  }, []);

  const loadChefs = useCallback(async (sellerId: string) => {
    const result = await fetchSellerChefs(sellerId);
    if (result.ok) setChefs(result.data.chefs);
  }, []);

  const select = useCallback(
    (sellerId: string) => {
      setSelectedId(sellerId);
      setDevices(null);
      setChefs(null);
      setShown(null);
      setKeyProblem(null);
      void loadDevices(sellerId);
      void loadChefs(sellerId);
    },
    [loadDevices, loadChefs],
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

  const makeKey = useCallback(
    async (kind: 'invite' | 'recovery') => {
      if (!selected) return;
      setBusy(true);
      setKeyProblem(null);
      const result =
        kind === 'invite'
          ? await createInviteKey(selected.id)
          : await createRecoveryKey(selected.id);
      setBusy(false);
      if (result.ok) setShown({ sellerId: selected.id, kind, key: result.data.key });
      else setKeyProblem(refusedHere(result));
    },
    [selected, refusedHere],
  );

  const signOutSeller = useCallback(
    async (deviceId: string) => {
      if (!selected) return;
      const result = await signOutSellerDevice(selected.id, deviceId);
      if (result.ok) await loadDevices(selected.id);
      else setKeyProblem(refusedHere(result));
    },
    [selected, loadDevices, refusedHere],
  );

  const signOutChef = useCallback(
    async (chefId: string) => {
      if (!selected) return;
      const result = await signOutChefEverywhere(selected.id, chefId);
      if (result.ok) await Promise.all([loadChefs(selected.id), loadDevices(selected.id)]);
      else setKeyProblem(refusedHere(result));
    },
    [selected, loadChefs, loadDevices, refusedHere],
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
                <Button variant="primary" disabled={busy} onClick={() => void makeKey('invite')}>
                  {t('home.seller.invite')}
                </Button>
                <Button disabled={busy} onClick={() => void makeKey('recovery')}>
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
                  keyText={shown.key}
                  onDone={() => setShown(null)}
                />
              ) : null}
              <SmallHeading>{t('home.seller.chefs')}</SmallHeading>
              <Muted>{t('home.seller.chefsNote')}</Muted>
              {chefs === null ? <Muted>{t('loading')}</Muted> : null}
              {chefs && chefs.length === 0 ? <Muted>{t('home.seller.noChefs')}</Muted> : null}
              {chefs && chefs.length > 0 ? (
                <DeviceList aria-label={t('home.seller.chefs')}>
                  {chefs.map((chef) => (
                    <DeviceItem key={chef.id}>
                      <strong>
                        {t('home.seller.chefLine', { name: chef.name, count: chef.devices })}
                      </strong>
                      {chef.devices > 0 ? (
                        <ConfirmButton
                          label={t('home.seller.signOutAll')}
                          confirmLabel={t('home.seller.signOutAllConfirm')}
                          onConfirm={() => void signOutChef(chef.id)}
                        />
                      ) : null}
                    </DeviceItem>
                  ))}
                </DeviceList>
              ) : null}
              <SmallHeading>{t('home.seller.devices')}</SmallHeading>
              {devices === null ? <Muted>{t('loading')}</Muted> : null}
              {devices && devices.length === 0 ? <Muted>{t('home.seller.noDevices')}</Muted> : null}
              {devices && devices.length > 0 ? (
                <DeviceList aria-label={t('home.seller.devices')}>
                  {devices.map((device) => (
                    <DeviceItem key={device.id}>
                      <span>
                        <strong>{device.name}</strong>
                        {device.chefName
                          ? ` · ${t('home.seller.chef', { name: device.chefName })}`
                          : ''}
                        <Muted>{when(device)}</Muted>
                      </span>
                      <ConfirmButton
                        label={t('home.seller.signOut')}
                        confirmLabel={t('home.seller.signOutConfirm')}
                        onConfirm={() => void signOutSeller(device.id)}
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
                  <span>
                    <strong>{device.name}</strong>
                    {device.current ? ` · ${t('home.mine.thisDevice')}` : ''}
                    <Muted>{when(device)}</Muted>
                  </span>
                  {device.current ? null : (
                    <ConfirmButton
                      label={t('home.seller.signOut')}
                      confirmLabel={t('home.seller.signOutConfirm')}
                      onConfirm={() => void signOutMine(device.id)}
                    />
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
