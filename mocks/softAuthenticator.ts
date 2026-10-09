// A software WebAuthn authenticator for tests (stage 8.2): makes the same JSON a browser's
// `startRegistration` / `startAuthentication` return, with a real ES256 key pair, so the server's
// real verification runs. No network, no browser. Used by the unit tests, the jsdom screen tests
// (through a mock of @simplewebauthn/browser) and the e2e global setup (API-only passkeys).
import { createHash, createPrivateKey, generateKeyPairSync, randomBytes, sign } from 'node:crypto';
import type { KeyObject } from 'node:crypto';

type Options = { challenge: string; allowCredentials?: Array<{ id: string }> } & Record<
  string,
  unknown
>;

const b64u = (bytes: Uint8Array): string => Buffer.from(bytes).toString('base64url');
const sha256 = (data: Uint8Array | string): Buffer => createHash('sha256').update(data).digest();

// ---- Just enough CBOR for an attestation object and a COSE key ----

function head(major: number, n: number): Buffer {
  if (n < 24) return Buffer.from([(major << 5) | n]);
  if (n < 256) return Buffer.from([(major << 5) | 24, n]);
  return Buffer.from([(major << 5) | 25, n >> 8, n & 255]);
}
const cText = (text: string): Buffer =>
  Buffer.concat([head(3, Buffer.byteLength(text)), Buffer.from(text)]);
const cBytes = (bytes: Uint8Array): Buffer => Buffer.concat([head(2, bytes.length), bytes]);
const cInt = (n: number): Buffer => (n >= 0 ? head(0, n) : head(1, -1 - n));
const cMap = (pairs: Array<[Buffer, Buffer]>): Buffer =>
  Buffer.concat([head(5, pairs.length), ...pairs.flatMap(([k, v]) => [k, v])]);

type Credential = {
  id: Buffer;
  privateKey: KeyObject;
  x: Buffer;
  y: Buffer;
  counter: number;
  userHandle: Buffer;
};

/**
 * A credential written down so another process can use it: the e2e global setup creates passkeys
 * over the API, and the specs load the same keys into Chrome's virtual authenticator (CDP
 * `WebAuthn.addCredential`, which takes standard base64) or sign in over the API again.
 */
export type ExportedCredential = {
  /** Standard base64 of the credential id (the server's id is its base64url form). */
  credentialId: string;
  /** PKCS#8, standard base64. */
  privateKey: string;
  userHandle: string;
  rpId: string;
};

export type SoftOptions = {
  /** The origin the "browser" claims in clientDataJSON. Defaults to the authenticator's own. */
  origin?: string;
  /** Overrides the signature counter written into this one answer. */
  counter?: number;
  /** Flips a byte of the signature, so verification must fail. */
  breakSignature?: boolean;
};

export class SoftAuthenticator {
  readonly credentials: Array<Credential> = [];

  /** `rpId` and `origin`: the site this authenticator is used on, e.g. localhost and https://localhost. */
  constructor(
    readonly origin: string,
    readonly rpId: string = new URL(origin).hostname,
  ) {}

  private clientData(type: string, challenge: string, origin?: string): Buffer {
    return Buffer.from(
      JSON.stringify({ type, challenge, origin: origin ?? this.origin, crossOrigin: false }),
    );
  }

  /** What `startRegistration` returns for these options. */
  create(options: Options, extra: SoftOptions = {}): Record<string, unknown> & { id: string } {
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
    const jwk = publicKey.export({ format: 'jwk' });
    const user = (options['user'] as { id?: string } | undefined)?.id;
    const credential: Credential = {
      id: randomBytes(32),
      privateKey,
      x: Buffer.from(jwk.x as string, 'base64url'),
      y: Buffer.from(jwk.y as string, 'base64url'),
      counter: extra.counter ?? 0,
      userHandle: user ? Buffer.from(user, 'base64url') : randomBytes(32),
    };
    this.credentials.push(credential);
    const cose = cMap([
      [cInt(1), cInt(2)],
      [cInt(3), cInt(-7)],
      [cInt(-1), cInt(1)],
      [cInt(-2), cBytes(credential.x)],
      [cInt(-3), cBytes(credential.y)],
    ]);
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(credential.counter);
    const idLength = Buffer.alloc(2);
    idLength.writeUInt16BE(credential.id.length);
    // flags: user present (1) + user verified (4) + attested credential data (64)
    const authData = Buffer.concat([
      sha256(this.rpId),
      Buffer.from([0x45]),
      counter,
      Buffer.alloc(16),
      idLength,
      credential.id,
      cose,
    ]);
    const attestation = cMap([
      [cText('fmt'), cText('none')],
      [cText('attStmt'), cMap([])],
      [cText('authData'), cBytes(authData)],
    ]);
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    return {
      id: b64u(credential.id),
      rawId: b64u(credential.id),
      response: {
        clientDataJSON: b64u(this.clientData('webauthn.create', options.challenge, extra.origin)),
        attestationObject: b64u(attestation),
        transports: ['internal'],
        publicKeyAlgorithm: -7,
        publicKey: b64u(spki),
        authenticatorData: b64u(authData),
      },
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      type: 'public-key',
    };
  }

  /** What `startAuthentication` returns; picks the credential the options allow (else the last). */
  get(options: Options, extra: SoftOptions = {}): Record<string, unknown> & { id: string } {
    const allowed = options.allowCredentials?.map((item) => item.id);
    const credential = [...this.credentials]
      .reverse()
      .find((item) => !allowed || allowed.includes(b64u(item.id)));
    if (!credential) {
      // What a real browser reports when it holds no matching passkey (or the person closes the prompt).
      const none = new Error('No passkey on this software authenticator');
      none.name = 'NotAllowedError';
      throw none;
    }
    credential.counter = extra.counter ?? credential.counter + 1;
    const counter = Buffer.alloc(4);
    counter.writeUInt32BE(credential.counter);
    // flags: user present (1) + user verified (4)
    const authData = Buffer.concat([sha256(this.rpId), Buffer.from([0x05]), counter]);
    const clientData = this.clientData('webauthn.get', options.challenge, extra.origin);
    const signature = sign(
      'sha256',
      Buffer.concat([authData, sha256(clientData)]),
      credential.privateKey,
    );
    if (extra.breakSignature)
      signature[signature.length - 1] = (signature[signature.length - 1] ?? 0) ^ 0xff;
    return {
      id: b64u(credential.id),
      rawId: b64u(credential.id),
      response: {
        authenticatorData: b64u(authData),
        clientDataJSON: b64u(clientData),
        signature: b64u(signature),
        userHandle: b64u(credential.userHandle),
      },
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      type: 'public-key',
    };
  }

  /** Every credential, as plain data (see ExportedCredential). */
  export(): Array<ExportedCredential> {
    return this.credentials.map((credential) => ({
      credentialId: credential.id.toString('base64'),
      privateKey: credential.privateKey.export({ type: 'pkcs8', format: 'der' }).toString('base64'),
      userHandle: credential.userHandle.toString('base64'),
      rpId: this.rpId,
    }));
  }

  /** An authenticator holding credentials written by `export()`; it can sign in, not register. */
  static from(origin: string, exported: ReadonlyArray<ExportedCredential>): SoftAuthenticator {
    const soft = new SoftAuthenticator(origin, exported[0]?.rpId);
    for (const item of exported) {
      soft.credentials.push({
        id: Buffer.from(item.credentialId, 'base64'),
        privateKey: createPrivateKey({
          key: Buffer.from(item.privateKey, 'base64'),
          format: 'der',
          type: 'pkcs8',
        }),
        x: Buffer.alloc(0),
        y: Buffer.alloc(0),
        counter: 0,
        userHandle: Buffer.from(item.userHandle, 'base64'),
      });
    }
    return soft;
  }

  /** The id of the newest credential, as the server and the browser call it. */
  get lastId(): string {
    const last = this.credentials[this.credentials.length - 1];
    if (!last) throw new Error('No passkey yet');
    return b64u(last.id);
  }
}
