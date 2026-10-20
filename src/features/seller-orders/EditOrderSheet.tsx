import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Order, SellerMenuItemView } from '../../../shared/domain';
import { formatMoney } from '../../../shared/money';
import { formatOrderCode } from '../../../shared/orderCode';
import { BottomSheet, Button, Notice, SlideOver, WarningDialog } from '../../ui';
import { AddDishList, EditDishRows } from './EditOrderFields';
import { SELLER_NS } from './i18n/register';
import {
  addDish,
  buildEditRequest,
  changeSummary,
  initialRows,
  isChanged,
  liveRows,
  patchRow,
  rowsTotal,
  type EditRow,
} from './editOrderModel';
import { ErrorText, Field, Label, NameField, NoteField } from './orderFormParts';
import { orderTotalCents, useLang } from './orderText';
import { SavingSpinner } from './SavingSpinner';
import { selectEdit, selectMenu } from './sellerOrdersSelectors';
import { editOrderRequested, editReset, menuRequested } from './sellerOrdersSlice';

// Plan 105: the seller edits an order (dishes, counts, note, name), any status, a customer's too.
// A 520 px slide-over on a tablet, a bottom sheet on a phone. Nothing is refused: warnings only.

const Body = styled.div<{ $pad?: boolean }>`
  display: flex;
  padding: ${({ theme, $pad }) => ($pad ? theme.spacing.lg : 0)};
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
`;
const Marks = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Mark = styled.span<{ $customer: boolean }>`
  padding: 0 ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme, $customer }) => ($customer ? theme.c.warnTint : theme.c.surf2)};
  color: ${({ theme }) => theme.c.text};
  font-size: 0.8125rem;
  font-weight: 700;
`;
const Summary = styled.p`
  margin: ${({ theme }) => theme.spacing.sm} 0 0;
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border-radius: ${({ theme }) => theme.size.radiusControl}px;
  background: ${({ theme }) => theme.c.surf2};
  font-size: 0.875rem;
  font-weight: 700;
`;
const TotalLine = styled.div`
  display: flex;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.sm};
  font-weight: 700;
  font-variant-numeric: tabular-nums;

  small {
    color: ${({ theme }) => theme.c.muted};
    font-weight: 400;
  }
`;
const AddRow = styled(Button)`
  justify-content: flex-start;
  width: 100%;
`;
const Tick = styled.label`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;

  input {
    flex: none;
    width: 1.5rem;
    height: 1.5rem;
    margin: ${({ theme }) => theme.spacing.xs} 0 0;
    accent-color: ${({ theme }) => theme.colour.accent};
  }
  small {
    display: block;
    color: ${({ theme }) => theme.c.muted};
    font-size: 0.8125rem;
  }
`;
const FootBox = styled.div`
  position: sticky;
  bottom: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding-top: ${({ theme }) => theme.spacing.sm};
  background: ${({ theme }) => theme.c.surf};
`;
const Buttons = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};

  button {
    white-space: nowrap;
  }
  button:first-child {
    flex: 1;
  }
`;
const Choices = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  margin-top: ${({ theme }) => theme.spacing.md};
`;

export type EditOrderSheetProps = Readonly<{
  order: Order;
  tablet: boolean;
  onClose: () => void;
}>;

export function EditOrderSheet({ order, tablet, onClose }: EditOrderSheetProps) {
  const { t } = useTranslation(SELLER_NS);
  const { t: tUi } = useTranslation();
  const lang = useLang();
  const dispatch = useDispatch();
  const menuState = useSelector(selectMenu);
  const edit = useSelector(selectEdit);
  const menu = useMemo<ReadonlyArray<SellerMenuItemView>>(
    () => (menuState.status === 'ready' ? menuState.items : []),
    [menuState],
  );

  const [rows, setRows] = useState<Array<EditRow>>(() => initialRows(order));
  const [name, setName] = useState(order.firstName);
  const [note, setNote] = useState(order.note ?? '');
  // A customer's order is told by default; one the kitchen typed in is not (the seller is on WhatsApp with them).
  const [notify, setNotify] = useState(order.enteredBy === undefined);
  const [view, setView] = useState<'edit' | 'add'>('edit');
  const [asking, setAsking] = useState<'leave' | 'cancelled' | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    dispatch(editReset());
    dispatch(menuRequested());
  }, [dispatch]);
  // Saved: the toast says so; the sheet is done.
  useEffect(() => {
    if (edit.status === 'saved' && edit.code === order.code) {
      dispatch(editReset());
      onClose();
    }
  }, [edit, order.code, dispatch, onClose]);

  const cancelled = order.status === 'cancelled';
  const values = { rows, name, note };
  const changed = isChanged(order, values);
  const noDishes = liveRows(rows).length === 0;
  const nameMissing = name.trim() === '';
  const mine = 'code' in edit && edit.code === order.code;
  const saving = mine && edit.status === 'saving';
  const warned = mine && edit.status === 'warned';
  const failed = mine && edit.status === 'error';
  const total = rowsTotal(rows);
  const summary = changeSummary(rows, lang);

  const save = useCallback(
    (reactivate: boolean) => {
      setAsking(null);
      dispatch(
        editOrderRequested({
          code: order.code,
          request: buildEditRequest(
            order,
            { rows, name, note },
            { notify, force: warned, reactivate },
          ),
        }),
      );
    },
    [dispatch, order, rows, name, note, notify, warned],
  );
  const onSave = () => {
    setSubmitted(true);
    if (noDishes || nameMissing || saving) return;
    if (cancelled) setAsking('cancelled');
    else save(false);
  };
  const requestClose = () => {
    if (view === 'add') setView('edit');
    else if (changed) setAsking('leave');
    else onClose();
  };

  const statusWarning =
    order.status === 'delivered' || order.status === 'collected'
      ? t('edit.warnDone', { status: t(`status.${order.status}`).toLowerCase() })
      : order.status === 'ready_for_pickup' || order.status === 'out_for_delivery'
        ? t('edit.warnHandled', { status: t(`status.${order.status}`).toLowerCase() })
        : cancelled
          ? t('edit.warnCancelled')
          : null;

  const dishes = (
    <Body $pad={tablet}>
      <Marks>
        <Mark $customer={order.enteredBy === undefined}>
          {t(order.enteredBy === undefined ? 'edit.fromCustomer' : 'edit.fromKitchen')}
        </Mark>
      </Marks>
      {statusWarning ? (
        <Notice tone="warn" layout="strip" role="status">
          {statusWarning}
        </Notice>
      ) : null}
      {order.paid ? (
        <Notice tone="info" layout="strip" role="status">
          {t('edit.warnPaid', { amount: formatMoney(orderTotalCents(order), lang) })}
        </Notice>
      ) : null}
      <NameField
        value={name}
        onChange={setName}
        {...(submitted && nameMissing ? { error: t('new.nameRequired') } : {})}
      />
      <Field>
        <Label>{t('edit.dishes')}</Label>
        <EditDishRows
          rows={rows}
          menu={menu}
          holds={!cancelled}
          lang={lang}
          onQty={(itemId, qty) => setRows((previous) => patchRow(previous, itemId, { qty }))}
          onRemoved={(itemId, removed) =>
            setRows((previous) => patchRow(previous, itemId, { removed }))
          }
          onNote={(itemId, lineNote) =>
            setRows((previous) => patchRow(previous, itemId, { note: lineNote }))
          }
        />
        <AddRow variant="quiet" onClick={() => setView('add')}>
          {t('edit.add')}
        </AddRow>
        {summary.removed.length > 0 || summary.added.length > 0 ? (
          <Summary>
            {summary.added.length === 0
              ? t('edit.summary', { removed: summary.removed.join(' · ') })
              : summary.removed.length === 0
                ? t('edit.summaryAdded', { added: summary.added.join(' · ') })
                : t('edit.summaryBoth', {
                    removed: summary.removed.join(' · '),
                    added: summary.added.join(' · '),
                  })}
          </Summary>
        ) : null}
        {noDishes ? <ErrorText role="alert">{t('edit.hint')}</ErrorText> : null}
        <TotalLine>
          <span>{t('edit.total')}</span>
          <span>
            {formatMoney(total, lang)}
            {total !== orderTotalCents(order) ? (
              <small>
                {' '}
                ({t('edit.was', { amount: formatMoney(orderTotalCents(order), lang) })})
              </small>
            ) : null}
          </span>
        </TotalLine>
      </Field>
      <NoteField value={note} onChange={setNote} />
      {warned ? (
        <Notice tone="warn" layout="strip" role="alert">
          {t('edit.overBody')}
        </Notice>
      ) : null}
      {failed ? <ErrorText role="alert">{t('edit.error')}</ErrorText> : null}
    </Body>
  );

  const footer: ReactNode =
    view === 'add' ? (
      <Button variant="primary" fullWidth onClick={() => setView('edit')}>
        {t('edit.done')}
      </Button>
    ) : (
      <FootBox>
        <Tick>
          <input
            type="checkbox"
            checked={notify}
            onChange={(event) => setNotify(event.target.checked)}
          />
          <span>
            <b>{t('edit.tell')}</b>
            <small>
              {order.enteredBy === undefined
                ? t('edit.tellHelp', { code: formatOrderCode(order.code) })
                : t('edit.tellSeller')}
            </small>
          </span>
        </Tick>
        <Buttons>
          <Button variant="primary" disabled={noDishes || saving || !changed} onClick={onSave}>
            {saving ? (
              <>
                <SavingSpinner />
                {t('edit.saving')}
              </>
            ) : warned ? (
              t('edit.saveAnyway')
            ) : (
              t('edit.save')
            )}
          </Button>
          <Button disabled={saving} onClick={requestClose}>
            {t('edit.cancel')}
          </Button>
        </Buttons>
      </FootBox>
    );

  const title = view === 'add' ? t('edit.addTitle') : t('edit.title');
  const heading = `${title} · ${formatOrderCode(order.code)}`;
  const content =
    view === 'add' ? (
      <Body $pad={tablet}>
        <AddDishList
          rows={rows}
          menu={menu}
          lang={lang}
          onAdd={(item) => setRows((previous) => addDish(previous, item))}
        />
      </Body>
    ) : (
      dishes
    );

  return (
    <>
      {tablet ? (
        <SlideOver
          label={heading}
          closeLabel={tUi('patterns.close')}
          onClose={requestClose}
          width="520px"
          footer={footer}
        >
          {content}
        </SlideOver>
      ) : (
        <BottomSheet title={heading} onClose={requestClose}>
          {content}
          {footer}
        </BottomSheet>
      )}
      {asking === 'leave' ? (
        <WarningDialog
          title={t('edit.discardTitle')}
          cancelLabel={t('edit.discardKeep')}
          continueLabel={t('edit.discardGo')}
          onCancel={() => setAsking(null)}
          onContinue={onClose}
        >
          {t('edit.discardBody')}
        </WarningDialog>
      ) : null}
      {asking === 'cancelled' ? (
        <BottomSheet title={t('edit.cancelledTitle')} onClose={() => setAsking(null)}>
          <p>{t('edit.cancelledBody')}</p>
          <Choices>
            <Button fullWidth onClick={() => save(false)}>
              {t('edit.keepCancelled')}
            </Button>
            <Button variant="primary" fullWidth onClick={() => save(true)}>
              {t('edit.reactivate')}
            </Button>
          </Choices>
        </BottomSheet>
      ) : null}
    </>
  );
}
