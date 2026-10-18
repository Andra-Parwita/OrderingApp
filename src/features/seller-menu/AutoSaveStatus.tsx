import {
  AutoSaveStatus as SharedAutoSaveStatus,
  type AutoSaveStatusProps,
} from '../../components/autoSave/AutoSaveStatus';
import { MENU_NS } from './i18n/register';
import { useSession } from './sessionIntercept';

/** The menu wizard's status line (plan 072); the shared line with the menu's own texts. A session has its own count and Save instead (plan 103). */
export function AutoSaveStatus(props: Omit<AutoSaveStatusProps, 'ns'>) {
  const session = useSession();
  if (session) return null;
  return <SharedAutoSaveStatus ns={MENU_NS} {...props} />;
}
