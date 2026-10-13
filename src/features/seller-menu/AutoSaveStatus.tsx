import {
  AutoSaveStatus as SharedAutoSaveStatus,
  type AutoSaveStatusProps,
} from '../../components/autoSave/AutoSaveStatus';
import { MENU_NS } from './i18n/register';

/** The menu wizard's status line (plan 072); the shared line with the menu's own texts. */
export function AutoSaveStatus(props: Omit<AutoSaveStatusProps, 'ns'>) {
  return <SharedAutoSaveStatus ns={MENU_NS} {...props} />;
}
