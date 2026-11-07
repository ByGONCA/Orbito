const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '..', 'node_modules', '@lobehub', 'icons-static-svg', 'icons');

function cleanSvg(svgContent, compName, defaultFill = '') {
  let inner = svgContent
    .replace(/<\?xml.*?\?>/gi, '')
    .replace(/<title>.*?<\/title>/gi, '')
    .replace(/style="[^"]*"/g, '')
    .replace(/height="[^"]*"/g, '')
    .replace(/width="[^"]*"/g, '');

  const vbMatch = inner.match(/viewBox="([^"]*)"/);
  const viewBox = vbMatch ? vbMatch[1] : '0 0 24 24';

  inner = inner.replace(/<svg[^>]*>/, '').replace(/<\/svg>/, '').trim();

  // JSX attribute conversions
  inner = inner
    .replace(/clip-rule=/g, 'clipRule=')
    .replace(/fill-rule=/g, 'fillRule=')
    .replace(/stop-color=/g, 'stopColor=')
    .replace(/stop-opacity=/g, 'stopOpacity=')
    .replace(/stroke-width=/g, 'strokeWidth=')
    .replace(/stroke-linecap=/g, 'strokeLinecap=')
    .replace(/stroke-linejoin=/g, 'strokeLinejoin=')
    .replace(/stroke-dasharray=/g, 'strokeDasharray=')
    .replace(/color-interpolation-filters=/g, 'colorInterpolationFilters=')
    .replace(/flood-opacity=/g, 'floodOpacity=')
    .replace(/class=/g, 'className=')
    .replace(/xmlns:xlink="[^"]*"/g, '')
    .replace(/xlink:href=/g, 'href=');

  const fillAttr = defaultFill ? ` fill="${defaultFill}"` : '';

  return `// ${compName}
export const ${compName}: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="${viewBox}"
    width={size}
    height={size}
    className={className}${fillAttr}
    xmlns="http://www.w3.org/2000/svg"
  >
    ${inner}
  </svg>
);
`;
}

function getIcon(fname, compName, defaultFill = '') {
  const p = path.join(iconDir, fname);
  if (!fs.existsSync(p)) {
    throw new Error('Missing icon: ' + fname);
  }
  return cleanSvg(fs.readFileSync(p, 'utf8'), compName, defaultFill);
}

const header = `import React from 'react';
import { Globe } from 'lucide-react';

export interface OfficialLogoProps {
  className?: string;
  size?: number | string;
}
`;

// PowerShell
const powershell = `export const PowerShellLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 128 128"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <linearGradient
      id="ps-devicon-bg"
      x1="96.306"
      x2="25.454"
      y1="35.144"
      y2="98.431"
      gradientTransform="matrix(1 0 0 -1 0 128)"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stopColor="#a9c8ff" />
      <stop offset="1" stopColor="#c7e6ff" />
    </linearGradient>
    <path
      fill="url(#ps-devicon-bg)"
      fillRule="evenodd"
      clipRule="evenodd"
      opacity=".85"
      d="M7.2 110.5c-1.7 0-3.1-.7-4.1-1.9-1-1.2-1.3-2.9-.9-4.6l18.6-80.5c.8-3.4 4-6 7.4-6h92.6c1.7 0 3.1.7 4.1 1.9 1 1.2 1.3 2.9.9 4.6l-18.6 80.5c-.8 3.4-4 6-7.4 6H7.2z"
    />
    <linearGradient
      id="ps-devicon-grad"
      x1="25.336"
      x2="94.569"
      y1="98.33"
      y2="36.847"
      gradientTransform="matrix(1 0 0 -1 0 128)"
      gradientUnits="userSpaceOnUse"
    >
      <stop offset="0" stopColor="#2d4664" />
      <stop offset=".169" stopColor="#29405b" />
      <stop offset=".445" stopColor="#1e2f43" />
      <stop offset=".79" stopColor="#0c131b" />
      <stop offset="1" stopColor="#000000" />
    </linearGradient>
    <path
      fill="url(#ps-devicon-grad)"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M120.3 18.5H28.5c-2.9 0-5.7 2.3-6.4 5.2L3.7 104.3c-.7 2.9 1.1 5.2 4 5.2h91.8c2.9 0 5.7-2.3 6.4-5.2l18.4-80.5c.7-2.9-1.1-5.3-4-5.3z"
    />
    <path
      fill="#2C5591"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M64.2 88.3h22.3c2.6 0 4.7 2.2 4.7 4.9s-2.1 4.9-4.7 4.9H64.2c-2.6 0-4.7-2.2-4.7-4.9s2.1-4.9 4.7-4.9zM78.7 66.5c-.4.8-1.2 1.6-2.6 2.6L34.6 98.9c-2.3 1.6-5.5 1-7.3-1.4-1.7-2.4-1.3-5.7.9-7.3l37.4-27.1v-.6l-23.5-25c-1.9-2-1.7-5.3.4-7.4 2.2-2 5.5-2 7.4 0l28.2 30c1.7 1.9 1.8 4.5.6 6.4z"
    />
    <path
      fill="#FFF"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M77.6 65.5c-.4.8-1.2 1.6-2.6 2.6L33.6 97.9c-2.3 1.6-5.5 1-7.3-1.4-1.7-2.4-1.3-5.7.9-7.3l37.4-27.1v-.6l-23.5-25c-1.9-2-1.7-5.3.4-7.4 2.2-2 5.5-2 7.4 0l28.2 30c1.7 1.8 1.8 4.4.5 6.4zM63.5 87.8h22.3c2.6 0 4.7 2.1 4.7 4.6 0 2.6-2.1 4.6-4.7 4.6H63.5c-2.6 0-4.7-2.1-4.7-4.6 0-2.6 2.1-4.6 4.7-4.6z"
    />
  </svg>
);
`;

// CMD
const cmd = `export const CmdLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect x="2" y="3" width="20" height="18" rx="2" fill="#0C0C0C" stroke="#2B2B2B" strokeWidth="1" />
    <path d="M2 5C2 3.89543 2.89543 3 4 3H20C21.1046 3 22 3.89543 22 5V7H2V5Z" fill="#0078D7" />
    <path d="M5.5 11.5L9 14.5L5.5 17.5" stroke="#38BDF8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    <line x1="11.5" y1="17.5" x2="16.5" y2="17.5" stroke="#FFFFFF" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);
`;

// GitBash
const gitbash = `export const GitBashLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 128 128"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#F34F29"
      d="M124.737 58.378L69.621 3.264c-3.172-3.174-8.32-3.174-11.497 0L46.68 14.71l14.518 14.518c3.375-1.139 7.243-.375 9.932 2.314 2.703 2.706 3.461 6.607 2.294 9.993l13.992 13.993c3.385-1.167 7.292-.413 9.994 2.295 3.78 3.777 3.78 9.9 0 13.679a9.673 9.673 0 01-13.683 0 9.677 9.677 0 01-2.105-10.521L68.574 47.933l-.002 34.341a9.708 9.708 0 012.559 1.828c3.778 3.777 3.778 9.898 0 13.683-3.779 3.777-9.904 3.777-13.679 0-3.778-3.784-3.778-9.905 0-13.683a9.65 9.65 0 013.167-2.11V47.333a9.581 9.581 0 01-3.167-2.111c-2.862-2.86-3.551-7.06-2.083-10.576L41.056 20.333 3.264 58.123a8.133 8.133 0 000 11.5l55.117 55.114c3.174 3.174 8.32 3.174 11.499 0l54.858-54.858a8.135 8.135 0 00-.001-11.501z"
    />
  </svg>
);
`;

// Bash
const bash = `export const BashLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 128 128"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#293138"
      d="M112.205 26.129 71.8 2.142A15.326 15.326 0 0 0 64.005 0c-2.688 0-5.386.717-7.796 2.152L15.795 26.14C10.976 28.999 8 34.289 8 40.018v47.975c0 5.729 2.967 11.019 7.796 13.878L56.2 125.858A15.193 15.193 0 0 0 63.995 128a15.32 15.32 0 0 0 7.796-2.142l40.414-23.987c4.819-2.86 7.796-8.16 7.796-13.878V40.007c0-5.718-2.967-11.019-7.796-13.878zm-31.29 74.907.063 3.448c0 .418-.267.889-.588 1.06l-2.046 1.178c-.321.16-.6-.032-.6-.45l-.032-3.394c-1.745.728-3.523.9-4.647.45-.214-.086-.31-.397-.225-.76l.739-3.117c.064-.246.193-.493.364-.643a.726.726 0 0 1 .193-.139c.117-.064.235-.075.332-.032 1.22.407 2.773.214 4.272-.535 1.907-.964 3.18-2.913 3.16-4.84-.022-1.757-.964-2.474-3.267-2.496-2.934.01-5.675-.567-5.718-4.894-.032-3.555 1.81-7.26 4.744-9.595l-.032-3.48c0-.428.257-.9.589-1.07l1.98-1.264c.322-.161.6.042.6.46l.033 3.48c1.456-.578 2.72-.738 3.865-.47.247.063.364.406.257.802l-.77 3.084a1.372 1.372 0 0 1-.354.622.825.825 0 0 1-.203.15c-.108.053-.204.064-.3.053-.525-.118-1.767-.385-3.727.6-2.056 1.038-2.773 2.827-2.763 4.155.022 1.585.825 2.066 3.63 2.11 3.738.063 5.344 1.691 5.387 5.45.053 3.684-1.917 7.657-4.937 10.077zm28.206-64.787L70.89 59.86c-4.765 2.784-8.278 5.911-8.288 11.662v47.107c0 3.437 1.392 5.665 3.523 6.318a12.81 12.81 0 0 1-2.12.204c-2.239 0-4.445-.61-6.383-1.757L17.219 99.408c-3.951-2.345-6.403-6.725-6.403-11.426V40.007c0-4.7 2.452-9.08 6.403-11.426L57.634 4.594a12.555 12.555 0 0 1 6.382-1.756c2.238 0 4.444.61 6.382 1.756l40.415 23.987c3.33 1.981 5.579 5.397 6.21 9.242-1.36-2.86-4.38-3.63-7.902-1.574z"
    />
    <path
      fill="#4fa847"
      d="m101.614 92.619-10.066 6.018c-.268.16-.46.332-.46.653v2.635c0 .32.214.46.481.3l10.216-6.212c.268-.16.31-.45.31-.77v-2.324c0-.322-.213-.45-.481-.3z"
    />
  </svg>
);
`;

// Google Logo
const google = `export const GoogleLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      fill="#4285F4"
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
    />
    <path
      fill="#34A853"
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
    />
    <path
      fill="#FBBC05"
      d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.62z"
    />
    <path
      fill="#EA4335"
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
    />
  </svg>
);
`;

// Custom Handcrafted Brand SVGs for tools not directly in lobehub
const customIcons = `
// Aider Logo (Official Terminal Phosphor Theme)
export const AiderLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#18181B" />
    <path d="M4 17L9.5 7L15 17H12.8L11.5 14.5H7.5L6.2 17H4ZM8.2 13H10.8L9.5 10.2L8.2 13Z" fill="#22C55E" />
    <circle cx="18" cy="16" r="1.5" fill="#22C55E" />
  </svg>
);

// Ante Logo (Antigma High Performance Rust Agent)
export const AnteLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#090A0F" />
    <path d="M12 4L4 18H8.5L12 11.5L15.5 18H20L12 4Z" fill="#F97316" />
    <path d="M9.5 14.5H14.5L12 10L9.5 14.5Z" fill="#FDBA74" />
  </svg>
);

// Auggie Logo (Augment Code CLI)
export const AuggieLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#0F172A" />
    <path d="M6 18V6H9.5C11.5 6 13 7.2 13 9C13 10.8 11.5 12 9.5 12H8V18H6ZM8 10H9.5C10.5 10 11 9.5 11 9C11 8.5 10.5 8 9.5 8H8V10Z" fill="#38BDF8" />
    <path d="M14 18L18 6H20.5L16.5 18H14Z" fill="#6366F1" />
  </svg>
);

// Codebuff Logo (Multi-Agent Fast Terminal Buffer)
export const CodebuffLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#1E1B4B" />
    <path d="M5 8L10 12L5 16" stroke="#A855F7" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    <rect x="12" y="14" width="7" height="2.2" rx="1" fill="#C084FC" />
  </svg>
);

// Continue Logo (Continue.dev Official Vector)
export const ContinueLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#111827" />
    <path d="M19.3 3L18 5.2L21.3 11C21.4 11.2 21.4 11.4 21.4 11.6C21.4 11.8 21.4 12 21.3 12.2L18 18L19.3 20.2L24 11.6L19.3 3Z" fill="#60A5FA" />
    <path d="M12.3 3L11 5.2L14.3 11C14.4 11.2 14.4 11.4 14.4 11.6C14.4 11.8 14.4 12 14.3 12.2L11 18L12.3 20.2L17 11.6L12.3 3Z" fill="#3B82F6" />
    <path d="M5.3 3L4 5.2L7.3 11C7.4 11.2 7.4 11.4 7.4 11.6C7.4 11.8 7.4 12 7.3 12.2L4 18L5.3 20.2L10 11.6L5.3 3Z" fill="#1D4ED8" />
  </svg>
);

// Crush Logo (Charmbracelet Terminal Agent)
export const CrushLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#2E0249" />
    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" fill="#F43F5E" />
  </svg>
);

// Droid Logo (Factory Code Droid)
export const DroidLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <rect width="24" height="24" rx="5" fill="#18181B" />
    <path d="M5 11C5 7.134 8.134 4 12 4C15.866 4 19 7.134 19 11V18C19 19.1046 18.1046 20 17 20H7C5.89543 20 5 19.1046 5 18V11Z" fill="#E4E4E7" />
    <circle cx="9" cy="11" r="1.5" fill="#09090B" />
    <circle cx="15" cy="11" r="1.5" fill="#09090B" />
    <line x1="12" y1="2" x2="12" y2="4" stroke="#E4E4E7" strokeWidth="2" strokeLinecap="round" />
    <line x1="8" y1="16" x2="16" y2="16" stroke="#09090B" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

// Rovo Dev Logo (Atlassian Official Vector)
export const RovoLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M7.12 11.084a.683.683 0 00-1.16.126L.075 22.974a.703.703 0 00.63 1.018h8.19a.678.678 0 00.63-.39c1.767-3.65.696-9.203-2.406-12.52z" fill="#0052CC" />
    <path d="M11.434.386a15.515 15.515 0 00-.906 15.317l3.95 7.9a.703.703 0 00.63.397h8.19a.687.687 0 00.63-1.025L12.593.513a.683.683 0 00-1.16-.127z" fill="#2684FF" />
  </svg>
);

// Zed Agent Logo (Zed Industries Official Vector)
export const ZedLogo: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    className={className}
    fill="currentColor"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M2.25 1.5a.75.75 0 0 0-.75.75v16.5H0V2.25A2.25 2.25 0 0 1 2.25 0h20.095c1.002 0 1.504 1.212.795 1.92L10.764 14.298h3.486V12.75h1.5v1.922a1.125 1.125 0 0 1-1.125 1.125H9.264l-2.578 2.578h11.68v-1.5h1.5v2.25a2.25 2.25 0 0 1-2.25 2.25H2.25A2.25 2.25 0 0 1 0 19.344V18h1.5v.75a.75.75 0 0 0 .75.75h3.486l8.835-8.836H11.085v1.5h-1.5v-1.922a1.125 1.125 0 0 1 1.125-1.125h5.361l2.578-2.578H6.97v1.5h-1.5V6.789a2.25 2.25 0 0 1 2.25-2.25h13.395V1.5H2.25Z" fill="#1348DC" />
  </svg>
);
`;

const lobehubIcons = [
  ['antigravity-color.svg', 'AntigravityLogo'],
  ['claude-color.svg', 'ClaudeLogo'],
  ['claudecode-color.svg', 'ClaudeCodeLogo'],
  ['codex-color.svg', 'CodexLogo'],
  ['gemini-color.svg', 'GeminiLogo'],
  ['geminicli-color.svg', 'GeminiCliLogo'],
  ['ollama.svg', 'OllamaLogo'],
  ['amp-color.svg', 'AmpLogo'],
  ['cline.svg', 'ClineLogo'],
  ['codebuddy-color.svg', 'CodeBuddyLogo'],
  ['cursor.svg', 'CursorLogo'],
  ['devin-color.svg', 'DevinLogo'],
  ['copilot-color.svg', 'CopilotLogo'],
  ['goose.svg', 'GooseLogo'],
  ['hermesagent.svg', 'HermesLogo'],
  ['kilocode.svg', 'KiloCodeLogo'],
  ['kimi-color.svg', 'KimiLogo'],
  ['kiro-color.svg', 'KiroLogo'],
  ['mistral-color.svg', 'MistralVibeLogo'],
  ['opencode.svg', 'OpenCodeLogo'],
  ['openhands-color.svg', 'OpenHandsLogo'],
  ['pi.svg', 'PiLogo'],
  ['qwen-color.svg', 'QwenLogo'],
  ['roocode.svg', 'RooCodeLogo'],
  ['trae-color.svg', 'TraeLogo']
];

let out = header + '\n' + powershell + '\n' + cmd + '\n' + gitbash + '\n' + bash + '\n' + google + '\n' + customIcons + '\n';

for (const [fname, compName] of lobehubIcons) {
  out += getIcon(fname, compName) + '\n';
}

// Renderer component
const renderer = `
// Helper component that returns the official logo based on provider/title
export const OfficialLogoRenderer: React.FC<{
  provider?: string;
  title?: string;
  className?: string;
  size?: number | string;
}> = ({ provider = '', title = '', className = 'w-3.5 h-3.5', size }) => {
  const norm = (provider || title).toLowerCase();

  // Web & system shells
  if (norm.includes('browser') || norm.includes('web')) {
    return <Globe className={className} size={size} />;
  }
  if (norm.includes('google') || norm.includes('chrome')) {
    return <GoogleLogo className={className} size={size} />;
  }
  if (norm.includes('power') || norm.includes('pwsh')) {
    return <PowerShellLogo className={className} size={size} />;
  }
  if (norm.includes('cmd') || norm.includes('command')) {
    return <CmdLogo className={className} size={size} />;
  }
  if (norm.includes('bash') && !norm.includes('git')) {
    return <BashLogo className={className} size={size} />;
  }
  if (norm.includes('git')) {
    return <GitBashLogo className={className} size={size} />;
  }

  // All 30 AI Coding Agents + Orbito AI engines
  if (norm === 'aider' || norm.includes('aider')) {
    return <AiderLogo className={className} size={size} />;
  }
  if (norm === 'amp' || norm.includes('amp')) {
    return <AmpLogo className={className} size={size} />;
  }
  if (norm === 'ante' || norm.includes('ante')) {
    return <AnteLogo className={className} size={size} />;
  }
  if (norm === 'auggie' || norm.includes('augment')) {
    return <AuggieLogo className={className} size={size} />;
  }
  if (norm === 'claudecode' || norm.includes('claude code')) {
    return <ClaudeCodeLogo className={className} size={size} />;
  }
  if (norm.includes('claude') || norm.includes('anthropic')) {
    return <ClaudeLogo className={className} size={size} />;
  }
  if (norm.includes('cline') && !norm.includes('roo')) {
    return <ClineLogo className={className} size={size} />;
  }
  if (norm.includes('codex') || (norm.includes('openai') && !norm.includes('codebuddy'))) {
    return <CodexLogo className={className} size={size} />;
  }
  if (norm.includes('codebuddy')) {
    return <CodeBuddyLogo className={className} size={size} />;
  }
  if (norm.includes('codebuff')) {
    return <CodebuffLogo className={className} size={size} />;
  }
  if (norm.includes('continue')) {
    return <ContinueLogo className={className} size={size} />;
  }
  if (norm.includes('crush')) {
    return <CrushLogo className={className} size={size} />;
  }
  if (norm.includes('cursor')) {
    return <CursorLogo className={className} size={size} />;
  }
  if (norm.includes('devin')) {
    return <DevinLogo className={className} size={size} />;
  }
  if (norm.includes('droid') || norm.includes('factory')) {
    return <DroidLogo className={className} size={size} />;
  }
  if (norm === 'geminicli' || norm.includes('gemini cli')) {
    return <GeminiCliLogo className={className} size={size} />;
  }
  if (norm.includes('gemini')) {
    return <GeminiLogo className={className} size={size} />;
  }
  if (norm.includes('copilot') || norm.includes('github')) {
    return <CopilotLogo className={className} size={size} />;
  }
  if (norm.includes('goose')) {
    return <GooseLogo className={className} size={size} />;
  }
  if (norm.includes('hermes')) {
    return <HermesLogo className={className} size={size} />;
  }
  if (norm.includes('kilo')) {
    return <KiloCodeLogo className={className} size={size} />;
  }
  if (norm.includes('kimi') || norm.includes('moonshot')) {
    return <KimiLogo className={className} size={size} />;
  }
  if (norm.includes('kiro')) {
    return <KiroLogo className={className} size={size} />;
  }
  if (norm.includes('vibe') || norm.includes('mistral')) {
    return <MistralVibeLogo className={className} size={size} />;
  }
  if (norm.includes('opencode')) {
    return <OpenCodeLogo className={className} size={size} />;
  }
  if (norm.includes('openhands') || norm.includes('all-hands')) {
    return <OpenHandsLogo className={className} size={size} />;
  }
  if (norm === 'pi' || norm.includes('pi coding')) {
    return <PiLogo className={className} size={size} />;
  }
  if (norm.includes('qwen') || norm.includes('dashscope')) {
    return <QwenLogo className={className} size={size} />;
  }
  if (norm.includes('roo')) {
    return <RooCodeLogo className={className} size={size} />;
  }
  if (norm.includes('rovo') || norm.includes('atlassian')) {
    return <RovoLogo className={className} size={size} />;
  }
  if (norm.includes('trae')) {
    return <TraeLogo className={className} size={size} />;
  }
  if (norm.includes('zed')) {
    return <ZedLogo className={className} size={size} />;
  }
  if (norm.includes('antigravity')) {
    return <AntigravityLogo className={className} size={size} />;
  }
  if (norm.includes('ollama')) {
    return <OllamaLogo className={className} size={size} />;
  }

  // Default to PowerShell official logo for standard terminal sessions
  return <PowerShellLogo className={className} size={size} />;
};
`;

out += renderer;

fs.writeFileSync(path.join(__dirname, '..', 'src', 'renderer', 'src', 'components', 'OfficialLogos.tsx'), out, 'utf8');
console.log('Successfully generated OfficialLogos.tsx!');
