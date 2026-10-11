import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import { LOG_ADMIN_LIMIT, LOG_APPS, type LogApp, type LogEntry } from '../../../shared/logContract';
import type { Language } from '../../../shared/domain';
import { formatDayTime } from '../../../shared/dates';
import { clearAdminLog, fetchAdminLog } from '../../api/auth';
import { Button, ConfirmButton, Icon } from '../../ui';
import { ADMIN_NS } from './i18n/register';
import { Muted } from './shared';

const Toggle = styled.button`
  box-sizing: border-box;
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  width: 100%;
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
  font-weight: ${({ theme }) => theme.type.weight.strong};
  text-align: start;
  cursor: pointer;
`;
const Chevron = styled.span<{ $open: boolean }>`
  display: inline-flex;
  margin-inline-start: auto;
  transform: rotate(${({ $open }) => ($open ? '90deg' : '0deg')});
`;
const List = styled.ul`
  margin: 0;
  padding: 0;
  list-style: none;
`;
const Item = styled.li`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.xs};
  padding: ${({ theme }) => theme.spacing.sm} 0;
  border-top: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  font-size: ${({ theme }) => theme.type.size.sm};
  overflow-wrap: anywhere;
`;
const Meta = styled.span`
  color: ${({ theme }) => theme.colour.textMuted};
`;

const Bar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} 0;
`;
const Select = styled.select`
  min-height: ${({ theme }) => theme.minTapTarget};
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border: ${({ theme }) => theme.border.hairline} solid ${({ theme }) => theme.colour.hairline};
  border-radius: ${({ theme }) => theme.radius.sm};
  background: transparent;
  color: inherit;
  font: inherit;
`;

const PAGE = LOG_ADMIN_LIMIT;

/**
 * The newest client problems (plan 026), collapsed to "Problems (N)". Filter by app and kitchen,
 * 50 per page (Older / Newer), and Clear all (tap twice). Scrubbed text only (D-007).
 */
export function ProblemsPanel({ slugs = [] }: Readonly<{ slugs?: ReadonlyArray<string> }>) {
  const { t, i18n } = useTranslation(ADMIN_NS);
  const lang: Language = i18n.resolvedLanguage === 'id' ? 'id' : 'en';
  const [entries, setEntries] = useState<Array<LogEntry> | null>(null);
  const [total, setTotal] = useState(0);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [app, setApp] = useState<LogApp | ''>('');
  const [slug, setSlug] = useState('');
  const [offset, setOffset] = useState(0);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    void fetchAdminLog({
      ...(app ? { app } : {}),
      ...(slug ? { slug } : {}),
      offset,
    }).then((result) => {
      if (!live) return;
      if (result.ok) {
        setEntries(result.data.entries);
        setTotal(result.data.total);
        setFailed(false);
      } else setFailed(true);
    });
    return () => {
      live = false;
    };
  }, [app, slug, offset, reload]);

  const clearAll = async () => {
    const result = await clearAdminLog();
    if (!result.ok) {
      setFailed(true);
      return;
    }
    setOffset(0);
    setReload((value) => value + 1);
  };

  return (
    <div>
      <Toggle
        type="button"
        aria-expanded={open}
        aria-controls="admin-problems"
        onClick={() => setOpen((value) => !value)}
      >
        {t('home.problems.title', { count: total })}
        <Chevron $open={open}>
          <Icon name="forward" />
        </Chevron>
      </Toggle>
      <div id="admin-problems" hidden={!open}>
        {open ? (
          <Bar>
            <Select
              aria-label={t('home.problems.app')}
              value={app}
              onChange={(event) => {
                setApp(event.target.value as LogApp | '');
                setOffset(0);
              }}
            >
              <option value="">{t('home.problems.allApps')}</option>
              {LOG_APPS.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
            <Select
              aria-label={t('home.problems.kitchen')}
              value={slug}
              onChange={(event) => {
                setSlug(event.target.value);
                setOffset(0);
              }}
            >
              <option value="">{t('home.problems.allKitchens')}</option>
              {slugs.map((id) => (
                <option key={id} value={id}>
                  {id}
                </option>
              ))}
            </Select>
            <ConfirmButton
              label={t('home.problems.clear')}
              confirmLabel={t('home.problems.clearConfirm')}
              disabled={total === 0 && app === '' && slug === ''}
              onConfirm={() => void clearAll()}
            />
          </Bar>
        ) : null}
        {open && failed ? <Muted>{t('home.problems.failed')}</Muted> : null}
        {open && entries && entries.length === 0 ? <Muted>{t('home.problems.none')}</Muted> : null}
        {open && entries && entries.length > 0 ? (
          <List aria-label={t('home.problems.list')}>
            {entries.map((entry) => (
              <Item key={entry.id}>
                <strong>{`${formatDayTime(entry.at, lang)} · ${entry.app} · ${entry.slug ?? '-'}`}</strong>
                <Meta>{`${entry.path} · ${entry.kind} · ${entry.code}`}</Meta>
                <span>{entry.message}</span>
                <Meta>{entry.agent}</Meta>
              </Item>
            ))}
          </List>
        ) : null}
        {open && total > PAGE ? (
          <Bar>
            <Button disabled={offset + PAGE >= total} onClick={() => setOffset(offset + PAGE)}>
              {t('home.problems.older')}
            </Button>
            <Button disabled={offset === 0} onClick={() => setOffset(Math.max(0, offset - PAGE))}>
              {t('home.problems.newer')}
            </Button>
            <Muted>
              {t('home.problems.range', {
                from: offset + 1,
                to: Math.min(offset + PAGE, total),
                total,
              })}
            </Muted>
          </Bar>
        ) : null}
      </div>
    </div>
  );
}
