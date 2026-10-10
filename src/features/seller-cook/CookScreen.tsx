import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useInRouterContext, useNavigate } from 'react-router';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { formatDay } from '../../../shared/dates';
import { LiveDot } from '../../components/LiveDot';
import { Button, Icon } from '../../ui';
import { COOK_NS } from './i18n/register';
import { CookTab } from './CookTab';
import { PackTab } from './PackTab';
import { selectBags, selectCookList, selectCookMenu, selectCounted } from './cookSelectors';
import { pollingStarted, pollingStopped, refreshRequested, type CookRootState } from './cookSlice';

type Tab = 'cook' | 'pack';

const LABELS_PATH = '/seller/labels';

const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  color: ${({ theme }) => theme.c.text};
`;
const Head = styled.header`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl} 0;
`;
const Title = styled.h1`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  font-size: 1.75rem;
  line-height: 1.2;
`;
const Sub = styled.p`
  margin: ${({ theme }) => theme.spacing.xs} 0 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Side = styled.div`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
`;
const Tabs = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const TabButton = styled.button<{ $active: boolean }>`
  display: inline-flex;
  align-items: baseline;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.focus} solid
    ${({ theme, $active }) => ($active ? theme.c.fill : 'transparent')};
  background: transparent;
  color: ${({ theme, $active }) => ($active ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-weight: ${({ $active }) => ($active ? 700 : 500)};
  cursor: pointer;
`;
const TabHint = styled.span`
  font-size: 0.875rem;
  font-weight: 400;
`;
const Body = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  min-height: 0;
`;

function tabFromUrl(): Tab {
  return new URLSearchParams(window.location.search).get('tab') === 'pack' ? 'pack' : 'cook';
}

function LabelsButton() {
  const { t } = useTranslation(COOK_NS);
  const navigate = useNavigate();
  const go = useCallback(() => void navigate(LABELS_PATH), [navigate]);
  return (
    <Button onClick={go}>
      <Icon name="print" />
      {t('printLabels')}
    </Button>
  );
}

/** Kitchen (plan 001, stage 8): Cook and Pack on today's cook route; `?tab=pack` opens Pack. */
export function CookScreen() {
  const { t, i18n } = useTranslation(COOK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const dispatch = useDispatch();
  const inRouter = useInRouterContext();
  const [tab, setTab] = useState<Tab>(tabFromUrl);

  useEffect(() => {
    dispatch(pollingStarted());
    return () => {
      dispatch(pollingStopped());
    };
  }, [dispatch]);

  const list = useSelector(selectCookList);
  const menu = useSelector(selectCookMenu);
  const bags = useSelector((state: CookRootState) => selectBags(state));
  const counted = useSelector((state: CookRootState) => selectCounted(state, 'all'));
  const retry = useCallback(() => dispatch(refreshRequested()), [dispatch]);

  const choose = useCallback((next: Tab) => {
    setTab(next);
    try {
      const url = new URL(window.location.href);
      if (next === 'pack') url.searchParams.set('tab', 'pack');
      else url.searchParams.delete('tab');
      window.history.replaceState(window.history.state, '', url);
    } catch {
      // The tab still switches; only the address stays as it was.
    }
  }, []);

  const date = menu ? formatDay(menu.cookingDate, lang) : '';
  const packed = bags.filter((bag) => bag.packed).length;

  return (
    <Page>
      <Head>
        <div>
          <Title>
            {menu ? t('title', { date }) : t('titleBare')}
            {list.status === 'ready' ? <LiveDot fetchFailed={list.live === 'error'} /> : null}
          </Title>
          {tab === 'cook' ? <Sub>{t('subtitle', { count: counted.length })}</Sub> : null}
        </div>
        <Side>
          {tab === 'pack' ? (
            <span>{t('pack.packedCount', { packed, total: bags.length })}</span>
          ) : null}
          {inRouter ? <LabelsButton /> : null}
        </Side>
      </Head>

      <Tabs role="tablist" aria-label={t('tabs.label')}>
        <TabButton
          type="button"
          role="tab"
          aria-selected={tab === 'cook'}
          $active={tab === 'cook'}
          onClick={() => choose('cook')}
        >
          {t('tabs.cook')} <TabHint>{t('tabs.cookSub')}</TabHint>
        </TabButton>
        <TabButton
          type="button"
          role="tab"
          aria-selected={tab === 'pack'}
          $active={tab === 'pack'}
          onClick={() => choose('pack')}
        >
          {t('tabs.pack')} <TabHint>{t('tabs.packSub')}</TabHint>
        </TabButton>
      </Tabs>

      <Body role="tabpanel">
        {tab === 'cook' ? (
          <CookTab
            key={menu?.cookingDate ?? ''}
            cookingDate={menu?.cookingDate ?? ''}
            status={list.status}
            onRetry={retry}
          />
        ) : list.status === 'ready' ? (
          <PackTab />
        ) : (
          <p role="status">{list.status === 'error' ? t('error') : t('loading')}</p>
        )}
      </Body>
    </Page>
  );
}
