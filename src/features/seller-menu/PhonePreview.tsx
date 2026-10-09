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

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; menu: MenuResponse };

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
  // The preview is rebuilt when the menu changes (a price, a limit, a place).
  const signature = JSON.stringify([view.menu, view.dishes, view.pickupPoints]);
  useEffect(() => {
    let live = true;
    void fetchSellerMenu(undefined, currentSellerSlug()).then((result) => {
      if (!live) return;
      if (!result.ok) {
        setState({ status: 'error' });
        return;
      }
      const { seller, kitchen, week, ordering, items } = result.data;
      const menu = strip({ seller, kitchen, week, ordering, items: [] }, items);
      setState(menu ? { status: 'ready', menu } : { status: 'error' });
    });
    return () => {
      live = false;
    };
  }, [signature]);
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
        {state.status === 'ready' ? (
          <I18nextProvider i18n={clone}>
            {render({ slug: state.menu.seller.slug, menu: state.menu })}
          </I18nextProvider>
        ) : state.status === 'error' ? (
          <Muted role="alert">{t('error')}</Muted>
        ) : (
          <Muted role="status">{t('loading')}</Muted>
        )}
      </Frame>
    </div>
  );
}
