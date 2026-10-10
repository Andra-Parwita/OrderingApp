import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import type { MenuDishView } from '../../../shared/menusContract';
import { pickText } from '../../../shared/text';
import { Button } from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import { MENU_NS } from './i18n/register';
import {
  loadRequested,
  opRequested,
  type MenuData,
  type MenuOp,
  type MenuOpKind,
  type MenuRootState,
  type OpResult,
} from './menuSlice';

// Pieces shared by the Menu screens: layout, the loader, and a way to run an op and hear back.

export const Page = styled.main`
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  font-size: 0.9375rem;
`;
export const Head = styled.header`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const Title = styled.h1`
  margin: 0;
  font-size: 1.375rem;
  font-weight: 700;
  line-height: 1.25;
`;
export const Tools = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
`;
export const Section = styled.section`
  padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.size.pagePadTablet}px;
`;
export const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-weight: 600;
`;
export const Message = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.muted};
`;
export const GroupLabel = styled.h2`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
export const LinkButton = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 600;
  text-decoration: underline;
  cursor: pointer;
`;
/** A round on/off switch with a visible word beside it (never colour alone). */
export const SwitchButton = styled.button<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  min-width: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.xs};
  border: 0;
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  cursor: pointer;

  i {
    position: relative;
    flex: none;
    width: 2.5rem;
    height: 1.5rem;
    border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
    border-radius: 62rem;
    background: ${({ $on, theme }) => ($on ? theme.c.fill : 'transparent')};
  }
  i::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    left: ${({ $on }) => ($on ? '1.1rem' : '0.125rem')};
    width: 1.125rem;
    height: 1.125rem;
    border-radius: 50%;
    background: ${({ $on, theme }) => ($on ? theme.c.on : theme.c.muted)};
  }
`;

export function useLang(): Language {
  const { i18n } = useTranslation(MENU_NS);
  return i18n.resolvedLanguage === 'id' ? 'id' : 'en';
}

export const selectMenu = (state: MenuRootState) => state.sellerMenu;

/** The two names of a dish, as the seller reads them: the language in use first. */
export function dishName(dish: Pick<MenuDishView, 'name'>, lang: Language): string {
  return pickText(dish.name, lang);
}

/** Loads everything on mount; `data` is null while it is not ready (the caller shows `status`). */
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
        <Message>
          <ErrorText role="alert">{t('error')}</ErrorText>
          <Button onClick={() => dispatch(loadRequested())}>{t('retry')}</Button>
        </Message>
      ),
    };
  }
  return { data: null, status: <Message role="status">{t('loading')}</Message> };
}

/** Runs ops. `busy` is true while one is running. */
export function useRunOp(): { run: (op: MenuOp) => void; busy: boolean } {
  const dispatch = useDispatch();
  const busy = useSelector((state: MenuRootState) => state.sellerMenu.busy);
  return { run: (op) => dispatch(opRequested(op)), busy };
}

type Handlers = {
  onDone?: (result: Extract<OpResult, { status: 'done' }>) => void;
  onFail?: (result: Extract<OpResult, { status: 'failed' }>) => void;
};

/**
 * Hears the answer to a request of one of `kinds` made from this screen (an answer from before the
 * screen opened is ignored). Each answer is heard once.
 */
export function useOpWatch(kinds: ReadonlyArray<MenuOpKind>, handlers: Handlers): void {
  const { result, seq } = useSelector(selectMenu);
  const [baseline] = useState(seq);
  const latest = useRef({ kinds, handlers });
  useEffect(() => {
    latest.current = { kinds, handlers };
  });
  useEffect(() => {
    if (seq <= baseline || !result || !latest.current.kinds.includes(result.kind)) return;
    if (result.status === 'done') latest.current.handlers.onDone?.(result);
    else latest.current.handlers.onFail?.(result);
    // Once per finished request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq]);
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.scrim};
`;
const Box = styled.div`
  width: min(26rem, 100%);
  padding: ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    font-size: 1.125rem;
  }
`;
const DialogActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;

/** A small question with a field (not a warning): used to ask for the cooking day or a set name. */
export function AskDialog({
  title,
  children,
  confirmLabel,
  cancelLabel,
  disabled = false,
  onCancel,
  onConfirm,
}: Readonly<{
  title: string;
  children: ReactNode;
  confirmLabel: string;
  cancelLabel: string;
  disabled?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}>) {
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onCancel);
  return (
    <Overlay>
      <Box
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2>{title}</h2>
        {children}
        <DialogActions>
          <Button onClick={onCancel}>{cancelLabel}</Button>
          <Button variant="primary" disabled={disabled} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </DialogActions>
      </Box>
    </Overlay>
  );
}
