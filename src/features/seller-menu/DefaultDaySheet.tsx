import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { formatCookingDate } from '../../../shared/dates';
import type { Language } from '../../../shared/domain';
import { Button } from '../../ui';
import { OVERLAY_Z, useModalFocus } from '../../ui/patterns/modal';
import { MENU_NS } from './i18n/register';

// Plan 126: the small sheet behind the lock day: which of the ticked days customers see selected first.

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
const Box = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
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
    margin: 0;
    font-size: 1.125rem;
  }
  p {
    margin: 0;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.875rem;
  }
`;
const Choices = styled.div`
  display: flex;
  flex-direction: column;
`;
const Choice = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  cursor: pointer;

  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
`;

export function DefaultDaySheet({
  days,
  current,
  lang,
  onPick,
  onClose,
}: Readonly<{
  /** The ticked days. */
  days: ReadonlyArray<string>;
  current: string;
  lang: Language;
  onPick: (day: string) => void;
  onClose: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const titleId = useId();
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onClose);
  const [picked, setPicked] = useState(current);
  return (
    <Overlay>
      <Box
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId}>{t('details.defaultDay.title')}</h2>
        <p>{t('details.defaultDay.help')}</p>
        <Choices role="radiogroup" aria-labelledby={titleId}>
          {days.map((day) => (
            <Choice key={day}>
              <input
                type="radio"
                name="default-delivery-day"
                checked={picked === day}
                onChange={() => setPicked(day)}
              />
              {formatCookingDate(day, lang)}
            </Choice>
          ))}
        </Choices>
        {days.length < 2 ? <p>{t('details.defaultDay.tickFirst')}</p> : null}
        <Actions>
          <Button onClick={onClose}>{t('cancel')}</Button>
          <Button variant="primary" onClick={() => onPick(picked)}>
            {t('details.defaultDay.save')}
          </Button>
        </Actions>
      </Box>
    </Overlay>
  );
}
