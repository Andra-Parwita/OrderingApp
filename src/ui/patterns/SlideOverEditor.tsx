import { useCallback, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '../Button';
import { SlideOver } from '../SlideOver';
import { WarningDialog } from './WarningDialog';

export type SlideOverEditorProps = Readonly<{
  /** Accessible name of the editor: "Edit Rendang". */
  title: string;
  /** True when there are unsaved changes: closing then asks first. */
  dirty?: boolean;
  saveLabel?: string;
  saving?: boolean;
  onCancel: () => void;
  onSave: () => void;
  /** An optional second footer action, beside Save (for example "Create only"). */
  secondaryAction?: Readonly<{ label: string; onClick: () => void; disabled?: boolean }>;
  children: ReactNode;
}>;

/** Editors slide over the list (560 px): dim the list, Cancel and Save pinned, ask before losing changes. */
export function SlideOverEditor({
  title,
  dirty = false,
  saveLabel,
  saving = false,
  onCancel,
  onSave,
  secondaryAction,
  children,
}: SlideOverEditorProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onCancel();
  }, [dirty, onCancel]);
  return (
    <>
      <SlideOver
        label={title}
        closeLabel={t('patterns.close')}
        onClose={requestClose}
        width="560px"
        footer={
          <>
            <Button onClick={requestClose}>{t('patterns.cancel')}</Button>
            {secondaryAction ? (
              <Button
                disabled={secondaryAction.disabled ?? saving}
                onClick={secondaryAction.onClick}
              >
                {secondaryAction.label}
              </Button>
            ) : null}
            <Button variant="primary" disabled={saving} onClick={onSave}>
              {saveLabel ?? t('patterns.save')}
            </Button>
          </>
        }
      >
        {children}
      </SlideOver>
      {asking ? (
        <WarningDialog
          title={t('patterns.unsavedTitle')}
          cancelLabel={t('patterns.keepEditing')}
          continueLabel={t('patterns.discard')}
          onCancel={() => setAsking(false)}
          onContinue={onCancel}
        >
          {t('patterns.unsavedBody')}
        </WarningDialog>
      ) : null}
    </>
  );
}
