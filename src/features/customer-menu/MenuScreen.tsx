import { useCallback, useEffect } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatMoney } from '../../../shared/money';
import { bannerAlt, phoneBannerSrc } from '../../../shared/kitchenImages';
import { formatPhone } from '../../../shared/phone';
import { pickText } from '../../../shared/text';
import { whatsAppUrl } from '../../api/device/whatsapp';
import { Button, ImageSlot } from '../../ui';
import { menuRequested, quantitySet } from './customerSlice';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { CUSTOMER_NS } from './i18n/register';
import { ItemRow } from './ItemRow';
import { Block, Muted, Page, StateMessage, Strong, Title, useLang } from './layout';
import { ScreenBoundary } from './ScreenBoundary';
import { selectBasket, selectBasketCount, selectBasketTotalCents, selectMenu } from './selectors';

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

const PreviewNote = styled(Muted)`
  display: block;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg} 0;
`;

const Items = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;

const Steps = styled.ol`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

const Closed = styled(Block)`
  background: ${({ theme }) => theme.colour.surface};
`;

const Bar = styled.div`
  position: sticky;
  /* Above the customer tab bar when there is one (set by the app shell). */
  bottom: var(--customer-tabbar-height, 0rem);
  margin-top: auto;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.bg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;

// The banner is the first thing on the page; the top safe area is padded in the banner's own colour.
const BannerTop = styled.div<{ $background?: string }>`
  padding-top: env(safe-area-inset-top);
  background: ${({ theme, $background }) => $background ?? theme.colour.surfaceAlt};
`;

const NameRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg} 0;
`;

const NameText = styled.div`
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

type Props = Readonly<{
  /** The seller whose menu this is (from the route). */
  slug: string;
  onViewBasket: () => void;
  /**
   * The seller's preview (D-019): this menu is shown instead of loading one, and nothing can be
   * ordered (steppers off, no basket bar).
   */
  preview?: MenuResponse;
}>;

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
      {week.delivery.available ? (
        <>
          <dt>{t('menu.deliveryAvailable')}</dt>
          <dd>{t('menu.deliveryNote')}</dd>
        </>
      ) : (
        <>
          <dt>{t('menu.deliveryLabel')}</dt>
          <dd>{t('menu.noDelivery')}</dd>
        </>
      )}
    </Week>
  );
}

// The seller's number stays on one line; it never wraps mid-number.
const NoWrap = styled.span`
  white-space: nowrap;
`;

function HowItWorks({ kitchen }: Readonly<{ kitchen: MenuResponse['kitchen'] }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  return (
    <Block as="section" aria-label={t('menu.howTitle')}>
      <Strong>{t('menu.howTitle')}</Strong>
      <Steps>
        <li>{t('menu.how1')}</li>
        <li>{t('menu.how2')}</li>
        <li>
          {kitchen.whatsappNumber ? (
            <Trans
              t={t}
              i18nKey="menu.how3"
              values={{ kitchen: kitchen.name, number: formatPhone(kitchen.whatsappNumber) }}
              components={{ num: <NoWrap /> }}
            />
          ) : (
            t('menu.how3Generic')
          )}
        </li>
      </Steps>
    </Block>
  );
}

function ClosedBlock({ data }: Readonly<{ data: MenuResponse }>) {
  const { t } = useTranslation(CUSTOMER_NS);
  const reason = data.ordering.reason === 'cutoff_passed' ? 'closedCutoff' : 'closedByseller';
  const openWhatsApp = useCallback(() => {
    window.open(
      whatsAppUrl(undefined, data.kitchen.whatsappNumber),
      '_blank',
      'noopener,noreferrer',
    );
  }, [data.kitchen.whatsappNumber]);
  return (
    <Closed role="status">
      <Strong>{t('menu.closedTitle')}</Strong>
      <Muted>{t(`menu.${reason}`)}</Muted>
      <Button variant="primary" onClick={openWhatsApp}>
        {t('menu.messageSeller')}
      </Button>
    </Closed>
  );
}

function MenuContent({ slug, onViewBasket, preview }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const stored = useSelector(selectMenu);
  const menu = preview ? ({ status: 'ready', data: preview } as const) : stored;
  const basket = useSelector(selectBasket);
  const count = useSelector(selectBasketCount);
  const totalCents = useSelector(selectBasketTotalCents);

  const load = useCallback(() => {
    if (!preview) dispatch(menuRequested(slug));
  }, [dispatch, slug, preview]);
  useEffect(load, [load]);

  const onQty = useCallback(
    (itemId: string, qty: number) => dispatch(quantitySet({ itemId, qty })),
    [dispatch],
  );

  return (
    <Page>
      {menu.status === 'ready' ? (
        <>
          <BannerTop $background={menu.data.kitchen.images?.bannerBackground}>
            <ImageSlot
              aspectRatio="2 / 1"
              background={menu.data.kitchen.images?.bannerBackground}
              src={phoneBannerSrc(menu.data.kitchen.images) ?? menu.data.kitchen.bannerImageUrl}
              alt={bannerAlt(menu.data.kitchen, lang)}
              placeholder={t('menu.bannerImage')}
            />
          </BannerTop>
          <NameRow>
            <NameText>
              <Title>{menu.data.kitchen.name}</Title>
              <Muted>{pickText(menu.data.kitchen.tagline, lang)}</Muted>
            </NameText>
            <LanguageSwitch />
          </NameRow>
          {menu.data.ordering.open || preview ? null : <ClosedBlock data={menu.data} />}
          <WeekBlock data={menu.data} lang={lang} />
          {preview ? <PreviewNote>{t('menu.previewOff')}</PreviewNote> : null}
          <Items>
            {menu.data.items.map((item) => (
              <ItemRow
                key={item.id}
                item={item}
                qty={basket[item.id] ?? 0}
                lang={lang}
                onQty={onQty}
                closed={!menu.data.ordering.open || preview !== undefined}
              />
            ))}
          </Items>
          <HowItWorks kitchen={menu.data.kitchen} />
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
      {!preview && count > 0 && !(menu.status === 'ready' && !menu.data.ordering.open) ? (
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
