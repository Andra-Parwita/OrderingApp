import { createContext, useContext } from 'react';

// Plan 028: a helper sees orders read only. They may still mark an order collected and set a dish
// sold out (the server's helperMay list); edit, cancel, lock, nudge, paid and limits are hidden.
// The app shell says which person this is; the screens only ask.

const ReadOnlyOrdersContext = createContext(false);

export const ReadOnlyOrdersProvider = ReadOnlyOrdersContext.Provider;

/** True for a helper: order changes other than "collected" are not offered. */
export function useReadOnlyOrders(): boolean {
  return useContext(ReadOnlyOrdersContext);
}
