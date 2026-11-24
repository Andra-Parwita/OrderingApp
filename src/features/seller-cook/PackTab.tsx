import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { packOrder } from '../../api/kitchen';
import { orderPatched } from '../../api/kitchenOrders';
import {
  PackCloseAsk,
  PackReadyAsk,
  PackSheet,
  tickedIdsOf,
  usePackActions,
} from '../../components/pack';
import { Segmented, type SegmentedOption } from '../../ui';
import { ChefFilterControl, useChefFilter } from './ChefFilterControl';
import { isOwnItem } from './cookModel';
import { usePhone } from './CookPhone';
import { selectBags, selectCookMenu } from './cookSelectors';
import type { CookRootState } from './cookSlice';
import { COOK_NS } from './i18n/register';
import { PackBagList } from './PackBagList';
import { PackDetail, type PackBusy } from './PackDetail';
import { nextUnpacked, sortBags, type Bag, type PackSort } from './packModel';

const SORTS: ReadonlyArray<PackSort> = ['time', 'place', 'code'];

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(23rem, 38%) minmax(0, 1fr);
  flex: 1;
  min-height: 0;

  @media (max-width: 52rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const ListPane = styled.div`
  min-width: 0;
  border-right: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (max-width: 52rem) {
    border-right: 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
`;
const SortBar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Centered = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;

/** The ticks of one bag as the seller has them on the page, not saved yet. */
type Draft = { code: string; ids: ReadonlySet<string> };

/**
 * Kitchen · Pack (D-066, plan 132): one bag at a time. A tick changes the page only; Save sends the
 * ticks, Ready sends them with Packed and the order's Ready step (the pack sheet's actions).
 */
export function PackTab() {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const actions = usePackActions();
  const phone = usePhone();
  const chef = useChefFilter();
  const menu = useSelector((state: CookRootState) => selectCookMenu(state));
  const bags = useSelector((state: CookRootState) => selectBags(state, chef.filter));
  const [sort, setSort] = useState<PackSort>('time');
  const [openCode, setOpenCode] = useState<string | null>(null);
  // Phone: a tapped bag opens in the full-screen pack sheet (the one Orders uses).
  const [sheetCode, setSheetCode] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [switchTo, setSwitchTo] = useState<string | null>(null);
  const [askReady, setAskReady] = useState<{ next: boolean } | null>(null);
  const [busy, setBusy] = useState<PackBusy>(null);
  const [failed, setFailed] = useState(false);

  const sorted = useMemo(() => sortBags(bags, sort), [bags, sort]);
  const open: Bag | undefined =
    sorted.find((bag) => bag.order.code === openCode) ??
    sorted.find((bag) => !bag.packed) ??
    sorted[0];

  const sortOptions: ReadonlyArray<SegmentedOption<PackSort>> = SORTS.map((value) => ({
    value,
    label: t(`pack.sort.${value}`),
  }));

  const savedIds = useMemo(() => (open ? tickedIdsOf(open.order) : []), [open]);
  const ticks: ReadonlySet<string> = useMemo(
    () => (draft && open && draft.code === open.order.code ? draft.ids : new Set(savedIds)),
    [draft, open, savedIds],
  );
  const dirty =
    draft !== null &&
    draft.code === open?.order.code &&
    (ticks.size !== savedIds.length || savedIds.some((id) => !ticks.has(id)));

  const openBag = useCallback((code: string) => {
    setOpenCode(code);
    setDraft(null);
    setSwitchTo(null);
    setFailed(false);
  }, []);

  const select = useCallback(
    (code: string) => {
      if (!open || code === open.order.code) return;
      if (dirty) setSwitchTo(code);
      else openBag(code);
    },
    [dirty, open, openBag],
  );

  const toggle = useCallback(
    (itemId: string) => {
      if (!open) return;
      const next = new Set(ticks);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      setDraft({ code: open.order.code, ids: next });
    },
    [open, ticks],
  );

  const save = useCallback(async () => {
    if (!open) return;
    setBusy('save');
    setFailed(false);
    const result = await actions.save(open.order, [...ticks]);
    setBusy(null);
    if (result.ok) setDraft(null);
    else setFailed(true);
  }, [actions, open, ticks]);

  const ready = useCallback(
    async (next: boolean, force: boolean) => {
      if (!open) return;
      setAskReady(null);
      setBusy(next ? 'next' : 'ready');
      setFailed(false);
      const result = await actions.ready(open.order, [...ticks], force);
      setBusy(null);
      if (result.ok) {
        setDraft(null);
        const following = next ? nextUnpacked(sorted, open.order.code) : null;
        if (following) setOpenCode(following.order.code);
      } else if (result.reason === 'unticked') {
        setAskReady({ next });
      } else {
        setFailed(true);
      }
    },
    [actions, open, sorted, ticks],
  );
  // Unticked items warn, never block (D-062): the question names what is missing.
  const unticked = open ? open.order.lines.filter((line) => !ticks.has(line.itemId)) : [];
  const requestReady = useCallback(
    (next: boolean) => {
      if (unticked.length > 0) setAskReady({ next });
      else void ready(next, false);
    },
    [ready, unticked.length],
  );

  const unpack = useCallback(async () => {
    if (!open) return;
    setFailed(false);
    const result = await packOrder(
      open.order.code,
      { packed: false },
      undefined,
      currentSellerSlug(),
    );
    if (result.ok) dispatch(orderPatched(result.data.order));
    else setFailed(true);
  }, [dispatch, open]);

  const sheetBag = phone ? sorted.find((bag) => bag.order.code === sheetCode) : undefined;
  const sheetWhere = sheetBag
    ? sheetBag.place
      ? [t('pack.pickup'), sheetBag.place, ...(sheetBag.time ? [sheetBag.time] : [])].join(' · ')
      : [t('pack.delivery'), ...(sheetBag.private && sheetBag.time ? [sheetBag.time] : [])].join(
          ' · ',
        )
    : '';
  const sheet = sheetBag ? (
    <PackSheet
      key={sheetBag.order.code}
      order={sheetBag.order}
      where={sheetWhere}
      onClose={() => setSheetCode(null)}
      onNext={() => {
        const following = nextUnpacked(sorted, sheetBag.order.code);
        setSheetCode(following ? following.order.code : null);
      }}
    />
  ) : null;

  if (sorted.length === 0 || !open) {
    return (
      <>
        <SortBar>
          <ChefFilterControl {...chef} />
        </SortBar>
        <Centered>{t('pack.empty')}</Centered>
      </>
    );
  }

  return (
    <Layout>
      <ListPane>
        <SortBar>
          <span>{t('pack.orderBy')}</span>
          <Segmented
            compact
            options={sortOptions}
            value={sort}
            onChange={setSort}
            label={t('pack.orderBy')}
          />
          <ChefFilterControl {...chef} />
        </SortBar>
        <PackBagList
          bags={sorted}
          openCode={phone ? (sheetCode ?? '') : open.order.code}
          lang={lang}
          onOpen={phone ? setSheetCode : select}
        />
      </ListPane>
      {sheet}

      {phone ? null : (
        <PackDetail
          bag={open}
          ticks={ticks}
          lang={lang}
          phone={phone}
          busy={busy}
          failed={failed}
          isOther={(line) => !isOwnItem(menu, chef.filter, line)}
          onToggle={toggle}
          onSave={() => void save()}
          onReady={requestReady}
          onUnpack={() => void unpack()}
        />
      )}

      {switchTo ? (
        <PackCloseAsk fixed onKeep={() => setSwitchTo(null)} onClose={() => openBag(switchTo)} />
      ) : null}
      {askReady ? (
        <PackReadyAsk
          fixed
          lines={unticked}
          delivery={open.order.fulfilment !== 'pickup'}
          lang={lang}
          onBack={() => setAskReady(null)}
          onGo={() => void ready(askReady.next, true)}
        />
      ) : null}
    </Layout>
  );
}
