# Decisions

The owner's rulings, numbered and never silently rewritten. When a decision is overturned, amend it and link the new one.

Format for each entry:

```markdown
## D-001 · <title> (YYYY-MM-DD)
**Ruling:** "<the owner's words>"
**Trade-off:** what we gain and what we give up.
**Revisit when:** the trigger that would reopen it.
```

## D-001 · Minimum tech stack (2026-10-06)
**Ruling:** "react, typescript, redux, redux saga, vite … eslint and prettier … make sure there is cyclic import [checking]", plus unit tests and a Playwright harness, with Jest "or any modern test tool".
**Trade-off:** Vitest was chosen over Jest because it shares the Vite config and runs faster, with a Jest-compatible API. Details are in [tech-stack.md](../guide/tech-stack.md).
**Revisit when:** a required tool doesn't work with the Cloudflare Vite plugin.

## D-002 · Always HTTPS in development, with mkcert (2026-10-06)
**Ruling:** "A, go with mkcert, and optional later with C if we have cloudflare configured later" (A = always HTTPS with mkcert; C = Cloudflare tunnel).
**Trade-off:** push, Home Screen install and QR scanning work on phones every day, and dev matches production, all without leaving the LAN. The cost is a one-time root-certificate install on each test phone, The PC's IP `192.168.178.97` is reserved in the router (owner, 2026-10-06), so the certificate doesn't need regenerating.
**Revisit when:** Cloudflare is configured (then add a tunnel or preview deploy for testing away from home), or a phone can't be made to trust the certificate.
