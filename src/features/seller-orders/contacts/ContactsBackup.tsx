import { useCallback, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { Button } from '../../../ui';
import { SELLER_NS } from '../i18n/register';
import { exportContacts, importContacts, useContactBook } from './contactsStore';

const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Title = styled.h2`
  margin: 0;
  font-size: 0.9375rem;
  font-weight: 700;
`;
const Muted = styled.p`
  margin: 0;
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.875rem;
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Hidden = styled.input`
  display: none;
`;

/** Phone More: save the contacts kept on this phone to a JSON file, or load such a file (a new phone). */
export function ContactsBackup() {
  const { t } = useTranslation(SELLER_NS);
  const count = useContactBook();
  const [message, setMessage] = useState<string | null>(null);
  const picker = useRef<HTMLInputElement>(null);

  const onExport = useCallback(() => {
    const blob = new Blob([exportContacts()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'contacts.json';
    link.click();
    URL.revokeObjectURL(url);
    setMessage(t('phoneMore.exported', { count }));
  }, [count, t]);

  const onPick = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      void file
        .text()
        .then((text) => {
          const added = importContacts(text);
          setMessage(
            added === null ? t('phoneMore.importBad') : t('phoneMore.imported', { count: added }),
          );
        })
        .catch(() => setMessage(t('phoneMore.importBad')));
    },
    [t],
  );

  return (
    <Block aria-label={t('phoneMore.contactsTitle')}>
      <Title>{t('phoneMore.contactsTitle')}</Title>
      <Muted>{t('phoneMore.contactsHelp')}</Muted>
      <Muted>{t('phoneMore.count', { count })}</Muted>
      <Pair>
        <Button onClick={onExport}>{t('phoneMore.export')}</Button>
        <Button onClick={() => picker.current?.click()}>{t('phoneMore.import')}</Button>
      </Pair>
      <Hidden
        ref={picker}
        type="file"
        accept="application/json,.json"
        aria-label={t('phoneMore.import')}
        onChange={onPick}
      />
      {message ? <Muted role="status">{message}</Muted> : null}
    </Block>
  );
}
