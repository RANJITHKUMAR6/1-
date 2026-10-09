/* Builds two outputs from src/:
   www/index.html     full HTML document for the Capacitor Android app (works offline, fonts embedded)
   dist/artifact.html page fragment for pasting into a hosted page / Claude artifact
*/
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const src = (f) => fs.readFileSync(path.join(root, 'src', f), 'utf8');

const fontFaces = [
  ['Fredoka', 500, 'fredoka-latin-500-normal.woff2'],
  ['Fredoka', 600, 'fredoka-latin-600-normal.woff2'],
  ['Fredoka', 700, 'fredoka-latin-700-normal.woff2'],
  ['Nunito', 500, 'nunito-latin-500-normal.woff2'],
  ['Nunito', 700, 'nunito-latin-700-normal.woff2'],
]
  .map(([family, weight, file]) => {
    const b64 = fs.readFileSync(path.join(root, 'src', 'fonts', file)).toString('base64');
    return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:swap;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
  })
  .join('\n');

const css = fontFaces + '\n' + src('style.css');
const levels = src('levels.js');
const game = src('game.js');
const body = src('body.html');
const scripts = `<script>\n${levels}\n</script>\n<script>\n${game}\n</script>`;

const title = 'Riddle Blocks';

// Fragment: the artifact host supplies doctype/head/body and safe-area padding.
const fragment = `<title>${title}</title>\n<style>\n${css}\n</style>\n${body}\n${scripts}\n`;

// Full document for the app. Adds viewport, theme colour and its own safe-area padding.
const full = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover, user-scalable=no">
<meta name="color-scheme" content="light dark">
<meta name="theme-color" content="#0E1829">
<title>${title}</title>
<style>
html,body{margin:0;min-height:100%}
:root{padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)}
</style>
<style>
${css}
</style>
</head>
<body>
${body}
${scripts}
</body>
</html>
`;

fs.mkdirSync(path.join(root, 'www'), { recursive: true });
fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'www', 'index.html'), full);
fs.writeFileSync(path.join(root, 'dist', 'artifact.html'), fragment);
console.log(`built www/index.html (${(full.length / 1024).toFixed(0)} KB) and dist/artifact.html (${(fragment.length / 1024).toFixed(0)} KB)`);
