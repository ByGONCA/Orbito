const fs = require('fs');
const path = require('path');

const iconDir = path.join(__dirname, '..', 'node_modules', '@lobehub', 'icons-static-svg', 'icons');

function convertSvgToReact(svgContent, compName, defaultFill) {
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

  return `export const ${compName}: React.FC<OfficialLogoProps> = ({ className = 'w-4 h-4', size }) => (
  <svg
    viewBox="${viewBox}"
    width={size}
    height={size}
    className={className}${fillAttr}
    xmlns="http://www.w3.org/2000/svg"
  >
    ${inner}
  </svg>
);`;
}

console.log('Script ready');
