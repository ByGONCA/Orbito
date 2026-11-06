import React from 'react';
import {
  Folder,
  FolderOpen,
  FolderGit2,
  FolderCode,
  FolderArchive,
  FolderCog,
  FileCode,
  FileText,
  FileJson,
  FileImage,
  FileAudio,
  FileVideo,
  FileKey,
  FileArchive,
  File,
  Terminal,
  Database,
  Layers,
  Palette,
  Wrench,
  Globe,
  Component,
  FlaskConical,
  BookOpen,
  Package
} from 'lucide-react';
import { Devicon } from './devicon-svgs';

export type FileIconTheme = 'material' | 'minimal';

interface FileIconProps {
  name: string;
  isDirectory: boolean;
  isExpanded?: boolean;
  theme?: FileIconTheme;
  className?: string;
}

export const FileIcon: React.FC<FileIconProps> = ({
  name,
  isDirectory,
  isExpanded = false,
  theme = 'material',
  className = 'w-3.5 h-3.5 flex-shrink-0'
}) => {
  const lowerName = name.toLowerCase();

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

  // 2. MATERIAL VS CODE ICON THEME (Rich semantic colors & shapes)
  if (isDirectory) {
    if (['src', 'source', 'sources'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#38BDF8]`} />
      ) : (
        <FolderCode className={`${className} text-[#38BDF8]`} />
      );
    }
    if (['components', 'component', 'widgets', 'views'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#06B6D4]`} />
      ) : (
        <Folder className={`${className} text-[#06B6D4]`} />
      );
    }
    if (['pages', 'screens', 'layouts', 'routes'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#A855F7]`} />
      ) : (
        <Folder className={`${className} text-[#A855F7]`} />
      );
    }
    if (['assets', 'images', 'img', 'static', 'public', 'icons'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#10B981]`} />
      ) : (
        <Folder className={`${className} text-[#10B981]`} />
      );
    }
    if (['test', 'tests', '__tests__', 'spec', 'specs', 'e2e'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#F43F5E]`} />
      ) : (
        <Folder className={`${className} text-[#F43F5E]`} />
      );
    }
    if (['docs', 'doc', 'documentation'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#F59E0B]`} />
      ) : (
        <Folder className={`${className} text-[#F59E0B]`} />
      );
    }
    if (['styles', 'style', 'css', 'scss'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#EC4899]`} />
      ) : (
        <Folder className={`${className} text-[#EC4899]`} />
      );
    }
    if (['utils', 'util', 'lib', 'helpers', 'tools'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#EAB308]`} />
      ) : (
        <Folder className={`${className} text-[#EAB308]`} />
      );
    }
    if (['api', 'services', 'service', 'network'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#14B8A6]`} />
      ) : (
        <Folder className={`${className} text-[#14B8A6]`} />
      );
    }
    if (['store', 'stores', 'state', 'redux', 'context'].includes(lowerName)) {
      return isExpanded ? (
        <FolderOpen className={`${className} text-[#8B5CF6]`} />
      ) : (
        <Folder className={`${className} text-[#8B5CF6]`} />
      );
    }
    if (['node_modules'].includes(lowerName)) {
      return <Folder className={`${className} text-[#64748B]`} />;
    }
    if (['.git', '.github'].includes(lowerName)) {
      return <FolderGit2 className={`${className} text-[#F97316]`} />;
    }
    if (['.vscode', '.idea', 'config', 'configs'].includes(lowerName)) {
      return <FolderCog className={`${className} text-[#3B82F6]`} />;
    }

    // Default warm folder
    return isExpanded ? (
      <FolderOpen className={`${className} text-[#FBBF24]`} />
    ) : (
      <Folder className={`${className} text-[#E5A93C]`} />
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
