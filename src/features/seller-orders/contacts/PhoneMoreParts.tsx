import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { LanguageSwitch } from '../../../components/LanguageSwitch';
import { SELLER_NS } from '../i18n/register';

const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Label = styled.span`
  font-weight: 600;
`;
const Note = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.9375rem;
`;

/** Phone More: the language choice, EN / ID. */
export function PhoneLanguageRow() {
  const { t } = useTranslation(SELLER_NS);
  return (
    <Row>
      <Label>{t('phoneMore.language')}</Label>
      <LanguageSwitch />
    </Row>
  );
}

/** Phone More: where the rest of the app lives (handoff, Phone More). */
export function PhoneMoreNote() {
  const { t } = useTranslation(SELLER_NS);
  return <Note>{t('phoneMore.note')}</Note>;
}
