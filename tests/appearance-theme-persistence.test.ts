import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Backing in-memory tables for DatabaseService mock
const dbTables = {
  workspaces: new Map<string, any>()
};

vi.mock('better-sqlite3', () => {
  return {
    default: class MockBetterSqlite3 {
      constructor() {}
      pragma() {}
      exec() {}
      close() {}
      prepare(sql: string) {
        const normalized = sql.replace(/\s+/g, ' ').trim();
        return {
          run: (...params: any[]) => {
            if (normalized.includes('INSERT INTO workspaces')) {
              const [id, name, ui_mode, theme, auto_index, file_icon_theme, created_at, updated_at] = params;
              dbTables.workspaces.set(id, {
                id,
                name,
                ui_mode,
                theme,
                auto_index,
                file_icon_theme,
                created_at,
                updated_at,
                layout_json: '{}'
              });
            } else if (normalized.includes('UPDATE workspaces SET ui_mode')) {
              const id = params[params.length - 1];
              const [
                ui_mode,
                theme,
                auto_index,
                current_project_id,
                file_icon_theme,
                show_git_file_colors,
                discord_rpc_enabled,
                discord_client_id,
                updated_at
              ] = params;
              const current = dbTables.workspaces.get(id) || { id };
              dbTables.workspaces.set(id, {
                ...current,
                ui_mode,
                theme,
                auto_index,
                current_project_id,
                file_icon_theme,
                show_git_file_colors,
                discord_rpc_enabled,
                discord_client_id,
                updated_at
              });
            }
            return { changes: 1 };
          },
          get: (...params: any[]) => {
            if (normalized.includes('SELECT * FROM workspaces LIMIT 1')) {
              return Array.from(dbTables.workspaces.values())[0] || null;
            }
            return null;
          },
          all: () => []
        };
      }
    }
  };
});

describe('Appearance & Theme Persistence Architecture', () => {
  let dbService: typeof import('../src/main/db/database.service').databaseService;
  let tempDir: string;

  beforeEach(async () => {
    vi.resetModules();
    dbTables.workspaces.clear();
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'orbito-theme-test-'));
    const mod = await import('../src/main/db/database.service');
    dbService = mod.databaseService;
    dbService.initialize(tempDir);
  });

  afterEach(() => {
    try {
      dbService.close();
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch {}
  });

  it('initializes new workspaces with default theme [glass] and fileIconTheme [material]', () => {
    const settings = dbService.getSettings();
    expect(settings.theme).toBe('glass');
    expect(settings.fileIconTheme).toBe('material');
  });

  it('preserves existing [glass] theme selection without alteration', () => {
    dbTables.workspaces.set('default-workspace', {
      id: 'default-workspace',
      name: 'Existing Workspace',
      ui_mode: 'simple',
      theme: 'glass',
      auto_index: 1,
      file_icon_theme: 'material'
    });

    const settings = dbService.getSettings();
    expect(settings.theme).toBe('glass');
    expect(settings.fileIconTheme).toBe('material');
  });

  it('preserves existing [solid] theme selection without alteration', () => {
    dbTables.workspaces.set('default-workspace', {
      id: 'default-workspace',
      name: 'Existing Solid Workspace',
      ui_mode: 'simple',
      theme: 'solid',
      auto_index: 1,
      file_icon_theme: 'minimal'
    });

    const settings = dbService.getSettings();
    expect(settings.theme).toBe('solid');
    expect(settings.fileIconTheme).toBe('minimal');
  });

  it('successfully updates to and persists first-class [light] theme', () => {
    const updated = dbService.updateSettings({ theme: 'light' });
    expect(updated.theme).toBe('light');

    const freshSettings = dbService.getSettings();
    expect(freshSettings.theme).toBe('light');
  });

  it('safely falls back to [glass] when an invalid or corrupted theme string is loaded', () => {
    dbTables.workspaces.set('default-workspace', {
      id: 'default-workspace',
      name: 'Corrupt Theme Workspace',
      ui_mode: 'simple',
      theme: 'neon-cyberpunk-invalid',
      auto_index: 1,
      file_icon_theme: 'material'
    });

    const settings = dbService.getSettings();
    expect(settings.theme).toBe('glass');
  });

  it('maintains strict independence between application theme and file icon theme updates', () => {
    dbService.updateSettings({ theme: 'light' });
    expect(dbService.getSettings().theme).toBe('light');
    expect(dbService.getSettings().fileIconTheme).toBe('material');

    // Updating file icon theme leaves application theme unchanged
    dbService.updateSettings({ fileIconTheme: 'minimal' });
    expect(dbService.getSettings().theme).toBe('light');
    expect(dbService.getSettings().fileIconTheme).toBe('minimal');

    // Updating application theme leaves file icon theme unchanged
    dbService.updateSettings({ theme: 'solid' });
    expect(dbService.getSettings().theme).toBe('solid');
    expect(dbService.getSettings().fileIconTheme).toBe('minimal');
  });
});
