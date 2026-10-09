import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { MAX_MENU_ITEMS } from '../../../shared/limits';
import { formatMoney } from '../../../shared/money';
import { parseWhatsAppPost, type DraftItem, type ParsedPost } from '../../../shared/pastePost';
import type { CreateItemRequest } from '../../../shared/setupContract';
import { Button, PageHeader, TextArea } from '../../ui';
import { MENU_NS } from './i18n/register';
import { ErrorText, Muted, Page, selectMenu, useLang, useMenuData, useOpWatch } from './menuShared';
import { opRequested } from './menuSlice';

export type PastePostScreenProps = Readonly<{
  onBack: () => void;
  /** Called after the items were added to the menu, with how many. */
  onDone: (count: number) => void;
}>;

const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Name = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;
const Block = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Lines = styled.ul`
  margin: 0;
  padding-left: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colour.textMuted};
`;

const KINDS = ['addItems'] as const;

/** A pasted post is in Indonesian, so the read text goes in the Indonesian fields. */
function requestOf(draft: DraftItem): CreateItemRequest {
  return {
    name: { en: '', id: draft.nameId },
    ...(draft.descriptionId ? { description: { en: '', id: draft.descriptionId } } : {}),
    ...(draft.sizeId ? { size: { en: '', id: draft.sizeId } } : {}),
    priceCents: draft.priceCents,
  };
}

export function PastePostScreen({ onBack, onDone }: PastePostScreenProps) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const { busy } = useSelector(selectMenu);
  const { data, status } = useMenuData();
  const [text, setText] = useState('');
  const [parsed, setParsed] = useState<ParsedPost | null>(null);
  const outcome = useOpWatch(KINDS, (result) => onDone(result.count));

  const header = <PageHeader title={t('paste.title')} backLabel={t('back')} onBack={onBack} />;
  if (!data) {
    return (
      <>
        {header}
        <Page>{status}</Page>
      </>
    );
  }

  const room = Math.max(0, MAX_MENU_ITEMS - data.items.length);
  const found = parsed?.items ?? [];
  const fit = Math.min(found.length, room);
  const partial = outcome?.status === 'failed' ? outcome : null;

  return (
    <>
      {header}
      <Page>
        <TextArea
          label={t('paste.label')}
          helper={t('paste.helper')}
          value={text}
          rows={8}
          onChange={(event) => {
            setText(event.target.value);
            setParsed(null);
          }}
        />
        <div>
          <Button
            variant={parsed ? 'secondary' : 'primary'}
            disabled={text.trim() === ''}
            onClick={() => setParsed(parseWhatsAppPost(text))}
          >
            {t('paste.read')}
          </Button>
        </div>

        {parsed && found.length === 0 ? (
          <ErrorText role="status">{t('paste.none')}</ErrorText>
        ) : null}

        {found.length > 0 ? (
          <Block aria-label={t('paste.previewLabel')}>
            <strong>{t('paste.found', { count: found.length })}</strong>
            <List>
              {found.map((draft, index) => (
                <Item key={`${String(index)}-${draft.nameId}`}>
                  <Name>
                    {index + 1}. {draft.nameId}
                  </Name>
                  <Muted>
                    {[draft.sizeId, formatMoney(draft.priceCents, lang), draft.descriptionId]
                      .filter((part) => part !== undefined && part !== '')
                      .join(' · ')}
                  </Muted>
                </Item>
              ))}
            </List>
          </Block>
        ) : null}

        {parsed && parsed.unparsedLines.length > 0 ? (
          <Block>
            <Muted>{t('paste.unparsed')}</Muted>
            <Lines>
              {parsed.unparsedLines.map((line, index) => (
                <li key={`${String(index)}-${line}`}>{line}</li>
              ))}
            </Lines>
          </Block>
        ) : null}

        {found.length > 0 ? (
          <Block>
            {room === 0 ? (
              <Muted>{t('paste.noRoom', { max: MAX_MENU_ITEMS })}</Muted>
            ) : fit < found.length ? (
              <Muted>{t('paste.someFit', { fit, total: found.length, max: MAX_MENU_ITEMS })}</Muted>
            ) : null}
            <div>
              <Button
                variant="primary"
                disabled={busy || fit === 0}
                onClick={() =>
                  dispatch(
                    opRequested({
                      kind: 'addItems',
                      requests: found.slice(0, fit).map(requestOf),
                    }),
                  )
                }
              >
                {t('paste.use', { count: fit })}
              </Button>
            </div>
          </Block>
        ) : null}

        {partial ? (
          <ErrorText role="alert">
            {partial.count > 0 ? t('paste.partial', { count: partial.count }) : t('genericError')}
          </ErrorText>
        ) : null}
      </Page>
    </>
  );
}
