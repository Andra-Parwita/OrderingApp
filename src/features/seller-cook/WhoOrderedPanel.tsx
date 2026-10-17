import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { parseOrderCode } from '../../../shared/orderCode';
import { pickText } from '../../../shared/text';
import { PrivateTag } from '../../components/PrivateTag';
import { SlideOver } from '../../ui';
import { COOK_NS } from './i18n/register';
import type { CookRow } from './cookModel';

const Title = styled.h2`
  margin: 0;
  padding: 0 ${({ theme }) => theme.spacing.xl};
  font-size: 1.125rem;
`;
const Summary = styled.p`
  margin: 0;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Person = styled(Link)`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.xl};
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
  color: inherit;
  text-decoration: none;

  &:hover {
    background: ${({ theme }) => theme.c.surf2};
  }
`;
const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Mono = styled(Muted)`
  font-family: ${({ theme }) => theme.font.mono};
  letter-spacing: 0.06em;
`;
const Qty = styled.b`
  font-variant-numeric: tabular-nums;
`;

/** Everyone who ordered one dish row, by first name; each person links to their order. */
export function WhoOrderedPanel({
  row,
  lang,
  onClose,
}: Readonly<{ row: CookRow; lang: Language; onClose: () => void }>) {
  const { t } = useTranslation(COOK_NS);
  const title = `${pickText(row.name, lang)} · ${pickText(row.size, lang)}`;
  const people = [...row.who].sort((a, b) => a.firstName.localeCompare(b.firstName, lang));
  const customers = new Set(row.who.map((who) => who.code)).size;
  return (
    <SlideOver label={title} closeLabel={t('who.close')} onClose={onClose}>
      <Title>{title}</Title>
      <Summary>{t('who.summary', { portions: row.qty, customers })}</Summary>
      <List>
        {people.map((who) => (
          <li key={who.code}>
            <Person
              to={`/seller/${who.private ? 'private' : 'orders'}/${parseOrderCode(who.code) ?? who.code}`}
            >
              <b>{who.firstName}</b>
              {who.private ? <PrivateTag label={t('privateTag')} /> : null}
              <Mono>{who.code}</Mono>
              <Qty>×{who.qty}</Qty>
              <Muted>{t(`who.${who.fulfilment}`)}</Muted>
            </Person>
          </li>
        ))}
      </List>
    </SlideOver>
  );
}
