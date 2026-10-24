import { useEffect, useRef, type ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { Icon } from '../../ui';
import type { ScreenId } from './flow';
import { INSTALL_NS } from './i18n/register';
import { InstallIcon } from './installIcons';
import type { InstallController } from './useInstallFlow';
import { StepPicture, AppTile } from './InstallPictures';
import {
  Overlay,
  Column,
  TopRow,
  IconOnly,
  BackLink,
  Dots,
  Eyebrow,
  Heading,
  Lead,
  Small,
  Note,
  Disc,
  WarnDisc,
  Body,
  Actions,
  Primary,
  TextButton,
  Numbered,
  DarkPanel,
  Notification,
  HomeGrid,
} from './installStyles';

// The install and notification screens (plan 004 stage 7, spec 6): a full-screen sheet over the
// customer app. One step per screen, the instruction at the top, one filled button at most, Skip
// always visible. Drawn from the design in uxDesign/customer (InstallIOS, InstallOther, Notify).

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
    case 'android-install':
      return (
        <>
          <TopRow>
            <span />
            <Close onClose={controller.close} />
          </TopRow>
          <Body>
            <Heading data-focus-target tabIndex={-1}>
              {t('androidInstall.title')}
            </Heading>
            <Numbered>
              {(['chrome', 'samsung', 'check'] as const).map((key) => (
                <li key={key}>
                  <span>
                    <Trans
                      t={t}
                      i18nKey={`androidInstall.${key}`}
                      ns={INSTALL_NS}
                      values={{ kitchen: kitchenName }}
                      components={{ b: <b /> }}
                    />
                  </span>
                </li>
              ))}
            </Numbered>
          </Body>
          <Actions>
            <Primary type="button" onClick={controller.close}>
              {t('androidInstall.done')}
            </Primary>
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
