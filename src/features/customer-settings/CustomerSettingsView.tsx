import { useCallback, useMemo, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { appVersion } from '../../../shared/buildInfo';
import type { Language } from '../../../shared/domain';
import {
  INSTALL_NS,
  InstallOverlay,
  promptInstall,
  useCanInstall,
  useSavedOrdersInstall,
  type InstallOverride,
} from '../../components/install';
import type { ThemePreference } from '../../theme/themePreference';
import { Icon, Segmented, type SegmentedOption } from '../../ui';

// The customer's Settings tab (spec §4.6): Language, Appearance, Order updates, and the "put it on
// your home screen" card. Presentational: CustomerSettingsScreen wires it to i18n and the theme
// preference, the fixtures page shows it as drawn. Order updates is a real switch (plan 004 stage
// 7): on means this browser gets the messages of the orders saved on this phone; off unsubscribes.

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  /* Leaves room for the customer tab bar when the app shell shows one. */
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
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
const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 4.5rem;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const Label = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
`;
const Name = styled.span`
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Hint = styled.span<{ $on?: boolean }>`
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: ${({ $on }) => ($on ? 700 : 400)};
  color: ${({ theme, $on }) => ($on ? theme.c.atext : theme.c.muted)};
`;

// ---- The switch ----

const Track = styled.button`
  flex: none;
  position: relative;
  box-sizing: border-box;
  width: 3.25rem;
  height: 2.25rem;
  min-width: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.surf2};
  cursor: pointer;

  &[aria-checked='true'] {
    border-color: ${({ theme }) => theme.c.fill};
    background: ${({ theme }) => theme.c.fill};
  }
  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;
const Knob = styled.span`
  position: absolute;
  top: 50%;
  left: 0.25rem;
  width: 1.5rem;
  height: 1.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.ctrl};
  transform: translateY(-50%);

  [aria-checked='true'] > & {
    left: auto;
    right: 0.25rem;
    background: ${({ theme }) => theme.c.on};
  }
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
const About = styled.ul`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg}
    ${({ theme }) => theme.spacing.lg} calc(${({ theme }) => theme.spacing.lg} + 1rem);
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.5;
`;
const ABOUT_KEYS = [
  'aboutKeep',
  'aboutNever',
  'aboutDevice',
  'aboutNotify',
  'aboutHow',
  'aboutFind',
  'aboutNo',
] as const;

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
const Fallback = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};

  b {
    color: ${({ theme }) => theme.c.text};
  }
`;

const LANGUAGES: ReadonlyArray<SegmentedOption<Language>> = [
  { value: 'en', label: 'EN' },
  { value: 'id', label: 'ID' },
];

export type CustomerSettingsViewProps = Readonly<{
  lang: Language;
  onLang: (next: Language) => void;
  theme: ThemePreference;
  onTheme: (next: ThemePreference) => void;
  /** Fixtures and tests: fix what the install and notification flow detects. */
  install?: InstallOverride;
  /** Fixtures and tests: pretend the browser is offering its own Install (Android Chrome). */
  canInstall?: boolean;
}>;

/** The Settings tab. */
export function CustomerSettingsView({
  lang,
  onLang,
  theme,
  onTheme,
  install: installOverride,
  canInstall: canInstallOverride,
}: CustomerSettingsViewProps) {
  const { t } = useTranslation();
  const { t: ti } = useTranslation(INSTALL_NS);
  const [aboutOpen, setAboutOpen] = useState(false);
  const install = useSavedOrdersInstall(installOverride);
  const browserOffersInstall = useCanInstall();
  const canInstall = canInstallOverride ?? browserOffersInstall;
  const themes = useMemo<Array<SegmentedOption<ThemePreference>>>(
    () => [
      { value: 'auto', label: t('customerSettings.themeAuto') },
      { value: 'light', label: t('theme.light') },
      { value: 'dark', label: t('theme.dark') },
    ],
    [t],
  );
  const { status, env, busy } = install;
  const onToggle = useCallback(() => {
    if (status === 'on') install.disable();
    else install.start();
  }, [status, install]);
  const onInstall = useCallback(() => void promptInstall(), []);

  // Offered on a phone (or when the browser offers its own Install) until it is installed.
  const showHome =
    !env.installed && (env.platform === 'ios' || env.platform === 'android' || canInstall);
  const iosGuide = env.platform === 'ios';
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
      <Title>{t('customerSettings.title')}</Title>
      <Rows>
        <Row>
          <Label>
            <Name>{t('customerSettings.language')}</Name>
          </Label>
          <Segmented
            options={LANGUAGES}
            value={lang}
            onChange={onLang}
            label={t('language.label')}
          />
        </Row>
        <Row>
          <Label>
            <Name>{t('customerSettings.theme')}</Name>
            <Hint>
              {theme === 'auto' ? t('customerSettings.themeAutoHint') : t(`theme.${theme}`)}
            </Hint>
          </Label>
          <Segmented
            options={themes}
            value={theme}
            onChange={onTheme}
            label={t('customerSettings.theme')}
          />
        </Row>
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
        <Row>
          <Label>
            <Name id="settings-about">{t('customerSettings.aboutTitle')}</Name>
          </Label>
          <AboutButton
            type="button"
            aria-expanded={aboutOpen}
            aria-controls="settings-about-text"
            aria-describedby="settings-about"
            onClick={() => {
              setAboutOpen((open) => !open);
            }}
          >
            {aboutOpen ? t('customerSettings.aboutHide') : t('customerSettings.aboutShow')}
          </AboutButton>
        </Row>
        {aboutOpen ? (
          <About id="settings-about-text">
            {ABOUT_KEYS.map((key) => (
              <li key={key}>{t(`customerSettings.${key}`)}</li>
            ))}
            <li>{t('customerSettings.aboutWho', { app: t('app.name') })}</li>
            <li>{t('customerSettings.aboutVersion', { version: appVersion() })}</li>
          </About>
        ) : null}
      </Rows>
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
          {iosGuide ? (
            <Install type="button" onClick={install.startGuide}>
              {ti('settings.homeShow')}
            </Install>
          ) : (
            <>
              {canInstall ? (
                <Install type="button" onClick={onInstall}>
                  {ti('settings.homeInstall')}
                </Install>
              ) : null}
              <Fallback>
                <Trans
                  t={ti}
                  i18nKey="settings.homeFallback"
                  ns={INSTALL_NS}
                  components={{ b: <b /> }}
                />
              </Fallback>
            </>
          )}
        </Card>
      ) : null}
      <InstallOverlay controller={install} kitchenName={t('app.name')} />
    </Page>
  );
}
