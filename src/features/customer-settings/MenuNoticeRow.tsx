import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { BottomSheet, Button } from '../../ui';
import { Hint, Knob, Label, Name, Row, Track } from './settingsParts';

// Plan 112 (D-113): "New menus from <kitchen>", a quiet switch, off by default. Turning it on first
// shows what the customer will get, how often, and how to turn it off; only "Turn on" asks the
// browser for permission. Presentational: useMenuNotice wires it to the device and the server.

export type MenuNoticeControl = Readonly<{
  kitchenName: string;
  on: boolean;
  busy: boolean;
  /** Why the last try did not work; shown under the name. */
  problem: 'blocked' | 'failed' | null;
  onTurnOn: () => void;
  onTurnOff: () => void;
}>;

const Points = styled.ul`
  margin: 0 0 ${({ theme }) => theme.spacing.lg};
  padding-left: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  color: ${({ theme }) => theme.c.muted};
`;
const Two = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Go = styled(Button)`
  white-space: nowrap;
`;

export function MenuNoticeRow({ control }: Readonly<{ control: MenuNoticeControl }>) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const { kitchenName: kitchen, on, busy, problem } = control;
  const hint = busy
    ? t('customerSettings.menuNoticeWorking')
    : problem === 'blocked'
      ? t('customerSettings.menuNoticeBlocked')
      : problem === 'failed'
        ? t('customerSettings.menuNoticeFailed')
        : on
          ? t('customerSettings.menuNoticeOn')
          : t('customerSettings.menuNoticeOff');
  return (
    <>
      <Row>
        <Label>
          <Name id="settings-menu-notice">{t('customerSettings.menuNotice', { kitchen })}</Name>
          <Hint $on={on && !busy && problem === null} role="status">
            {hint}
          </Hint>
        </Label>
        <Track
          type="button"
          role="switch"
          aria-checked={on}
          aria-labelledby="settings-menu-notice"
          disabled={busy}
          onClick={() => {
            if (on) control.onTurnOff();
            else setAsking(true);
          }}
        >
          <Knob />
        </Track>
      </Row>
      {asking ? (
        <BottomSheet
          title={t('customerSettings.menuNoticeAsk', { kitchen })}
          onClose={() => {
            setAsking(false);
          }}
        >
          <Points>
            <li>{t('customerSettings.menuNoticeWhat', { kitchen })}</li>
            <li>{t('customerSettings.menuNoticePrivacy', { kitchen })}</li>
            <li>{t('customerSettings.menuNoticeOffAnyTime')}</li>
          </Points>
          <Two>
            <Go
              variant="quiet"
              onClick={() => {
                setAsking(false);
              }}
            >
              {t('customerSettings.menuNoticeNotNow')}
            </Go>
            <Go
              variant="primary"
              onClick={() => {
                setAsking(false);
                control.onTurnOn();
              }}
            >
              {t('customerSettings.menuNoticeTurnOn')}
            </Go>
          </Two>
        </BottomSheet>
      ) : null}
    </>
  );
}
