/// <reference types="vite/client" />
import type { IElectronAPI } from '../../shared/ipc';

declare global {
  interface Window {
    api: IElectronAPI;
  }
}
