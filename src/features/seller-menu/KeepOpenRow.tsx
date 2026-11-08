import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { MENU_NS } from './i18n/register';
import { Muted, SwitchButton } from './menuShared';

// Plan 126: "Keep the menu open 1 more day" and the hint that spells out the automatic finish.

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  font-weight: 600;

  > span:first-child {
    flex: 1;
    min-width: 0;
  }
`;

export function KeepOpenRow({
  on,
  busy,
  lastDay,
  lang,
  onToggle,
}: Readonly<{
  on: boolean;
  busy: boolean;
  /** The last open day (the menu finishes at midnight after it). */
  lastDay: string;
  lang: Language;
  onToggle: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  return (
    <>
      <Row>
        <span id="keep-open-label">{t('details.keepOpen.label')}</span>
        <SwitchButton
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="keep-open-label"
          $on={on}
          disabled={busy}
          onClick={onToggle}
        >
          <i />
          <span>{on ? t('live.yes') : t('live.no')}</span>
        </SwitchButton>
      </Row>
      <Muted>{t('details.keepOpen.hint', { day: formatCookingDate(lastDay, lang) })}</Muted>
    </>
  );
}
