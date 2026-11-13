import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { SymbolsFolderIcon } from '../src/renderer/src/utils/symbols-folder-icons';
import { FileIcon } from '../src/renderer/src/utils/file-icons';
import { useWorkspaceStore } from '../src/renderer/src/stores/workspace.store';

describe('Symbols Folder Icon System (Miguel Solorio Style)', () => {
  it('renders closed generic folder with clean outline stroke', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="random-folder" isExpanded={false} />);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('stroke="currentColor"');
    expect(html).toContain('stroke-width="1.75"');
  });

  it('renders open generic folder with expanded flap geometry', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="random-folder" isExpanded={true} />);
    expect(html).toContain('viewBox="0 0 24 24"');
    expect(html).toContain('fill-opacity="0.25"');
    expect(html).toContain('fill-opacity="0.15"');
  });

  it('renders specialized badge for src folder', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="src" isExpanded={false} />);
    expect(html).toContain('stroke="#EAB308"'); // Amber code glyph < / >
    expect(html).toContain('clip-rule="evenodd"'); // Folder cutout
  });

  it('renders specialized badge for components folder', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="components" isExpanded={false} />);
    expect(html).toContain('fill="#3B82F6"'); // Blue UI tiles
    expect(html).toContain('rect');
  });

  it('renders specialized badge for utils folder', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="utils" isExpanded={false} />);
    expect(html).toContain('fill="#C084FC"'); // Purple wrench
  });

  it('renders specialized badge for test folder', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="__tests__" isExpanded={false} />);
    expect(html).toContain('stroke="#F43F5E"'); // Rose test flask
  });

  it('renders specialized badge for agents folder (Orbito special)', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name=".agents" isExpanded={false} />);
    expect(html).toContain('fill="#A855F7"'); // Violet AI agent sparkle
  });

  it('renders specialized badge for database folder', () => {
    const html = renderToStaticMarkup(<SymbolsFolderIcon name="database" isExpanded={false} />);
    expect(html).toContain('stroke="#06B6D4"'); // Cyan database cylinders
  });

  it('integrates seamlessly into FileIcon for directories', () => {
    const closedHtml = renderToStaticMarkup(
      <FileIcon name="src" isDirectory={true} isExpanded={false} theme="symbols" />
    );
    expect(closedHtml).toContain('stroke="#EAB308"');

    const openHtml = renderToStaticMarkup(
      <FileIcon name="src" isDirectory={true} isExpanded={true} theme="symbols" />
    );
    expect(openHtml).toContain('stroke="#EAB308"');
  });

  it('workspace store supports symbols fileIconTheme and defaults to symbols', () => {
    const state = useWorkspaceStore.getState();
    expect(state.fileIconTheme).toBe('symbols');

    state.setFileIconTheme('minimal');
    expect(useWorkspaceStore.getState().fileIconTheme).toBe('minimal');

    state.setFileIconTheme('symbols');
    expect(useWorkspaceStore.getState().fileIconTheme).toBe('symbols');
  });
});
