import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { AdminSeller, DeviceView, SellerSummary } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatCookingDate, formatDay, formatDayTime } from '../../../shared/dates';
import { DEVICE_NAME_MAX, SELLER_NAME_MAX } from '../../../shared/authContract';
import { SLUG_MAX } from '../../../shared/seller';
import {
  createDeviceCode,
  createSeller,
  fetchMyDevices,
  fetchSellers,
  renameMyDevice,
  signOut,
  signOutDevice,
} from '../../api/auth';
import type { ApiFailure } from '../../api/http';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { brandColour, brandSize } from '../../theme/brandTokens';
import { Button, ConfirmButton, Icon, SlideOver, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { BackupMinutesPanel } from './BackupMinutesPanel';
import { MaintenancePanel } from './MaintenancePanel';
import { ProblemsPanel } from './ProblemsPanel';
import { RefreshBar } from './RefreshBar';
import { PauseLabel, SellerDetails } from './SellerDetails';
import { DraftNotice, draftKey, useDraft } from '../../components/draft';
import { slugProblem } from './slug';
import {
  DeviceItem,
  DeviceList,
  failureText,
  FormSection,
  Message,
  Muted,
  Row,
  Section,
  SmallHeading,
  Sub,
} from './shared';
import { SCREEN_HEIGHT, TOP_BARS } from '../../theme/screen';

export type AdminHomeScreenProps = Readonly<{
  /** The admin ended this session. */
  onSignedOut?: () => void;
  /** The session is missing or not an admin's: the route sends the visitor to sign-in. */
  onSignInNeeded?: () => void;
  /** The app layer's top bar (the ShaggyBobo brand bar), given the page name, language switch and
   *  Sign out to carry. Without it the tools sit in a plain bar. */
  top?: (tools: ReactNode) => ReactNode;
  /** The app layer's bottom bar (the brand footer). */
  bottom?: ReactNode;
  /** The kitchen's pictures editor (plan 041), given the seller id; shown in the open seller row. */
  images?: (sellerId: string) => ReactNode;
}>;

const Shell = styled.div`
  display: flex;
  flex-direction: column;
  min-height: ${SCREEN_HEIGHT};
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
// The brand bar's right side: the page name, the language switch and Sign out, on the bar's beige.
const BarTools = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;

  /* The EN / ID switch sits on the brand's fixed beige, so it uses the brand's fixed ink in both
     themes (the theme text colour is near-white in dark mode and unreadable here). */
  [role='radiogroup'] {
    border-color: ${brandColour.ink};
  }
  [role='radio'][aria-checked='false'] {
    color: ${brandColour.ink};
  }
  [role='radio']:focus-visible {
    outline-color: ${brandColour.ink};
  }
`;
const BarTitle = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  /* The bar has a fixed height and no room for the name on a phone (the page repeats it below). */
  @media (max-width: 26rem) {
    display: none;
  }
`;
const BarSignOut = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${brandSize.hairline} solid ${brandColour.ink};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: transparent;
  color: ${brandColour.ink};
  font: inherit;
  white-space: nowrap;
  cursor: pointer;
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${brandColour.ink};
    outline-offset: ${({ theme }) => theme.border.focus};
  }
`;
const PlainBar = styled.header`
  display: flex;
  justify-content: flex-end;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${brandColour.beige};
  color: ${brandColour.ink};
`;
// Two panels: the admin's own things on a raised surface, the sellers on the page background,
// a hairline between them (beside on a tablet, between on a phone).
const Layout = styled.main`
  flex: 1;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  align-content: start;
  width: 100%;

  @media (min-width: 48rem) {
    grid-template-columns: 22rem minmax(0, 1fr);
    align-content: stretch;
  }
`;
const AdminPanel = styled.aside`
  box-sizing: border-box;
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.c.surf};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};

  @media (min-width: 48rem) {
    border-bottom: 0;
    border-inline-end: ${({ theme }) => theme.border.hairline} solid
      ${({ theme }) => theme.colour.hairline};
  }
`;
const AdminInner = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xl};

  @media (min-width: 48rem) {
    position: sticky;
    top: calc(${TOP_BARS} + ${({ theme }) => theme.spacing.lg});
  }
`;
const SellersPanel = styled.div`
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
`;
const RowList = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Toggle = styled.button`
  box-sizing: border-box;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: 3.5rem;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.colour.surfaceAlt};
  }
  &:focus-visible {
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const RowName = styled.strong`
  flex: 1 1 8rem;
  min-width: 0;
`;
const RowMeta = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
`;
const RowSummary = styled.span`
  flex: 1 0 100%;
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Chevron = styled.span`
  display: inline-flex;
  margin-inline-start: auto;
`;
const PanelBody = styled.div`
  padding: 0 ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.xl};
`;
const Fields = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
  gap: ${({ theme }) => theme.spacing.lg};
  align-self: stretch;
`;

/** The admin page: the admin's own devices on the left, the sellers on the right. No order data. */
export function AdminHomeScreen({
  onSignedOut,
  onSignInNeeded,
  top,
  bottom,
  images,
}: AdminHomeScreenProps) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [sellers, setSellers] = useState<Array<AdminSeller> | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loadProblem, setLoadProblem] = useState<string | null>(null);
  // The right-hand panel (plan 038 stage 4): one seller's details, or the Add a seller form.
  const [panel, setPanel] = useState<{ kind: 'seller'; id: string } | { kind: 'add' } | null>(null);
  const rows = useRef<Record<string, HTMLButtonElement | null>>({});
  const addButton = useRef<HTMLButtonElement | null>(null);
  const [mine, setMine] = useState<Array<DeviceView> | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  // Plan 061: the new kitchen's name and address survive a reload until it is added.
  const [addForm, setAddForm, addDraft] = useDraft<{ name: string; slug: string }>(
    draftKey('admin', 'add-kitchen'),
    { name: '', slug: '' },
  );
  const { name, slug } = addForm;
  const setName = (value: string) => setAddForm((f) => ({ ...f, name: value }));
  const setSlug = (value: string) => setAddForm((f) => ({ ...f, slug: value }));
  const [addProblem, setAddProblem] = useState<string | null>(null);
  const [added, setAdded] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Plan 052: when the list was loaded, and a counter that tells the Problems list and the open
  // seller panel to load again.
  const [loadedAt, setLoadedAt] = useState<number | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

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
    // Plan 073: the device counts come with the list (one request, not one per kitchen).
    setCounts(
      Object.fromEntries(
        result.data.sellers.map((seller) => [seller.id, seller.summary?.devices ?? 0]),
      ),
    );
    setLoadedAt(Date.now());
  }, [refusedHere]);

  const refresh = useCallback(() => {
    setRefreshKey((value) => value + 1);
    void loadSellers();
  }, [loadSellers]);

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

  const closePanel = useCallback(() => setPanel(null), []);
  const panelSeller =
    panel?.kind === 'seller' ? (sellers ?? []).find((row) => row.id === panel.id) : undefined;
  const returnFocus = useCallback(
    () => (panel?.kind === 'seller' ? (rows.current[panel.id] ?? null) : addButton.current),
    [panel],
  );

  const setDevices = useCallback((sellerId: string, devices: number) => {
    setCounts((current) => ({ ...current, [sellerId]: devices }));
  }, []);

  const changeSeller = useCallback((seller: AdminSeller) => {
    setSellers((current) => (current ?? []).map((row) => (row.id === seller.id ? seller : row)));
  }, []);

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
      addDraft.clear();
      setAddForm({ name: '', slug: '' });
      setAdded(t('home.add.added', { name: seller.name, slug: seller.slug }));
      setPanel({ kind: 'seller', id: seller.id });
    },
    [addDraft, canAdd, name, slug, refusedHere, setAddForm, t],
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

  /** "2 people · Live · Sat 17 Oct · 3 orders · Active 10 Oct": counts and dates only. */
  const summaryText = (summary: SellerSummary): string => {
    const menu = summary.menu;
    const parts = [t('home.sum.people', { count: summary.people })];
    if (!menu) parts.push(t('home.sum.noMenu'));
    else {
      const day = formatCookingDate(menu.cookingDate, lang);
      if (menu.state === 'live') {
        parts.push(t('home.sum.live', { day }), t('home.sum.orders', { count: summary.orders }));
      } else {
        parts.push(
          t(menu.state === 'finished' ? 'home.sum.finished' : 'home.sum.notPublished', { day }),
        );
      }
    }
    parts.push(
      summary.lastActiveAt
        ? t('home.sum.active', { when: formatDay(summary.lastActiveAt, lang) })
        : t('home.sum.neverActive'),
    );
    return parts.join(' · ');
  };

  const when = (device: DeviceView) =>
    t('home.seller.lastUsed', { when: formatDayTime(device.lastUsedAt, lang) });

  const tools = (
    <BarTools>
      <BarTitle>{t('home.title')}</BarTitle>
      <LanguageSwitch compact />
      <BarSignOut type="button" onClick={() => void leave()}>
        {t('home.signOut')}
      </BarSignOut>
    </BarTools>
  );

  return (
    <Shell>
      {top ? top(tools) : <PlainBar>{tools}</PlainBar>}
      <Layout>
        <AdminPanel>
          <AdminInner>
            <Sub>{t('home.title')}</Sub>
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
                            if (next !== '' && next !== device.name)
                              void renameMine(device.id, next);
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
                            <Button onClick={() => setRenaming(null)}>
                              {t('home.mine.cancel')}
                            </Button>
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
                            <Button
                              onClick={() => setRenaming({ id: device.id, name: device.name })}
                            >
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
            <MaintenancePanel />
            <BackupMinutesPanel />
            <ProblemsPanel slugs={slugs} refreshKey={refreshKey} />
            <Muted>{t('home.privacy')}</Muted>
          </AdminInner>
        </AdminPanel>

        <SellersPanel>
          <Sub>{t('home.sellers')}</Sub>
          <RefreshBar loadedAt={loadedAt} onRefresh={refresh} />
          <Toggle
            ref={addButton}
            type="button"
            aria-haspopup="dialog"
            onClick={() => setPanel({ kind: 'add' })}
          >
            <RowName>{t('home.add.title')}</RowName>
            <Chevron>
              <Icon name="forward" />
            </Chevron>
          </Toggle>

          {loadProblem ? <Message $bad>{loadProblem}</Message> : null}
          {sellers === null && !loadProblem ? <Muted>{t('loading')}</Muted> : null}
          {sellers && sellers.length === 0 ? <Muted>{t('home.noSellers')}</Muted> : null}
          {sellers && sellers.length > 0 ? (
            <RowList aria-label={t('home.sellersTable')}>
              {sellers.map((seller) => {
                const devices = counts[seller.id];
                return (
                  <li key={seller.id}>
                    <Toggle
                      ref={(element) => {
                        rows.current[seller.id] = element;
                      }}
                      type="button"
                      aria-haspopup="dialog"
                      aria-current={panel?.kind === 'seller' && panel.id === seller.id}
                      onClick={() => {
                        setAdded(null);
                        setPanel({ kind: 'seller', id: seller.id });
                      }}
                    >
                      <RowName>{seller.name}</RowName>
                      <RowMeta>{`/${seller.slug}`}</RowMeta>
                      <RowMeta>
                        {t('home.createdOn', { date: formatDay(seller.createdAt, lang) })}
                      </RowMeta>
                      {seller.paused ? <PauseLabel pause={seller.paused} /> : null}
                      <RowMeta>
                        {devices === undefined ? '…' : t('home.devicesCount', { count: devices })}
                      </RowMeta>
                      <Chevron>
                        <Icon name="forward" />
                      </Chevron>
                      {seller.summary ? (
                        <RowSummary>{summaryText(seller.summary)}</RowSummary>
                      ) : null}
                    </Toggle>
                  </li>
                );
              })}
            </RowList>
          ) : null}
        </SellersPanel>
      </Layout>
      {panel?.kind === 'add' ? (
        <SlideOver
          label={t('home.add.title')}
          closeLabel={t('home.close')}
          onClose={closePanel}
          returnFocus={returnFocus}
          width="36rem"
        >
          <PanelBody>
            <FormSection onSubmit={(event) => void addSeller(event)}>
              <SmallHeading>{t('home.add.title')}</SmallHeading>
              <DraftNotice draft={addDraft} />
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
              <Button type="submit" variant="primary" disabled={!canAdd}>
                {t('home.add.button')}
              </Button>
            </FormSection>
          </PanelBody>
        </SlideOver>
      ) : null}
      {panelSeller ? (
        <SlideOver
          label={panelSeller.name}
          closeLabel={t('home.close')}
          onClose={closePanel}
          returnFocus={returnFocus}
          width="36rem"
        >
          <SellerDetails
            key={panelSeller.id}
            seller={panelSeller}
            refused={refusedHere}
            onSeller={changeSeller}
            onDevices={setDevices}
            notice={added}
            refreshKey={refreshKey}
            {...(images ? { images } : {})}
          />
        </SlideOver>
      ) : null}
      {bottom}
    </Shell>
  );
}
