import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import {
  countRememberNudgeShown,
  hideRememberNudge,
  rememberNudgeAllowed,
} from '../notice/nudgeState';
import { Pill, PillBody, PillClose, PillLink, PillRow } from '../notice/NoticePill';
import { rememberMeSupported } from '../../api/customer/rememberMe';
import { useRememberMeLocal } from './hooks';
import { REMEMBER_NS } from './i18n/register';
import { TurnOnSheet } from './TurnOnSheet';

// Plan 096: "Keep this order · Remember me" / "Keep your address · Remember me" in the soft-stone
// pill, on the order-placed page only. The cross asks again after 30 days; at most 3 shows in total.

const LinkButton = styled(PillLink).attrs({ as: 'button', type: 'button' })`
  min-height: 2.5rem;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

/** Whether the pill may show now (decided once when the page opens). */
export function useRememberPillOffered(): boolean {
  const on = useRememberMeLocal() !== null;
  const [allowed] = useState(() => rememberNudgeAllowed());
  return allowed && !on && rememberMeSupported();
}

export function RememberMePill({ delivery }: Readonly<{ delivery: boolean }>) {
  const { t } = useTranslation(REMEMBER_NS);
  const on = useRememberMeLocal() !== null;
  const [hidden, setHidden] = useState(false);
  const [open, setOpen] = useState(false);
  const counted = useRef(false);
  useEffect(() => {
    if (counted.current) return;
    counted.current = true;
    countRememberNudgeShown();
  }, []);
  return (
    <>
      {hidden || on ? null : (
        <Pill $kind="tip" role="status" data-testid="remember-me-pill">
          <PillRow>
            <PillBody text={t(delivery ? 'pill.address' : 'pill.order')} />
            <LinkButton
              onClick={() => {
                setOpen(true);
              }}
            >
              {t('pill.link')}
            </LinkButton>
          </PillRow>
          <PillClose
            type="button"
            $kind="tip"
            aria-label={t('hide')}
            onClick={() => {
              hideRememberNudge();
              setHidden(true);
            }}
          >
            ✕
          </PillClose>
        </Pill>
      )}
      {open ? (
        <TurnOnSheet
          onClose={() => {
            setOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
