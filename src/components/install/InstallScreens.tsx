import { useEffect, useRef, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon } from '../../ui';
import type { ScreenId } from './flow';
import { INSTALL_NS } from './i18n/register';
import { InstallIcon } from './installIcons';
import type { InstallController } from './useInstallFlow';

// The install and notification screens (plan 004 stage 7, spec 6): a full-screen sheet over the
// customer app. One step per screen, the instruction at the top, one filled button at most, Skip
// always visible. Drawn from the design in uxDesign/customer (InstallIOS, InstallOther, Notify).

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  overflow-y: auto;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
`;
const Column = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  box-sizing: border-box;
  max-width: 30rem;
  min-height: 100dvh;
  margin: 0 auto;
  padding: calc(var(--sat) + ${({ theme }) => theme.spacing.lg}) ${({ theme }) => theme.spacing.lg}
    calc(var(--sab) + ${({ theme }) => theme.spacing.lg});
`;
const TopRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;
  color: ${({ theme }) => theme.c.muted};
`;
const IconOnly = styled.button`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: ${({ theme }) => theme.size.tap}px;
  height: ${({ theme }) => theme.size.tap}px;
  margin-right: -${({ theme }) => theme.spacing.sm};
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.text};
  cursor: pointer;
`;
const BackLink = styled.button`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  min-height: ${({ theme }) => theme.size.tap}px;
  margin-left: -${({ theme }) => theme.spacing.xs};
  padding: 0 ${({ theme }) => theme.spacing.sm} 0 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const Dots = styled.ol`
  display: flex;
  gap: ${({ theme }) => theme.spacing.xs};
  margin: 0;
  padding: 0;
  list-style: none;

  li {
    width: 0.5rem;
    height: 0.5rem;
    border-radius: ${({ theme }) => theme.radius.pill};
    background: ${({ theme }) => theme.c.line};
  }
  li[aria-current='step'] {
    width: 1.5rem;
    background: ${({ theme }) => theme.c.fill};
  }
`;
const Eyebrow = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.atext};
  font-size: ${({ theme }) => theme.type.size.md};
  font-weight: 700;
`;
const Heading = styled.h1`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.xl};
  line-height: 1.2;
  font-weight: 700;

  &:focus {
    outline: none;
  }
`;
const Lead = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Small = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Note = styled.p`
  margin: 0;
  text-align: center;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Disc = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 4rem;
  height: 4rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.tint};
  color: ${({ theme }) => theme.c.atext};
`;
const WarnDisc = styled(Disc)`
  background: ${({ theme }) => theme.c.warnTint};
  color: ${({ theme }) => theme.c.warn};
`;
const Body = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: auto;
`;
const Primary = styled.button`
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
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: 700;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: wait;
  }
`;
const TextButton = styled.button<{ $quiet?: boolean }>`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  background: none;
  color: ${({ theme, $quiet }) => ($quiet ? theme.c.muted : theme.c.atext)};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const Numbered = styled.ol`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: 0;
  list-style: none;
  counter-reset: step;

  li {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    counter-increment: step;
    font-size: ${({ theme }) => theme.type.size.base};
  }
  li::before {
    content: counter(step);
    flex: none;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 2rem;
    height: 2rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.line};
    color: ${({ theme }) => theme.c.atext};
    font-size: ${({ theme }) => theme.type.size.md};
    font-weight: 700;
  }
  b {
    font-weight: 700;
  }
`;

// ---- Pictures (illustrations of the phone's own screens; not real controls) ----

const Panel = styled.div`
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 14rem;
  overflow: hidden;
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf2};
`;
const Ring = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: ${({ theme }) => theme.border.focus} solid ${({ theme }) => theme.c.warn};
  border-radius: 1rem;
`;
const BigButton = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  width: 8.5rem;
  height: 8.5rem;
  border: 1rem solid ${({ theme }) => theme.c.line};
  border-radius: 50%;
  background: ${({ theme }) => theme.c.surf};

  i {
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.text};
  }
`;
const Arrow = styled.svg`
  position: absolute;
  right: 2rem;
  bottom: 1rem;
  width: 3rem;
  height: 4rem;
  fill: none;
  stroke: ${({ theme }) => theme.c.warn};
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
`;
const Sheet = styled.div`
  align-self: flex-start;
  width: 100%;
  margin: 1.25rem 1rem 0;
  overflow: hidden;
  border-radius: 1rem 1rem 0 0;
  background: ${({ theme }) => theme.c.surf};
  box-shadow: 0 0.25rem 1rem ${({ theme }) => theme.colour.scrim};
`;
const MenuCard = styled(Sheet)`
  align-self: flex-start;
  width: 62%;
  margin: 1.25rem 1rem 0 auto;
  border-radius: 1rem;
`;
const SheetRow = styled.div<{ $on?: boolean }>`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding: 0.75rem 1rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  font-weight: ${({ $on }) => ($on ? 700 : 400)};
  box-shadow: ${({ $on, theme }) =>
    $on ? `inset 0 0 0 ${theme.border.focus} ${theme.c.warn}` : 'none'};
`;
const SheetHead = styled(SheetRow)`
  justify-content: flex-start;
  font-weight: 400;

  div {
    display: flex;
    flex-direction: column;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
  }
  b {
    font-weight: 700;
  }
`;
const Tile = styled.span<{ $size: string }>`
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  width: ${({ $size }) => $size};
  height: ${({ $size }) => $size};
  border-radius: 22%;
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font-weight: 700;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;
const Toggle = styled.span`
  position: relative;
  flex: none;
  width: 3rem;
  height: 1.75rem;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};

  &::after {
    content: '';
    position: absolute;
    top: 0.125rem;
    right: 0.125rem;
    width: 1.5rem;
    height: 1.5rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.on};
  }
`;
const DarkPanel = styled(Panel)`
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  gap: 1.25rem;
  padding: 1.5rem;
  background: ${({ theme }) => theme.c.text};
  color: ${({ theme }) => theme.c.bg};
`;
const Notification = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: 1.25rem;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font-size: ${({ theme }) => theme.type.size.md};

  div {
    display: flex;
    flex: 1;
    flex-direction: column;
    min-width: 0;
  }
  b {
    display: flex;
    justify-content: space-between;
    font-weight: 700;
  }
  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: ${({ theme }) => theme.type.size.sm};
    font-weight: 400;
  }
`;
const HomeGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem;
  justify-items: center;

  > span {
    width: 3.5rem;
    height: 3.5rem;
    border-radius: 22%;
    background: ${({ theme }) => theme.c.muted};
    opacity: 0.5;
  }
  figcaption {
    white-space: nowrap;
  }
  figure {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin: 0;
    font-size: ${({ theme }) => theme.type.size.sm};
  }
`;

/** The kitchen's icon, or its initials on the kitchen's colour. */
function AppTile({
  name,
  src,
  size,
}: Readonly<{ name: string; src?: string | undefined; size: string }>) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word.charAt(0).toUpperCase())
    .join('');
  return (
    <Tile $size={size} aria-hidden="true">
      {src ? <img src={src} alt="" /> : initials}
    </Tile>
  );
}

function Pointer({ label }: Readonly<{ label: string }>) {
  return (
    <Arrow viewBox="0 0 48 64" role="img" aria-label={label}>
      <path d="M8 4c4 24 16 38 30 52M28 54l10 4 2-12" />
    </Arrow>
  );
}

type PictureProps = Readonly<{ name: string; src?: string | undefined; code?: string | undefined }>;

function StepPicture({ screen, name, src, code }: PictureProps & { screen: ScreenId }) {
  const { t } = useTranslation(INSTALL_NS);
  switch (screen) {
    case 'ios-step-1':
      return (
        <Panel>
          <BigButton aria-hidden="true">
            <i />
            <i />
            <i />
          </BigButton>
          <Pointer label={t('step1.pointer')} />
        </Panel>
      );
    case 'ios-step-2':
      return (
        <Panel aria-hidden="true">
          <MenuCard>
            <SheetRow $on>
              {t('pictures.share')}
              <InstallIcon name="share" />
            </SheetRow>
            <SheetRow>Bookmarks</SheetRow>
            <SheetRow>New Tab</SheetRow>
            <SheetRow>Reload</SheetRow>
          </MenuCard>
        </Panel>
      );
    case 'ios-step-3':
      return (
        <Panel aria-hidden="true">
          <Sheet>
            <SheetHead>
              <AppTile name={name} src={src} size="2.5rem" />
              <div>
                <b>{name}</b>
                <small>{window.location.host}</small>
              </div>
            </SheetHead>
            <SheetRow>{t('pictures.copy')}</SheetRow>
            <SheetRow>{t('pictures.readingList')}</SheetRow>
            <SheetRow $on>{t('pictures.addHome')}</SheetRow>
            <SheetRow>{t('pictures.findOnPage')}</SheetRow>
          </Sheet>
        </Panel>
      );
    case 'ios-step-4':
      return (
        <Panel aria-hidden="true">
          <Sheet>
            <SheetRow>
              <span>{t('pictures.cancel')}</span>
              <b>{t('pictures.addHome')}</b>
              <Ring>
                <b>&nbsp;{t('pictures.add')}&nbsp;</b>
              </Ring>
            </SheetRow>
            <SheetHead>
              <AppTile name={name} src={src} size="3.5rem" />
              <div>
                <b>{name}</b>
                <small>{`${window.location.host}/o/${code ?? ''}`}</small>
              </div>
            </SheetHead>
            <SheetRow>
              {t('pictures.openAsApp')}
              <Toggle />
            </SheetRow>
          </Sheet>
        </Panel>
      );
    default:
      return null;
  }
}

// ---- Screens ----

type ScreenProps = Readonly<{
  controller: InstallController;
  kitchenName: string;
  iconSrc?: string | undefined;
  /** The order code as shown (K7F-2QX), when there is an order. */
  code?: string | undefined;
  /** The page behind the sheet, for the blocked screen's "‹ Order". */
  backLabel?: string | undefined;
}>;

function Close({ onClose }: Readonly<{ onClose: () => void }>) {
  const { t } = useTranslation(INSTALL_NS);
  return (
    <IconOnly type="button" onClick={onClose} aria-label={t('close')}>
      <Icon name="x" />
    </IconOnly>
  );
}

function Hint({ text }: Readonly<{ text: string | null }>) {
  return (
    <Note role="status" aria-live="polite">
      {text}
    </Note>
  );
}

function IosStep({
  screen,
  controller,
  kitchenName,
  iconSrc,
  code,
}: ScreenProps & { screen: ScreenId }) {
  const { t } = useTranslation(INSTALL_NS);
  const { step, flow } = controller;
  if (!step) return null;
  const key = screen === 'ios-step-2' && flow.variant === 'other' ? 'Other' : '';
  const title = t(
    screen === 'ios-step-2' ? `step2.title${key}` : `${screen.replace('ios-step-', 'step')}.title`,
  );
  const body = t(
    screen === 'ios-step-2' ? `step2.body${key}` : `${screen.replace('ios-step-', 'step')}.body`,
  );
  return (
    <>
      <TopRow>
        <Dots aria-label={t('stepsAlt', { n: step.n, total: step.total })}>
          {Array.from({ length: step.total }, (_, index) => (
            <li key={index} aria-current={index + 1 === step.n ? 'step' : undefined} />
          ))}
        </Dots>
        <Close onClose={controller.close} />
      </TopRow>
      <Body>
        <div>
          <Eyebrow>{t('stepOf', { n: step.n, total: step.total })}</Eyebrow>
          <Heading data-focus-target tabIndex={-1}>
            {title}
          </Heading>
        </div>
        <Lead>{body}</Lead>
        <StepPicture screen={screen} name={kitchenName} src={iconSrc} code={code} />
        {screen === 'ios-step-1' ? <Small>{t('step1.older')}</Small> : null}
      </Body>
      <Actions>
        <TextButton type="button" onClick={controller.next}>
          {step.n === step.total ? t('doneLast') : t('done')}
        </TextButton>
        {controller.showBack ? (
          <TextButton type="button" $quiet onClick={controller.back}>
            {t('back')}
          </TextButton>
        ) : null}
      </Actions>
    </>
  );
}

function Screen({ screen, ...props }: ScreenProps & { screen: ScreenId }): ReactNode {
  const { t } = useTranslation(INSTALL_NS);
  const { controller, kitchenName, iconSrc, code } = props;
  const { env, flow } = controller;
  const hint =
    flow.hint === 'copied'
      ? t(env.platform === 'android' ? 'linkCopiedAndroid' : 'linkCopied')
      : flow.hint === 'copy-failed'
        ? t('copyFailed')
        : flow.hint === 'still-blocked'
          ? t('notify.stillBlocked')
          : null;

  switch (screen) {
    case 'ios-ask':
      return (
        <>
          <TopRow>
            <span>{code ? t('orderLabel', { code }) : kitchenName}</span>
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <DarkPanel aria-hidden="true">
              <Notification>
                <AppTile name={kitchenName} src={iconSrc} size="2.75rem" />
                <div>
                  <b>
                    {kitchenName}
                    <small>{t('ask.now')}</small>
                  </b>
                  {t('ask.sampleBody')}
                  {code ? <small>{code}</small> : null}
                </div>
              </Notification>
            </DarkPanel>
            <Heading data-focus-target tabIndex={-1}>
              {t('ask.title')}
            </Heading>
            <Lead>{t('ask.body', { kitchen: kitchenName })}</Lead>
          </Body>
          <Actions>
            <Primary type="button" onClick={controller.next}>
              {t('ask.button')}
            </Primary>
            <TextButton type="button" onClick={controller.close}>
              {t('ask.skip')}
            </TextButton>
          </Actions>
        </>
      );
    case 'ios-step-1':
    case 'ios-step-2':
    case 'ios-step-3':
    case 'ios-step-4':
      return <IosStep screen={screen} {...props} />;
    case 'ios-open-from-home':
      return (
        <>
          <TopRow>
            <Eyebrow>{t('open.added')}</Eyebrow>
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Heading data-focus-target tabIndex={-1}>
              {t('open.title', { kitchen: kitchenName })}
            </Heading>
            <Lead>{code ? t('open.body', { code }) : t('open.bodyNoCode')}</Lead>
            <DarkPanel aria-hidden="true">
              <HomeGrid>
                <span />
                <span />
                <span />
                <span />
                <span />
                <span />
                <figure>
                  <AppTile name={kitchenName} src={iconSrc} size="3.5rem" />
                  <figcaption>{kitchenName}</figcaption>
                </figure>
                <span />
              </HomeGrid>
            </DarkPanel>
            <Small role="status">
              {flow.hint === 'cant-find' ? t('open.cantFindHelp', { kitchen: kitchenName }) : null}
            </Small>
          </Body>
          <Actions>
            <TextButton type="button" onClick={controller.showCantFind}>
              {t('open.cantFind')}
            </TextButton>
            <TextButton type="button" $quiet onClick={controller.close}>
              {t('open.stay')}
            </TextButton>
          </Actions>
        </>
      );
    case 'ios-inside-whatsapp':
      return (
        <>
          <TopRow>
            <span />
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Disc>
              <InstallIcon name="compass" size="1.75rem" />
            </Disc>
            <Heading data-focus-target tabIndex={-1}>
              {t('iosInApp.title')}
            </Heading>
            <Lead>{t('iosInApp.body', { app: env.inAppName ?? t('inAppName') })}</Lead>
            <Numbered>
              {(['step1', 'step2', 'step3'] as const).map((key) => (
                <li key={key}>
                  <span>
                    <Trans
                      t={t}
                      i18nKey={`iosInApp.${key}`}
                      ns={INSTALL_NS}
                      components={{ b: <b /> }}
                    />
                  </span>
                </li>
              ))}
            </Numbered>
          </Body>
          <Actions>
            <Primary type="button" onClick={controller.copyLink}>
              <InstallIcon name="copy" />
              {t('copyLink')}
            </Primary>
            <Note role="status" aria-live="polite">
              {hint ?? t('copyHint')}
            </Note>
            <TextButton type="button" onClick={controller.close}>
              {t('skip')}
            </TextButton>
          </Actions>
        </>
      );
    case 'android-inside-whatsapp':
      return (
        <>
          <TopRow>
            <span />
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Heading data-focus-target tabIndex={-1}>
              {t('androidInApp.title')}
            </Heading>
            <Lead>{t('androidInApp.body', { app: env.inAppName ?? t('inAppName') })}</Lead>
            <Numbered>
              {(['step1', 'step2'] as const).map((key) => (
                <li key={key}>
                  <span>
                    <Trans
                      t={t}
                      i18nKey={`androidInApp.${key}`}
                      ns={INSTALL_NS}
                      components={{ b: <b /> }}
                    />
                  </span>
                </li>
              ))}
            </Numbered>
          </Body>
          <Actions>
            <TextButton type="button" onClick={controller.close}>
              {t('skip')}
            </TextButton>
          </Actions>
        </>
      );
    case 'android-allow':
      return (
        <>
          <TopRow>
            <span />
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Disc>
              <InstallIcon name="bell" size="1.75rem" />
            </Disc>
            <Heading data-focus-target tabIndex={-1}>
              {t('ask.title')}
            </Heading>
            <Lead>{t('android.allowBody')}</Lead>
            <Small role="status">{controller.busy ? t('android.waiting') : null}</Small>
          </Body>
          <Actions>
            <TextButton type="button" onClick={controller.close}>
              {t('skip')}
            </TextButton>
          </Actions>
        </>
      );
    case 'notify-off':
      return (
        <>
          <TopRow>
            <span>{code ? `${kitchenName} · ${code}` : kitchenName}</span>
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Disc>
              <InstallIcon name="bell" size="1.75rem" />
            </Disc>
            <Heading data-focus-target tabIndex={-1}>
              {t('notify.offTitle')}
            </Heading>
            <Lead>
              <Trans
                t={t}
                i18nKey={code ? 'notify.offBody' : 'notify.offBodyNoCode'}
                ns={INSTALL_NS}
                values={{ code }}
                components={{ b: <b /> }}
              />
            </Lead>
          </Body>
          <Actions>
            <Primary type="button" disabled={controller.busy} onClick={controller.enable}>
              {controller.busy ? t('notify.working') : t('notify.offButton')}
            </Primary>
            <TextButton type="button" onClick={controller.close}>
              {t('notNow')}
            </TextButton>
          </Actions>
        </>
      );
    case 'notify-blocked':
      return <Blocked {...props} hint={hint} />;
    case 'not-set-up':
    case 'unsupported':
    case 'failed': {
      const key = screen === 'not-set-up' ? 'notSetUp' : screen;
      const failed = screen === 'failed';
      return (
        <>
          <TopRow>
            <span />
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <WarnDisc>
              <InstallIcon name="bellOff" size="1.75rem" />
            </WarnDisc>
            <Heading data-focus-target tabIndex={-1}>
              {t(`notify.${key}Title`)}
            </Heading>
            <Lead>{t(`notify.${key}Body`)}</Lead>
          </Body>
          <Actions>
            <Primary type="button" onClick={failed ? controller.enable : controller.close}>
              {failed ? t('notify.tryAgain') : t('notify.gotIt')}
            </Primary>
            {failed ? (
              <TextButton type="button" onClick={controller.close}>
                {t('notNow')}
              </TextButton>
            ) : null}
          </Actions>
        </>
      );
    }
  }
}

function Blocked({
  controller,
  kitchenName,
  backLabel,
  hint,
}: ScreenProps & { hint: string | null }) {
  const { t } = useTranslation(INSTALL_NS);
  const { platform } = controller.env;
  const domain = window.location.host;
  return (
    <>
      <TopRow>
        <BackLink type="button" onClick={controller.close}>
          <Icon name="back" />
          {backLabel ?? t('back')}
        </BackLink>
        <span />
      </TopRow>
      <Body>
        <WarnDisc>
          <InstallIcon name="bellOff" size="1.75rem" />
        </WarnDisc>
        <Heading data-focus-target tabIndex={-1}>
          {t('notify.blockedTitle')}
        </Heading>
        <Lead>
          {t(
            platform === 'ios'
              ? 'notify.blockedBody'
              : platform === 'android'
                ? 'notify.blockedBodyAndroid'
                : 'notify.blockedBodyDesktop',
          )}
        </Lead>
        {platform === 'ios' ? (
          <>
            <Numbered>
              {(['blockedStep1', 'blockedStep2', 'blockedStep3', 'blockedStep4'] as const).map(
                (key) => (
                  <li key={key}>
                    <span>
                      <Trans
                        t={t}
                        i18nKey={`notify.${key}`}
                        ns={INSTALL_NS}
                        values={{ kitchen: kitchenName }}
                        components={{ b: <b /> }}
                      />
                    </span>
                  </li>
                ),
              )}
            </Numbered>
            <Small>{t('notify.blockedAndroid', { domain })}</Small>
          </>
        ) : (
          <Small>
            {t(platform === 'android' ? 'notify.blockedAndroid' : 'notify.blockedDesktop', {
              domain,
            })}
          </Small>
        )}
      </Body>
      <Actions>
        <Hint text={hint} />
        <Primary type="button" disabled={controller.busy} onClick={controller.recheck}>
          {t('notify.blockedDone')}
        </Primary>
        <TextButton type="button" onClick={controller.close}>
          {t('skip')}
        </TextButton>
      </Actions>
    </>
  );
}

/** The sheet for whatever screen the flow is on; nothing when it is closed. */
export function InstallOverlay(props: ScreenProps) {
  const { t } = useTranslation(INSTALL_NS);
  const { controller } = props;
  const screen = controller.flow.screen;
  const root = useRef<HTMLDivElement>(null);
  const close = controller.close;
  // Each new screen starts at its heading, for keyboards and screen readers.
  useEffect(() => {
    root.current?.querySelector<HTMLElement>('[data-focus-target]')?.focus();
    root.current?.scrollTo?.(0, 0);
  }, [screen]);
  useEffect(() => {
    if (screen === null) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, close]);
  if (screen === null) return null;
  return (
    <Overlay ref={root} role="dialog" aria-modal="true" aria-label={t('notify.offButton')}>
      <Column>
        <Screen screen={screen} {...props} />
      </Column>
    </Overlay>
  );
}

export type { ScreenProps as InstallOverlayProps };
