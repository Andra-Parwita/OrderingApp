import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { Button } from '../../ui';
import { MENU_NS } from './i18n/register';
import {
  loadRequested,
  type MenuData,
  type MenuOpKind,
  type MenuRootState,
  type OpResult,
} from './menuSlice';

export const Page = styled.main<{ $wide?: boolean }>`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 100dvh;
  max-width: ${({ $wide }) => ($wide ? 'none' : 'min(100%, 45rem)')};
  margin: 0 auto;
  padding: ${({ theme, $wide }) => ($wide ? theme.spacing.xl : theme.spacing.lg)};
  padding-bottom: ${({ theme }) => theme.spacing.xxl};
  font-size: ${({ theme }) => theme.type.size.base};
`;
export const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
export const TitleRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
export const Title = styled.h1<{ $big?: boolean }>`
  margin: 0;
  font-size: ${({ theme, $big }) => ($big ? theme.type.size.xl : theme.type.size.lg)};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
export const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;
export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.status.cancelled.fg};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

export function useLang(): Language {
  const { i18n } = useTranslation(MENU_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

export const selectMenu = (state: MenuRootState) => state.sellerMenu;

/** Loads the menu on mount; `null` while it is not ready (the caller shows `status`). */
export function useMenuData(): { data: MenuData | null; status: ReactNode } {
  const { t } = useTranslation(MENU_NS);
  const dispatch = useDispatch();
  const { load, data } = useSelector(selectMenu);
  useEffect(() => {
    dispatch(loadRequested());
  }, [dispatch]);
  if (data) return { data, status: null };
  if (load === 'error') {
    return {
      data: null,
      status: (
        <>
          <ErrorText role="alert">{t('error')}</ErrorText>
          <div>
            <Button onClick={() => dispatch(loadRequested())}>{t('retry')}</Button>
          </div>
        </>
      ),
    };
  }
  return { data: null, status: <Muted role="status">{t('loading')}</Muted> };
}

/**
 * The answer to a request made from this screen. An answer from before the screen opened is
 * ignored. `onDone` runs once per successful request of one of `kinds`.
 */
export function useOpWatch(
  kinds: ReadonlyArray<MenuOpKind>,
  onDone?: (result: Extract<OpResult, { status: 'done' }>) => void,
): OpResult | null {
  const { result, seq, busy } = useSelector(selectMenu);
  const [baseline] = useState(seq);
  const latest = useRef(onDone);
  useEffect(() => {
    latest.current = onDone;
  });
  const fresh = seq > baseline && result && kinds.includes(result.kind) ? result : null;
  useEffect(() => {
    if (fresh?.status === 'done') latest.current?.(fresh);
  }, [fresh]);
  return busy ? null : fresh;
}
