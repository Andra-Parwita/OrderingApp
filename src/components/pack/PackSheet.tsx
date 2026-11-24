import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, Order } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { pickText } from '../../../shared/text';
import { LayerBar, LayerShell } from '../layer/LayerShell';
import { useMediaQuery } from '../useMediaQuery';
import { Button, Icon } from '../../ui';
import { lockPageScroll, unlockPageScroll } from '../../ui/patterns/BottomSheet';
import { OVERLAY_Z, useModalFocus } from '../../ui/patterns/modal';
import { PACK_NS } from './i18n/register';
import { PackCloseAsk, PackReadyAsk } from './PackAsk';
import { PackHead } from './PackHead';
import { keepPortion, tickedIdsOf } from './packModel';
import { usePackActions } from './usePackActions';
import { useBackToClose } from './useBackToClose';

// Plan 132: the pack sheet. Ticks change only here and only on this sheet's own state: nothing is sent
// on a tap. Save sends the ticks; Ready sends them as Packed and, for pickup, does the Ready step; Ready &
// next order does the same and hands over to the next order. Phone: a full-screen layer. Tablet: a
// centred modal over the page.

export type PackSheetProps = Readonly<{
  order: Order;
  /** "Pickup · Goodwood Community Center · 11:00": the line under the name. */
  where: string;
  onClose: () => void;
  /** After "Ready & next order" worked: open the next order to pack, or close when none is left. */
  onNext: () => void;
}>;

type Ask = { kind: 'close' } | { kind: 'ready'; next: boolean };
type Busy = 'save' | 'ready' | 'next' | null;

const TABLET = '(min-width: 600px)';

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: ${OVERLAY_Z};
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.scrim};
`;
const Modal = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  width: min(35rem, 100%);
  height: min(86%, 56rem);
  overflow: hidden;
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  padding: 0 ${({ theme }) => theme.size.pagePadPhone}px;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
const Hint = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Item = styled.button`
  display: grid;
  grid-template-columns: 1.75rem 2.25rem minmax(0, 1fr) auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.size.rowOrder}px;
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border: 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: transparent;
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  text-align: start;
  cursor: pointer;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Box = styled.span<{ $on: boolean }>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  border: ${({ theme }) => theme.border.focus} solid
    ${({ theme, $on }) => ($on ? theme.c.fill : theme.c.ctrl)};
  border-radius: 0.375rem;
  background: ${({ theme, $on }) => ($on ? theme.c.fill : 'transparent')};
  color: ${({ theme }) => theme.c.on};
`;
const Qty = styled.span`
  font-weight: 700;
  font-variant-numeric: tabular-nums;
`;
const Price = styled.span`
  font-variant-numeric: tabular-nums;
`;
const LineNote = styled.span`
  display: block;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.875rem;
`;
const Foot = styled.div`
  display: flex;
  flex: none;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};
`;
const Failed = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
  font-size: 0.875rem;
`;
const Buttons = styled.div<{ $wide: boolean }>`
  display: grid;
  gap: ${({ theme }) => theme.spacing.sm};
  grid-template-columns: ${({ $wide }) =>
    $wide ? 'minmax(0, 1fr) auto auto' : 'repeat(auto-fit, minmax(10rem, 1fr))'};

  > :first-child {
    min-height: ${({ theme }) => theme.size.mainAction + 4}px;
    ${({ $wide }) => ($wide ? '' : 'grid-column: 1 / -1;')}
  }
`;
export function PackSheet({ order, where, onClose, onNext }: PackSheetProps) {
  const { t, i18n } = useTranslation(PACK_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const tablet = useMediaQuery(TABLET);
  const actions = usePackActions();
  const [saved] = useState(() => tickedIdsOf(order));
  const [ticked, setTicked] = useState<ReadonlySet<string>>(() => new Set(saved));
  const [ask, setAsk] = useState<Ask | null>(null);
  const [busy, setBusy] = useState<Busy>(null);
  const [failed, setFailed] = useState(false);

  const dirty = useMemo(
    () => ticked.size !== saved.length || saved.some((id) => !ticked.has(id)),
    [ticked, saved],
  );
  const total = order.lines.length;
  const untickedLines = order.lines.filter((line) => !ticked.has(line.itemId));
  const delivery = order.fulfilment !== 'pickup';

  const toggle = useCallback((id: string) => {
    setTicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const requestClose = useCallback(() => {
    if (busy) return;
    if (dirty) setAsk({ kind: 'close' });
    else onClose();
  }, [busy, dirty, onClose]);
  // Escape: close the question first, then the sheet (asking when ticks are unsaved).
  const escape = useCallback(() => {
    if (ask) setAsk(null);
    else requestClose();
  }, [ask, requestClose]);
  // Android Back does the same; `true` tells the history hook the sheet is gone.
  const back = useCallback((): boolean => {
    if (busy) return false;
    if (ask) {
      setAsk(null);
      return false;
    }
    if (dirty) {
      setAsk({ kind: 'close' });
      return false;
    }
    onClose();
    return true;
  }, [ask, busy, dirty, onClose]);
  useBackToClose(back);

  const doSave = useCallback(async () => {
    setBusy('save');
    setFailed(false);
    const result = await actions.save(order, [...ticked]);
    if (result.ok) {
      onClose();
      return;
    }
    setBusy(null);
    setFailed(true);
  }, [actions, onClose, order, ticked]);

  const doReady = useCallback(
    async (next: boolean, force: boolean) => {
      setAsk(null);
      setBusy(next ? 'next' : 'ready');
      setFailed(false);
      const result = await actions.ready(order, [...ticked], force);
      if (result.ok) {
        if (next) onNext();
        else onClose();
        return;
      }
      setBusy(null);
      if (result.reason === 'unticked') setAsk({ kind: 'ready', next });
      else setFailed(true);
    },
    [actions, onClose, onNext, order, ticked],
  );
  // Unticked items warn, never block (D-062): the question names what is missing.
  const askReady = useCallback(
    (next: boolean) => {
      if (untickedLines.length > 0) setAsk({ kind: 'ready', next });
      else void doReady(next, false);
    },
    [doReady, untickedLines.length],
  );

  const label = t('title');
  const saveButton = (
    <Button disabled={busy !== null} onClick={() => void doSave()}>
      {busy === 'save' ? t('saving') : t('save')}
    </Button>
  );
  const nextButton = (
    <Button disabled={busy !== null} onClick={() => askReady(true)}>
      {busy === 'next' ? t('saving') : t(delivery ? 'readyNextDelivery' : 'readyNext')}
    </Button>
  );
  const content = (
    <>
      <LayerBar>
        <span />
        <h2>{label}</h2>
        <Button variant="quiet" aria-label={t('close')} onClick={requestClose}>
          <Icon name="x" />
        </Button>
      </LayerBar>
      <PackHead
        order={order}
        lang={lang}
        where={where}
        progressText={t('ticked', { ticked: ticked.size, total })}
        ticked={ticked.size}
        total={total}
      />
      <Scroll>
        <Hint>{t('tickHint')}</Hint>
        {order.lines.map((line) => {
          const on = ticked.has(line.itemId);
          const size = pickText(line.size, lang);
          return (
            <Item
              key={line.itemId}
              type="button"
              role="checkbox"
              aria-checked={on}
              onClick={() => toggle(line.itemId)}
            >
              <Box $on={on}>{on ? <Icon name="check" /> : null}</Box>
              <Qty>{line.qty}×</Qty>
              <span>
                {pickText(line.name, lang)}
                {size ? <small> · {keepPortion(size)}</small> : null}
                {line.note ? <LineNote>{line.note}</LineNote> : null}
              </span>
              <Price>{formatMoney(line.priceCents * line.qty, lang)}</Price>
            </Item>
          );
        })}
      </Scroll>
      <Foot>
        {failed ? <Failed role="alert">{t('error')}</Failed> : null}
        <Buttons $wide={tablet}>
          <Button variant="primary" disabled={busy !== null} onClick={() => askReady(false)}>
            <Icon name="check" />
            {busy === 'ready' ? t('saving') : t(delivery ? 'readyDelivery' : 'readyPickup')}
          </Button>
          {tablet ? nextButton : saveButton}
          {tablet ? saveButton : nextButton}
        </Buttons>
      </Foot>
      {ask?.kind === 'close' ? (
        <PackCloseAsk onKeep={() => setAsk(null)} onClose={onClose} />
      ) : null}
      {ask?.kind === 'ready' ? (
        <PackReadyAsk
          lines={untickedLines}
          delivery={delivery}
          lang={lang}
          onBack={() => setAsk(null)}
          onGo={() => void doReady(ask.next, true)}
        />
      ) : null}
    </>
  );

  // Through a portal to <body>: the host (a sticky footer) is its own stacking context, which would
  // keep the sheet under the page's sticky top.
  return createPortal(
    tablet ? (
      <TabletModal label={label} onEscape={escape} onScrim={requestClose}>
        {content}
      </TabletModal>
    ) : (
      <LayerShell label={label} onClose={escape}>
        {content}
      </LayerShell>
    ),
    document.body,
  );
}

function TabletModal({
  label,
  onEscape,
  onScrim,
  children,
}: Readonly<{
  label: string;
  onEscape: () => void;
  onScrim: () => void;
  children: ReactNode;
}>) {
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onEscape);
  useEffect(() => {
    lockPageScroll();
    return unlockPageScroll;
  }, []);
  return (
    <Overlay
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onScrim();
      }}
    >
      <Modal
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        {children}
      </Modal>
    </Overlay>
  );
}
