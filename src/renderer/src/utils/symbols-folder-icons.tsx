import React from 'react';

export interface SymbolsFolderIconProps {
  name: string;
  isExpanded?: boolean;
  className?: string;
}

/**
 * Miguel Solorio Symbols-inspired folder icon system.
 * Minimalist, stroke-driven geometry with contextual bottom-right badges
 * and distinct closed/open states.
 */
export const SymbolsFolderIcon: React.FC<SymbolsFolderIconProps> = ({
  name,
  isExpanded = false,
  className = 'w-3.5 h-3.5 flex-shrink-0'
}) => {
  const lower = name.toLowerCase().replace(/\/$/, '').trim();

  // 1. Resolve contextual category
  let category: string | null = null;

  if (['src', 'source', 'sources'].includes(lower)) {
    category = 'src';
  } else if (['components', 'component', 'widgets', 'ui'].includes(lower)) {
    category = 'components';
  } else if (['pages', 'screens', 'views', 'routes', 'app', 'layouts', 'router'].includes(lower)) {
    category = 'pages';
  } else if (['assets', 'images', 'img', 'static', 'public', 'media', 'icons'].includes(lower)) {
    category = 'assets';
  } else if (['utils', 'util', 'lib', 'helpers', 'tools'].includes(lower)) {
    category = 'utils';
  } else if (['hooks'].includes(lower)) {
    category = 'hooks';
  } else if (['services', 'service', 'api', 'network', 'http'].includes(lower)) {
    category = 'api';
  } else if (['store', 'stores', 'state', 'context', 'redux', 'zustand'].includes(lower)) {
    category = 'store';
  } else if (['styles', 'style', 'css', 'scss', 'sass', 'less'].includes(lower)) {
    category = 'styles';
  } else if (['docs', 'doc', 'documentation', 'wiki'].includes(lower)) {
    category = 'docs';
  } else if (['config', 'configs', 'settings', '.vscode', '.idea', '.cursor'].includes(lower)) {
    category = 'config';
  } else if (['node_modules'].includes(lower)) {
    category = 'node_modules';
  } else if (['.git', '.github', 'git'].includes(lower)) {
    category = 'git';
  } else if (['scripts', 'bin'].includes(lower)) {
    category = 'scripts';
  } else if (['test', 'tests', 'spec', 'specs', '__tests__', 'e2e'].includes(lower)) {
    category = 'test';
  } else if (['db', 'database', 'prisma', 'drizzle', 'sql', 'migrations'].includes(lower)) {
    category = 'database';
  } else if (['types', 'interfaces', '@types'].includes(lower)) {
    category = 'types';
  } else if (['agents', '.agents', 'orchestrator', 'workflows', 'prompts'].includes(lower)) {
    category = 'agents';
  } else if (['auth', 'security', 'cert'].includes(lower)) {
    category = 'auth';
  } else if (['build', 'dist', 'out', 'target'].includes(lower)) {
    category = 'build';
  } else if (['locales', 'i18n', 'lang', 'translations'].includes(lower)) {
    category = 'locales';
  }

  // 2. Default generic folder (No contextual badge)
  if (!category) {
    if (isExpanded) {
      // Symbols Open Folder: Back tab + tilted front pocket
      return (
        <svg
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={className}
        >
          {/* Back tab */}
          <path
            d="M4 6C4 5.44772 4.44772 5 5 5H7.78388C8.2469 5 8.69558 5.16065 9.05336 5.45455L11.4466 7.42045C11.8044 7.71435 12.2531 7.875 12.7161 7.875H19C19.5523 7.875 20 8.32272 20 8.875V11H4V6Z"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="1.6"
            className="text-neutral-400"
          />
          {/* Tilted front flap */}
          <path
            d="M2.5 11.5C2.5 10.9477 2.94772 10.5 3.5 10.5H20.5C21.0523 10.5 21.5 10.9477 21.5 11.5L19.8 17.5C19.65 18.05 19.15 18.5 18.58 18.5H5.42C4.85 18.5 4.35 18.05 4.2 17.5L2.5 11.5Z"
            fill="currentColor"
            fillOpacity="0.15"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
            className="text-neutral-300"
          />
        </svg>
      );
    }

    // Symbols Closed Folder: Crisp minimalist stroke outline
    return (
      <svg
        viewBox="0 0 24 24"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
      >
        <path
          d="M7.78388 5H5C3.89543 5 3 5.89543 3 7V17C3 18.1046 3.89543 19 5 19H19C20.1046 19 21 18.1046 21 17V9.875C21 8.77043 20.1046 7.875 19 7.875H12.7161C12.2531 7.875 11.8044 7.71435 11.4466 7.42045L9.05336 5.45455C8.69558 5.16065 8.2469 5 7.78388 5Z"
          stroke="currentColor"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="text-neutral-400 group-hover:text-neutral-300"
        />
      </svg>
    );
  }

  // 3. Contextual Folders with Bottom-Right Badges
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Base folder body with bottom-right badge cutout */}
      {isExpanded ? (
        // Open folder base with cutout
        <g className="text-neutral-300">
          <path
            d="M4 6C4 5.44772 4.44772 5 5 5H7.78388C8.2469 5 8.69558 5.16065 9.05336 5.45455L11.4466 7.42045C11.8044 7.71435 12.2531 7.875 12.7161 7.875H19C19.5523 7.875 20 8.32272 20 8.875V10H4V6Z"
            fill="currentColor"
            fillOpacity="0.25"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M5 4C3.34315 4 2 5.34315 2 7V17C2 18.6569 3.34315 20 5 20H13V18H5C4.44772 18 4 17.5523 4 17V7C4 6.44772 4.44772 6 5 6H7.78388C8.01539 6 8.23973 6.08033 8.41862 6.22727L10.8119 8.19318C11.3486 8.63402 12.0216 8.875 12.7161 8.875H19C19.5523 8.875 20 9.32272 20 9.875V10H22V9.875C22 8.21815 20.6569 6.875 19 6.875H12.7161C12.4846 6.875 12.2603 6.79467 12.0814 6.64773L9.6881 4.68182C9.15142 4.24098 8.47841 4 7.78388 4H5Z"
            fill="currentColor"
            fillOpacity="0.9"
          />
        </g>
      ) : (
        // Closed folder base with cutout
        <path
          fillRule="evenodd"
          clipRule="evenodd"
          d="M5 4C3.34315 4 2 5.34315 2 7V17C2 18.6569 3.34315 20 5 20H13V18H5C4.44772 18 4 17.5523 4 17V7C4 6.44772 4.44772 6 5 6H7.78388C8.01539 6 8.23973 6.08033 8.41862 6.22727L10.8119 8.19318C11.3486 8.63402 12.0216 8.875 12.7161 8.875H19C19.5523 8.875 20 9.32272 20 9.875V10H22V9.875C22 8.21815 20.6569 6.875 19 6.875H12.7161C12.4846 6.875 12.2603 6.79467 12.0814 6.64773L9.6881 4.68182C9.15142 4.24098 8.47841 4 7.78388 4H5Z"
          fill="currentColor"
          className="text-neutral-400 group-hover:text-neutral-300"
        />
      )}

      {/* Contextual Badge Glyphs */}
      {category === 'src' && (
        <g>
          <path
            d="M15.5 13.5L13.5 15.5L15.5 17.5"
            stroke="#EAB308"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M21.5 13.5L23.5 15.5L21.5 17.5"
            stroke="#EAB308"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M17 18.5L20 12.5"
            stroke="#EAB308"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </g>
      )}

      {category === 'components' && (
        <g fill="#3B82F6">
          <rect x="15" y="12" width="2.8" height="2.8" rx="0.6" />
          <rect x="19.2" y="12" width="2.8" height="2.8" rx="0.6" />
          <rect x="15" y="16.2" width="2.8" height="2.8" rx="0.6" />
          <rect x="19.2" y="16.2" width="2.8" height="2.8" rx="0.6" />
        </g>
      )}

      {category === 'pages' && (
        <g>
          <rect
            x="14"
            y="11.5"
            width="9"
            height="7.5"
            rx="1.5"
            stroke="#0EA5E9"
            strokeWidth="1.3"
            fill="none"
          />
          <line x1="14" y1="14" x2="23" y2="14" stroke="#0EA5E9" strokeWidth="1.2" />
          <circle cx="16" cy="12.8" r="0.6" fill="#0EA5E9" />
          <circle cx="18" cy="12.8" r="0.6" fill="#0EA5E9" />
        </g>
      )}

      {category === 'assets' && (
        <g>
          <rect x="14" y="11" width="3.8" height="3.8" rx="0.8" fill="#0D9488" />
          <circle cx="21" cy="18" r="2" fill="#3B82F6" />
          <path d="M16 16.5L17.7 19.5H14.3L16 16.5Z" fill="#22D3EE" />
          <circle cx="21" cy="12.5" r="1.5" fill="#C084FC" />
        </g>
      )}

      {category === 'utils' && (
        <g fill="#C084FC">
          <path d="M23.5 13.5C22.8 14.2 21.8 14.5 21.2 14.2C20.6 13.9 20.4 13.1 20.8 12.5C21.1 11.9 20.6 11.2 19.8 11.5C18.5 12 17.5 13.2 17.5 14.6C17.5 15.1 17.7 15.5 18 15.9L15.2 18.7C14.8 19.1 14.8 19.7 15.2 20.1C15.6 20.5 16.2 20.5 16.6 20.1L19.4 17.3C19.8 17.6 20.2 17.8 20.7 17.8C22.1 17.8 23.3 16.8 23.8 15.5C24.1 14.7 23.4 14.2 22.8 14.5" />
        </g>
      )}

      {category === 'hooks' && (
        <g stroke="#8B5CF6">
          <path
            d="M16 19.5C16 20.85 17.1 21.95 18.45 21.95C19.8 21.95 20.9 20.85 20.9 19.5V16"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <path
            d="M16 19.5V16.9L17.7 18.6"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="20.9" cy="14" r="1.6" fill="#8B5CF6" stroke="none" />
        </g>
      )}

      {category === 'api' && (
        <g>
          <path
            d="M19 11L15 16.5H19L18 21.5L22.5 15.5H18.5L19 11Z"
            fill="#14B8A6"
            stroke="#14B8A6"
            strokeWidth="0.5"
            strokeLinejoin="round"
          />
        </g>
      )}

      {category === 'store' && (
        <g fill="#8B5CF6">
          <path d="M18.5 12L14.5 14L18.5 16L22.5 14L18.5 12Z" />
          <path
            d="M14.5 16L18.5 18L22.5 16"
            stroke="#8B5CF6"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
          <path
            d="M14.5 18.5L18.5 20.5L22.5 18.5"
            stroke="#8B5CF6"
            strokeWidth="1.4"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}

      {category === 'styles' && (
        <g>
          <path
            d="M18.5 11.5C16.3 11.5 14.5 13.3 14.5 15.5C14.5 17.5 16.5 18.5 17.2 19.5C17.5 20 17.5 20.5 18.5 20.5C20.7 20.5 22.5 18.7 22.5 16.5C22.5 13.7 20.7 11.5 18.5 11.5Z"
            stroke="#EC4899"
            strokeWidth="1.4"
            fill="none"
          />
          <circle cx="17" cy="14" r="0.7" fill="#EC4899" />
          <circle cx="19.5" cy="14" r="0.7" fill="#EC4899" />
          <circle cx="20.5" cy="16.5" r="0.7" fill="#EC4899" />
        </g>
      )}

      {category === 'docs' && (
        <g>
          <rect
            x="15"
            y="11.5"
            width="7"
            height="9"
            rx="1"
            stroke="#F59E0B"
            strokeWidth="1.4"
            fill="none"
          />
          <line x1="17" y1="14" x2="20" y2="14" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="17" y1="16.5" x2="20" y2="16.5" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
          <line x1="17" y1="19" x2="19" y2="19" stroke="#F59E0B" strokeWidth="1.2" strokeLinecap="round" />
        </g>
      )}

      {category === 'config' && (
        <g stroke="#0EA5E9">
          <circle cx="18.5" cy="16" r="2" strokeWidth="1.5" fill="none" />
          <path
            d="M18.5 12.5V13.5M18.5 18.5V19.5M15 16H16M21 16H22M16 13.5L16.8 14.3M20.2 17.7L21 18.5M16 18.5L16.8 17.7M20.2 14.3L21 13.5"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </g>
      )}

      {category === 'node_modules' && (
        <g stroke="#94A3B8">
          <path
            d="M18.5 12L22.5 14.2V18.8L18.5 21L14.5 18.8V14.2L18.5 12Z"
            strokeWidth="1.3"
            fill="none"
          />
          <line x1="18.5" y1="12" x2="18.5" y2="21" strokeWidth="1.2" />
          <line x1="14.5" y1="14.2" x2="18.5" y2="16.5" strokeWidth="1.2" />
          <line x1="22.5" y1="14.2" x2="18.5" y2="16.5" strokeWidth="1.2" />
        </g>
      )}

      {category === 'git' && (
        <g>
          <circle cx="16" cy="14" r="1.3" fill="#F97316" />
          <circle cx="16" cy="19" r="1.3" fill="#F97316" />
          <circle cx="21" cy="15" r="1.3" fill="#F97316" />
          <path
            d="M16 15.3V17.7M16 16.5C18 16.5 19.5 15.8 20 15.2"
            stroke="#F97316"
            strokeWidth="1.3"
            strokeLinecap="round"
            fill="none"
          />
        </g>
      )}

      {category === 'scripts' && (
        <g stroke="#22C55E">
          <path
            d="M14.5 13.5L17.5 16L14.5 18.5"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <line x1="18.5" y1="18.5" x2="22.5" y2="18.5" strokeWidth="1.5" strokeLinecap="round" />
        </g>
      )}

      {category === 'test' && (
        <g stroke="#F43F5E">
          <path
            d="M17.5 11H20.5M19 11V14.5L22 19.5C22.5 20.3 21.9 21.5 20.9 21.5H17.1C16.1 21.5 15.5 20.3 16 19.5L19 14.5"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          <circle cx="19" cy="18" r="0.8" fill="#F43F5E" stroke="none" />
        </g>
      )}

      {category === 'database' && (
        <g stroke="#06B6D4">
          <ellipse cx="18.5" cy="13.5" rx="3.5" ry="1.5" strokeWidth="1.3" fill="none" />
          <path
            d="M15 13.5V18.5C15 19.3 16.6 20 18.5 20C20.4 20 22 19.3 22 18.5V13.5"
            strokeWidth="1.3"
            fill="none"
          />
          <path
            d="M15 16C15 16.8 16.6 17.5 18.5 17.5C20.4 17.5 22 16.8 22 16"
            strokeWidth="1.2"
            fill="none"
          />
        </g>
      )}

      {category === 'types' && (
        <g>
          <rect x="14.5" y="12" width="8" height="8" rx="1.5" fill="#3B82F6" />
          <path d="M16.5 14H20.5M18.5 14V18" stroke="#FFFFFF" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}

      {category === 'agents' && (
        <g fill="#A855F7">
          <path d="M18.5 11.5L19.5 14.5L22.5 15.5L19.5 16.5L18.5 19.5L17.5 16.5L14.5 15.5L17.5 14.5L18.5 11.5Z" />
          <circle cx="15.5" cy="12.5" r="0.8" fill="#C084FC" />
        </g>
      )}

      {category === 'auth' && (
        <g>
          <rect
            x="15"
            y="14.5"
            width="7"
            height="6"
            rx="1.2"
            stroke="#F59E0B"
            strokeWidth="1.3"
            fill="#F59E0B"
            fillOpacity="0.2"
          />
          <path
            d="M16.5 14.5V13C16.5 11.9 17.4 11 18.5 11C19.6 11 20.5 11.9 20.5 13V14.5"
            stroke="#F59E0B"
            strokeWidth="1.3"
            fill="none"
          />
        </g>
      )}

      {category === 'build' && (
        <g stroke="#FBBF24">
          <path d="M14.5 13.5H22.5V20H14.5V13.5Z" strokeWidth="1.3" fill="none" />
          <line x1="14.5" y1="15.5" x2="22.5" y2="15.5" strokeWidth="1.2" />
          <path d="M17.5 17.5H19.5" strokeWidth="1.4" strokeLinecap="round" />
        </g>
      )}

      {category === 'locales' && (
        <g stroke="#3B82F6">
          <circle cx="18.5" cy="16" r="3.5" strokeWidth="1.3" fill="none" />
          <ellipse cx="18.5" cy="16" rx="1.6" ry="3.5" strokeWidth="1.2" fill="none" />
          <line x1="15" y1="16" x2="22" y2="16" strokeWidth="1.2" />
        </g>
      )}
    </svg>
  );
};

export default SymbolsFolderIcon;
