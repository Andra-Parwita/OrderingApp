import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import { MAX_SETS, SET_NAME_MAX } from '../../../shared/limits';
import type { SavedSetView } from '../../../shared/setupContract';
import { Button, ConfirmButton, PageHeader, TextField, Toast } from '../../ui';
import { MENU_NS } from './i18n/register';
import { ErrorText, Muted, Page, selectMenu, useMenuData, useOpWatch } from './menuShared';
import { opRequested, type MenuOpKind } from './menuSlice';

export type SavedSetsScreenProps = Readonly<{
  onBack: () => void;
  /** Called after a set replaced this week's items; defaults to `onBack`. */
  onUsed?: () => void;
}>;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Heading = styled.h2`
  margin: 0;
  font-size: ${({ theme }) => theme.type.size.lg};
`;
const List = styled.ul`
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Card = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const SetName = styled.strong`
  font-size: ${({ theme }) => theme.type.size.base};
`;
const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Inline = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const KINDS: ReadonlyArray<MenuOpKind> = ['useSet', 'saveSet', 'renameSet', 'deleteSet'];

export function SavedSetsScreen({ onBack, onUsed }: SavedSetsScreenProps) {
  const { t } = useTranslation(MENU_NS);
  const dispatch = useDispatch();
  const { busy } = useSelector(selectMenu);
  const { data, status } = useMenuData();
  const [toast, setToast] = useState<string | null>(null);
  const [asking, setAsking] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; name: string } | null>(null);
  const [newName, setNewName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);

  const outcome = useOpWatch(KINDS, (result) => {
    setAsking(null);
    if (result.kind === 'useSet') {
      (onUsed ?? onBack)();
    } else if (result.kind === 'saveSet') {
      setNewName('');
      setToast(t('sets.saved'));
    } else if (result.kind === 'renameSet') {
      setRenaming(null);
      setToast(t('sets.renamed'));
    } else {
      setToast(t('sets.deleted'));
    }
  });

  const header = <PageHeader title={t('sets.title')} backLabel={t('back')} onBack={onBack} />;
  if (!data) {
    return (
      <>
        {header}
        <Page>{status}</Page>
      </>
    );
  }
  const { sets, items } = data;
  const full = sets.length >= MAX_SETS;
  const failure = outcome?.status === 'failed' ? outcome : null;
  let failureText: string | null = null;
  if (failure) {
    if (failure.code === 'week_not_draft') failureText = t('sets.notDraft');
    else if (failure.code === 'item_has_orders') failureText = t('sets.hasOrders');
    else failureText = t('genericError');
  }

  const use = (set: SavedSetView) => {
    if (items.length > 0 && asking !== set.id) {
      setAsking(set.id);
      return;
    }
    dispatch(opRequested({ kind: 'useSet', id: set.id, confirm: items.length > 0 }));
  };

  const validName = (name: string): string | null => {
    const trimmed = name.trim();
    if (trimmed === '') {
      setNameError(t('sets.nameRequired'));
      return null;
    }
    if (trimmed.length > SET_NAME_MAX) {
      setNameError(t('sets.nameTooLong', { max: SET_NAME_MAX }));
      return null;
    }
    setNameError(null);
    return trimmed;
  };

  const save = (event: FormEvent, replaceSetId?: string) => {
    event.preventDefault();
    const name = validName(newName);
    if (name === null) return;
    dispatch(opRequested({ kind: 'saveSet', name, ...(replaceSetId ? { replaceSetId } : {}) }));
  };

  const rename = (event: FormEvent) => {
    event.preventDefault();
    if (!renaming) return;
    const name = validName(renaming.name);
    if (name !== null) dispatch(opRequested({ kind: 'renameSet', id: renaming.id, name }));
  };

  return (
    <>
      {header}
      <Page>
        <Muted>{t('sets.count', { n: sets.length, max: MAX_SETS })}</Muted>
        {failureText ? <ErrorText role="alert">{failureText}</ErrorText> : null}
        {sets.length === 0 ? <Muted>{t('sets.empty')}</Muted> : null}
        <List aria-label={t('sets.title')}>
          {sets.map((set) => (
            <Card key={set.id}>
              <SetName>{set.name}</SetName>
              <Muted>
                {t('sets.items', { count: set.items.length })} ·{' '}
                {t('sets.images', { count: set.imageSlots.length })}
              </Muted>
              {asking === set.id ? (
                <Section aria-label={t('sets.replaceAsk', { count: items.length })}>
                  <strong>{t('sets.replaceAsk', { count: items.length })}</strong>
                  <Buttons>
                    <Button variant="primary" disabled={busy} onClick={() => use(set)}>
                      {t('sets.replaceYes')}
                    </Button>
                    <Button onClick={() => setAsking(null)}>{t('cancel')}</Button>
                  </Buttons>
                </Section>
              ) : renaming?.id === set.id ? (
                <Inline onSubmit={rename} noValidate>
                  <TextField
                    label={t('sets.name')}
                    value={renaming.name}
                    onChange={(event) => setRenaming({ id: set.id, name: event.target.value })}
                    {...(nameError ? { error: nameError } : {})}
                  />
                  <Buttons>
                    <Button type="submit" variant="primary" disabled={busy}>
                      {t('sets.renameSave')}
                    </Button>
                    <Button onClick={() => setRenaming(null)}>{t('cancel')}</Button>
                  </Buttons>
                </Inline>
              ) : (
                <Buttons>
                  <Button variant="primary" disabled={busy} onClick={() => use(set)}>
                    {t('sets.use')}
                  </Button>
                  <Button
                    disabled={busy}
                    aria-label={`${t('sets.rename')} ${set.name}`}
                    onClick={() => setRenaming({ id: set.id, name: set.name })}
                  >
                    {t('sets.rename')}
                  </Button>
                  <ConfirmButton
                    label={t('sets.delete')}
                    confirmLabel={t('sets.deleteConfirm')}
                    disabled={busy}
                    onConfirm={() => dispatch(opRequested({ kind: 'deleteSet', id: set.id }))}
                  />
                </Buttons>
              )}
            </Card>
          ))}
        </List>

        <Section>
          <Heading>{t('sets.saveHeading')}</Heading>
          {items.length === 0 ? (
            <Muted>{t('sets.saveNeedsItems')}</Muted>
          ) : (
            <Inline onSubmit={(event) => save(event)} noValidate>
              <TextField
                label={t('sets.name')}
                value={newName}
                onChange={(event) => setNewName(event.target.value)}
                {...(nameError && renaming === null ? { error: nameError } : {})}
              />
              {full ? (
                <>
                  <Muted>{t('sets.full', { max: MAX_SETS })}</Muted>
                  <Buttons>
                    {sets.map((set) => (
                      <Button key={set.id} disabled={busy} onClick={(event) => save(event, set.id)}>
                        {t('sets.replace', { name: set.name })}
                      </Button>
                    ))}
                  </Buttons>
                </>
              ) : (
                <div>
                  <Button type="submit" variant="primary" disabled={busy}>
                    {t('sets.save')}
                  </Button>
                </div>
              )}
            </Inline>
          )}
        </Section>
      </Page>
      <Toast message={toast} onDismiss={() => setToast(null)} />
    </>
  );
}
