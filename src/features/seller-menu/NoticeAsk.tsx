import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { BottomSheet, Button } from '../../ui';
import { MENU_NS } from './i18n/register';
import { Dialog } from './PublishDialog';

// Plan 133: the one question right after a menu is published. Always asked (no check for devices, also
// when the menu was published again), no names and no count. Send is the bell's send; Not now closes.

const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
/** The tablet box: the two buttons share the footer's width equally. */
const Equal = styled.div`
  display: grid;
  flex: 1;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Problem = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  color: ${({ theme }) => theme.c.danger};
`;

export function NoticeAsk({
  layout,
  saving,
  failed,
  onSend,
  onClose,
}: Readonly<{
  /** Phone: a bottom sheet. Tablet: a small centred box. */
  layout: 'sheet' | 'box';
  saving: boolean;
  failed: boolean;
  onSend: () => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const title = t('notify.ask');
  const close = saving ? () => undefined : onClose;
  const buttons = (
    <>
      <Button variant="secondary" disabled={saving} onClick={onClose}>
        {t('notify.notNow')}
      </Button>
      <Button variant="primary" disabled={saving} onClick={onSend}>
        {saving ? t('notify.sending') : t('notify.send')}
      </Button>
    </>
  );
  const problem = failed ? <Problem role="alert">{t('notify.failed')}</Problem> : null;
  if (layout === 'sheet') {
    return (
      <BottomSheet title={title} onClose={close} hideClose>
        <Two>{buttons}</Two>
        {problem}
      </BottomSheet>
    );
  }
  return (
    <Dialog title={title} width="26rem" onClose={close} footer={<Equal>{buttons}</Equal>}>
      {problem}
    </Dialog>
  );
}
