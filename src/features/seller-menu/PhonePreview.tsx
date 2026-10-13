import { useEffect, useMemo, useState } from 'react';
import { I18nextProvider, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, MenuItemView, SellerMenuItemView } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { fetchSellerMenu } from '../../api/client';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Segmented } from '../../ui';
import { MENU_NS } from './i18n/register';
import { GroupLabel, Muted } from './menuShared';
import type { MenuView } from '../../../shared/menusContract';
import type { MenuSlots } from './slots';

// "What customers see": the customer's menu screen, read-only (nothing can be ordered), in EN or ID.
// It reads the menu the way a customer's phone would (chef data is stripped before it gets here).

const Frame = styled.div`
  width: 100%;
  max-width: 22rem;
  height: 38rem;
  overflow-y: auto;
  border: 0.375rem solid ${({ theme }) => theme.c.line};
  border-radius: 1.75rem;
  background: ${({ theme }) => theme.c.surf};
  /* The customer screen is a page; keep it inside the frame. */
  contain: paint;
`;
const Cover = styled.img`
  display: block;
  width: 100%;
  aspect-ratio: 3 / 2;
  object-fit: cover;
`;
const Head = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.md};
`;

type Base = Pick<MenuResponse, 'seller' | 'kitchen' | 'week' | 'ordering'>;
type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; base: Base };

/** The customer's view of this menu: the server's, with the chef fields taken off. */
function strip(menu: MenuResponse | null, items: Array<SellerMenuItemView>): MenuResponse | null {
  if (!menu) return null;
  return {
    ...menu,
    items: items.map((item) => {
      const copy: Partial<SellerMenuItemView> = { ...item };
      delete copy.chefId;
      delete copy.manualSoldOut;
      return copy as MenuItemView;
    }),
  };
}

export function PhonePreview({
  view,
  render,
}: Readonly<{ view: MenuView; render: MenuSlots['preview'] }>) {
  const { t, i18n } = useTranslation(MENU_NS);
  const [lang, setLang] = useState<Language>(i18n.resolvedLanguage === 'id' ? 'id' : 'en');
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  // Read once when the preview opens: the seller, kitchen and ordering state are not in the wizard's
  // data. Dishes, date, cut-off, delivery and places come from `view`, so a save needs no new request.
  useEffect(() => {
    let live = true;
    void fetchSellerMenu(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      if (!result.ok) {
        setState({ status: 'error' });
        return;
      }
      const { seller, kitchen, week, ordering } = result.data;
      setState({ status: 'ready', base: { seller, kitchen, week, ordering } });
    });
    return () => {
      live = false;
    };
  }, []);
  const menu = useMemo(() => {
    if (state.status !== 'ready') return null;
    const { base } = state;
    const week = {
      ...base.week,
      cookingDate: view.menu.cookingDate,
      cutoffAt: view.menu.cutoffAt,
      delivery: view.menu.delivery,
      pickupPoints: view.pickupPoints,
    };
    return strip({ ...base, week, items: [] }, view.dishes);
  }, [state, view]);
  const clone = useMemo(() => i18n.cloneInstance({ lng: lang }), [i18n, lang]);
  const options = [
    { value: 'en' as const, label: 'EN' },
    { value: 'id' as const, label: 'ID' },
  ];
  return (
    <div>
      <Head>
        <GroupLabel as="h2">{t('check.customersSee')}</GroupLabel>
        <Segmented
          options={options}
          value={lang}
          onChange={setLang}
          label={t('check.previewLang')}
        />
      </Head>
      <Frame role="region" aria-label={t('check.customersSee')}>
        {view.menu.pictureRef ? <Cover src={view.menu.pictureRef} alt="" /> : null}
        {menu ? (
          <I18nextProvider i18n={clone}>{render({ slug: menu.seller.slug, menu })}</I18nextProvider>
        ) : state.status === 'error' ? (
          <Muted role="alert">{t('error')}</Muted>
        ) : (
          <Muted role="status">{t('loading')}</Muted>
        )}
      </Frame>
    </div>
  );
}
