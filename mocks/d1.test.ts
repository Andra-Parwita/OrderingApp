// @vitest-environment node
// What is specific to D1: the migration splitter, the dev-tools guard and the
// database-level caps. The rest of the behaviour is covered by the suites that use mocks/impl.ts.
import { describe, expect, it } from 'vitest';
import { splitStatements } from '../worker/db/migrate';
import { createD1Repository } from '../worker/db';
import type { D1Like } from '../worker/db/d1';

describe('splitStatements', () => {
  it('splits on semicolons at line ends and keeps a trigger body whole', () => {
    const sql = [
      '-- a comment',
      'CREATE TABLE a (',
      '  x INTEGER, -- not a full-line comment',
      '  y TEXT',
      ') STRICT;',
      '',
      'CREATE TRIGGER t AFTER INSERT ON a',
      'BEGIN',
      '  DELETE FROM a WHERE x = 1;',
      '  DELETE FROM a WHERE x = 2;',
      'END;',
      'CREATE INDEX i ON a (x);',
    ].join('\n');
    const statements = splitStatements(sql);
    expect(statements).toHaveLength(3);
    expect(statements[1]).toContain('DELETE FROM a WHERE x = 2;');
    expect(statements[1]?.endsWith('END;')).toBe(true);
  });

  it('refuses a migration that stops mid-statement', () => {
    expect(() => splitStatements('CREATE TABLE a (x INTEGER')).toThrow();
  });
});

describe('dev tools guard', () => {
  it('refuses reset and sample orders unless the repository was built with devTools', async () => {
    const never: D1Like = {
      prepare: () => {
        throw new Error('the database must not be touched');
      },
      batch: () => Promise.reject(new Error('the database must not be touched')),
    };
    const repo = createD1Repository(never, { now: () => new Date(), adminSetupKey: 'x' });
    await expect(repo.dev.reset()).rejects.toThrow('Dev tools are off');
    await expect(repo.dev.addSampleOrders('seller-onde-onde', 1)).rejects.toThrow(
      'Dev tools are off',
    );
  });
});
