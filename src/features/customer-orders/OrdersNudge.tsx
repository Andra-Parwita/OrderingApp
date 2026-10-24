import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { rememberMeSupported } from '../../api/customer/rememberMe';
import { readMyOrders } from '../../api/device/myOrders';
import {
  InstallOverlay,
  useSavedOrdersInstall,
  type InstallOverride,
} from '../../components/install';
import { NudgeCard } from '../../components/notice/NudgeCard';
import {
  dismissNudge,
  nudgeQuiet,
  nudgeStopped,
  type NudgeCardId,
  type NudgeContext,
} from '../../components/notice/ordersNudgeState';
import { useBarShowing } from '../../components/notice/useBarShowing';
import { TurnOnSheet, useRememberMeLocal } from '../../components/remember-me';
import { ORDERS_NS } from './i18n/register';

// Plan 121 part A: one quiet card at the top of My orders. Notifications while an order is open and
// they are off, otherwise Remember me while it is off. Never while an update, maintenance,
// announcement or offline bar is up (plan 096: one nudge at a time). The dismiss rules live in
// ordersNudgeState. A card that is only quiet keeps its place (the other one does not jump in);
// a card stopped for good gives way to the other.

type Props = Readonly<{
  /** An order of the current week that is not collected, delivered or cancelled. */
  hasOpenOrder: boolean;
  /** Each loaded kitchen's menu: slug to cooking date. */
  menus: Readonly<Record<string, string>>;
  kitchenName: string;
  /** Tests: a fixed environment for the notification flow. */
  install?: InstallOverride | undefined;
}>;

export function OrdersNudge({ hasOpenOrder, menus, kitchenName, install }: Props) {
  const { t } = useTranslation(ORDERS_NS);
  const barUp = useBarShowing();
  const controller = useSavedOrdersInstall(install);
  const rememberOff = useRememberMeLocal() === null && rememberMeSupported();
  const [hidden, setHidden] = useState<NudgeCardId | null>(null);
  const [turnOn, setTurnOn] = useState(false);

  // Permission already granted: the browser is only slow to say it is subscribed; do not flash the card.
  const notifyOff = controller.status === 'off' && controller.env.permission !== 'granted';
  const homeFirst = controller.kind === 'ios-guide';
  const context: NudgeContext = { menus, orders: readMyOrders().map((order) => order.token) };
  const card: NudgeCardId | null =
    hasOpenOrder && notifyOff && !nudgeStopped('notify')
      ? 'notify'
      : rememberOff && !nudgeStopped('remember')
        ? 'remember'
        : null;
  const shown = card !== null && !barUp && hidden !== card && !nudgeQuiet(card, context);
  const hide = () => {
    if (card === null) return;
    dismissNudge(card, context);
    setHidden(card);
  };

  return (
    <>
      {shown && card === 'notify' ? (
        <NudgeCard
          testId="orders-nudge-notify"
          text={homeFirst ? t('nudge.home') : t('nudge.notify')}
          action={homeFirst ? t('nudge.how') : t('nudge.turnOn')}
          hideLabel={t('nudge.hide')}
          onAction={homeFirst ? controller.install : controller.start}
          onHide={hide}
        />
      ) : null}
      {shown && card === 'remember' ? (
        <NudgeCard
          testId="orders-nudge-remember"
          text={t('nudge.remember')}
          action={
            controller.env.platform === 'ios' ? t('nudge.turnOnOrRestore') : t('nudge.turnOn')
          }
          hideLabel={t('nudge.hide')}
          onAction={() => {
            setTurnOn(true);
          }}
          onHide={hide}
        />
      ) : null}
      <InstallOverlay controller={controller} kitchenName={kitchenName} />
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
