import type { CDPSession, Page } from '@playwright/test';
import type { ExportedCredential } from '../mocks/softAuthenticator';

// Chrome's virtual authenticator (DevTools protocol, Chromium only): a platform passkey that
// answers the page's WebAuthn calls with no prompt, so the specs create and use real passkeys.

export type VirtualAuthenticator = { cdp: CDPSession; authenticatorId: string };

/** Adds a user-verifying, discoverable-credential platform authenticator to the page. */
export async function virtualAuthenticator(page: Page): Promise<VirtualAuthenticator> {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
    },
  });
  return { cdp, authenticatorId };
}

/** Puts an existing passkey (made by the software authenticator) into a new virtual authenticator. */
export async function addCredential(
  page: Page,
  credential: ExportedCredential,
  signCount: number,
): Promise<VirtualAuthenticator> {
  const authenticator = await virtualAuthenticator(page);
  await authenticator.cdp.send('WebAuthn.addCredential', {
    authenticatorId: authenticator.authenticatorId,
    credential: {
      credentialId: credential.credentialId,
      isResidentCredential: true,
      rpId: credential.rpId,
      privateKey: credential.privateKey,
      userHandle: credential.userHandle,
      signCount,
    },
  });
  return authenticator;
}

/** The passkeys the virtual authenticator holds now (to prove one was really made or used). */
export async function credentialsOf({ cdp, authenticatorId }: VirtualAuthenticator) {
  const { credentials } = await cdp.send('WebAuthn.getCredentials', { authenticatorId });
  return credentials;
}
