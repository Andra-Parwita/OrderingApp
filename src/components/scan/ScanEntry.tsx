import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatOrderCode, parseOrderCode } from '../../../shared/orderCode';
import { Button } from '../../ui';
import type { Decoder } from './decoder';
import { SCAN_NS } from './i18n/register';
import { ScanSheet, type CameraOpener } from './ScanSheet';

/** Moves focus to the typed-code search box (after the sheet has handed focus back). */
export function focusSearch(): void {
  setTimeout(() => document.querySelector<HTMLInputElement>('input[type="search"]')?.focus(), 0);
}

const Note = styled.p`
  position: fixed;
  right: ${({ theme }) => theme.spacing.md};
  bottom: ${({ theme }) => theme.spacing.xl};
  left: ${({ theme }) => theme.spacing.md};
  z-index: 20;
  max-width: 28rem;
  margin: 0 auto;
  padding: ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  text-align: center;
`;

function CameraIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="20"
      height="20"
      aria-hidden="true"
      focusable="false"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 8h4l2-3h6l2 3h4v11H3zM12 17a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  );
}

type Props = Readonly<{
  /** Looks the order up in the list already loaded. Never asks the server. */
  find: (code: string) => Readonly<{ code: string; status: string }> | undefined;
  /** A live order was found: open it. */
  onOpen: (code: string) => void;
  /** Called when the camera is refused, before focus moves to the search box. */
  onTypeCode?: () => void;
  /** Icon only, for a crowded header. */
  compact?: boolean;
  decode?: Decoder;
  openCamera?: CameraOpener;
}>;

/** The Scan button, its camera sheet, and what to say about the code that was read. */
export function ScanEntry({
  find,
  onOpen,
  onTypeCode,
  compact = false,
  decode,
  openCamera,
}: Props) {
  const { t } = useTranslation(SCAN_NS);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    if (!note) return;
    const timer = setTimeout(() => setNote(null), 6000);
    return () => clearTimeout(timer);
  }, [note]);

  const handle = (text: string) => {
    setOpen(false);
    const code = parseOrderCode(text);
    if (!code) return setNote(t('notOrderCode'));
    const order = find(code);
    if (!order) return setNote(t('notFound', { code: formatOrderCode(code) }));
    if (order.status === 'cancelled')
      return setNote(t('cancelled', { code: formatOrderCode(code) }));
    setNote(null);
    onOpen(order.code);
  };
  const typeCode = () => {
    setOpen(false);
    onTypeCode?.();
    focusSearch();
  };

  return (
    <>
      <Button aria-label={t('buttonLabel')} aria-haspopup="dialog" onClick={() => setOpen(true)}>
        <CameraIcon />
        {compact ? null : <b>{t('button')}</b>}
      </Button>
      {open ? (
        <ScanSheet
          onCode={handle}
          onClose={() => setOpen(false)}
          onTypeCode={typeCode}
          decode={decode}
          openCamera={openCamera}
        />
      ) : null}
      {note ? <Note role="status">{note}</Note> : null}
    </>
  );
}
