import { useTranslation } from 'react-i18next';
import styled from 'styled-components';

const LANGUAGES = ['en', 'id'] as const;

const Group = styled.div`
  display: inline-flex;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const Option = styled.button`
  min-height: ${({ theme }) => theme.minTapTarget};
  min-width: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
  cursor: pointer;
  &[aria-pressed='true'] {
    background: ${({ theme }) => theme.colour.accent};
    border-color: ${({ theme }) => theme.colour.accent};
    color: ${({ theme }) => theme.colour.onAccent};
  }
`;

export function LanguageSwitch() {
  const { t, i18n } = useTranslation();
  return (
    <Group role="group" aria-label={t('language.label')}>
      {LANGUAGES.map((code) => (
        <Option
          key={code}
          type="button"
          aria-pressed={i18n.language === code}
          onClick={() => void i18n.changeLanguage(code)}
        >
          {code.toUpperCase()}
        </Option>
      ))}
    </Group>
  );
}
