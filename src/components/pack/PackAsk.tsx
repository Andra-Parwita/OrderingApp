import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language, OrderLine } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import { Button } from '../../ui';
import { OVERLAY_Z } from '../../ui/patterns/modal';
import { PACK_NS } from './i18n/register';

// Plan 132: the two questions of packing. "Close without saving?" (unsaved ticks) and "N items not
// ticked. Ready anyway?" (D-062: warn, never block). Inside the pack sheet they cover the sheet;
// `fixed` covers the page (Kitchen -> Pack).

const Layer = styled.div<{ $fixed: boolean }>`
  position: ${({ $fixed }) => ($fixed ? 'fixed' : 'absolute')};
  inset: 0;
  z-index: ${({ $fixed }) => ($fixed ? OVERLAY_Z : 1)};
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background: ${({ theme }) => theme.colour.scrim};

  @media (min-width: 37.5rem) {
    align-items: center;
  }
`;
const Card = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  width: min(28rem, 100%);
  padding: ${({ theme }) => theme.spacing.lg};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  h4 {
    margin: 0;
    font-size: 1.0625rem;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.9375rem;
    overflow-wrap: anywhere;
  }
`;
const Buttons = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;

/** "Close without saving?": keep packing, or close and drop the unsaved ticks. */
export function PackCloseAsk({
  fixed = false,
  onKeep,
  onClose,
}: Readonly<{ fixed?: boolean; onKeep: () => void; onClose: () => void }>) {
  const { t } = useTranslation(PACK_NS);
  return (
    <Layer $fixed={fixed}>
      <Card role="alertdialog" aria-label={t('closeTitle')}>
        <h4>{t('closeTitle')}</h4>
        <p>{t('closeBody')}</p>
        <Buttons>
          <Button variant="primary" data-autofocus onClick={onKeep}>
            {t('closeKeep')}
          </Button>
          <Button onClick={onClose}>{t('closeGo')}</Button>
        </Buttons>
      </Card>
    </Layer>
  );
}

/** "N items not ticked. Ready anyway?": names what is missing. */
export function PackReadyAsk({
  fixed = false,
  lines,
  delivery = false,
  lang,
  onBack,
  onGo,
}: Readonly<{
  fixed?: boolean;
  lines: ReadonlyArray<OrderLine>;
  /** A delivery order is only marked Packed, so the question says "Packed anyway". */
  delivery?: boolean;
  lang: Language;
  onBack: () => void;
  onGo: () => void;
}>) {
  const { t } = useTranslation(PACK_NS);
  const title = t(delivery ? 'askTitleDelivery' : 'askTitle', { count: lines.length });
  return (
    <Layer $fixed={fixed}>
      <Card role="alertdialog" aria-label={title}>
        <h4>{title}</h4>
        <p>{lines.map((line) => pickText(line.name, lang)).join(', ')}</p>
        <Buttons>
          <Button data-autofocus onClick={onBack}>
            {t('askBack')}
          </Button>
          <Button variant="primary" onClick={onGo}>
            {t(delivery ? 'askGoDelivery' : 'askGo')}
          </Button>
        </Buttons>
      </Card>
    </Layer>
  );
}
