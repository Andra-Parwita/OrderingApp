import { useCallback, useState } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Icon } from '../../ui';
import { resetThisPhone } from './resetThisPhone';

// Plan 102 stage 3: Settings → Help → "Start fresh". The beta reset steps, and the one button that
// forgets this phone's data. The steps are the same as the WhatsApp text (docs/guide/start-fresh-whatsapp.md).

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  padding: 0 ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
`;
const Back = styled.button`
  display: inline-flex;
  align-items: center;
  min-height: ${({ theme }) => theme.size.tap}px;
  margin-top: ${({ theme }) => theme.spacing.sm};
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;
`;
const Title = styled.h1`
  margin: 0 0 ${({ theme }) => theme.spacing.sm};
  font-size: 1.75rem;
  line-height: 1.2;
  font-weight: 700;
`;
const Intro = styled.p`
  margin: 0 0 ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Steps = styled.ol`
  margin: 0;
  padding-left: 1.25rem;
  font-size: ${({ theme }) => theme.type.size.md};
  line-height: 1.45;

  li {
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  }
  b {
    font-weight: 700;
  }
`;
const Actions = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.lg};
`;
const Reset = styled.button`
  min-height: 3.25rem;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  border: 0;
  border-radius: ${({ theme }) => theme.radius.pill};
  background: ${({ theme }) => theme.c.fill};
  color: ${({ theme }) => theme.c.on};
  font: inherit;
  font-weight: 700;
  white-space: nowrap;
  cursor: pointer;

  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
const TextLink = styled.button`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0;
  border: 0;
  background: none;
  color: ${({ theme }) => theme.c.atext};
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

const STEPS = ['step1', 'step2', 'step3', 'step4', 'step5', 'step6', 'step7'] as const;

type Props = Readonly<{
  onBack: () => void;
  /** Opens Settings, where "Delete my saved data" is. */
  onOpenSettings: () => void;
  /** Where the customer goes once the phone is reset (a full reload at the start page). */
  onDone?: () => void;
}>;

export function StartFreshScreen({ onBack, onOpenSettings, onDone }: Props) {
  const { t } = useTranslation();
  const [working, setWorking] = useState(false);
  const reset = useCallback(() => {
    setWorking(true);
    void resetThisPhone().then(onDone ?? (() => window.location.assign('/')));
  }, [onDone]);
  return (
    <Page>
      <Back type="button" onClick={onBack}>
        <Icon name="back" />
        {t('startFresh.back')}
      </Back>
      <Title>{t('startFresh.title')}</Title>
      <Intro>{t('startFresh.intro')}</Intro>
      <Steps>
        {STEPS.map((key) => (
          <li key={key}>
            <Trans i18nKey={`startFresh.${key}`} components={{ b: <b /> }} />
          </li>
        ))}
      </Steps>
      <Actions>
        <Reset type="button" disabled={working} onClick={reset}>
          {working ? t('startFresh.resetting') : t('startFresh.reset')}
        </Reset>
        <TextLink type="button" onClick={onOpenSettings}>
          {t('startFresh.deleteLink')}
        </TextLink>
      </Actions>
    </Page>
  );
}
