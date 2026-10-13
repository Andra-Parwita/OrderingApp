// Plan 071 (D-099): the shapes of the seller's device-only address book.

/** The delivery address as the seller keeps it (all four may be empty strings). */
export type BookAddress = {
  street: string;
  suburb: string;
  postcode: string;
  notes: string;
};

/** One saved customer. Lives only on the seller's device (IndexedDB) and in her CSV backup. */
export type Customer = {
  id: string;
  firstName: string;
  /** Digits with the country code (61...). */
  phone?: string;
  address?: BookAddress;
  /** Anonymous codes from the customer's phone(s). */
  customerCodes: Array<string>;
  /** Orders whose number was typed by hand (New order, order page) before any code linked them. */
  orderCodes: Array<string>;
  /** Local date YYYY-MM-DD of the latest order, or ''. */
  lastOrderDate: string;
  createdAt: string;
  updatedAt: string;
};

/** Small facts kept beside the customers. */
export type BookMeta = {
  /** ISO time of the last CSV backup, or null. */
  lastBackupAt: string | null;
};
