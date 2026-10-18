import { useTranslation } from 'react-i18next';
import { styled } from 'styled-components';
import type { Order } from '../../../shared/domain';
import { formatAuditDiff } from '../../../shared/auditDiff';
import { formatDayTime } from '../../../shared/dates';
import { formatMoney } from '../../../shared/money';
import { Icon } from '../../ui';
import { SELLER_NS } from './i18n/register';
import { actorLabel, useLang } from './orderText';
import { lastStaffEdit, paidGap } from './paidGap';

const Note = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  font-size: 0.875rem;
  overflow-wrap: anywhere;

  svg {
    flex: none;
    color: ${({ theme }) => theme.c.muted};
  }
  strong {
    display: block;
  }
  span {
    display: block;
    color: ${({ theme }) => theme.c.muted};
  }
`;

/**
 * Plan 105: after a seller edit the panel says who edited and what changed, and for a paid order
 * whose total moved what is left to collect (or to refund). Nothing while neither applies.
 */
export function EditedNote({ order }: Readonly<{ order: Order }>) {
  const { t } = useTranslation(SELLER_NS);
  const lang = useLang();
  const edit = lastStaffEdit(order);
  const gap = paidGap(order);
  if (!edit && !gap) return null;
  return (
    <Note data-testid="edited-note">
      <Icon name="pencil" />
      <div>
        {edit ? (
          <>
            <strong>
              {t('edit.editedBy', {
                name: actorLabel(edit.by, t),
                when: formatDayTime(edit.at, lang),
              })}
            </strong>
            {edit.diff ? <span>{formatAuditDiff(edit.diff, lang)}</span> : null}
          </>
        ) : null}
        {gap ? (
          <span>
            {t(gap.gapCents > 0 ? 'edit.gap' : 'edit.gapRefund', {
              paid: formatMoney(gap.paidCents, lang),
              total: formatMoney(gap.totalCents, lang),
              amount: formatMoney(Math.abs(gap.gapCents), lang),
            })}
          </span>
        ) : null}
      </div>
    </Note>
  );
}
