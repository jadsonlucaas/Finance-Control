import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const indexPath = path.join(rootDir, 'index.html');
let indexHtml = fs.readFileSync(indexPath, 'utf-8');

const regex = /<section id="(view-[^"]+)".*?>([\s\S]*?)<\/section>(?=<!--|\s*<section|\s*<\/main>)/g;
let match;

const viewsDir = path.join(rootDir, 'src/ui/templates/views');
if (!fs.existsSync(viewsDir)) {
  fs.mkdirSync(viewsDir, { recursive: true });
}

let imports = [];
let injects = [];

let mainContentStart = indexHtml.indexOf('<main class="flex-1 overflow-auto p-4" id="main-content">');
let mainContentEnd = indexHtml.indexOf('</main>', mainContentStart);

let extractedHtml = indexHtml.substring(mainContentStart, mainContentEnd + 7);
let originalMainContent = extractedHtml;
let newMainContent = '<main class="flex-1 overflow-auto p-4" id="main-content"></main>';

// We'll replace the inner HTML of main-content with nothing,
// but extract the sections
const sectionsRegex = /(<!--.*?-->\s*)?<section id="(view-[^"]+)"[^>]*>[\s\S]*?<\/section>/g;

let matchSection;
while ((matchSection = sectionsRegex.exec(originalMainContent)) !== null) {
  let sectionContent = matchSection[0];
  let id = matchSection[2]; // e.g. view-dashboard
  
  let functionName = id.replace(/-([a-z])/g, (g) => g[1].toUpperCase()) + 'Template'; // viewDashboardTemplate
  let fileName = `${functionName}.js`;
  
  let fileContent = `export function ${functionName}() {\n  return \`\n${sectionContent.replace(/`/g, '\\`').replace(/\$/g, '\\$')}\`;\n}\n`;
  
  fs.writeFileSync(path.join(viewsDir, fileName), fileContent);
  imports.push(`import { ${functionName} } from './views/${fileName}';`);
  injects.push(`    mainContent.innerHTML += ${functionName}();`);
}

indexHtml = indexHtml.replace(originalMainContent, newMainContent);
fs.writeFileSync(indexPath, indexHtml);

console.log("Extraction complete.");
console.log("Imports:\n" + imports.join('\n'));
console.log("Injects:\n" + injects.join('\n'));

