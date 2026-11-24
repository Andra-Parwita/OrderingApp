import { createContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { LayerBar, LayerShell } from '../../../components/layer/LayerShell';
import { Button, Icon, IconButton } from '../../../ui';
import { MENU_NS } from '../i18n/register';
import type { Step } from '../steps';

// Plan 134: the menu wizard on the phone, one column: top bar (Close, "Menu for <date>", status), a
// compact four-part step bar, the step, and a footer pinned at the bottom (Back / Next). A step may
// put a chip at the start of the footer (step 1: "On this menu N") through `PhoneFooterSlot`.

/** Where a step puts its footer chip (a DOM node in the shell's footer); null outside the shell. */
export const PhoneFooterSlot = createContext<HTMLElement | null>(null);

const Titles = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  text-align: center;
`;
export type StatusTone = 'live' | 'muted' | 'warn' | 'error';

const Status = styled.small<{ $tone: StatusTone }>`
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ $tone, theme }) =>
    $tone === 'live'
      ? theme.c.conf
      : $tone === 'warn'
        ? theme.c.warn
        : $tone === 'error'
          ? theme.c.danger
          : theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Steps = styled.nav`
  display: grid;
  flex: none;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
const StepTab = styled.button<{ $current: boolean; $done: boolean }>`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.125rem;
  min-width: 0;
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xs};
  border: 0;
  border-bottom: ${({ theme }) => theme.border.tab} solid
    ${({ $current, theme }) => ($current ? theme.c.fill : 'transparent')};
  background: transparent;
  color: ${({ $current, theme }) => ($current ? theme.c.text : theme.c.muted)};
  font: inherit;
  font-size: 0.8125rem;
  font-weight: ${({ $current }) => ($current ? 700 : 500)};
  text-align: center;
  cursor: pointer;

  &:disabled {
    cursor: default;
    opacity: 0.6;
  }
  i {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 1.5rem;
    height: 1.5rem;
    border: ${({ theme }) => theme.border.hairline} solid
      ${({ $current, $done, theme }) => ($current || $done ? theme.c.fill : theme.c.ctrl)};
    border-radius: 50%;
    background: ${({ $current, $done, theme }) =>
      $current || $done ? theme.c.fill : 'transparent'};
    color: ${({ $current, $done, theme }) => ($current || $done ? theme.c.on : 'inherit')};
    font-size: 0.75rem;
    font-style: normal;
  }
  span {
    max-width: 100%;
    overflow-wrap: anywhere;
  }
`;
const Scroll = styled.div`
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
`;
const Foot = styled.footer`
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadPhone}px;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.bg};

  button {
    white-space: nowrap;
  }
`;
const FootStart = styled.div`
  display: flex;
  flex: none;

  &:empty {
    display: none;
  }
`;
const Next = styled.div`
  display: flex;
  flex: 1 1 8rem;
  justify-content: flex-end;

  button {
    flex: 1;
  }
`;

export type ShellStep = Readonly<{
  name: Step;
  /** The short name ("Publish"), not the long one. */
  label: string;
  current: boolean;
  done: boolean;
  disabled: boolean;
}>;

export function PhoneWizardShell({
  label,
  title,
  status,
  tone,
  steps,
  onStep,
  onClose,
  back,
  next,
  children,
  floating,
}: Readonly<{
  label: string;
  title: string;
  status: string;
  tone: StatusTone;
  steps: ReadonlyArray<ShellStep>;
  onStep: (step: Step) => void;
  onClose: () => void;
  back: Readonly<{ label: string; onClick: () => void }> | undefined;
  next: Readonly<{ label: string; onClick: () => void }> | undefined;
  children: ReactNode;
  /** Over the layer, inside it (the layer is its own stacking context): the pill, the dish editor, dialogs. */
  floating: ReactNode;
}>) {
  const { t } = useTranslation(MENU_NS);
  const [slot, setSlot] = useState<HTMLElement | null>(null);
  // Each step starts at its top, not where the last one was scrolled to.
  const scroll = useRef<HTMLDivElement>(null);
  const current = steps.find((step) => step.current)?.name;
  useEffect(() => {
    scroll.current?.scrollTo?.({ top: 0 });
  }, [current]);
  return (
    <PhoneFooterSlot.Provider value={slot}>
      <LayerShell label={label} onClose={onClose}>
        <LayerBar>
          <IconButton label={t('close')} onClick={onClose}>
            <Icon name="x" />
          </IconButton>
          <Titles>
            <h2>{title}</h2>
            <Status $tone={tone} role="status">
              <Icon name={tone === 'live' ? 'check' : 'note'} />
              {status}
            </Status>
          </Titles>
          <span />
        </LayerBar>
        <Steps aria-label={t('make.steps')}>
          {steps.map((step, position) => (
            <StepTab
              key={step.name}
              type="button"
              $current={step.current}
              $done={step.done}
              aria-current={step.current ? 'step' : undefined}
              disabled={step.disabled}
              onClick={() => onStep(step.name)}
            >
              <i>{step.done && !step.current ? <Icon name="check" /> : position + 1}</i>
              <span>{step.label}</span>
            </StepTab>
          ))}
        </Steps>
        <Scroll ref={scroll}>{children}</Scroll>
        <Foot>
          <FootStart ref={setSlot} />
          {back ? (
            <Button onClick={back.onClick}>
              <Icon name="back" />
              {back.label}
            </Button>
          ) : null}
          {next ? (
            <Next>
              <Button variant="primary" onClick={next.onClick}>
                {next.label}
                <Icon name="forward" />
              </Button>
            </Next>
          ) : null}
        </Foot>
        {floating}
      </LayerShell>
    </PhoneFooterSlot.Provider>
  );
}
