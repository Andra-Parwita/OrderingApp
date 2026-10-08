import { useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { Button } from '../../ui';
import { menuRequested, quantitySet } from './customerSlice';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { CUSTOMER_NS } from './i18n/register';
import { ItemRow } from './ItemRow';
import { Block, Muted, Page, StateMessage, Strong, Title, TopBar, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import { selectBasket, selectBasketCount, selectBasketTotalCents, selectMenu } from './selectors';

const Banner = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(${({ theme }) => theme.minTapTarget} * 2);
  background: ${({ theme }) => theme.colour.surface};
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const BannerImage = styled.img`
  display: block;
  width: 100%;
  height: calc(${({ theme }) => theme.minTapTarget} * 2);
  object-fit: cover;
`;

const Week = styled.dl`
  margin: 0;
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.surface};
  font-size: ${({ theme }) => theme.type.size.sm};

  dt {
    color: ${({ theme }) => theme.colour.textMuted};
  }
  dd {
    margin: 0;
    font-weight: ${({ theme }) => theme.type.weight.strong};
  }
`;

const Items = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Bar = styled.div`
  position: sticky;
  bottom: 0;
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.bg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;

type Props = Readonly<{ onViewBasket: () => void; onMyOrders: () => void }>;

function WeekBlock({ data, lang }: Readonly<{ data: MenuResponse; lang: Language }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { week } = data;
  const pickup = week.pickupPoints[0];
  return (
    <Week>
      <dt>{t('menu.cooking')}</dt>
      <dd>{formatCookingDate(week.cookingDate, lang)}</dd>
      <dt>{t('menu.orderBy')}</dt>
      <dd>{formatCutoff(week.cutoffAt, lang)}</dd>
      {pickup ? (
        <>
          <dt>{t('menu.pickup')}</dt>
          <dd>
            {formatWindow(pickup.window.start, pickup.window.end, lang)}, {pickup.place}
          </dd>
        </>
      ) : null}
      <dt>{t('menu.deliveryAvailable')}</dt>
      <dd>{week.delivery.available ? t('menu.deliveryNote') : t('menu.noDelivery')}</dd>
    </Week>
  );
}

function MenuContent({ onViewBasket, onMyOrders }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const menu = useSelector(selectMenu);
  const basket = useSelector(selectBasket);
  const count = useSelector(selectBasketCount);
  const totalCents = useSelector(selectBasketTotalCents);

  const load = useCallback(() => {
    dispatch(menuRequested());
  }, [dispatch]);
  useEffect(load, [load]);

  const onQty = useCallback(
    (itemId: string, qty: number) => dispatch(quantitySet({ itemId, qty })),
    [dispatch],
  );

  return (
    <Page>
      <TopBar>
        <Button variant="quiet" onClick={onMyOrders}>
          {t('common.myOrders')}
        </Button>
        <LanguageSwitch />
      </TopBar>
      {menu.status === 'ready' ? (
        <>
          {menu.data.kitchen.bannerImageUrl ? (
            <BannerImage src={menu.data.kitchen.bannerImageUrl} alt="" />
          ) : (
            <Banner aria-hidden="true">{t('menu.bannerImage')}</Banner>
          )}
          <Block>
            <Title>{menu.data.kitchen.name}</Title>
            <Muted>{pickText(menu.data.kitchen.tagline, lang)}</Muted>
          </Block>
          <WeekBlock data={menu.data} lang={lang} />
          <Items>
            {menu.data.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                qty={basket[item.id] ?? 0}
                lang={lang}
                onQty={onQty}
              />
            ))}
          </Items>
        </>
      ) : menu.status === 'error' ? (
        <StateMessage
          alert
          text={menu.code === 'week_not_published' ? t('menu.notPublished') : t('menu.loadError')}
          onRetry={load}
        />
      ) : (
        <StateMessage text={t('common.loading')} />
      )}
      {count > 0 ? (
        <Bar>
          <Strong>
            {t('menu.items', { count })} · {formatMoney(totalCents, lang)}
          </Strong>
          <Button variant="primary" onClick={onViewBasket}>
            {t('menu.viewBasket')} ›
          </Button>
        </Bar>
      ) : null}
    </Page>
  );
}

export function MenuScreen(props: Props) {
  return (
    <ScreenBoundary>
      <MenuContent {...props} />
    </ScreenBoundary>
  );
}
