import React from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileImage,
  FileAudio,
  FileVideo,
  FileKey,
  FileArchive,
  File,
  Package
} from 'lucide-react';
import { Devicon } from './devicon-svgs';
import { useWorkspaceStore } from '../stores/workspace.store';
import { SymbolsFolderIcon } from './symbols-folder-icons';

export type FileIconTheme = 'symbols' | 'material' | 'minimal' | 'vscode';

interface FileIconProps {
  name: string;
  isDirectory: boolean;
  isExpanded?: boolean;
  theme?: FileIconTheme;
  className?: string;
  customIcons?: Record<string, string>;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  isDirectory,
  isExpanded = false,
  theme = 'vscode',
  className = 'w-3.5 h-3.5 flex-shrink-0',
  customIcons
}) => {
  const lowerName = name.toLowerCase();
  const storeCustomIcons = useWorkspaceStore((state) => state.project?.settings?.customFileIcons);
  const activeCustomIcons = customIcons || storeCustomIcons;

  // Custom user-defined file icon override (by extension or exact name)
  if (!isDirectory && activeCustomIcons) {
    const ext = lowerName.includes('.') ? lowerName.split('.').pop() || '' : '';
    const customIcon =
      activeCustomIcons[ext] ||
      activeCustomIcons[`.${ext}`] ||
      activeCustomIcons[lowerName];

    if (customIcon) {
      return (
        <img
          src={customIcon}
          alt={ext || name}
          className={`${className} object-contain rounded-[2px]`}
          onError={(e) => {
            (e.target as HTMLElement).style.display = 'none';
          }}
        />
      );
    }
  }

  // 1. MINIMAL MONOCHROME THEME
  if (theme === 'minimal') {
    if (isDirectory) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#ECEDEF]`} />
      ) : (
        <Folder className={`${className} text-[#A4A8AF]`} />
      );
    }
    const ext = lowerName.split('.').pop() || '';
    if (['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go', 'html', 'css', 'json', 'sql', 'sh'].includes(ext)) {
      return <FileCode className={`${className} text-[#A4A8AF]`} />;
    }
    if (['md', 'txt', 'doc', 'pdf'].includes(ext)) {
      return <FileText className={`${className} text-[#747982]`} />;
    }
    return <File className={`${className} text-[#747982]`} />;
  }

  // 2. SYMBOLS / MATERIAL / VSCODE FOLDER ICON SYSTEM (Miguel Solorio Style)
  if (isDirectory) {
    return (
      <SymbolsFolderIcon
        name={name}
        isExpanded={isExpanded}
        className={className}
      />
    );
  }

  // Exact file name matches
  if (['package.json', 'package-lock.json', 'pnpm-lock.yaml', 'yarn.lock'].includes(lowerName)) {
    return <Package className={`${className} text-[#CB3837]`} />;
  }
  if (['dockerfile', 'docker-compose.yml', 'docker-compose.yaml', '.dockerignore'].includes(lowerName)) {
    return <Devicon name="docker" className={className} />;
  }
  if (['.gitignore', '.gitattributes', '.gitmodules'].includes(lowerName)) {
    return <Devicon name="git" className={className} />;
  }
  if (lowerName.startsWith('.env')) {
    return <FileKey className={`${className} text-[#EAB308]`} />;
  }
  if (lowerName.includes('tailwind.config')) {
    return <Devicon name="tailwindcss" className={className} />;
  }
  if (lowerName.includes('tsconfig')) {
    return <Devicon name="typescript" className={className} />;
  }

  // Extensions
  const ext = lowerName.split('.').pop() || '';

  switch (ext) {
    case 'tsx':
      return <Devicon name="react" className={className} />;
    case 'ts':
      return <Devicon name="typescript" className={className} />;
    case 'jsx':
      return <Devicon name="react" className={className} />;
    case 'js':
    case 'mjs':
    case 'cjs':
      return <Devicon name="javascript" className={className} />;
    case 'json':
    case 'jsonc':
    case 'json5':
      return <Devicon name="json" className={className} />;
    case 'html':
    case 'htm':
      return <Devicon name="html5" className={className} />;
    case 'css':
      return <Devicon name="css3" className={className} />;
    case 'scss':
    case 'sass':
    case 'less':
      return <Devicon name="sass" className={className} />;
    case 'py':
      return <Devicon name="python" className={className} />;
    case 'rs':
      return <Devicon name="rust" className={className} />;
    case 'go':
      return <Devicon name="go" className={className} />;
    case 'c':
      return <Devicon name="c" className={className} />;
    case 'cpp':
    case 'cc':
    case 'cxx':
      return <Devicon name="cplusplus" className={className} />;
    case 'cs':
      return <Devicon name="csharp" className={className} />;
    case 'java':
      return <Devicon name="java" className={className} />;
    case 'php':
      return <Devicon name="php" className={className} />;
    case 'rb':
      return <Devicon name="ruby" className={className} />;
    case 'swift':
      return <Devicon name="swift" className={className} />;
    case 'kt':
    case 'kts':
      return <Devicon name="kotlin" className={className} />;
    case 'dart':
      return <Devicon name="dart" className={className} />;
    case 'vue':
      return <Devicon name="vuejs" className={className} />;
    case 'svelte':
      return <Devicon name="svelte" className={className} />;
    case 'md':
    case 'mdx':
      return <Devicon name="markdown" className={className} />;
    case 'sql':
      return <Devicon name="postgresql" className={className} />;
    case 'sqlite':
    case 'db':
      return <Devicon name="sqlite" className={className} />;
    case 'sh':
    case 'bash':
    case 'zsh':
    case 'ps1':
    case 'bat':
    case 'cmd':
      return <Devicon name="bash" className={className} />;
    case 'yml':
    case 'yaml':
      return <Devicon name="yaml" className={className} />;
    case 'graphql':
    case 'gql':
      return <Devicon name="graphql" className={className} />;
    case 'lua':
      return <Devicon name="lua" className={className} />;
    case 'zig':
      return <Devicon name="zig" className={className} />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'svg':
    case 'webp':
    case 'ico':
      return <FileImage className={`${className} text-[#A855F7]`} />;
    case 'mp3':
    case 'wav':
    case 'ogg':
      return <FileAudio className={`${className} text-[#FB7185]`} />;
    case 'mp4':
    case 'mov':
    case 'webm':
      return <FileVideo className={`${className} text-[#FB7185]`} />;
    case 'pdf':
      return <FileText className={`${className} text-[#EF4444]`} />;
    case 'zip':
    case 'tar':
    case 'gz':
    case '7z':
    case 'rar':
      return <FileArchive className={`${className} text-[#F59E0B]`} />;
    case 'txt':
    case 'log':
      return <FileText className={`${className} text-[#94A3B8]`} />;
    default:
      return <File className={`${className} text-[#94A3B8]`} />;
  }
};

export default FileIcon;
