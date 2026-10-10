import { useMemo, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { styled } from 'styled-components';
import {
  MAX_MENU_ITEMS,
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_SIZE_MAX,
} from '../../../shared/limits';
import { formatDay } from '../../../shared/dates';
import type { Dish } from '../../../shared/menusContract';
import { Button, SlideOverEditor, TextArea, TextField, WarningDialog } from '../../ui';
import { FieldFrame, fieldControlStyle, useFieldIds } from '../../ui/Field';
import { MENU_NS } from './i18n/register';
import {
  EMPTY_DRAFT,
  createRequestOf,
  draftOf,
  draftOfDish,
  updateDishRequestOf,
  updateRequestOf,
  validateDraft,
  type ItemDraft,
} from './itemForm';
import { ErrorText, LinkButton, Muted, useLang, useOpWatch, useRunOp } from './menuShared';
import type { MenuData } from './menuSlice';

/** What the editor changes: a dish in Your dishes (null id = a new one), or one dish on this menu. */
export type DishTarget =
  { kind: 'library'; dishId: string | null } | { kind: 'menu'; itemId: string };

export type DishEditorProps = Readonly<{
  data: MenuData;
  target: DishTarget;
  onClose: () => void;
}>;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px
    ${({ theme }) => theme.size.pagePadTablet}px;
`;
const Heading = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
`;
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
`;
const Cols = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: start;
`;
const LangLabel = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};
  color: ${({ theme }) => theme.c.muted};
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
`;
const Select = styled.select<{ $invalid: boolean }>`
  ${fieldControlStyle}
`;
const Check = styled.label`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
  min-height: ${({ theme }) => theme.size.tap}px;

  input {
    width: 1.25rem;
    height: 1.25rem;
    accent-color: ${({ theme }) => theme.c.fill};
  }
`;
const ChefHead = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

/** The dish editor (560 px slide-over). Used from the wizard, the live menu and Your dishes. */
export function DishEditor({ data, target, onClose }: DishEditorProps) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const navigate = useNavigate();
  const { run, busy } = useRunOp();
  const { view } = data;
  const dish: Dish | undefined =
    target.kind === 'library' && target.dishId !== null
      ? data.dishes.find((d) => d.id === target.dishId)
      : undefined;
  const item = target.kind === 'menu' ? view.dishes.find((d) => d.id === target.itemId) : undefined;
  const isNew = target.kind === 'library' && target.dishId === null;
  const [draft, setDraft] = useState<ItemDraft>(() =>
    item ? draftOf(item) : dish ? draftOfDish(dish) : EMPTY_DRAFT,
  );
  const [start] = useState(draft);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const menuOpen = view.menu.state !== 'finished';
  const menuFull = view.dishes.length >= MAX_MENU_ITEMS;
  const [addToMenu, setAddToMenu] = useState(menuOpen && !menuFull);
  const { errors } = validateDraft(draft);
  const set =
    (key: keyof ItemDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((previous) => ({ ...previous, [key]: event.target.value }));
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(start), [draft, start]);

  useOpWatch(['createDish', 'updateDish', 'updateMenuDish', 'deleteDish'], {
    onDone: () => onClose(),
    onFail: (result) => {
      // A new dish is saved even when "add to this menu" was refused: say so, and close.
      setFailure(result.code === 'limit_reached' ? t('dish.menuFull') : t('genericError'));
    },
  });

  const save = () => {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;
    if (isNew) {
      const request = createRequestOf(draft);
      if (request)
        run({ kind: 'createDish', request, addToMenu: addToMenu && menuOpen && !menuFull });
    } else if (item) {
      const request = updateRequestOf(draft);
      if (request) {
        run({
          kind: 'updateMenuDish',
          id: item.id,
          request,
          ...(item.dishId ? { alsoDishId: item.dishId } : {}),
        });
      }
    } else if (dish) {
      const request = updateDishRequestOf(draft);
      if (request) run({ kind: 'updateDish', id: dish.id, request });
    }
  };

  const libraryDishId = item?.dishId ?? dish?.id;
  const onThisMenu = libraryDishId
    ? view.dishes.some((d) => d.dishId === libraryDishId)
    : target.kind === 'menu';
  const lastUsed = dish?.lastUsedAt;
  const title = isNew
    ? t('dish.titleNew')
    : t('dish.titleEdit', { name: (draft.nameEn || draft.nameId).trim() });
  const err = (key: keyof ReturnType<typeof validateDraft>['errors'], max?: number) => {
    if (!submitted) return undefined;
    const e = errors[key];
    if (!e) return undefined;
    return t(e === 'tooLong' ? 'dish.err.tooLong' : `dish.err.${key}`, { max });
  };

  return (
    <>
      <SlideOverEditor
        title={title}
        dirty={dirty}
        saveLabel={isNew ? t('dish.add') : t('dish.save')}
        saving={busy}
        onCancel={onClose}
        onSave={save}
      >
        <Form
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Heading>{title}</Heading>
          <Muted>{isNew ? t('dish.subNew') : t('dish.subEdit')}</Muted>
          <LangLabel>
            <span>{t('dish.english')}</span>
            <span>{t('dish.indonesian')}</span>
          </LangLabel>
          <Pair>
            <TextField
              label={t('dish.name')}
              value={draft.nameEn}
              maxLength={ITEM_NAME_MAX}
              placeholder={t('dish.nameHintEn')}
              onChange={set('nameEn')}
              {...(submitted && errors.name ? { error: err('name', ITEM_NAME_MAX) } : {})}
            />
            <TextField
              label={t('dish.nameId')}
              value={draft.nameId}
              maxLength={ITEM_NAME_MAX}
              placeholder={t('dish.nameHintId')}
              onChange={set('nameId')}
              {...(draft.nameId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
            />
          </Pair>
          <Pair>
            <TextArea
              label={t('dish.description')}
              value={draft.descEn}
              maxLength={ITEM_DESCRIPTION_MAX}
              showCounter
              onChange={set('descEn')}
              {...(submitted && errors.descEn
                ? { error: err('descEn', ITEM_DESCRIPTION_MAX) }
                : {})}
            />
            <TextArea
              label={t('dish.descriptionId')}
              value={draft.descId}
              maxLength={ITEM_DESCRIPTION_MAX}
              showCounter
              onChange={set('descId')}
              {...(draft.descId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
            />
          </Pair>
          <Pair>
            <TextField
              label={t('dish.size')}
              value={draft.sizeEn}
              maxLength={ITEM_SIZE_MAX}
              placeholder={t('dish.sizeHintEn')}
              onChange={set('sizeEn')}
              {...(submitted && errors.sizeEn ? { error: err('sizeEn', ITEM_SIZE_MAX) } : {})}
            />
            <TextField
              label={t('dish.sizeId')}
              value={draft.sizeId}
              maxLength={ITEM_SIZE_MAX}
              placeholder={t('dish.sizeHintId')}
              onChange={set('sizeId')}
              {...(draft.sizeId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
            />
          </Pair>
          <Cols>
            <TextField
              label={t('dish.price')}
              value={draft.price}
              inputMode="decimal"
              helper={t('dish.priceHelper')}
              onChange={set('price')}
              {...(submitted && errors.price ? { error: err('price') } : {})}
            />
            <TextField
              label={t('dish.limit')}
              value={draft.limit}
              inputMode="numeric"
              placeholder={t('dish.noLimit')}
              helper={t('dish.limitHelper')}
              onChange={set('limit')}
              {...(submitted && errors.limit ? { error: err('limit') } : {})}
            />
          </Cols>
          <ChefField
            value={draft.chefId}
            chefs={data.chefs}
            kitchen={t('dish.wholeKitchen')}
            label={t('dish.chef')}
            editLabel={t('dish.editChefs')}
            onChange={set('chefId')}
            onEdit={() => void navigate('/seller/chefs')}
          />
          {isNew && menuOpen ? (
            <Check>
              <input
                type="checkbox"
                checked={addToMenu && !menuFull}
                disabled={menuFull}
                onChange={(event) => setAddToMenu(event.target.checked)}
              />
              <span>
                {t('dish.addToMenu')} <Muted as="span">{t('dish.savedAnyway')}</Muted>
              </span>
            </Check>
          ) : null}
          {isNew && menuOpen && menuFull ? <Muted>{t('dish.menuFull')}</Muted> : null}
          {!isNew ? (
            <Muted>
              {onThisMenu
                ? t('dish.usedOnThis')
                : lastUsed
                  ? t('dish.lastUsed', { date: formatDay(lastUsed, lang) })
                  : t('dish.neverUsed')}
            </Muted>
          ) : null}
          {failure ? <ErrorText role="alert">{failure}</ErrorText> : null}
          {libraryDishId ? (
            <div>
              <Button variant="destructive" onClick={() => setAsking(true)}>
                {t('dish.delete')}
              </Button>
            </div>
          ) : null}
        </Form>
      </SlideOverEditor>
      {asking && libraryDishId ? (
        <WarningDialog
          title={t('dish.deleteTitle', { name: (draft.nameEn || draft.nameId).trim() })}
          cancelLabel={t('dish.keep')}
          continueLabel={t('dish.deleteAnyway')}
          onCancel={() => setAsking(false)}
          onContinue={() => {
            setAsking(false);
            run({ kind: 'deleteDish', id: libraryDishId });
          }}
        >
          {onThisMenu && view.menu.state === 'live' ? t('dish.deleteLive') : t('dish.deleteBody')}
        </WarningDialog>
      ) : null}
    </>
  );
}

function ChefField({
  value,
  chefs,
  kitchen,
  label,
  editLabel,
  onChange,
  onEdit,
}: Readonly<{
  value: string;
  chefs: MenuData['chefs'];
  kitchen: string;
  label: string;
  editLabel: string;
  onChange: (event: ChangeEvent<HTMLSelectElement>) => void;
  onEdit: () => void;
}>) {
  const { id } = useFieldIds(undefined, undefined);
  return (
    <FieldFrame label={label} id={id} helperId={undefined} errorId={undefined} counter={undefined}>
      <ChefHead>
        <span />
        <LinkButton type="button" onClick={onEdit}>
          {editLabel}
        </LinkButton>
      </ChefHead>
      <Select id={id} value={value} $invalid={false} onChange={onChange}>
        <option value="">{kitchen}</option>
        {chefs.map((chef) => (
          <option key={chef.id} value={chef.id}>
            {chef.name}
          </option>
        ))}
      </Select>
    </FieldFrame>
  );
}
