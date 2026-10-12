import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';
import { styled } from 'styled-components';
import {
  MAX_MENU_ITEMS,
  ITEM_DESCRIPTION_MAX,
  ITEM_NAME_MAX,
  ITEM_SIZE_MAX,
} from '../../../shared/limits';
import { formatDay } from '../../../shared/dates';
import type { Dish } from '../../../shared/menusContract';
import { useSellerLanguages } from '../../api/useSellerLanguages';
import { currentSellerSlug } from '../../api/device/sellerContext';
import { DRAFT_NS, DraftNotice, draftKey, fingerprint, useDraft } from '../../components/draft';
import { TranslateButton } from '../../components/translate';
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
  unifyDraft,
  type ItemDraft,
} from './itemForm';
import { ErrorText, LinkButton, Muted, useLang, useOpWatch, useRunOp } from './menuShared';
import { loadRequested, type MenuData } from './menuSlice';
import type { MenuSlots } from './slots';

/** What the editor changes: a dish in Your dishes (null id = a new one), or one dish on this menu. */
export type DishTarget =
  { kind: 'library'; dishId: string | null } | { kind: 'menu'; itemId: string };

export type DishEditorProps = Readonly<{
  data: MenuData;
  target: DishTarget;
  onClose: () => void;
  /** Plan 030: a chef's editor (their own dish): no chef picker, no add-to-menu, no delete. */
  asChef?: boolean;
  /** Edit chefs opens this over the editor (the app injects the Chefs screen); without it the link is hidden. */
  renderChefs?: MenuSlots['chefs'];
}>;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.size.pagePadTablet}px
    ${({ theme }) => theme.size.pagePadTablet}px;

  @media (max-width: 37.4375rem) {
    padding-inline: ${({ theme }) => theme.spacing.lg};
  }
`;
const Heading = styled.h2`
  margin: 0;
  font-size: 1.25rem;
  font-weight: 700;
  line-height: 1.25;
`;
// On a phone (plan 051) every field takes the full width: one column.
const Pair = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${({ theme }) => theme.spacing.md};

  @media (max-width: 37.4375rem) {
    grid-template-columns: minmax(0, 1fr);
  }
`;
const Cell = styled.div`
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.xs};

  > :first-child {
    align-self: stretch;
  }
`;
const Cols = styled.div`
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: ${({ theme }) => theme.spacing.md};
  align-items: start;

  @media (max-width: 37.4375rem) {
    grid-template-columns: minmax(0, 1fr);
  }
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

  @media (max-width: 37.4375rem) {
    display: none;
  }
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
export function DishEditor({
  data,
  target,
  onClose,
  asChef = false,
  renderChefs,
}: DishEditorProps) {
  const { t } = useTranslation(MENU_NS);
  const lang = useLang();
  const dispatch = useDispatch();
  const { run, busy } = useRunOp();
  const { view } = data;
  const dish: Dish | undefined =
    target.kind === 'library' && target.dishId !== null
      ? data.dishes.find((d) => d.id === target.dishId)
      : undefined;
  const item = target.kind === 'menu' ? view.dishes.find((d) => d.id === target.itemId) : undefined;
  const isNew = target.kind === 'library' && target.dishId === null;
  const [start] = useState<ItemDraft>(() =>
    item ? draftOf(item) : dish ? draftOfDish(dish) : EMPTY_DRAFT,
  );
  // Plan 061: what is typed survives a reload or a closed editor, until Save or Discard.
  const [draft, setDraft, saved] = useDraft<ItemDraft>(
    draftKey(currentSellerSlug(), 'dish', item ? `menu-${item.id}` : dish ? dish.id : 'new'),
    start,
    { baseline: fingerprint(start) },
  );
  const { t: tDraft } = useTranslation(DRAFT_NS);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const menuOpen = view.menu.state !== 'finished';
  const menuFull = view.dishes.length >= MAX_MENU_ITEMS;
  const [addToMenu, setAddToMenu] = useState(!asChef && menuOpen && !menuFull);
  const languages = useSellerLanguages();
  const oneLanguage = languages === 'en' || languages === 'id' ? languages : null;
  const shown = oneLanguage ? unifyDraft(draft, oneLanguage) : draft;
  const { errors } = validateDraft(shown);
  const setBoth =
    (a: keyof ItemDraft, b: keyof ItemDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setDraft((previous) => ({ ...previous, [a]: event.target.value, [b]: event.target.value }));
  // Plan 057: with both languages, a ⇄ button fills the empty one from the other (not saved here).
  const translateFor = (pair: 'name' | 'desc', toId = false) => {
    const en = pair === 'name' ? ('nameEn' as const) : ('descEn' as const);
    const id = pair === 'name' ? ('nameId' as const) : ('descId' as const);
    const [from, to] = toId ? [en, id] : [id, en];
    if (draft[to].trim() !== '' || draft[from].trim() === '') return null;
    return (
      <TranslateButton
        text={draft[from]}
        from={toId ? 'en' : 'id'}
        to={toId ? 'id' : 'en'}
        onResult={(result) => setDraft((previous) => ({ ...previous, [to]: result }))}
      />
    );
  };
  const set =
    (key: keyof ItemDraft) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((previous) => ({ ...previous, [key]: event.target.value }));
  const [editingChefs, setEditingChefs] = useState(false);
  // The cooks that existed when Edit chefs opened: one that is not among them afterwards is new.
  const chefsBefore = useRef<ReadonlyArray<string> | null>(null);
  const openChefs = () => {
    chefsBefore.current = data.chefs.map((c) => c.id);
    setEditingChefs(true);
  };
  const closeChefs = () => {
    setEditingChefs(false);
    dispatch(loadRequested());
  };
  useEffect(() => {
    const before = chefsBefore.current;
    if (before === null || editingChefs) return;
    const added = data.chefs.find((c) => !before.includes(c.id));
    if (added) {
      chefsBefore.current = null;
      setDraft((previous) => ({ ...previous, chefId: added.id }));
    } else if (draft.chefId !== '' && !data.chefs.some((c) => c.id === draft.chefId)) {
      setDraft((previous) => ({ ...previous, chefId: '' }));
    }
  }, [data.chefs, editingChefs, draft.chefId, setDraft]);
  const dirty = useMemo(() => JSON.stringify(draft) !== JSON.stringify(start), [draft, start]);

  useOpWatch(['createDish', 'updateDish', 'updateMenuDish', 'deleteDish'], {
    onDone: () => {
      saved.clear();
      onClose();
    },
    onFail: (result) => {
      // A new dish is saved even when "add to this menu" was refused: say so, and close.
      setFailure(
        result.code === 'limit_reached'
          ? t('dish.menuFull')
          : result.code === 'forbidden'
            ? t('chef.ownerOnly')
            : t('genericError'),
      );
    },
  });

  const save = () => {
    setSubmitted(true);
    setFailure(null);
    if (Object.keys(errors).length > 0) return;
    const draft = shown;
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
        onDiscard={() => {
          saved.discard();
          onClose();
        }}
        keepDraftLabel={tDraft('keepDraft')}
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
          <DraftNotice draft={saved} />
          {oneLanguage ? (
            <>
              <TextField
                label={t('dish.nameOne')}
                value={shown.nameEn}
                maxLength={ITEM_NAME_MAX}
                placeholder={t(oneLanguage === 'en' ? 'dish.nameHintEn' : 'dish.nameHintId')}
                onChange={setBoth('nameEn', 'nameId')}
                {...(submitted && errors.name ? { error: err('name', ITEM_NAME_MAX) } : {})}
              />
              <TextArea
                label={t('dish.descriptionOne')}
                value={shown.descEn}
                maxLength={ITEM_DESCRIPTION_MAX}
                showCounter
                onChange={setBoth('descEn', 'descId')}
                {...(submitted && errors.descEn
                  ? { error: err('descEn', ITEM_DESCRIPTION_MAX) }
                  : {})}
              />
              <TextField
                label={t('dish.sizeOne')}
                value={shown.sizeEn}
                maxLength={ITEM_SIZE_MAX}
                placeholder={t(oneLanguage === 'en' ? 'dish.sizeHintEn' : 'dish.sizeHintId')}
                onChange={setBoth('sizeEn', 'sizeId')}
                {...(submitted && errors.sizeEn ? { error: err('sizeEn', ITEM_SIZE_MAX) } : {})}
              />
            </>
          ) : (
            <>
              <LangLabel>
                <span>{t('dish.english')}</span>
                <span>{t('dish.indonesian')}</span>
              </LangLabel>
              <Pair>
                <Cell>
                  <TextField
                    label={t('dish.name')}
                    value={draft.nameEn}
                    maxLength={ITEM_NAME_MAX}
                    placeholder={t('dish.nameHintEn')}
                    onChange={set('nameEn')}
                    {...(submitted && errors.name ? { error: err('name', ITEM_NAME_MAX) } : {})}
                  />
                  {translateFor('name')}
                </Cell>
                <Cell>
                  <TextField
                    label={t('dish.nameId')}
                    value={draft.nameId}
                    maxLength={ITEM_NAME_MAX}
                    placeholder={t('dish.nameHintId')}
                    onChange={set('nameId')}
                    {...(draft.nameId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
                  />
                  {translateFor('name', true)}
                </Cell>
              </Pair>
              <Pair>
                <Cell>
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
                  {translateFor('desc')}
                </Cell>
                <Cell>
                  <TextArea
                    label={t('dish.descriptionId')}
                    value={draft.descId}
                    maxLength={ITEM_DESCRIPTION_MAX}
                    showCounter
                    onChange={set('descId')}
                    {...(draft.descId.trim() === '' ? { helper: t('dish.seeEnglish') } : {})}
                  />
                  {translateFor('desc', true)}
                </Cell>
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
            </>
          )}
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
          <Check>
            <input
              type="checkbox"
              checked={draft.preorder}
              onChange={(event) => setDraft((p) => ({ ...p, preorder: event.target.checked }))}
            />
            <span>
              {t('dish.preorder')} <Muted as="span">{t('dish.preorderHelper')}</Muted>
            </span>
          </Check>
          <Check>
            <input
              type="checkbox"
              checked={draft.onTheDay}
              onChange={(event) => setDraft((p) => ({ ...p, onTheDay: event.target.checked }))}
            />
            <span>
              {t('dish.onTheDay')} <Muted as="span">{t('dish.onTheDayHelper')}</Muted>
            </span>
          </Check>
          {draft.onTheDay ? (
            <TextField
              label={t('dish.dayStock')}
              value={draft.dayStock}
              inputMode="numeric"
              onChange={set('dayStock')}
              {...(!draft.preorder ? { helper: t('dish.dayStockOnly') } : {})}
              {...(submitted && errors.dayStock ? { error: err('dayStock') } : {})}
            />
          ) : null}
          {submitted && errors.preorder ? (
            <ErrorText role="alert">{err('preorder')}</ErrorText>
          ) : null}
          {asChef ? null : (
            <ChefField
              value={draft.chefId}
              chefs={data.chefs}
              kitchen={t('dish.wholeKitchen')}
              label={t('dish.chef')}
              editLabel={t('dish.editChefs')}
              onChange={set('chefId')}
              onEdit={renderChefs ? openChefs : undefined}
            />
          )}
          {isNew && menuOpen ? (
            <Check>
              <input
                type="checkbox"
                checked={addToMenu && !menuFull}
                disabled={menuFull}
                onChange={(event) => setAddToMenu(event.target.checked)}
              />
              <span>
                {asChef ? t('dish.addToCurrent') : t('dish.addToMenu')}{' '}
                <Muted as="span">{t('dish.savedAnyway')}</Muted>
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
          {libraryDishId && !asChef ? (
            <div>
              <Button variant="destructive" onClick={() => setAsking(true)}>
                {t('dish.delete')}
              </Button>
            </div>
          ) : null}
        </Form>
      </SlideOverEditor>
      {editingChefs && renderChefs ? renderChefs({ onClose: closeChefs }) : null}
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
  onEdit: (() => void) | undefined;
}>) {
  const { id } = useFieldIds(undefined, undefined);
  return (
    <FieldFrame label={label} id={id} helperId={undefined} errorId={undefined} counter={undefined}>
      <ChefHead>
        <span />
        {onEdit ? (
          <LinkButton type="button" onClick={onEdit}>
            {editLabel}
          </LinkButton>
        ) : null}
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
