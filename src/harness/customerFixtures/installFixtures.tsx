import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import i18n from 'i18next';
import { formatOrderCode } from '../../../shared/orderCode';
import {
  InstallOverlay,
  useOrderInstall,
  type Environment,
  type ScreenId,
} from '../../components/install';
import {
  ANDROID_CHROME,
  ANDROID_WHATSAPP,
  IPHONE_INSTALLED,
  IPHONE_SAFARI,
  IPHONE_WHATSAPP,
} from './installEnvironments';
import { orderFrom } from './orderFixtures';
import type { FixtureProps } from './types';

// The install and notification screens (plan 004 stage 7) fed from fixtures.json: each one is the
// real sheet with the detection fixed to the device the design shows. Nothing is read from the
// browser or sent. The kitchen icon is the sample kitchen's (public/samples).

const ICON = '/samples/icon-512.jpg';

/** Shows its children in Indonesian (the design's longest-copy check). */
function InIndonesian({ children }: Readonly<{ children: ReactNode }>) {
  const [ready, setReady] = useState(i18n.language.startsWith('id'));
  useEffect(() => {
    void i18n.changeLanguage('id').then(() => setReady(true));
  }, []);
  return ready ? children : null;
}

function Sheet({
  props,
  screen,
  env,
}: Readonly<{ props: FixtureProps; screen: ScreenId; env: Environment }>) {
  const order = orderFrom(props, 0);
  const controller = useOrderInstall(order.token, { env, screen });
  return (
    <InstallOverlay
      controller={controller}
      kitchenName={props.data.kitchen.name}
      iconSrc={ICON}
      code={formatOrderCode(order.code)}
      backLabel="Order"
    />
  );
}

const sheet =
  (screen: ScreenId, env: Environment): ComponentType<FixtureProps> =>
  (props) => <Sheet props={props} screen={screen} env={env} />;

const iosStep1Id: ComponentType<FixtureProps> = (props) => (
  <InIndonesian>
    <Sheet props={props} screen="ios-step-1" env={IPHONE_SAFARI} />
  </InIndonesian>
);

export const INSTALL_FIXTURE_SCREENS: Readonly<Record<string, ComponentType<FixtureProps>>> = {
  'ios-ask': sheet('ios-ask', IPHONE_SAFARI),
  'ios-step-1': sheet('ios-step-1', IPHONE_SAFARI),
  'ios-step-2': sheet('ios-step-2', IPHONE_SAFARI),
  'ios-step-3': sheet('ios-step-3', IPHONE_SAFARI),
  'ios-step-4': sheet('ios-step-4', IPHONE_SAFARI),
  'ios-open-from-home': sheet('ios-open-from-home', IPHONE_SAFARI),
  'ios-step-1-id': iosStep1Id,
  'ios-inside-whatsapp': sheet('ios-inside-whatsapp', IPHONE_WHATSAPP),
  'android-allow': sheet('android-allow', ANDROID_CHROME),
  'android-inside-whatsapp': sheet('android-inside-whatsapp', ANDROID_WHATSAPP),
  'notify-blocked': sheet('notify-blocked', { ...IPHONE_INSTALLED, permission: 'denied' }),
};
