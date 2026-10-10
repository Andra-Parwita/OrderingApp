import { useCallback, useEffect, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { MenuResponse } from '../../../shared/menuContract';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { setKitchenBrand } from '../../theme/kitchenBrand';
import { menuRequested, quantitySet } from './customerSlice';
import { DishesView, DishList } from './DishesView';
import { HowItWorksView } from './HowItWorksView';
import { hasSeenHowItWorks, markHowItWorksSeen } from './howItWorksSeen';
import { CUSTOMER_NS } from './i18n/register';
import { useLang } from './layout';
import { MenuErrorView, MenuLoadingView } from './MenuLoadStates';
import { MenuHomeView, NotPublishedView } from './MenuHomeView';
import { ScreenBoundary } from './ScreenBoundary';
import {
  selectBasket,
  selectBasketCount,
  selectBasketTotalCents,
  selectMenu,
  selectMenuSlug,
} from './selectors';

// The routed menu screens: menu home, dishes and how ordering works. Each loads the menu through
// the store and hands it to a presentational view (the fixtures page feeds the same views).

function useMenuData(slug: string, preview?: MenuResponse) {
  const dispatch = useDispatch();
  const stored = useSelector(selectMenu);
  const storedSlug = useSelector(selectMenuSlug);
  // Until the request for this slug has started, the stored menu may be another seller's.
  const menu =
    preview !== undefined
      ? ({ status: 'ready', data: preview } as const)
      : storedSlug === slug
        ? stored
        : ({ status: 'loading' } as const);

  // The kitchen's colours on its customer pages (D-064). Not in the seller's preview.
  const theme = menu.status === 'ready' ? (menu.data.theme ?? 'onde') : undefined;
  useEffect(() => {
    if (theme !== undefined && !preview) setKitchenBrand(theme);
  }, [theme, preview]);

  const load = useCallback(() => {
    if (!preview) dispatch(menuRequested(slug));
  }, [dispatch, slug, preview]);
  useEffect(load, [load]);
  return { menu, load };
}

function openWhatsApp(number: string | undefined): void {
  window.open(whatsAppUrl(undefined, number), '_blank', 'noopener,noreferrer');
}

type MenuData = ReturnType<typeof useMenuData>['menu'];

/** Loading, error and "not out yet" for every menu page; `children` gets a ready menu. */
function MenuGate({
  menu,
  load,
  children,
}: Readonly<{ menu: MenuData; load: () => void; children: (data: MenuResponse) => ReactNode }>) {
  const lang = useLang();
  const onMessage = useCallback(() => openWhatsApp(undefined), []);
  if (menu.status === 'ready') return children(menu.data);
  if (menu.status === 'error') {
    return menu.code === 'week_not_published' ? (
      <NotPublishedView lang={lang} onMessageSeller={onMessage} />
    ) : (
      <MenuErrorView onRetry={load} />
    );
  }
  return <MenuLoadingView />;
}

type HomeProps = Readonly<{
  /** The seller whose menu this is (from the route). */
  slug: string;
  onSeeDishes?: () => void;
  onHowItWorks?: () => void;
  /**
   * The seller's preview (D-019): this menu is shown instead of loading one, and nothing can be
   * ordered.
   */
  preview?: MenuResponse;
}>;

function HomeContent({ slug, onSeeDishes, onHowItWorks, preview }: HomeProps) {
  const lang = useLang();
  const { menu, load } = useMenuData(slug, preview);
  const ready = menu.status === 'ready' ? menu.data : null;
  const showHow = ready?.ordering.open === true && !preview;

  // A first-timer sees "How ordering works" once, by itself; Back returns to the menu.
  useEffect(() => {
    if (showHow && onHowItWorks && !hasSeenHowItWorks()) {
      markHowItWorksSeen();
      onHowItWorks();
    }
  }, [showHow, onHowItWorks]);

  return (
    <MenuGate menu={menu} load={load}>
      {(data) => (
        <MenuHomeView
          data={data}
          lang={lang}
          onSeeDishes={preview ? undefined : onSeeDishes}
          onHowItWorks={preview ? undefined : onHowItWorks}
          onMessageSeller={() => openWhatsApp(data.kitchen.whatsappNumber)}
        />
      )}
    </MenuGate>
  );
}

export function MenuScreen(props: HomeProps) {
  return (
    <ScreenBoundary>
      <HomeContent {...props} />
    </ScreenBoundary>
  );
}

const PreviewNote = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const noop = () => undefined;

/** The seller's preview of a menu: the home screen, then the dishes, nothing orderable. */
export function MenuPreview({ slug, menu }: Readonly<{ slug: string; menu: MenuResponse }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  return (
    <ScreenBoundary>
      <HomeContent slug={slug} preview={menu} />
      <PreviewNote>{t('menu.previewOff')}</PreviewNote>
      <DishList data={menu} basket={{}} lang={lang} onQty={noop} readOnly />
    </ScreenBoundary>
  );
}

type DishesProps = Readonly<{
  slug: string;
  onBack: () => void;
  onViewBasket: () => void;
}>;

function DishesContent({ slug, onBack, onViewBasket }: DishesProps) {
  const lang = useLang();
  const dispatch = useDispatch();
  const { menu, load } = useMenuData(slug);
  const basket = useSelector(selectBasket);
  const count = useSelector(selectBasketCount);
  const totalCents = useSelector(selectBasketTotalCents);
  const onQty = useCallback(
    (itemId: string, qty: number) => dispatch(quantitySet({ itemId, qty })),
    [dispatch],
  );
  return (
    <MenuGate menu={menu} load={load}>
      {(data) => (
        <DishesView
          data={data}
          basket={basket}
          lang={lang}
          onQty={onQty}
          readOnly={!data.ordering.open}
          count={count}
          totalCents={totalCents}
          onBack={onBack}
          onViewBasket={onViewBasket}
        />
      )}
    </MenuGate>
  );
}

export function DishesScreen(props: DishesProps) {
  return (
    <ScreenBoundary>
      <DishesContent {...props} />
    </ScreenBoundary>
  );
}

type HowProps = Readonly<{ slug: string; onBack: () => void; onSeeDishes: () => void }>;

function HowContent({ slug, onBack, onSeeDishes }: HowProps) {
  const { menu, load } = useMenuData(slug);
  useEffect(markHowItWorksSeen, []);
  return (
    <MenuGate menu={menu} load={load}>
      {(data) => <HowItWorksView data={data} onBack={onBack} onSeeDishes={onSeeDishes} />}
    </MenuGate>
  );
}

export function HowItWorksScreen(props: HowProps) {
  return (
    <ScreenBoundary>
      <HowContent {...props} />
    </ScreenBoundary>
  );
}
