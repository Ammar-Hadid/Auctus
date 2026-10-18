import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it, expect } from 'vitest';
import { openDatabase } from '../src/server/db/connection';

describe('persistent foundation', () => {
  it('migrates idempotently and preserves settings after reopening the disk database', () => {
    const dir = mkdtempSync(join(tmpdir(), 'auctus-'));
    const file = join(dir, 'test.db');
    try {
      const first = openDatabase(file);
      first.sqlite.prepare('INSERT INTO settings (id, selected_program_id) VALUES (1, NULL)').run();
      expect(first.sqlite.pragma('foreign_keys', { simple: true })).toBe(1);
      first.sqlite.close();
      const reopened = openDatabase(file);
      expect(reopened.sqlite.prepare('SELECT id FROM settings').get()).toEqual({ id: 1 });
      expect(reopened.sqlite.pragma('integrity_check', { simple: true })).toBe('ok');
      reopened.sqlite.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
