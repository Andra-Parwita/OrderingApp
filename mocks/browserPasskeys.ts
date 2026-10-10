// A stand-in for @simplewebauthn/browser in screen and client tests (stage 8.2): the "browser"
// answers with a software authenticator (mocks/softAuthenticator.ts), so the server's real
// WebAuthn checks still run end to end. Use it with
//   vi.mock('@simplewebauthn/browser', async () => (await import('<path>/mocks/browserPasskeys')).browserMock);
import { SoftAuthenticator } from './softAuthenticator';

let soft: SoftAuthenticator | undefined;
let next: 'ok' | 'cancel' | 'fail' | 'exists' = 'ok';
let supported = true;

const authenticator = (): SoftAuthenticator =>
  (soft ??= new SoftAuthenticator(globalThis.location.origin));

function guard(): void {
  if (next === 'ok') return;
  const kind = next;
  next = 'ok';
  const failure = new Error(kind === 'cancel' ? 'The prompt was closed' : 'Cannot use a passkey');
  // `exists`: the browser refuses to make a second passkey for the account (plan 025).
  failure.name =
    kind === 'cancel'
      ? 'NotAllowedError'
      : kind === 'exists'
        ? 'InvalidStateError'
        : 'NotSupportedError';
  throw failure;
}

/** Test controls: a fresh authenticator, and a one-time failure of the next prompt. */
export const browserPasskeys = {
  reset(): void {
    soft = undefined;
    next = 'ok';
    supported = true;
  },
  /** The next prompt is closed by the person (`cancel`) or fails (`fail`). */
  failNext(kind: 'cancel' | 'fail' | 'exists'): void {
    next = kind;
  },
  setSupported(value: boolean): void {
    supported = value;
  },
  get authenticator(): SoftAuthenticator {
    return authenticator();
  },
};

export const browserMock = {
  startRegistration: ({ optionsJSON }: { optionsJSON: unknown }) => {
    guard();
    return Promise.resolve(authenticator().create(optionsJSON as never));
  },
  startAuthentication: ({ optionsJSON }: { optionsJSON: unknown }) => {
    guard();
    return Promise.resolve(authenticator().get(optionsJSON as never));
  },
  browserSupportsWebAuthn: () => supported,
};
