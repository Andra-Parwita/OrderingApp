import { useCallback, useEffect, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { Link } from 'react-router';
import { styled } from 'styled-components';
import type { MembershipRole, TeamMember } from '../../../shared/authContract';
import { CHEF_NAME_MAX } from '../../../shared/limits';
import { createInvite, fetchTeam, removeTeamMember } from '../../api/auth';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { Button, ConfirmButton, Segmented, TextField } from '../../ui';
import { ChefsScreen } from './ChefsScreen';
import { SETUP_NS } from './i18n/register';
import { DraftNotice, draftKey, useDraft } from '../../components/draft';
import { InviteBox } from './InviteBox';
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
import { chefsRequested, type SetupRootState } from './setupSlice';

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
const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  font-size: ${({ theme }) => theme.type.size.sm};
  color: ${({ theme }) => theme.colour.textMuted};
`;
const Select = styled.select`
  box-sizing: border-box;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.outline};
  border-radius: ${({ theme }) => theme.radius.md};
  background: ${({ theme }) => theme.colour.bg};
  color: ${({ theme }) => theme.colour.text};
  font: inherit;
`;
const Notice = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
`;

type Load = 'loading' | 'ready' | 'error';
type InviteForm = { name: string; role: MembershipRole; cookId: string };
const EMPTY_INVITE: InviteForm = { name: '', role: 'chef', cookId: '' };
type Shown = Readonly<{ name: string; key: string; role: MembershipRole }>;

/** Settings → Team (plan 033): who is in this kitchen, invite by name and role, remove. Cooks follow below. */
export function TeamScreen({ embedded = false }: Readonly<{ embedded?: boolean }>) {
  const { t } = useTranslation(SETUP_NS);
  const dispatch = useDispatch();
  const slug = currentSellerSlug();
  const cooks = useSelector((state: SetupRootState) => state.sellerSetup.chefs);
  const [load, setLoad] = useState<Load>('loading');
  const [members, setMembers] = useState<ReadonlyArray<TeamMember>>([]);
  // Plan 061: name, role and cook survive a reload until the invite is made. Never the key or link.
  const [form, setForm, formDraft] = useDraft<InviteForm>(
    draftKey(slug, 'invite', 'new'),
    EMPTY_INVITE,
  );
  const { name, role, cookId } = form;
  const setName = (value: string) => setForm((f) => ({ ...f, name: value }));
  const setRole = (value: MembershipRole) => setForm((f) => ({ ...f, role: value }));
  const setCookId = (value: string) => setForm((f) => ({ ...f, cookId: value }));
  const [submitted, setSubmitted] = useState(false);
  const [shown, setShown] = useState<Shown | null>(null);
  const [failure, setFailure] = useState<'invite' | 'remove' | null>(null);
  const [reassign, setReassign] = useState<Readonly<{ name: string; count: number }> | null>(null);

  const reload = useCallback(async () => {
    const result = await fetchTeam(slug);
    if (result.ok) {
      setMembers(result.data.members);
      setLoad('ready');
    } else setLoad('error');
  }, [slug, setLoad, setMembers]);

  useEffect(() => {
    dispatch(chefsRequested());
    let live = true;
    void fetchTeam(slug).then((result) => {
      if (!live) return;
      if (result.ok) {
        setMembers(result.data.members);
        setLoad('ready');
      } else setLoad('error');
    });
    return () => {
      live = false;
    };
  }, [dispatch, slug]);

  const invite = useCallback(
    async (event: { preventDefault: () => void }) => {
      event.preventDefault();
      setSubmitted(true);
      const displayName = name.trim();
      if (displayName === '') return;
      setFailure(null);
      setShown(null);
      const result = await createInvite(
        { displayName, role, ...(role === 'chef' && cookId !== '' ? { chefId: cookId } : {}) },
        slug,
      );
      if (!result.ok) {
        setFailure('invite');
        return;
      }
      setShown({ name: displayName, key: result.data.key, role });
      formDraft.clear();
      setForm((f) => ({ ...f, name: '', cookId: '' }));
      setSubmitted(false);
      dispatch(chefsRequested());
    },
    [cookId, dispatch, formDraft, name, role, setForm, slug],
  );

  const remove = useCallback(
    async (member: TeamMember) => {
      setFailure(null);
      setReassign(null);
      const result = await removeTeamMember(member.accountId, slug);
      if (!result.ok) {
        setFailure('remove');
        return;
      }
      const count = member.chefId ? (cooks.counts[member.chefId] ?? 0) : 0;
      if (count > 0) setReassign({ name: member.displayName, count });
      await reload();
    },
    [cooks.counts, reload, slug],
  );

  const roleLabel = (r: MembershipRole) =>
    t(r === 'owner' ? 'team.roleOwner' : r === 'helper' ? 'team.roleHelper' : 'team.roleChef');

  return (
    <>
      <Page>
        {embedded ? null : <Title>{t('team.title')}</Title>}
        {load === 'loading' ? <Centered role="status">{t('loading')}</Centered> : null}
        {load === 'error' ? (
          <Centered role="alert">
            {t('error')}{' '}
            <Button variant="quiet" onClick={() => void reload()}>
              {t('retry')}
            </Button>
          </Centered>
        ) : null}
        {load === 'ready' ? (
          <Body>
            <List aria-label={t('team.title')}>
              {members.map((member) => (
                <Item key={member.accountId}>
                  <div>
                    <Name>
                      {member.displayName}
                      {member.you ? ` (${t('team.you')})` : ''}
                    </Name>
                    <Hint>
                      {roleLabel(member.role)}
                      {member.chefName ? ` · ${t('team.cook', { name: member.chefName })}` : ''}
                    </Hint>
                    <Hint>{t('team.devices', { count: member.devices })}</Hint>
                  </div>
                  {member.you ? null : (
                    <Actions>
                      <ConfirmButton
                        label={t('team.remove')}
                        confirmLabel={t('team.removeConfirm')}
                        onConfirm={() => void remove(member)}
                      />
                    </Actions>
                  )}
                </Item>
              ))}
            </List>
            {reassign ? (
              <Notice role="status">
                <Hint>{t('team.reassign', { name: reassign.name, count: reassign.count })}</Hint>
                <div>
                  <Link to="/seller/menu">{t('team.reassignLink')}</Link>
                </div>
              </Notice>
            ) : null}
            {failure === 'remove' ? <Failure role="alert">{t('team.removeFailed')}</Failure> : null}
            <Section as="form" onSubmit={(event) => void invite(event)} noValidate>
              <SectionTitle>{t('team.invite')}</SectionTitle>
              <DraftNotice draft={formDraft} />
              <TextField
                label={t('team.name')}
                error={submitted && name.trim() === '' ? t('team.nameEmpty') : undefined}
                value={name}
                maxLength={CHEF_NAME_MAX}
                autoComplete="off"
                onChange={(event: ChangeEvent<HTMLInputElement>) => setName(event.target.value)}
              />
              <Segmented<MembershipRole>
                label={t('team.role')}
                value={role}
                onChange={setRole}
                options={[
                  { value: 'chef', label: t('team.roleChef') },
                  { value: 'helper', label: t('team.roleHelper') },
                  { value: 'owner', label: t('team.roleOwner') },
                ]}
              />
              {role === 'chef' ? (
                <Field>
                  {t('team.linkCook')}
                  <Select value={cookId} onChange={(event) => setCookId(event.target.value)}>
                    <option value="">{t('team.newCook')}</option>
                    {cooks.list.map((cook) => (
                      <option key={cook.id} value={cook.id}>
                        {cook.name}
                      </option>
                    ))}
                  </Select>
                </Field>
              ) : null}
              {failure === 'invite' ? (
                <Failure role="alert">{t('team.inviteFailed')}</Failure>
              ) : null}
              <div>
                <Button type="submit" variant="primary">
                  {t('team.makeInvite')}
                </Button>
              </div>
            </Section>
            {shown ? (
              <InviteBox
                name={shown.name}
                slug={slug}
                kitchen={cooks.kitchenName || slug}
                role={shown.role}
                keyText={shown.key}
                onDone={() => setShown(null)}
              />
            ) : null}
          </Body>
        ) : null}
      </Page>
      <div>
        <Body>
          <SectionTitle>{t('team.cooks')}</SectionTitle>
          <Hint>{t('team.cooksHint')}</Hint>
        </Body>
        <ChefsScreen embedded />
      </div>
    </>
  );
}
