import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon, type IconName } from '../Icon';

export type ChecklistStep = Readonly<{ id: string; label: string; done: boolean }>;

export type EmptyStateProps = Readonly<{
  icon?: IconName;
  /** What is empty: "No menu yet". */
  title: string;
  /** Why it is empty, in a sentence. */
  why?: string;
  /** First run: a checklist instead of a bare message. Each step shows an icon and a word. */
  steps?: ReadonlyArray<ChecklistStep>;
  /** The one next step, usually a filled Button. */
  action?: ReactNode;
}>;

const Wrap = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  max-width: 32rem;
  padding: ${({ theme }) => theme.size.pagePadTablet}px;
  color: ${({ theme }) => theme.c.text};
`;
const Title = styled.h2`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  margin: 0;
  font-size: 1.125rem;
  font-weight: 700;
`;
const Why = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
`;
const Steps = styled.ol`
  align-self: stretch;
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: 0;
  list-style: none;
`;
const Step = styled.li<{ $done: boolean }>`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: 3rem;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: ${({ $done, theme }) => ($done ? theme.c.muted : theme.c.text)};

  em {
    margin-left: auto;
    color: ${({ $done, theme }) => ($done ? theme.c.conf : theme.c.muted)};
    font-size: 0.8125rem;
    font-style: normal;
    font-weight: 600;
  }
`;
const Action = styled.div`
  margin-top: ${({ theme }) => theme.spacing.md};
`;

/** Says why it is empty and offers one next step; the first run is a checklist. */
export function EmptyState({ icon = 'inbox', title, why, steps, action }: EmptyStateProps) {
  const { t } = useTranslation();
  return (
    <Wrap>
      <Title>
        <Icon name={icon} />
        {title}
      </Title>
      {why ? <Why>{why}</Why> : null}
      {steps ? (
        <Steps>
          {steps.map((step) => (
            <Step key={step.id} $done={step.done}>
              <Icon name={step.done ? 'check' : 'plus'} />
              {step.label}
              <em>{t(step.done ? 'patterns.checklistDone' : 'patterns.checklistTodo')}</em>
            </Step>
          ))}
        </Steps>
      ) : null}
      {action ? <Action>{action}</Action> : null}
    </Wrap>
  );
}
