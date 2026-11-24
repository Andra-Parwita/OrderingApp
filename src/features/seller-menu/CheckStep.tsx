import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { Icon } from '../../ui';
import { MENU_NS } from './i18n/register';
import { GroupLabel, LinkButton, Muted } from './menuShared';
import type { MenuData } from './menuSlice';
import { usePhone } from './phone/usePhone';
import { PhonePreview } from './PhonePreview';
import type { MenuSlots } from './slots';
import { PricesTable } from './PricesTable';
import { worries } from './worry';

// Step 3: per-menu prices, limits and chefs; a summary of the details; "Worth a look" (never a
// block, D-062); and the customer's phone view in EN and ID.

const Layout = styled.div`
  display: grid;
  grid-template-columns: minmax(0, 1fr) 24rem;
  min-height: 0;

  @media (max-width: 62.5rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Left = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;

  h2 {
    margin: 0;
    font-size: 1.125rem;
  }
  @media (max-width: 37.4375rem) {
    gap: ${({ theme }) => theme.spacing.xl};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;

    h2 {
      font-size: 1rem;
    }
  }
`;
/** The heading and the prices: a little closer than the blocks of the page on a phone. */
const DishesBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  min-width: 0;

  @media (max-width: 37.4375rem) {
    gap: ${({ theme }) => theme.spacing.sm};
  }
`;
const Right = styled.aside`
  min-width: 0;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  border-left: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Head = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: 37.4375rem) {
    flex-wrap: wrap;
  }
`;
const Summary = styled.dl`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
  margin: 0;

  dt {
    display: inline;
    color: ${({ theme }) => theme.c.muted};
  }
  dd {
    display: inline;
    margin: 0 0 0 ${({ theme }) => theme.spacing.xs};
    font-weight: 600;
  }
  /* A phone: one line per fact, the label on the left and the value beside it. */
  @media (max-width: 37.4375rem) {
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.sm};

    > div {
      display: grid;
      grid-template-columns: 7rem minmax(0, 1fr);
      gap: ${({ theme }) => theme.spacing.sm};
    }
    dd {
      margin: 0;
    }
  }
`;
const Time = styled.span`
  white-space: nowrap;
`;
const Comma = styled.span``;
const Place = styled.span`
  @media (max-width: 37.4375rem) {
    display: block;

    ${Comma} {
      display: none;
    }
  }
`;
/** A phone: no side padding, so the link's text lines up with the text beside and above it. */
const FixLink = styled(LinkButton)`
  @media (max-width: 37.4375rem) {
    padding-inline: 0;
  }
`;
const Worry = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};

  > span {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
  svg {
    flex: none;
    color: ${({ theme }) => theme.c.warn};
  }
  /* A phone: the icon, then the text and the link in one column under each other. */
  @media (max-width: 37.4375rem) {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;

    > span {
      display: contents;
    }
    svg {
      margin-top: 0.125rem;
    }
    ${FixLink} {
      grid-column: 2;
      justify-self: start;
    }
  }
`;
const Worries = styled.ul`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  padding: 0;
  list-style: none;
`;

export function CheckStep({
  data,
  lang,
  onGo,
  renderPreview,
}: Readonly<{
  data: MenuData;
  lang: Language;
  onGo: (where: 'dishes' | 'details') => void;
  renderPreview: MenuSlots['preview'];
}>) {
  const { t } = useTranslation(MENU_NS);
  const phone = usePhone();
  const { view } = data;
  const { menu } = view;
  const found = useMemo(() => worries(view, new Date()), [view]);
  const pickup = view.pickupPoints.length > 0;
  // Each "place time" stays together: a time never splits, and on a phone each place has its own line.
  const places = view.pickupPoints.map((place, index) => (
    <Place key={place.place + String(index)}>
      {place.place} <Time>{formatWindow(place.window.start, place.window.end, lang)}</Time>
      {index < view.pickupPoints.length - 1 ? <Comma>, </Comma> : null}
    </Place>
  ));
  const how = menu.delivery.available
    ? t(pickup ? 'check.pickupOrDelivery' : 'check.deliveryOnly')
    : t(pickup ? 'check.pickupOnly' : 'check.noWay');
  const dishesBlock = (
    <DishesBlock>
      <Head>
        <h2>
          {t('check.dishesOn')}{' '}
          <Muted as="span">
            {t('live.nOf', {
              n: view.dishes.filter((dish) => dish.groupId === undefined).length,
              max: MAX_MENU_ITEMS,
            })}
          </Muted>
        </h2>
        <FixLink onClick={() => onGo('dishes')}>{t('check.addOrRemove')}</FixLink>
      </Head>
      <PricesTable data={data} lang={lang} />
    </DishesBlock>
  );
  const detailsBlock = (
    <div>
      <Head>
        <h2>{t('check.details')}</h2>
        <FixLink onClick={() => onGo('details')}>{t('check.editDetails')}</FixLink>
      </Head>
      <Summary>
        <div>
          <dt>{t('check.cookingDay')}</dt>
          <dd>{formatCookingDate(menu.cookingDate, lang)}</dd>
        </div>
        <div>
          <dt>{t('check.ordersClose')}</dt>
          <dd>{formatCutoff(menu.cutoffAt, lang)}</dd>
        </div>
        <div>
          <dt>{t('check.how')}</dt>
          <dd>{how}</dd>
        </div>
        {pickup ? (
          <div>
            <dt>{t('check.pickup')}</dt>
            <dd>{places}</dd>
          </div>
        ) : null}
      </Summary>
    </div>
  );
  const worthBlock = (
    <div>
      <h2>{t('check.worth')}</h2>
      {found.length === 0 ? (
        <Muted role="status">{t('check.allGood')}</Muted>
      ) : (
        <Worries>
          {found.map((worry) => {
            const fix = worry.fix;
            return (
              <Worry key={worry.id}>
                <span>
                  <Icon name="warning" />
                  <span>{t(`worry.${worry.id}`, { count: worry.count ?? 0 })}</span>
                </span>
                {fix === 'prices' ? null : (
                  <FixLink onClick={() => onGo(fix)}>{t(`worry.fix.${worry.id}`)}</FixLink>
                )}
              </Worry>
            );
          })}
        </Worries>
      )}
      <GroupLabel as="p" style={{ marginTop: '0.5rem' }}>
        {t('check.neverBlock')}
      </GroupLabel>
    </div>
  );
  // Plan 134 (phone): one column, "Worth a look" first; the customer-phone preview is left out (the
  // phone is already that size).
  if (phone) {
    return (
      <Left>
        {worthBlock}
        {dishesBlock}
        {detailsBlock}
      </Left>
    );
  }
  return (
    <Layout>
      <Left>
        {dishesBlock}
        {detailsBlock}
        {worthBlock}
      </Left>
      <Right>
        <PhonePreview view={view} render={renderPreview} />
      </Right>
    </Layout>
  );
}
