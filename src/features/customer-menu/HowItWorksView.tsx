import type { ReactNode } from 'react';
import { Trans, useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { MenuResponse } from '../../../shared/menuContract';
import { formatPhone } from '../../../shared/phone';
import { CustomerPage } from '../../components/CustomerPage';
import { CUSTOMER_NS } from './i18n/register';
import { MenuIcon, type MenuIconName } from './menuIcons';
import { MainButton } from './menuParts';

// How ordering works (spec §4.1): three steps with big icons, then the one main button.

const Steps = styled.ol`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.lg};
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Step = styled.li`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Badge = styled.span`
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 3.5rem;
  height: 3.5rem;
  border-radius: 50%;
  background: ${({ theme }) => theme.c.line};
  color: ${({ theme }) => theme.c.atext};
`;
const StepText = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  padding-top: ${({ theme }) => theme.spacing.xs};

  strong {
    font-size: ${({ theme }) => theme.type.size.base};
    font-weight: 700;
  }
  span {
    color: ${({ theme }) => theme.c.muted};
  }
`;
const NoWrap = styled.span`
  white-space: nowrap;
`;
const Foot = styled.div`
  position: sticky;
  bottom: var(--customer-tabbar-height, 0rem);
  margin-top: ${({ theme }) => theme.spacing.xxl};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  background: ${({ theme }) => theme.c.bg};
`;

type Props = Readonly<{
  data: MenuResponse;
  onBack: () => void;
  onSeeDishes: () => void;
}>;

export function HowItWorksView({ data, onBack, onSeeDishes }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const { kitchen, seller } = data;
  const cook = seller.name || t('states.theSeller');
  const number = kitchen.whatsappNumber ? formatPhone(kitchen.whatsappNumber) : null;
  const steps: ReadonlyArray<Readonly<{ icon: MenuIconName; title: string; body: ReactNode }>> = [
    { icon: 'bag', title: t('how.s1Title'), body: t('how.s1Body') },
    { icon: 'person', title: t('how.s2Title'), body: t('how.s2Body') },
    {
      icon: 'chat',
      title: t('how.s3Title'),
      body: number ? (
        <Trans
          t={t}
          i18nKey="how.s3Body"
          values={{ cook, number }}
          components={{ num: <NoWrap /> }}
        />
      ) : (
        t('how.s3BodyNoNumber', { cook })
      ),
    },
  ];
  return (
    <CustomerPage
      title={t('how.title')}
      kitchenName={kitchen.name}
      logoSrc={kitchen.images?.railImage}
      backLabel={t('dishes.backMenu')}
      onBack={onBack}
    >
      <Steps>
        {steps.map((step) => (
          <Step key={step.icon}>
            <Badge>
              <MenuIcon name={step.icon} size="1.5rem" />
            </Badge>
            <StepText>
              <strong>{step.title}</strong>
              <span>{step.body}</span>
            </StepText>
          </Step>
        ))}
      </Steps>
      <Foot>
        <MainButton type="button" onClick={onSeeDishes}>
          {t('home.seeDishes')}
          <MenuIcon name="chevron" />
        </MainButton>
      </Foot>
    </CustomerPage>
  );
}
