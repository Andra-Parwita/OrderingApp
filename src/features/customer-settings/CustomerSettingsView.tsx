import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Kitchen, Language } from '../../../shared/domain';
import type { CustomerLiveState } from '../../api/customerLiveState';
import {
  INSTALL_NS,
  InstallOverlay,
  useCanInstall,
  useSavedOrdersInstall,
  type InstallOverride,
} from '../../components/install';
import { setTextSize, useTextSize, type TextSize } from '../../theme/textSize';
import type { ThemePreference } from '../../theme/themePreference';
import { KitchenBanner } from '../../components/KitchenBanner';
import { PrivacyModal, RememberMeCard } from '../../components/remember-me';
import { Icon } from '../../ui';
import { ChoiceSheet, type Choice } from './ChoiceSheet';
import { MenuNoticeRow, type MenuNoticeControl } from './MenuNoticeRow';
import { Hint, Knob, Label, Name, Row, Track } from './settingsParts';
import { ValueRow } from './ValueRow';
import { screenHeightMinus } from '../../theme/screen';

// The customer's Settings tab (spec §4.6): Language, Appearance, Order updates, and the "put it on
// your home screen" card. Presentational: CustomerSettingsScreen wires it to i18n and the theme
// preference, the fixtures page shows it as drawn. Order updates is a real switch (plan 004 stage
// 7): on means this browser gets the messages of the orders saved on this phone; off unsubscribes.

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  /* Leaves room for the customer tab bar when the app shell shows one. */
  min-height: ${screenHeightMinus('var(--customer-tabbar-height, 0rem) - var(--customer-banner-height, 0rem)')};
`;
const Title = styled.h1`
  margin: 0;
  padding: calc(var(--sat) + ${({ theme }) => theme.spacing.sm}) ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.md};
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: 700;
`;
const Rows = styled.div`
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};
`;
// Plan 074: one muted line about the live connection; no banner, no alarm colour.
const Connection = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Dot = styled.span`
  color: ${({ theme }) => theme.c.atext};
`;

// ---- About and privacy ----

const AboutButton = styled.button`
  flex: none;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

// ---- The home-screen card ----

const Card = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
`;
const CardHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Tile = styled.span`
  flex: none;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 0.875rem;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};

  svg {
    width: 1.75rem;
    height: 1.75rem;
  }
`;
const CardText = styled.span`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.125rem;

  b {
    font-weight: 700;
  }
`;
const Install = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  gap: ${({ theme }) => theme.spacing.sm};
  width: 100%;
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.lg};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

type Picker = 'language' | 'theme' | 'size' | null;

export type CustomerSettingsViewProps = Readonly<{
  lang: Language;
  onLang: (next: Language) => void;
  theme: ThemePreference;
  onTheme: (next: ThemePreference) => void;
  /** Fixtures and tests: fix what the install and notification flow detects. */
  install?: InstallOverride;
  /** Fixtures and tests: pretend the browser is offering its own Install (Android Chrome). */
  canInstall?: boolean;
  /** Plan 056: false when the kitchen offers one language, so there is nothing to switch. */
  showLanguage?: boolean;
  /** The loaded kitchen: its banner shows on top, as on the menu. Absent = no banner. */
  kitchen?: Kitchen;
  /** Plan 074: what the live connection is doing; absent = the line is not shown. */
  connection?: CustomerLiveState;
  /** Plan 112: the "New menus from <kitchen>" option; absent = no kitchen known, no row. */
  menuNotice?: MenuNoticeControl | undefined;
  /** Plan 102: opens the "Start fresh" help page; absent = no Help row. */
  onStartFresh?: (() => void) | undefined;
}>;

/** "10:42", in the phone's own clock style. */
function clockTime(ms: number, lang: Language): string {
  return new Intl.DateTimeFormat(lang === 'id' ? 'id-ID' : 'en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(new Date(ms));
}

/** The Settings tab. */
export function CustomerSettingsView({
  lang,
  onLang,
  theme,
  onTheme,
  install: installOverride,
  canInstall: canInstallOverride,
  showLanguage = true,
  kitchen,
  connection,
  menuNotice,
  onStartFresh,
}: CustomerSettingsViewProps) {
  const { t } = useTranslation();
  const { t: ti } = useTranslation(INSTALL_NS);
  const [aboutOpen, setAboutOpen] = useState(false);
  const install = useSavedOrdersInstall(installOverride);
  const browserOffersInstall = useCanInstall();
  const canInstall = canInstallOverride ?? browserOffersInstall;
  const [picker, setPicker] = useState<Picker>(null);
  const languages = useMemo<Array<Choice<Language>>>(
    () => [
      { value: 'en', label: t('customerSettings.langEn') },
      { value: 'id', label: t('customerSettings.langId') },
    ],
    [t],
  );
  const themes = useMemo<Array<Choice<ThemePreference>>>(
    () => [
      {
        value: 'auto',
        label: t('customerSettings.themeAuto'),
        hint: t('customerSettings.themeFollows'),
      },
      { value: 'light', label: t('theme.light') },
      { value: 'dark', label: t('theme.dark') },
    ],
    [t],
  );
  const textSize = useTextSize();
  const textSizes = useMemo<Array<Choice<TextSize>>>(
    () => [
      { value: 'smaller', label: t('customerSettings.textSmaller') },
      { value: 'normal', label: t('customerSettings.textNormal') },
      { value: 'larger', label: t('customerSettings.textLarger') },
    ],
    [t],
  );
  const { status, env, busy } = install;
  const onToggle = useCallback(() => {
    if (status === 'on') install.disable();
    else install.start();
  }, [status, install]);

  // Offered on a phone (or when the browser offers its own Install) until it is installed.
  const showHome =
    !env.installed && (env.platform === 'ios' || env.platform === 'android' || canInstall);
  const hint =
    status === 'on'
      ? ti('settings.on')
      : status === 'blocked'
        ? ti('settings.blocked')
        : status === 'unsupported'
          ? ti('settings.unsupported')
          : busy
            ? ti('settings.working')
            : ti('settings.off');
  return (
    <Page>
      {kitchen ? <KitchenBanner kitchen={kitchen} lang={lang} placeholder={kitchen.name} /> : null}
      <Title>{t('customerSettings.title')}</Title>
      <Rows>
        {showLanguage ? (
          <ValueRow
            label={t('customerSettings.language')}
            value={languages.find((choice) => choice.value === lang)?.label ?? lang}
            onOpen={() => {
              setPicker('language');
            }}
          />
        ) : null}
        <ValueRow
          label={t('customerSettings.theme')}
          value={themes.find((choice) => choice.value === theme)?.label ?? theme}
          onOpen={() => {
            setPicker('theme');
          }}
        />
        <ValueRow
          label={t('customerSettings.textSize')}
          value={textSizes.find((choice) => choice.value === textSize)?.label ?? textSize}
          onOpen={() => {
            setPicker('size');
          }}
        />
        <Row>
          <Label>
            <Name id="settings-updates">{t('customerSettings.updatesTitle')}</Name>
            <Hint $on={status === 'on'} role="status">
              {hint}
            </Hint>
          </Label>
          <Track
            type="button"
            role="switch"
            aria-checked={status === 'on'}
            aria-labelledby="settings-updates"
            disabled={status === 'unsupported' || busy}
            onClick={onToggle}
          >
            <Knob />
          </Track>
        </Row>
        {menuNotice && env.pushSupported ? <MenuNoticeRow control={menuNotice} /> : null}
        <Row>
          <Label>
            <Name id="settings-about">{t('customerSettings.aboutTitle')}</Name>
          </Label>
          <AboutButton
            type="button"
            aria-haspopup="dialog"
            aria-describedby="settings-about"
            onClick={() => {
              setAboutOpen(true);
            }}
          >
            {t('customerSettings.aboutShow')}
          </AboutButton>
        </Row>
        {onStartFresh ? (
          <Row>
            <Label>
              <Name id="settings-help">{t('customerSettings.helpTitle')}</Name>
            </Label>
            <AboutButton type="button" aria-describedby="settings-help" onClick={onStartFresh}>
              {t('customerSettings.startFresh')}
            </AboutButton>
          </Row>
        ) : null}
      </Rows>
      {picker === 'language' ? (
        <ChoiceSheet
          title={t('customerSettings.language')}
          choices={languages}
          value={lang}
          onPick={onLang}
          onClose={() => {
            setPicker(null);
          }}
        />
      ) : null}
      {picker === 'theme' ? (
        <ChoiceSheet
          title={t('customerSettings.theme')}
          choices={themes}
          value={theme}
          onPick={onTheme}
          onClose={() => {
            setPicker(null);
          }}
        />
      ) : null}
      {picker === 'size' ? (
        <ChoiceSheet
          title={t('customerSettings.textSize')}
          choices={textSizes}
          value={textSize}
          onPick={setTextSize}
          onClose={() => {
            setPicker(null);
          }}
        />
      ) : null}
      {aboutOpen ? (
        <PrivacyModal
          onClose={() => {
            setAboutOpen(false);
          }}
        />
      ) : null}
      <RememberMeCard kitchenName={kitchen?.name} />
      {connection ? (
        <Connection role="status">
          {connection.mode === 'live' ? (
            <>
              {t('customerSettings.connLive')} <Dot aria-hidden="true">●</Dot>
            </>
          ) : connection.mode === 'backup' ? (
            connection.lastUpdated === null ? (
              t('customerSettings.connBackupNone', { minutes: connection.minutes })
            ) : (
              t('customerSettings.connBackup', {
                time: clockTime(connection.lastUpdated, lang),
                minutes: connection.minutes,
              })
            )
          ) : connection.mode === 'connecting' ? (
            t('customerSettings.connConnecting')
          ) : (
            t('customerSettings.connNone')
          )}
        </Connection>
      ) : null}
      {showHome ? (
        <Card aria-labelledby="settings-home">
          <CardHead>
            <Tile>
              <Icon name="bag" />
            </Tile>
            <CardText>
              <b id="settings-home">{t('customerSettings.homeTitle')}</b>
              <Hint>{t('customerSettings.homeBody')}</Hint>
            </CardText>
          </CardHead>
          <Install type="button" onClick={install.install}>
            {kitchen ? ti('settings.homeInstall', { name: kitchen.name }) : ti('homeCard.install')}
          </Install>
        </Card>
      ) : null}
      <InstallOverlay controller={install} kitchenName={kitchen?.name ?? t('app.name')} />
    </Page>
  );
}
