import type { ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { FIRST_NAME_MAX, NOTE_MAX } from '../../../shared/limits';
import { TextArea, TextField } from '../../ui';
import { SELLER_NS } from './i18n/register';

// The pieces New order (tablet panel, phone screen) and Edit order share: the field styles, the
// first-name field and the note field (plan 105 takes them out of the two New order files).

export const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
export const Label = styled.span`
  font-size: 0.8125rem;
  font-weight: 700;
`;
export const Muted = styled.span`
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
export const ErrorText = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.danger};
`;
export const Row = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.rowCompact}px;
  border-bottom: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.line};
`;
export const Names = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 0;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
export const Select = styled.select`
  min-height: ${({ theme }) => theme.size.tap}px;
  padding: 0 ${({ theme }) => theme.spacing.md};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.c.ctrl};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf};
  color: ${({ theme }) => theme.c.text};
  font: inherit;
`;

export type NameFieldProps = Readonly<{
  value: string;
  onChange: (next: string) => void;
  error?: string;
}>;

/** The customer's first name. */
export function NameField({ value, onChange, error }: NameFieldProps) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <TextField
      label={t('new.name')}
      value={value}
      onChange={(event: ChangeEvent<HTMLInputElement>) => onChange(event.target.value)}
      maxLength={FIRST_NAME_MAX}
      autoComplete="off"
      {...(error ? { error } : {})}
    />
  );
}

export type NoteFieldProps = Readonly<{ value: string; onChange: (next: string) => void }>;

/** The customer's note, with its counter. */
export function NoteField({ value, onChange }: NoteFieldProps) {
  const { t } = useTranslation(SELLER_NS);
  return (
    <TextArea
      label={t('new.note')}
      helper={t('new.noteHelper')}
      value={value}
      onChange={(event: ChangeEvent<HTMLTextAreaElement>) => onChange(event.target.value)}
      maxLength={NOTE_MAX}
      showCounter
    />
  );
}
