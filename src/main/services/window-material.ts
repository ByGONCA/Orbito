import { BrowserWindow } from 'electron';
import { databaseService } from '../db/database.service';
import { appLogger } from './app-logger';

let currentAppliedMaterial: 'acrylic' | 'none' | null = null;

/**
 * Applies the native Windows 11 backdrop material to an Electron BrowserWindow.
 *
 * CRITICAL RULE:
 * `win.setBackgroundMaterial()` is an OS-level Win32 call (`DwmSetWindowAttribute`)
 * that causes Windows DWM to detach and re-attach the DirectX composition swapchain.
 * Calling this repeatedly or on focus/restore causes visible screen flashing ("piscas")
 * and can choke DWM into dropping frames and falling back to solid gray.
 *
 * We strictly guard against redundant calls using `currentAppliedMaterial`.
 */
export function setWindowMaterial(win: BrowserWindow | null, material?: 'acrylic' | 'none'): void {
  if (!win || win.isDestroyed()) return;
  if (typeof win.setBackgroundMaterial !== 'function') return;

  const currentTheme = databaseService.getSettings()?.theme;
  const isSolid = material ? material === 'none' : currentTheme === 'solid';
  const target: 'acrylic' | 'none' = isSolid ? 'none' : 'acrylic';

  if (currentAppliedMaterial === target) {
    return; // Already applied — do not rebuild DWM swapchain!
  }

  try {
    win.setBackgroundMaterial(target);
    currentAppliedMaterial = target;
    appLogger.info('WindowMaterial', `Applied native window material: ${target}`);
  } catch (err) {
    appLogger.warn('WindowMaterial', `Failed to set background material to ${target}`, err);
  }
}
