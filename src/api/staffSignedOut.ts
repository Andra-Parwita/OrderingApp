import { createAction } from '@reduxjs/toolkit';

/**
 * Dispatched just before a seller or chef signs out (Sign out, Switch person). The seller sagas
 * `take` it to stop their live refresh and polling, which closes the live socket, so nothing
 * seller-side calls the API once the session cookie is on its way out.
 */
export const staffSignedOut = createAction('session/staffSignedOut');
