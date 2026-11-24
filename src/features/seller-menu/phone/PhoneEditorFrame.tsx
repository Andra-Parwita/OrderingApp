import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, WarningDialog, type SlideOverEditorProps } from '../../../ui';
import { PhoneFullLayer } from './PhoneFullLayer';

// Plan 134: the phone's version of the editor frame (the tablet's is the slide-over): a full-screen
// layer with its own bar (title and ✕), the form scrolling below, Cancel and the save button pinned at
// the bottom, and the same question before losing changes. Same props as SlideOverEditor.

export function PhoneEditorFrame({
  title,
  dirty = false,
  saveLabel,
  saving = false,
  onCancel,
  onSave,
  secondaryAction,
  onDiscard,
  keepDraftLabel,
  children,
}: SlideOverEditorProps) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);
  const requestClose = useCallback(() => {
    if (dirty) setAsking(true);
    else onCancel();
  }, [dirty, onCancel]);
  return (
    <PhoneFullLayer
      label={title}
      closeLabel={t('patterns.close')}
      onClose={requestClose}
      footer={
        <>
          <Button onClick={requestClose}>{t('patterns.cancel')}</Button>
          {secondaryAction ? (
            <Button disabled={secondaryAction.disabled ?? saving} onClick={secondaryAction.onClick}>
              {secondaryAction.label}
            </Button>
          ) : null}
          <Button variant="primary" disabled={saving} onClick={onSave}>
            {saveLabel ?? t('patterns.save')}
          </Button>
        </>
      }
      overlay={
        asking ? (
          <WarningDialog
            title={t('patterns.unsavedTitle')}
            cancelLabel={t('patterns.keepEditing')}
            continueLabel={t('patterns.discard')}
            onCancel={() => setAsking(false)}
            onContinue={onDiscard ?? onCancel}
            {...(keepDraftLabel ? { extraLabel: keepDraftLabel, onExtra: onCancel } : {})}
          >
            {t('patterns.unsavedBody')}
          </WarningDialog>
        ) : null
      }
    >
      {children}
    </PhoneFullLayer>
  );
}
