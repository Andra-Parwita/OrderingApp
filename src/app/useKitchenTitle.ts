import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { kitchenPageTitle } from '../../shared/kitchenHeadLinks';
import { customerArea } from './customerPath';

/**
 * The tab and bookmark title follows the kitchen on screen (the Worker writes the first one into the
 * HTML): its name, "<Kitchen> · Order" on an order page (the word in the customer's language). Nothing
 * changes while the kitchen is not known yet, so the Worker's title stays.
 */
export function useKitchenTitle(pathname: string, kitchenName: string | null): void {
  const { t } = useTranslation();
  const isOrder = customerArea(pathname).kind === 'order';
  const orderWord = t('customerNav.orderTitle');
  useEffect(() => {
    if (kitchenName === null) return;
    document.title = kitchenPageTitle(kitchenName, isOrder ? orderWord : undefined);
  }, [kitchenName, isOrder, orderWord]);
}
