import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../../components/LanguageSwitch';
import { ThemeSwitch } from '../../components/ThemeSwitch';
import { Button } from '../../ui';

const Page = styled.main`
  max-width: 32rem;
  margin: 0 auto;
  /* Leaves room for the customer tab bar when the app shell shows one. */
  min-height: calc(100dvh - var(--customer-tabbar-height, 0rem));
  padding-top: env(safe-area-inset-top);
`;
const Title = styled.h1`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.type.size.lg};
  line-height: ${({ theme }) => theme.type.lineHeight.tight};
`;
const Section = styled.section`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.lg};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
`;
const Heading = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.base};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.colour.textMuted};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const Steps = styled.ol`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.xl};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
`;
const SubHeading = styled.h3`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.sm};
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

const STEPS = [1, 2, 3, 4] as const;

function Guide({ platform }: Readonly<{ platform: 'iphone' | 'android' }>) {
  const { t } = useTranslation();
  return (
    <div>
      <SubHeading>{t(`customerSettings.${platform}Title`)}</SubHeading>
      <Steps>
        {STEPS.map((step) => (
          <li key={step}>{t(`customerSettings.${platform}${step}`)}</li>
        ))}
      </Steps>
    </div>
  );
}

/** The customer's Settings tab: language, appearance, updates (not yet) and the Home Screen guide. */
export function CustomerSettingsScreen() {
  const { t } = useTranslation();
  return (
    <Page>
      <Title>{t('customerSettings.title')}</Title>
      <Section aria-labelledby="cs-language">
        <Heading id="cs-language">{t('customerSettings.language')}</Heading>
        <LanguageSwitch />
      </Section>
      <Section aria-labelledby="cs-theme">
        <Heading id="cs-theme">{t('customerSettings.theme')}</Heading>
        <ThemeSwitch />
      </Section>
      <Section aria-labelledby="cs-updates">
        <Heading id="cs-updates">{t('customerSettings.updatesTitle')}</Heading>
        <Button disabled aria-describedby="cs-updates-soon">
          {t('customerSettings.updatesButton')}
        </Button>
        <Muted id="cs-updates-soon">{t('customerSettings.updatesSoon')}</Muted>
      </Section>
      <Section aria-labelledby="cs-guide">
        <Heading id="cs-guide">{t('customerSettings.guideTitle')}</Heading>
        <Muted>{t('customerSettings.guideIntro')}</Muted>
        <Guide platform="iphone" />
        <Guide platform="android" />
      </Section>
    </Page>
  );
}
