import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { AdminSeller, SellerSummary } from '../../../shared/authContract';
import type { Language } from '../../../shared/domain';
import { formatCookingDate, formatDay } from '../../../shared/dates';
import { SELLER_NAME_MAX } from '../../../shared/authContract';
import { SLUG_MAX } from '../../../shared/seller';
import { createSeller, fetchSellers, signOut } from '../../api/auth';
import type { ApiFailure } from '../../api/http';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { brandColour, brandSize } from '../../theme/brandTokens';
import { Button, Icon, SlideOver, TextField } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { DevicesPanel } from './DevicesPanel';
import { BackupMinutesPanel } from './BackupMinutesPanel';
import { MaintenancePanel } from './MaintenancePanel';
import { MessagesPanel } from './MessagesPanel';
import { ProblemsPanel } from './ProblemsPanel';
import { RefreshBar } from './RefreshBar';
import { PauseLabel, SellerDetails } from './SellerDetails';
import { DraftNotice, draftKey, useDraft } from '../../components/draft';
import { slugProblem } from './slug';
import { failureText, FormSection, HiddenText, Message, Muted, SmallHeading, Sub } from './shared';
import { SECTIONS, useSection, type Section } from './useSection';
import { COLUMN_MAX, COLUMN_MIN, COLUMN_STEP, useColumnWidth } from './useColumnWidth';
import { SCREEN_HEIGHT } from '../../theme/screen';

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

// Plan 078: the page itself never scrolls; the brand bar stays and the two panes scroll alone.
const Shell = styled.div`
  display: flex;
  flex-direction: column;
  height: ${SCREEN_HEIGHT};
  overflow: hidden;
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
// Below the bar: a short menu on the left (a dropdown on a phone) and the chosen section.
const Body = styled.div`
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  width: 100%;

  @media (min-width: 48rem) {
    flex-direction: row;
  }
`;
const Nav = styled.nav`
  display: flex;
  flex: none;
  box-sizing: border-box;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
  overflow-y: auto;
  background: ${({ theme }) => theme.c.surf2};

  @media (max-width: 47.99rem) {
    display: none;
  }
`;
const NavButton = styled.button`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: 2.25rem;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.md};
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: ${({ theme }) => theme.type.size.base};
  text-align: start;
  cursor: pointer;
  &:hover {
    background: ${({ theme }) => theme.c.surf};
  }
  &[aria-current='true'] {
    background: ${({ theme }) => theme.c.tint};
    color: ${({ theme }) => theme.c.atext};
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
  &:focus-visible {
    outline: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.atext};
    outline-offset: -${({ theme }) => theme.border.focus};
  }
`;
const NavLabel = styled.span`
  flex: 1;
  min-width: 0;
`;
const Badge = styled.span`
  min-width: 1.25rem;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-align: center;
`;
const Dot = styled.span`
  width: 0.5rem;
  height: 0.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.warn};
`;
// The drag handle on the menu's right edge: a thin hairline, thicker on hover and focus.
const Handle = styled.div`
  display: block;
  flex: none;
  position: relative;
  z-index: 1;
  width: 0.5rem;
  margin: 0 -0.25rem;
  cursor: col-resize;
  touch-action: none;
  &::before {
    content: '';
    position: absolute;
    inset-block: 0;
    inset-inline-start: 0.25rem;
    width: ${({ theme }) => theme.border.hairline};
    background: ${({ theme }) => theme.c.line};
  }
  &:hover::before,
  &:focus-visible::before,
  &[data-drag='true']::before {
    inset-inline-start: 0.1875rem;
    width: 0.1875rem;
    background: ${({ theme }) => theme.c.atext};
  }
  &:focus-visible {
    outline: none;
  }

  @media (max-width: 47.99rem) {
    display: none;
  }
`;
const PickBar = styled.div`
  flex: none;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.c.surf2};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (min-width: 48rem) {
    display: none;
  }
`;
const Pick = styled.select`
  box-sizing: border-box;
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;
const Main = styled.main`
  flex: 1;
  min-width: 0;
  min-height: 0;
  box-sizing: border-box;
  overflow-y: auto;
  padding: ${({ theme }) => theme.spacing.lg};

  @media (min-width: 48rem) {
    padding: ${({ theme }) => theme.spacing.xl} 1.75rem;
  }
`;
// Every section stays mounted (so the menu's counts and dot are known); only the chosen one shows.
const Pane = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  &[hidden] {
    display: none;
  }
  > section:first-child {
    padding-top: 0;
    border-top: 0;
  }
`;
const Head = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const HeadTitle = styled(Sub)`
  flex: 1;
`;
const SellersPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
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
  const [section, choose] = useSection();
  const menu = useColumnWidth();
  const [deviceCount, setDeviceCount] = useState<number | null>(null);
  const [problemCount, setProblemCount] = useState<number | null>(null);
  const [noticeSet, setNoticeSet] = useState(false);
  const [maintenanceOn, setMaintenanceOn] = useState(false);
  const body = useRef<HTMLDivElement | null>(null);
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

  useEffect(() => {
    // Calls that set state after a network round trip, started once on mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadSellers();
  }, [loadSellers]);

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

  const navCount = (id: Section): number | null => {
    if (id === 'sellers') return sellers?.length ?? null;
    if (id === 'problems') return problemCount;
    if (id === 'devices') return deviceCount;
    return null;
  };
  /** The phone dropdown's text: "Sellers (4)", "Announce & maintenance •". */
  const navText = (id: Section): string => {
    const count = navCount(id);
    const mark =
      (id === 'announce' && noticeSet) || (id === 'maintenance' && maintenanceOn) ? ' •' : '';
    return `${t(`home.nav.${id}`)}${count !== null ? ` (${count})` : ''}${mark}`;
  };

  // The drag handle (plan 078): the width follows the pointer and is saved when it is let go.
  const [dragging, setDragging] = useState(false);
  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    setDragging(true);
    event.preventDefault();
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    const left = body.current?.getBoundingClientRect().left ?? 0;
    const root = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
    menu.set((event.clientX - left) / root, false);
  };
  const endDrag = () => {
    if (!dragging) return;
    setDragging(false);
    menu.set(menu.width, true);
  };
  const keyResize = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    menu.set(menu.width + (event.key === 'ArrowRight' ? COLUMN_STEP : -COLUMN_STEP), true);
  };

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
      <PickBar>
        <Pick
          aria-label={t('home.nav.pick')}
          value={section}
          onChange={(event) => choose(event.target.value as Section)}
        >
          {SECTIONS.map((id) => (
            <option key={id} value={id}>
              {navText(id)}
            </option>
          ))}
        </Pick>
      </PickBar>
      <Body ref={body}>
        <Nav aria-label={t('home.nav.label')} style={{ width: `${menu.width}rem` }}>
          {SECTIONS.map((id) => {
            const count = navCount(id);
            return (
              <NavButton
                key={id}
                type="button"
                aria-current={section === id}
                onClick={() => choose(id)}
              >
                <NavLabel>{t(`home.nav.${id}`)}</NavLabel>
                {count !== null ? <Badge>{count}</Badge> : null}
                {(id === 'announce' && noticeSet) || (id === 'maintenance' && maintenanceOn) ? (
                  <>
                    <Dot aria-hidden="true" />
                    <HiddenText>{t('home.nav.noticeSet')}</HiddenText>
                  </>
                ) : null}
              </NavButton>
            );
          })}
        </Nav>
        <Handle
          role="separator"
          aria-orientation="vertical"
          aria-label={t('home.nav.resize')}
          aria-valuenow={menu.width}
          aria-valuemin={COLUMN_MIN}
          aria-valuemax={COLUMN_MAX}
          tabIndex={0}
          data-drag={dragging}
          onPointerDown={startDrag}
          onPointerMove={moveDrag}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onDoubleClick={menu.reset}
          onKeyDown={keyResize}
        />
        <Main>
          <Pane hidden={section !== 'sellers'}>
            <SellersPanel>
              <Head>
                <HeadTitle>{t('home.sellers')}</HeadTitle>
                <RefreshBar loadedAt={loadedAt} onRefresh={refresh} />
              </Head>
              <Muted>{t('home.privacy')}</Muted>
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
                            {devices === undefined
                              ? '…'
                              : t('home.devicesCount', { count: devices })}
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
          </Pane>
          <Pane hidden={section !== 'announce'}>
            <MaintenancePanel part="announce" onActive={setNoticeSet} />
          </Pane>
          <Pane hidden={section !== 'maintenance'}>
            <MaintenancePanel part="mode" onActive={setMaintenanceOn} />
          </Pane>
          <Pane hidden={section !== 'message'}>
            <MessagesPanel sellers={sellers} refused={refusedHere} />
          </Pane>
          <Pane hidden={section !== 'settings'}>
            <BackupMinutesPanel />
          </Pane>
          <Pane hidden={section !== 'problems'}>
            <ProblemsPanel slugs={slugs} refreshKey={refreshKey} onTotal={setProblemCount} />
          </Pane>
          <Pane hidden={section !== 'devices'}>
            <DevicesPanel onCount={setDeviceCount} />
          </Pane>
        </Main>
      </Body>
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
