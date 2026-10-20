import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Language } from '../../../shared/domain';
import { pickText } from '../../../shared/text';
import type { CookRow } from './cookModel';
import { COOK_NS } from './i18n/register';

// Plan 111: the notes typed on a dish's order lines, listed under the dish (a choice's under it).

const List = styled.ul`
  grid-column: 1 / -1;
  flex-basis: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  color: ${({ theme }) => theme.c.warn};
  font-size: 0.875rem;
`;

export function LineNotes({ row, lang }: Readonly<{ row: CookRow; lang: Language }>) {
  const { t } = useTranslation(COOK_NS);
  if (!row.notes || row.notes.length === 0) return null;
  return (
    <List>
      {row.notes.map((note) => (
        <li key={note.code}>
          {t('lineNote', {
            note: note.note,
            who: row.choice ? `${note.firstName}, ${pickText(row.name, lang)}` : note.firstName,
          })}
        </li>
      ))}
    </List>
  );
}
