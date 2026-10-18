import { styled } from 'styled-components';

// The phase strip (states 2, 3 and 4): four steps, each with a 4px bar, an icon (done: a tick in
// a circle; current: a half-filled circle; to do: an empty circle, never colour alone), a label and
// a date line. The current step is bold and has aria-current="step".

const Strip = styled.ol`
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  margin: 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.size.pagePadTablet}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  list-style: none;

  @media (max-width: 40rem) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
`;
const Phase = styled.li<{ $done: boolean; $current: boolean }>`
  display: flex;
  flex-direction: column;
  min-width: 0;
  gap: ${({ theme }) => theme.spacing.xs};
  color: ${({ $current, theme }) => ($current ? theme.c.text : theme.c.muted)};
  font-weight: ${({ $current }) => ($current ? 700 : 500)};

  .bar {
    height: 0.1875rem;
    border-radius: 0.125rem;
    background: ${({ $done, $current, theme }) => ($done || $current ? theme.c.fill : theme.c.line)};
  }
  .label {
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
    font-size: 0.875rem;
    white-space: nowrap;
  }
  .label small {
    min-width: 0;
    overflow: hidden;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
    font-weight: 400;
    text-overflow: ellipsis;
  }
`;
const Svg = styled.svg`
  width: 1rem;
  height: 1rem;
  flex: none;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.75;
  stroke-linecap: round;
  stroke-linejoin: round;
`;

export type Progress = 'done' | 'current' | 'todo';

const CIRCLE = 'M12 3a9 9 0 1 0 0 18a9 9 0 1 0 0-18z';
const PATHS: Readonly<Record<Progress, string>> = {
  done: `${CIRCLE}M8 12.5l2.5 2.5L16 9.5`,
  current: `${CIRCLE}M12 3v18`,
  todo: CIRCLE,
};

export function StateIcon({ state }: Readonly<{ state: Progress }>) {
  return (
    <Svg viewBox="0 0 24 24" aria-hidden="true">
      <path d={PATHS[state]} />
    </Svg>
  );
}

export type PhaseItem = Readonly<{ id: string; label: string; note: string; state: Progress }>;

export function PhaseStrip({
  label,
  phases,
}: Readonly<{ label: string; phases: ReadonlyArray<PhaseItem> }>) {
  return (
    <Strip aria-label={label}>
      {phases.map((phase) => (
        <Phase
          key={phase.id}
          $done={phase.state === 'done'}
          $current={phase.state === 'current'}
          aria-current={phase.state === 'current' ? 'step' : undefined}
        >
          <span className="bar" aria-hidden="true" />
          <span className="label">
            <StateIcon state={phase.state} />
            {phase.label}
            {phase.note ? <small title={phase.note}>{phase.note}</small> : null}
          </span>
        </Phase>
      ))}
    </Strip>
  );
}
