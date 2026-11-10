import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { useWorkspaceStore } from './stores/workspace.store';

if (typeof window !== 'undefined') {
  (window as any).__WORKSPACE_STORE__ = useWorkspaceStore;
}

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
