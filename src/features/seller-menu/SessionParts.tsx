import { useTranslation } from 'react-i18next';
import { keyframes, styled } from 'styled-components';
import { Button, Notice } from '../../ui';
import { useModalFocus } from '../../ui/patterns/modal';
import type { SessionDiff } from './draftSession';
import { MENU_NS } from './i18n/register';
import type { SavePhase } from './useSessionControls';

// Plan 103 fix 8: the pieces around an edit session: the sheet's sticky footer, the draft wizard's
// floating pill, and the "Save N changes?" question. Button labels stay on one line.

const spin = keyframes`to { transform: rotate(360deg); }`;
const Spinner = styled.i`
  display: inline-block;
  width: 1rem;
  height: 1rem;
  margin-right: ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.tab} solid currentcolor;
  border-top-color: transparent;
  border-radius: 50%;
  vertical-align: -0.2em;
  animation: ${spin} 0.8s linear infinite;

  @media (prefers-reduced-motion: reduce) {
    animation: none;
  }
`;
const Foot = styled.footer`
  display: flex;
  flex: none;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  background: ${({ theme }) => theme.c.surf};

  button {
    flex: none;
    white-space: nowrap;
  }
`;
const Count = styled.p<{ $error?: boolean }>`
  display: flex;
  flex: 1;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-width: 0;
  margin: 0;
  color: ${({ $error, theme }) => ($error ? theme.c.danger : theme.c.text)};
  font-weight: 700;
  white-space: nowrap;

  &::before {
    content: '';
    flex: none;
    width: 0.5rem;
    height: 0.5rem;
    border-radius: 50%;
    background: ${({ $error, theme }) => ($error ? theme.c.danger : theme.c.warn)};
  }
  .short {
    display: none;
  }
  @media (max-width: 40rem) {
    .long {
      display: none;
    }
    .short {
      display: inline;
    }
  }
`;

/** "Saving…" with a small spinner. */
function SavingLabel() {
  const { t } = useTranslation(MENU_NS);
  return (
    <>
      <Spinner aria-hidden="true" />
      {t('session.saving')}
    </>
  );
}

/** The sheet's footer: how many changes, Discard and Save, and their saving / saved / failed look. */
export function SessionFooter({
  diff,
  phase,
  onSave,
  onDiscard,
}: Readonly<{
  diff: SessionDiff;
  phase: SavePhase;
  onSave: () => void;
  onDiscard: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const count = diff.total;
  const failed = phase === 'failed';
  const saving = phase === 'saving';
  const saved = phase === 'saved';
  return (
    <>
      {failed ? (
        <Notice tone="error" layout="strip" role="alert">
          {t('session.failedNote')}
        </Notice>
      ) : null}
      <Foot>
        <Count $error={failed} role="status">
          {failed ? (
            t('session.failed')
          ) : saved ? (
            t('session.allSaved')
          ) : saving ? (
            t('session.savingCount', { count })
          ) : count === 0 ? (
            t('session.none')
          ) : (
            <>
              <span className="long">{t('session.count', { count })}</span>
              <span className="short">{t('session.countShort', { count })}</span>
            </>
          )}
        </Count>
        <Button onClick={onDiscard} disabled={saving || saved || count === 0}>
          {t('session.discard')}
        </Button>
        <Button
          variant={failed ? 'destructive' : 'primary'}
          onClick={onSave}
          disabled={saving || saved || (count === 0 && !failed)}
        >
          {saving ? (
            <SavingLabel />
          ) : saved ? (
            t('session.saved')
          ) : failed ? (
            t('session.retry')
          ) : (
            t('session.save')
          )}
        </Button>
      </Foot>
    </>
  );
}

const Pill = styled.div<{ $error: boolean }>`
  position: fixed;
  z-index: 15;
  right: ${({ theme }) => theme.spacing.lg};
  bottom: 5.5rem;
  display: inline-flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  min-height: ${({ theme }) => theme.size.tap}px;
  max-width: calc(100% - 1.5rem);
  padding: 0 ${({ theme }) => theme.spacing.xs} 0 ${({ theme }) => theme.spacing.lg};
  border-radius: 62rem;
  background: ${({ $error, theme }) => ($error ? theme.c.danger : theme.c.text)};
  color: ${({ theme }) => theme.c.bg};
  font-weight: 700;
  font-size: 0.9063rem;
  white-space: nowrap;
  box-shadow: 0 0.25rem 0.875rem ${({ theme }) => theme.noticeShadow};

  &::before {
    content: '';
    flex: none;
    width: 0.5625rem;
    height: 0.5625rem;
    border-radius: 50%;
    background: ${({ theme }) => theme.c.bg};
  }
  .short {
    display: none;
  }
  @media (max-width: 40rem) {
    right: ${({ theme }) => theme.spacing.md};
    bottom: 8.25rem;
    .long {
      display: none;
    }
    .short {
      display: inline;
    }
  }
`;
const PillSave = styled.button`
  min-height: 2.25rem;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 0;
  border-radius: 62rem;
  background: ${({ theme }) => theme.c.bg};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;
const Toast = styled.p`
  position: fixed;
  z-index: 15;
  right: ${({ theme }) => theme.spacing.lg};
  bottom: 5.5rem;
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-radius: 62rem;
  background: ${({ theme }) => theme.c.surf};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.conf};
  font-weight: 700;
`;

/** The draft wizard's pill above the Back / Next footer; after a save, a small "Saved ✓". */
export function DraftPill({
  diff,
  phase,
  onSave,
}: Readonly<{ diff: SessionDiff; phase: SavePhase; onSave: () => void }>) {
  const { t } = useTranslation(MENU_NS);
  const count = diff.total;
  if (phase === 'saved') return <Toast role="status">{t('session.saved')}</Toast>;
  if (count === 0 && phase !== 'failed') return null;
  const failed = phase === 'failed';
  const saving = phase === 'saving';
  return (
    <Pill
      $error={failed}
      role="status"
      aria-label={failed ? t('session.pillFailed') : t('session.pill', { count })}
    >
      {failed ? (
        <span>{t('session.pillFailed')}</span>
      ) : (
        <>
          <span className="long">{t('session.pill', { count })}</span>
          <span className="short">{t('session.pillShort', { count })}</span>
        </>
      )}
      <PillSave type="button" onClick={onSave} disabled={saving}>
        {saving ? <SavingLabel /> : failed ? t('session.retry') : t('session.save')}
      </PillSave>
    </Pill>
  );
}

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.colour.scrim};
`;
const Box = styled.div`
  width: min(26rem, 100%);
  padding: ${({ theme }) => theme.spacing.xl};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  border-radius: ${({ theme }) => theme.size.radiusSheet}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};

  &:focus {
    outline: none;
  }
  h2 {
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    font-size: 1.125rem;
  }
  p {
    margin: 0;
  }
`;
const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};

  button {
    white-space: nowrap;
  }
  @media (max-width: 40rem) {
    flex-direction: column;
    button {
      width: 100%;
      min-height: 3rem;
    }
  }
`;

/** Leaving with changes: Save / Don't save / Keep editing (Escape keeps editing). */
export function SaveChangesDialog({
  count,
  draft,
  saving,
  onSave,
  onDont,
  onKeep,
}: Readonly<{
  count: number;
  draft: boolean;
  saving: boolean;
  onSave: () => void;
  onDont: () => void;
  onKeep: () => void;
}>) {
  const { t } = useTranslation(MENU_NS);
  const { box, onKeyDown } = useModalFocus<HTMLDivElement>(onKeep);
  const title = t('session.leaveTitle', { count });
  return (
    <Overlay>
      <Box
        ref={box}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onKeyDown={onKeyDown}
      >
        <h2>{title}</h2>
        <p>{draft ? t('session.leaveBodyDraft') : t('session.leaveBody')}</p>
        <Buttons>
          <Button variant="primary" onClick={onSave} disabled={saving} data-autofocus>
            {saving ? <SavingLabel /> : t('session.save')}
          </Button>
          <Button onClick={onDont} disabled={saving}>
            {t('session.dont')}
          </Button>
          <Button variant="quiet" onClick={onKeep} disabled={saving}>
            {t('session.keep')}
          </Button>
        </Buttons>
      </Box>
    </Overlay>
  );
}
