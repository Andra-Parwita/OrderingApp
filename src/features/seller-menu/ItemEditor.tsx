import { useState, type ChangeEvent, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { styled } from 'styled-components';
import type { Chef, SellerMenuItemView } from '../../../shared/domain';
import {
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_SIZE_MAX,
  MAX_MENU_ITEMS,
} from '../../../shared/limits';
import { Button, ConfirmButton, PageHeader, SlideOver, TextField } from '../../ui';
import { FieldFrame, fieldControlStyle, useFieldIds } from '../../ui/Field';
import { MENU_NS } from './i18n/register';
import {
  EMPTY_DRAFT,
  createRequestOf,
  draftOf,
  updateRequestOf,
  validateDraft,
  type ItemDraft,
} from './itemForm';
import { ErrorText, Muted, Page, selectMenu, Title, useMenuData, useOpWatch } from './menuShared';
import { opRequested, type OpResult } from './menuSlice';

export type ItemEditorProps = Readonly<{
  /** The item to edit; `null` adds a new one. */
  itemId: string | null;
  /** True at 1024 px and up: a slide-over on the menu. Otherwise a full screen. */
  desktop?: boolean;
  /** Called after a save or delete, and when the seller leaves. */
  onClose: () => void;
}>;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl}
    ${({ theme }) => theme.spacing.xl};
`;
const PhoneForm = styled(Form)`
  padding: ${({ theme }) => theme.spacing.lg};
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: 1fr;
  gap: ${({ theme }) => theme.spacing.md};
`;
const Select = styled.select<{ $invalid: boolean }>`
  ${fieldControlStyle}
`;
const Toggle = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.minTapTarget};
  font-weight: ${({ theme }) => theme.type.weight.strong};

  input {
    width: 1.5rem;
    height: 1.5rem;
    accent-color: ${({ theme }) => theme.colour.accent};
  }
`;
const Buttons = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
`;
const Notice = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const EDIT_KINDS = ['createItem', 'updateItem', 'deleteItem'] as const;

export function ItemEditor({ itemId, desktop = false, onClose }: ItemEditorProps) {
  const { t } = useTranslation(MENU_NS);
  const { data, status } = useMenuData();
  // Here, not in the form: a refresh after a delete removes the item and the form with it.
  const outcome = useOpWatch(EDIT_KINDS, onClose);
  const title = t(itemId === null ? 'item.titleNew' : 'item.titleEdit');
  const item =
    itemId === null ? undefined : data?.items.find((candidate) => candidate.id === itemId);

  let body;
  if (!data) body = status;
  else if (itemId !== null && !item) {
    body = (
      <Notice>
        <Muted role="alert">{t('item.notFound')}</Muted>
        <Button onClick={onClose}>{t('close')}</Button>
      </Notice>
    );
  } else {
    body = (
      <ItemForm
        key={item ? item.id : 'new'}
        item={item}
        chefs={data.chefs}
        kitchenName={data.kitchenName}
        itemCount={data.items.length}
        padded={desktop}
        outcome={outcome}
      />
    );
  }

  if (desktop) {
    return (
      <SlideOver label={title} closeLabel={t('close')} onClose={onClose}>
        <Title as="h2" style={{ padding: '0 24px' }}>
          {title}
        </Title>
        {body}
      </SlideOver>
    );
  }
  return (
    <>
      <PageHeader title={title} backLabel={t('back')} onBack={onClose} />
      <Page>{body}</Page>
    </>
  );
}

function ItemForm({
  item,
  chefs,
  kitchenName,
  itemCount,
  padded,
  outcome,
}: Readonly<{
  item: SellerMenuItemView | undefined;
  chefs: ReadonlyArray<Chef>;
  kitchenName: string;
  itemCount: number;
  padded: boolean;
  outcome: OpResult | null;
}>) {
  const { t } = useTranslation(MENU_NS);
  const dispatch = useDispatch();
  const { busy } = useSelector(selectMenu);
  const [draft, setDraft] = useState<ItemDraft>(item ? draftOf(item) : EMPTY_DRAFT);
  const [attempted, setAttempted] = useState(false);
  const chefId = useFieldIds(t('item.chefHelper'), undefined);
  const Wrap = padded ? Form : PhoneForm;

  const errors = attempted ? validateDraft(draft).errors : {};
  const isNew = item === undefined;
  const full = isNew && itemCount >= MAX_MENU_ITEMS;
  const failed = outcome?.status === 'failed' ? outcome : null;
  const hasOrders = failed?.kind === 'deleteItem' && failed.code === 'item_has_orders';

  const set =
    (field: keyof ItemDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft({ ...draft, [field]: event.target.value });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setAttempted(true);
    if (item) {
      const request = updateRequestOf(draft);
      if (request) dispatch(opRequested({ kind: 'updateItem', id: item.id, request }));
    } else {
      const request = createRequestOf(draft);
      if (request) dispatch(opRequested({ kind: 'createItem', request }));
    }
  };

  let failureText: string | null = null;
  if (failed && !hasOrders) {
    failureText =
      failed.code === 'limit_reached' ? t('item.full', { max: MAX_MENU_ITEMS }) : t('genericError');
  }

  return (
    <Wrap onSubmit={submit} noValidate>
      <Pair>
        <TextField
          label={t('item.nameEn')}
          value={draft.nameEn}
          onChange={set('nameEn')}
          {...(errors.name
            ? {
                error:
                  errors.name === 'tooLong'
                    ? t('item.err.tooLong', { max: ITEM_NAME_MAX })
                    : t('item.err.name'),
              }
            : {})}
        />
        <TextField label={t('item.nameId')} value={draft.nameId} onChange={set('nameId')} />
      </Pair>
      <Pair>
        <TextField
          label={t('item.descEn')}
          value={draft.descEn}
          helper={t('item.oneEmpty')}
          onChange={set('descEn')}
          {...(errors.descEn
            ? { error: t('item.err.tooLong', { max: ITEM_DESCRIPTION_MAX }) }
            : {})}
        />
        <TextField
          label={t('item.descId')}
          value={draft.descId}
          onChange={set('descId')}
          {...(errors.descId
            ? { error: t('item.err.tooLong', { max: ITEM_DESCRIPTION_MAX }) }
            : {})}
        />
      </Pair>
      <Pair>
        <TextField
          label={t('item.sizeEn')}
          value={draft.sizeEn}
          onChange={set('sizeEn')}
          {...(errors.sizeEn ? { error: t('item.err.tooLong', { max: ITEM_SIZE_MAX }) } : {})}
        />
        <TextField
          label={t('item.sizeId')}
          value={draft.sizeId}
          onChange={set('sizeId')}
          {...(errors.sizeId ? { error: t('item.err.tooLong', { max: ITEM_SIZE_MAX }) } : {})}
        />
      </Pair>
      <TextField
        label={t('item.price')}
        value={draft.price}
        inputMode="decimal"
        helper={t('item.priceHelper')}
        onChange={set('price')}
        {...(errors.price ? { error: t('item.err.price') } : {})}
      />
      <TextField
        label={t('item.limit')}
        value={draft.limit}
        inputMode="numeric"
        helper={t('item.limitHelper')}
        onChange={set('limit')}
        {...(errors.limit ? { error: t('item.err.limit') } : {})}
      />
      <FieldFrame
        label={t('item.chef')}
        helper={t('item.chefHelper')}
        id={chefId.id}
        helperId={chefId.helperId}
        errorId={undefined}
        counter={undefined}
      >
        <Select
          id={chefId.id}
          $invalid={false}
          aria-describedby={chefId.describedBy}
          value={draft.chefId}
          onChange={set('chefId')}
        >
          <option value="">{t('item.chefNone', { kitchen: kitchenName })}</option>
          {chefs.map((chef) => (
            <option key={chef.id} value={chef.id}>
              {chef.name}
            </option>
          ))}
        </Select>
      </FieldFrame>
      {item ? (
        <div>
          <Toggle>
            <input
              type="checkbox"
              role="switch"
              checked={draft.soldOut}
              onChange={(event) => setDraft({ ...draft, soldOut: event.target.checked })}
            />
            {t('item.soldOut')}
          </Toggle>
          <Muted>{t('item.soldOutHelper')}</Muted>
        </div>
      ) : null}

      {failureText ? <ErrorText role="alert">{failureText}</ErrorText> : null}
      {hasOrders && item ? (
        <Notice>
          <ErrorText role="alert">{t('item.hasOrders')}</ErrorText>
          <Button
            variant="primary"
            disabled={busy}
            onClick={() =>
              dispatch(opRequested({ kind: 'updateItem', id: item.id, request: { soldOut: true } }))
            }
          >
            {t('item.markSoldOut')}
          </Button>
        </Notice>
      ) : null}

      <Buttons>
        <Button type="submit" variant="primary" disabled={busy || full}>
          {t(isNew ? 'item.add' : 'item.save')}
        </Button>
        {item ? (
          <ConfirmButton
            label={t('item.delete')}
            confirmLabel={t('item.deleteConfirm')}
            disabled={busy}
            onConfirm={() => dispatch(opRequested({ kind: 'deleteItem', id: item.id }))}
          />
        ) : null}
      </Buttons>
      {full ? <Muted>{t('item.full', { max: MAX_MENU_ITEMS })}</Muted> : null}
    </Wrap>
  );
}
