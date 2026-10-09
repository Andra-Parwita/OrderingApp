import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import type { MenuItemView, SellerMenuItemView } from '../../shared/domain';
import type { MenuResponse } from '../../shared/menuContract';
import { fetchSellerMenu } from '../api/client';
import { currentSellerSlug } from '../api/device/sellerContext';
import { MenuScreen as CustomerMenuScreen } from '../features/customer-menu';
import { opRequested, type MenuRootState } from '../features/seller-menu';
import { Button } from '../ui';

// Preview as customer (D-019): the customer menu screen filled with the seller's current draft,
// under a bar that says so. Nothing can be ordered from it, and chef data is stripped here so it
// can never reach the customer screen.

const Bar = styled.div`
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  padding: calc(env(safe-area-inset-top) + ${({ theme }) => theme.spacing.sm})
    ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.colour.surfaceAlt};
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Label = styled.strong`
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Actions = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Message = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
`;

type Loaded = { status: 'loading' } | { status: 'error' } | { status: 'ready'; menu: MenuResponse };

function load(): Promise<Loaded> {
  return fetchSellerMenu(undefined, currentSellerSlug()).then((result) => {
    if (!result.ok) return { status: 'error' };
    const { seller, kitchen, week, ordering, items } = result.data;
    const stripped = items.map((item) => {
      const copy: Partial<SellerMenuItemView> = { ...item };
      delete copy.chefId;
      delete copy.manualSoldOut;
      return copy as MenuItemView;
    });
    return { status: 'ready', menu: { seller, kitchen, week, ordering, items: stripped } };
  });
}

export function SellerPreview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [state, setState] = useState<Loaded>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const publishFailed = useSelector(
    (root: MenuRootState) =>
      root.sellerMenu.result?.kind === 'publish' && root.sellerMenu.result.status === 'failed',
  );
  const busy = useSelector((root: MenuRootState) => root.sellerMenu.busy);
  const seq = useSelector((root: MenuRootState) => root.sellerMenu.seq);
  const [firstSeq] = useState(seq);

  useEffect(() => {
    let live = true;
    void load().then((next) => {
      if (live) setState(next);
    });
    return () => {
      live = false;
    };
    // A finished request (the publish) changes what the preview should say.
  }, [attempt, seq]);

  const back = useCallback(() => void navigate('/seller/menu'), [navigate]);
  const publish = useCallback(() => dispatch(opRequested({ kind: 'publish' })), [dispatch]);
  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const published = state.status === 'ready' && state.menu.week.status === 'published';
  const menu = state.status === 'ready' ? state.menu : undefined;
  return (
    <>
      <Bar role="region" aria-label={t('sellerNav.previewDraft')}>
        <Label>{t(published ? 'sellerNav.previewPublished' : 'sellerNav.previewDraft')}</Label>
        <Actions>
          <Button onClick={back}>{t('sellerNav.backToEditing')}</Button>
          {published ? null : (
            <Button variant="primary" disabled={busy || menu === undefined} onClick={publish}>
              {t('sellerNav.publish')}
            </Button>
          )}
        </Actions>
        {publishFailed && seq !== firstSeq ? (
          <Message role="alert">{t('sellerNav.previewPublishError')}</Message>
        ) : null}
      </Bar>
      {menu ? (
        <CustomerMenuScreen slug={menu.seller.slug} onViewBasket={back} preview={menu} />
      ) : state.status === 'error' ? (
        <Message role="alert">
          {t('sellerNav.previewLoadError')} <Button onClick={retry}>{t('sellerNav.retry')}</Button>
        </Message>
      ) : (
        <Message role="status">…</Message>
      )}
    </>
  );
}
