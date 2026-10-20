import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { ITEM_NAME_MAX, MAX_CHOICES } from '../../../shared/limits';
import { Button, Icon, IconButton, TextField } from '../../ui';
import { MENU_NS } from './i18n/register';
import { newChoiceDraft, type ChoiceDraft } from './itemForm';
import { Muted } from './menuShared';

// Plan 111 (D-112): the "Choices (optional)" part of the dish sheet. A choice has a name (English
// and Indonesian, or one box in a one-language kitchen) and a limit; the rest is the dish's.

const Section = styled.fieldset`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
`;
const Legend = styled.legend`
  padding: 0;
  font-weight: 700;
`;
const Row = styled.div<{ $one: boolean }>`
  display: grid;
  grid-template-columns: ${({ $one }) =>
    $one ? 'minmax(0, 1fr) 7rem auto' : 'minmax(0, 1fr) minmax(0, 1fr) 7rem auto'};
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: start;
  padding-bottom: ${({ theme }) => theme.spacing.md};
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};

  @media (max-width: 37.4375rem) {
    grid-template-columns: minmax(0, 1fr) auto;

    > :nth-child(1),
    > :nth-child(2) {
      grid-column: 1 / -1;
    }
  }
`;
const Remove = styled.div`
  padding-top: 1.5rem;

  @media (max-width: 37.4375rem) {
    padding-top: 0;
  }
`;

export type ChoicesFieldProps = Readonly<{
  choices: ReadonlyArray<ChoiceDraft>;
  oneLanguage: 'en' | 'id' | null;
  invalid: boolean;
  onChange: (next: Array<ChoiceDraft>) => void;
}>;

export function ChoicesField({ choices, oneLanguage, invalid, onChange }: ChoicesFieldProps) {
  const { t } = useTranslation(MENU_NS);
  const patch = (key: string, change: Partial<ChoiceDraft>) =>
    onChange(choices.map((choice) => (choice.key === key ? { ...choice, ...change } : choice)));
  return (
    <Section>
      <Legend>{t('choices.title')}</Legend>
      <Muted>{t('choices.helper')}</Muted>
      {choices.map((choice) => (
        <Row key={choice.key} $one={oneLanguage !== null}>
          {oneLanguage ? (
            <TextField
              label={t('choices.name')}
              value={choice.nameEn}
              maxLength={ITEM_NAME_MAX}
              onChange={(event) =>
                patch(choice.key, { nameEn: event.target.value, nameId: event.target.value })
              }
              {...(invalid && choice.nameEn.trim() === '' ? { error: t('choices.err') } : {})}
            />
          ) : (
            <>
              <TextField
                label={t('choices.nameEn')}
                value={choice.nameEn}
                maxLength={ITEM_NAME_MAX}
                onChange={(event) => patch(choice.key, { nameEn: event.target.value })}
                {...(invalid && choice.nameEn.trim() === '' && choice.nameId.trim() === ''
                  ? { error: t('choices.err') }
                  : {})}
              />
              <TextField
                label={t('choices.nameId')}
                value={choice.nameId}
                maxLength={ITEM_NAME_MAX}
                onChange={(event) => patch(choice.key, { nameId: event.target.value })}
                {...(choice.nameId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
              />
            </>
          )}
          <TextField
            label={t('choices.limit')}
            value={choice.limit}
            inputMode="numeric"
            placeholder={t('dish.noLimit')}
            onChange={(event) => patch(choice.key, { limit: event.target.value })}
          />
          <Remove>
            <IconButton
              label={t('choices.remove', { name: (choice.nameEn || choice.nameId).trim() })}
              onClick={() => onChange(choices.filter((c) => c.key !== choice.key))}
            >
              <Icon name="x" />
            </IconButton>
          </Remove>
        </Row>
      ))}
      <div>
        <Button
          variant="secondary"
          disabled={choices.length >= MAX_CHOICES}
          onClick={() => onChange([...choices, newChoiceDraft()])}
        >
          {t('choices.add')}
        </Button>
      </div>
      {choices.length >= MAX_CHOICES ? (
        <Muted>{t('choices.max', { max: MAX_CHOICES })}</Muted>
      ) : null}
    </Section>
  );
}
