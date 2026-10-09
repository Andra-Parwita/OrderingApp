import { useMemo, type ComponentType } from 'react';
import type { MenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import {
  DishesView,
  FullPictureViewer,
  HowItWorksView,
  MenuErrorView,
  MenuHomeView,
  NotPublishedView,
  useLang,
} from '../../features/customer-menu';
import logoWide from '../../../uxDesign/customer/design/assets/logo-wide.png?url';
import menuPicture from '../../../uxDesign/customer/design/assets/menu-picture.jpg?url';
import phoneBanner from '../../../uxDesign/customer/design/assets/phone-banner.jpg?url';
import type { FixtureProps } from './types';

// The menu screens (plan 004 stage 2) fed from fixtures.json: the fixtures are turned into the
// same MenuResponse the real API serves, then handed to the real presentational views. No network.
// The design's pictures are used straight from uxDesign/ (this page is dev only).

function menuFrom({ data, state }: FixtureProps): MenuResponse {
  const { kitchen, menu } = data;
  const paused = state['menu.takingOrders'] === false || !menu.takingOrders;
  const now = typeof state['now'] === 'string' ? Date.parse(state['now']) : null;
  const cutoffPassed = now !== null && now >= Date.parse(menu.orderBy);
  const items: Array<MenuItemView> = menu.dishes.map((dish) => ({
    id: dish.id,
    name: dish.name,
    description: dish.description,
    size: dish.size,
    priceCents: Math.round(dish.price * 100),
    remaining: dish.left,
    soldOut: dish.soldOut,
  }));
  return {
    seller: { id: 's1', slug: kitchen.slug, name: kitchen.cook },
    kitchen: {
      sellerId: 's1',
      name: kitchen.name,
      tagline: kitchen.tagline,
      whatsappNumber: '61412345678',
      images: { phoneBanner, railImage: logoWide, bannerBackground: '#E9E3CF' },
    },
    week: {
      cookingDate: menu.cookingDate,
      cutoffAt: menu.orderBy,
      status: 'published',
      pickupPoints: menu.pickupPlaces.map((place) => ({
        id: place.id,
        place: place.name,
        directions: place.directions,
        window: { start: place.from, end: place.to },
      })),
      delivery: { available: menu.delivery.available, note: menu.delivery.note },
    },
    items,
    ordering: paused
      ? { open: false, reason: 'closed_by_seller' }
      : cutoffPassed
        ? { open: false, reason: 'cutoff_passed' }
        : { open: true },
    pictureUrl: menuPicture,
  };
}

const noop = () => undefined;

function Home(props: FixtureProps) {
  const lang = useLang();
  const data = useMemo(() => menuFrom(props), [props]);
  return (
    <MenuHomeView
      data={data}
      lang={lang}
      onSeeDishes={noop}
      onHowItWorks={noop}
      onMessageSeller={noop}
    />
  );
}

function FullPicture(props: FixtureProps) {
  const data = useMemo(() => menuFrom(props), [props]);
  return (
    <FullPictureViewer
      src={data.pictureUrl ?? ''}
      title="Menu for Sat 17 Oct"
      onClose={noop}
      onSeeDishes={noop}
    />
  );
}

function Dishes(props: FixtureProps) {
  const lang = useLang();
  const data = useMemo(() => menuFrom(props), [props]);
  const basket = useMemo(
    () => Object.fromEntries(props.data.basket.map((line) => [line.dishId, line.qty])),
    [props.data.basket],
  );
  const count = props.data.basket.reduce((sum, line) => sum + line.qty, 0);
  const totalCents = data.items.reduce(
    (sum, item) => sum + item.priceCents * (basket[item.id] ?? 0),
    0,
  );
  return (
    <DishesView
      data={data}
      basket={basket}
      lang={lang}
      onQty={noop}
      readOnly={!data.ordering.open}
      count={count}
      totalCents={totalCents}
      onBack={noop}
      onViewBasket={noop}
    />
  );
}

function HowItWorks(props: FixtureProps) {
  const data = useMemo(() => menuFrom(props), [props]);
  return <HowItWorksView data={data} onBack={noop} onSeeDishes={noop} />;
}

function NotPublished(props: FixtureProps) {
  const lang = useLang();
  const data = useMemo(() => menuFrom(props), [props]);
  return (
    <NotPublishedView
      kitchen={data.kitchen}
      cook={data.seller.name}
      lang={lang}
      onMessageSeller={noop}
    />
  );
}

function LoadError() {
  return <MenuErrorView onRetry={noop} />;
}

export const MENU_FIXTURE_SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  'menu-home': Home,
  'menu-full-picture': FullPicture,
  'menu-dishes': Dishes,
  'menu-how-it-works': HowItWorks,
  'menu-paused': Home,
  'menu-closed': Home,
  'menu-not-published': NotPublished,
  'menu-load-error': LoadError,
};
