import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Chef } from '../../../shared/domain';
import { CHEF_NAME_MAX } from '../../../shared/limits';
import { createChefInvite, fetchChefDevices } from '../../api/auth';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, ConfirmButton, TextField } from '../../ui';
import { ChefKeyBox } from './ChefKeyBox';
import { SETUP_NS } from './i18n/register';
import {
  Actions,
  Body,
  Centered,
  Failure,
  Hint,
  Page,
  Section,
  SectionTitle,
  Title,
} from './parts';
import {
  chefAddRequested,
  chefDeleteRequested,
  chefRenameRequested,
  chefsRequested,
  type SetupRootState,
} from './setupSlice';

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
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} 0;
  border-bottom: ${({ theme }) => theme.border.hairline} solid
    ${({ theme }) => theme.colour.hairline};
`;
const Name = styled.span`
  font-weight: ${({ theme }) => theme.type.weight.strong};
`;

type RowProps = Readonly<{
  chef: Chef;
  count: number;
  busy: boolean;
  /** Devices signed in as this chef; null until known. */
  devices: number | null;
  /** The invite key just made for this chef, shown once. */
  invite: string | null;
  onInvite: (chef: Chef) => void;
  onInviteDone: () => void;
}>;

function ChefRow({ chef, count, busy, devices, invite, onInvite, onInviteDone }: RowProps) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const [name, setName] = useState<string | null>(null);

  const startRename = useCallback(() => setName(chef.name), [chef.name]);
  const cancel = useCallback(() => setName(null), []);
  const submit = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      const next = (name ?? '').trim();
      if (next === '') return;
      if (next !== chef.name) dispatch(chefRenameRequested({ id: chef.id, name: next }));
      setName(null);
    },
    [chef.id, chef.name, dispatch, name],
  );
  const remove = useCallback(() => dispatch(chefDeleteRequested(chef.id)), [chef.id, dispatch]);

  if (name !== null) {
    return (
      <Item>
        <form onSubmit={submit} noValidate>
          <TextField
            label={t('chefs.renameField', { name: chef.name })}
            value={name}
            maxLength={CHEF_NAME_MAX}
            autoComplete="off"
            onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
          />
          <Actions>
            <Button type="submit" variant="primary" disabled={busy || name.trim() === ''}>
              {t('chefs.renameSave')}
            </Button>
            <Button variant="secondary" onClick={cancel}>
              {t('chefs.cancel')}
            </Button>
          </Actions>
        </form>
      </Item>
    );
  }
  return (
    <Item>
      <div>
        <Name>{chef.name}</Name>
        <Hint>{t('chefs.items', { count })}</Hint>
        {devices !== null ? <Hint>{t('chefs.devices', { count: devices })}</Hint> : null}
      </div>
      <Actions>
        <Button variant="primary" onClick={() => onInvite(chef)} disabled={busy}>
          {t('chefs.invite')}
        </Button>
        <Button variant="secondary" onClick={startRename} disabled={busy}>
          {t('chefs.rename')}
        </Button>
        <ConfirmButton
          label={t('chefs.delete')}
          confirmLabel={t('chefs.deleteConfirm')}
          onConfirm={remove}
          disabled={busy}
        />
      </Actions>
      {invite ? <ChefKeyBox chefName={chef.name} keyText={invite} onDone={onInviteDone} /> : null}
    </Item>
  );
}

/** Chefs (S11, chefs part), route-agnostic: list, add, rename, delete and invite to sign in. */
export function ChefsScreen({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const { load, list, counts, kitchenName, busy, failure } = useSelector(
    (state: SetupRootState) => state.sellerSetup.chefs,
  );
  const [name, setName] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [devices, setDevices] = useState<Record<string, number>>({});
  const [shown, setShown] = useState<{ chefId: string; key: string } | null>(null);
  const [inviteFailed, setInviteFailed] = useState(false);

  useEffect(() => {
    dispatch(chefsRequested());
  }, [dispatch]);

  const chefIds = list.map((chef) => chef.id).join(',');
  useEffect(() => {
    if (load !== 'ready') return;
    let live = true;
    void fetchChefDevices(currentSellerSlug()).then((result) => {
      if (live && result.ok) {
        setDevices(Object.fromEntries(result.data.chefs.map((chef) => [chef.id, chef.devices])));
      }
    });
    return () => {
      live = false;
    };
  }, [load, chefIds]);

  const invite = useCallback(async (chef: Chef) => {
    setInviteFailed(false);
    setShown(null);
    const result = await createChefInvite(chef.id, currentSellerSlug());
    if (result.ok) setShown({ chefId: chef.id, key: result.data.key });
    else setInviteFailed(true);
  }, []);
  const inviteDone = useCallback(() => setShown(null), []);

  const retry = useCallback(() => dispatch(chefsRequested()), [dispatch]);
  const onAdd = useCallback(
    (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      const trimmed = name.trim();
      if (trimmed === '') return;
      dispatch(chefAddRequested(trimmed));
      setName('');
      setSubmitted(false);
    },
    [dispatch, name],
  );

  return (
    <Page>
      {embedded ? null : <Title>{t('chefs.title')}</Title>}
      {load === 'loading' && list.length === 0 ? (
        <Centered role="status">{t('loading')}</Centered>
      ) : null}
      {load === 'error' ? (
        <Centered role="alert">
          {t('error')}{' '}
          <Button variant="quiet" onClick={retry}>
            {t('retry')}
          </Button>
        </Centered>
      ) : null}
      {load === 'ready' ? (
        <Body>
          {list.length === 0 ? (
            <Hint>{t('chefs.empty')}</Hint>
          ) : (
            <>
              <List>
                {list.map((chef) => (
                  <ChefRow
                    key={chef.id}
                    chef={chef}
                    count={counts[chef.id] ?? 0}
                    busy={busy}
                    devices={devices[chef.id] ?? null}
                    invite={shown?.chefId === chef.id ? shown.key : null}
                    onInvite={(target) => void invite(target)}
                    onInviteDone={inviteDone}
                  />
                ))}
              </List>
              <Hint>{t('chefs.deleteNote', { kitchen: kitchenName })}</Hint>
            </>
          )}
          {inviteFailed ? <Failure role="alert">{t('chefs.inviteFailed')}</Failure> : null}
          {failure ? (
            <Failure role="alert">
              {failure.code === 'limit_reached' ? t('chefs.limit') : t('chefs.failed')}
            </Failure>
          ) : null}
          <Section as="form" onSubmit={onAdd} noValidate>
            <SectionTitle>{t('chefs.add')}</SectionTitle>
            <TextField
              label={t('chefs.name')}
              helper={t('chefs.addHelper')}
              error={submitted && name.trim() === '' ? t('chefs.nameEmpty') : undefined}
              value={name}
              maxLength={CHEF_NAME_MAX}
              autoComplete="off"
              onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
            />
            <div>
              <Button type="submit" variant="primary" disabled={busy}>
                {busy ? t('chefs.adding') : t('chefs.add')}
              </Button>
            </div>
          </Section>
        </Body>
      ) : null}
    </Page>
  );
}
