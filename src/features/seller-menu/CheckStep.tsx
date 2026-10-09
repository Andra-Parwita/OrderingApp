import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate, formatCutoff, formatWindow } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { Icon } from '../../ui';
import { MENU_NS } from './i18n/register';
import { GroupLabel, LinkButton, Muted } from './menuShared';
import type { MenuData } from './menuSlice';
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
`;
const Worry = styled.li`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.warnTint};

  span {
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  }
  svg {
    color: ${({ theme }) => theme.c.warn};
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
  const { view } = data;
  const { menu } = view;
  const found = useMemo(() => worries(view, new Date()), [view]);
  const places = view.pickupPoints
    .map((place) => `${place.place} ${formatWindow(place.window.start, place.window.end, lang)}`)
    .join(', ');
  return (
    <Layout>
      <Left>
        <Head>
          <h2>
            {t('check.dishesOn')}{' '}
            <Muted as="span">{t('live.nOf', { n: view.dishes.length, max: 10 })}</Muted>
          </h2>
          <LinkButton onClick={() => onGo('dishes')}>{t('check.addOrRemove')}</LinkButton>
        </Head>
        <PricesTable data={data} lang={lang} />
        <div>
          <Head>
            <h2>{t('check.details')}</h2>
            <LinkButton onClick={() => onGo('details')}>{t('check.editDetails')}</LinkButton>
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
              <dt>{t('check.pickup')}</dt>
              <dd>{places || t('check.nowhere')}</dd>
            </div>
            <div>
              <dt>{t('check.delivery')}</dt>
              <dd>{menu.delivery.available ? t('check.on') : t('check.off')}</dd>
            </div>
          </Summary>
        </div>
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
                      {t(`worry.${worry.id}`, { count: worry.count ?? 0 })}
                    </span>
                    {fix === 'prices' ? null : (
                      <LinkButton onClick={() => onGo(fix)}>
                        {t(`worry.fix.${worry.id}`)}
                      </LinkButton>
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
      </Left>
      <Right>
        <PhonePreview view={view} render={renderPreview} />
      </Right>
    </Layout>
  );
}
