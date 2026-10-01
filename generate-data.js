// generate-stack.js — run from repo root:  node generate-stack.js
// Produces Tech-Stack.xlsx (Project | Section | Item | Declared | Installed/Value | Category)
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execSync } = require('child_process');

// exceljs: use root install if present, else fall back to the backend's copy
let ExcelJS;
try { ExcelJS = require('exceljs'); }
catch { ExcelJS = require('./backend/node_modules/exceljs'); }

const PROJECT = 'Newel Planner';   // <-- change per project, or pass as argv[2]
const projectName = process.argv[2] || PROJECT;

// ---- category lookup (extend as you add packages) ----
const CATEGORY = {
  next:'Framework & Core', react:'Framework & Core', 'react-dom':'Framework & Core',
  '@nestjs/core':'Framework & Core', '@nestjs/common':'Framework & Core',
  '@nestjs/platform-express':'Framework & Core', 'reflect-metadata':'Framework & Core', rxjs:'Framework & Core',
  typescript:'Language',
  '@nestjs/config':'Configuration',
  prisma:'Database', '@prisma/client':'Database',
  '@nestjs/jwt':'Authentication', '@nestjs/passport':'Authentication', passport:'Authentication',
  'passport-jwt':'Authentication', bcrypt:'Authentication',
  helmet:'Security', '@nestjs/throttler':'Security',
  'cookie-parser':'Web / Middleware',
  'class-validator':'Validation', 'class-transformer':'Validation',
  '@nestjs/swagger':'API Docs', 'swagger-ui-express':'API Docs',
  '@nestjs/schedule':'Scheduling / Jobs', '@nestjs/event-emitter':'Events',
  nodemailer:'Email', exceljs:'File & Export', multer:'File & Upload',
  dayjs:'Utilities', uuid:'Utilities', '@nestjs/mapped-types':'Utilities', 'date-fns':'Utilities',
  tailwindcss:'Styling', '@tailwindcss/postcss':'Styling', 'tailwind-merge':'Styling',
  'tw-animate-css':'Styling', 'class-variance-authority':'Styling', clsx:'Styling',
  'radix-ui':'UI Components', shadcn:'UI Components', 'lucide-react':'UI & Icons',
  'framer-motion':'UI & Animation', recharts:'Data Visualization', zustand:'State Management',
  'react-hook-form':'Forms & Validation', '@hookform/resolvers':'Forms & Validation', zod:'Forms & Validation',
  axios:'Data & HTTP',
  jest:'Testing', 'ts-jest':'Testing', supertest:'Testing', '@nestjs/testing':'Testing',
  'ts-loader':'Build', 'tsconfig-paths':'Build',
};
const catOf = (p) => CATEGORY[p] || (p.startsWith('@types/') ? 'Types' : 'Dev & Tooling');

function readPkg(dir) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, dir, 'package.json'), 'utf8')); }
  catch { return null; }
}
function installedVersion(dir, pkg) {
  try { return JSON.parse(fs.readFileSync(path.join(__dirname, dir, 'node_modules', pkg, 'package.json'), 'utf8')).version || ''; }
  catch { return ''; }
}
function depsRows(dir, section) {
  const pkg = readPkg(dir);
  if (!pkg) return [];
  const all = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  return Object.keys(all).sort().map((name) => ({
    project: projectName, section, item: name,
    declared: all[name], installed: installedVersion(dir, name), category: catOf(name),
  }));
}
function tryCmd(cmd) { try { return execSync(cmd, { shell: true }).toString().trim(); } catch { return ''; } }

const envRows = [
  { item:'OS',     value: (os.version && os.version()) || `${os.type()} ${os.release()}`, category:'System' },
  { item:'CPU',    value:`(${os.cpus().length}) ${os.arch()} ${os.cpus()[0].model}`,      category:'System' },
  { item:'Memory', value:`${(os.freemem()/1e9).toFixed(2)} GB / ${(os.totalmem()/1e9).toFixed(2)} GB`, category:'System' },
  { item:'Node',   value: process.version.replace(/^v/, ''), category:'Binary' },
  { item:'npm',    value: tryCmd('npm -v'),  category:'Binary' },
  { item:'pnpm',   value: tryCmd('pnpm -v'), category:'Binary' },
].map(r => ({ project: projectName, section:'Environment', item:r.item, declared:'', installed:r.value, category:r.category }));

const rows = [
  ...envRows,
  ...depsRows('frontend', 'Frontend'),
  ...depsRows('backend', 'Backend'),
];

(async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Tech Stack');
  ws.columns = [
    { header:'Project', key:'project', width:16 },
    { header:'Section', key:'section', width:13 },
    { header:'Item', key:'item', width:26 },
    { header:'Declared (package.json)', key:'declared', width:22 },
    { header:'Installed / Value', key:'installed', width:38 },
    { header:'Category', key:'category', width:20 },
  ];
  rows.forEach(r => ws.addRow(r));

  const HEAD = 'FF1F3864';
  const SECTION_FILL = { Environment:'FFEDE7F6', Frontend:'FFE5F0FB', Backend:'FFE6F4EA' };

  ws.getRow(1).eachCell(c => {
    c.font = { name:'Arial', bold:true, color:{ argb:'FFFFFFFF' }, size:11 };
    c.fill = { type:'pattern', pattern:'solid', fgColor:{ argb:HEAD } };
    c.alignment = { vertical:'middle' };
  });
  ws.getRow(1).height = 20;

  for (let r = 2; r <= ws.rowCount; r++) {
    const row = ws.getRow(r);
    row.eachCell(c => { c.font = { name:'Arial', size:10 }; c.alignment = { vertical:'middle' }; });
    const sectionCell = row.getCell(2);
    sectionCell.fill = { type:'pattern', pattern:'solid', fgColor:{ argb: SECTION_FILL[sectionCell.value] || 'FFFFFFFF' } };
    sectionCell.font = { name:'Arial', size:10, bold:true };
    if (sectionCell.value === 'Environment' && String(row.getCell(5).value || '').length > 25) {
      row.getCell(5).alignment = { vertical:'middle', wrapText:true };
    }
  }

  ws.views = [{ state:'frozen', ySplit:1 }];
  ws.autoFilter = { from:'A1', to:`F${ws.rowCount}` };

  const out = path.join(__dirname, 'Tech-Stack.xlsx');
  await wb.xlsx.writeFile(out);
  console.log(`Wrote ${out}  (${rows.length} rows: ${envRows.length} env, ` +
              `${rows.filter(r=>r.section==='Frontend').length} FE, ${rows.filter(r=>r.section==='Backend').length} BE)`);
})();