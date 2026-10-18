import { useEffect, useState } from 'react';
import { styled } from 'styled-components';
import { readMyOrders } from '../../api/device/myOrders';
import { HomeScreenPill, useHomePillOffered, type InstallOverride } from '../../components/install';
import { useBarShowing } from '../../components/notice/useBarShowing';
import {
  RememberMePill,
  TurnOnSheet,
  clearWantsRememberMe,
  useRememberPillOffered,
  wantsRememberMe,
} from '../../components/remember-me';

// Plan 096: the one quiet nudge of the order-placed page. Never while an update, maintenance,
// announcement or offline bar is up. The home-screen pill (first order, browser only) comes before
// the Remember me pill (first order or a delivery order), and only one shows on a page view. A
// ticked "Remember me" box on the name step starts the turn-on here instead, once the order exists.

const Slot = styled.div`
  box-sizing: border-box;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xs} 0;
  font-family: ${({ theme }) => theme.font.ui};
  font-size: ${({ theme }) => theme.type.size.sm};
`;

export function PlacedNudge({
  delivery,
  kitchenName,
  install,
}: Readonly<{ delivery: boolean; kitchenName: string; install?: InstallOverride | undefined }>) {
  const barUp = useBarShowing();
  const [first] = useState(() => readMyOrders().length <= 1);
  const [ticked] = useState(() => wantsRememberMe());
  const [turnOn, setTurnOn] = useState(ticked);
  useEffect(() => {
    clearWantsRememberMe();
  }, []);
  const homeOffered = useHomePillOffered(install);
  const rememberOffered = useRememberPillOffered();
  const home = first && homeOffered;
  const remember = !home && !ticked && (first || delivery) && rememberOffered;
  return (
    <>
      {!barUp && (home || remember) ? (
        <Slot>
          {home ? (
            <HomeScreenPill kitchenName={kitchenName} {...(install ? { override: install } : {})} />
          ) : (
            <RememberMePill delivery={delivery} />
          )}
        </Slot>
      ) : null}
      {turnOn ? (
        <TurnOnSheet
          onClose={() => {
            setTurnOn(false);
          }}
        />
      ) : null}
    </>
  );
}
