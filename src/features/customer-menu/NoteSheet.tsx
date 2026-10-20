import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { NOTE_MAX } from '../../../shared/limits';
import { TextField } from '../../ui';
import { BottomSheet } from '../../ui/patterns';
import { CUSTOMER_NS } from './i18n/register';
import { MainButton, OutlineButton } from './menuParts';

// Plan 111: the note of one basket line, in a bottom sheet. Saving it empty removes the note.

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
  margin-top: ${({ theme }) => theme.spacing.sm};
`;
const Hint = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: ${({ theme }) => theme.type.size.md};
`;
const Buttons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
`;

type Props = Readonly<{
  /** The name of the line (dish, or dish · choice). */
  name: string;
  note: string;
  onSave: (note: string) => void;
  onClose: () => void;
}>;

export function NoteSheet({ name, note, onSave, onClose }: Props) {
  const { t } = useTranslation(CUSTOMER_NS);
  const [text, setText] = useState(note);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSave(text);
  };
  return (
    <BottomSheet title={t('lineNote.title', { name })} onClose={onClose}>
      <Form onSubmit={submit}>
        <Hint>{t('lineNote.hint')}</Hint>
        <TextField
          label={t('lineNote.label')}
          value={text}
          maxLength={NOTE_MAX}
          showCounter
          onChange={(event) => setText(event.target.value)}
        />
        <Buttons>
          <OutlineButton type="button" onClick={onClose}>
            {t('lineNote.cancel')}
          </OutlineButton>
          <MainButton type="submit">{t('lineNote.save')}</MainButton>
        </Buttons>
      </Form>
    </BottomSheet>
  );
}
