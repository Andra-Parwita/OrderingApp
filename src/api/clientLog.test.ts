import { describe, expect, it } from 'vitest';
import { agentOf, createClientLog, type ClientLogDeps } from './clientLog';

function setup(enabled = true) {
  const bodies: Array<string> = [];
  const deps: ClientLogDeps = {
    enabled,
    send: (body) => bodies.push(body),
    context: () => ({
      app: 'customer',
      version: 'dev',
      slug: null,
      path: '/o/AbCdEf1234567890xyzAB',
      agent: 'Safari iOS 17',
      standalone: false,
    }),
    later: () => undefined,
  };
  const log = createClientLog(deps);
  const sent = () => bodies.flatMap((b) => (JSON.parse(b) as { entries: Array<unknown> }).entries);
  return { log, bodies, sent };
}

const report = { kind: 'api_error' as const, code: 'server_error', message: 'HTTP 500' };

describe('client log sender', () => {
  it('turns a failure into one entry and drops repeats', () => {
    const { log, sent } = setup();
    log.report(report);
    log.report(report);
    log.flush();
    expect(sent()).toHaveLength(1);
  });

  it('never sends a token, an email or a query string', () => {
    const { log, bodies } = setup();
    log.report({ ...report, message: 'x@y.com token=abc' });
    log.flush();
    expect(bodies.join()).not.toMatch(/AbCdEf|x@y\.com|abc/);
  });

  it('sends at most 5 per call and 20 per page load', () => {
    const { log, bodies, sent } = setup();
    for (let n = 0; n < 30; n += 1) log.report({ ...report, message: `m${String(n)}` });
    log.flush();
    expect(sent()).toHaveLength(20);
    expect(bodies).toHaveLength(4);
  });

  it('does nothing when off', () => {
    const { log, bodies } = setup(false);
    log.report(report);
    log.flush();
    expect(bodies).toHaveLength(0);
  });

  it('reduces a user agent to family and OS', () => {
    expect(
      agentOf(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
      ),
    ).toBe('Safari iOS 17');
  });
});
