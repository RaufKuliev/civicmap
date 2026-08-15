import fs from "node:fs";
import path from "node:path";

const outRoot = path.join(process.cwd(), "out");
const baseArg = process.argv.find((argument) => argument.startsWith("--base-path="))?.split("=")[1] ?? "";
const basePath = baseArg === "/" ? "" : baseArg.replace(/\/$/u, "");
if (!fs.existsSync(outRoot)) throw new Error("Static export directory out/ does not exist");

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

const files = walk(outRoot);
const htmlFiles = files.filter((file) => file.endsWith(".html"));
const broken = new Set<string>();
let internalReferences = 0;

function targetFile(urlValue: string) {
  const clean = decodeURI(urlValue.split(/[?#]/u)[0]);
  if (!clean.startsWith("/")) return null;
  if (basePath && !clean.startsWith(`${basePath}/`) && clean !== basePath) return `outside-base:${clean}`;
  const relative = (basePath ? clean.slice(basePath.length) : clean) || "/";
  const diskPath = path.join(outRoot, relative.replace(/^\//u, ""));
  if (path.extname(relative)) return diskPath;
  return path.join(diskPath, "index.html");
}

for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  for (const match of html.matchAll(/(?:href|src)=["']([^"']+)["']/giu)) {
    const urlValue = match[1];
    if (/^(?:https?:|mailto:|tel:|data:|#)/iu.test(urlValue)) continue;
    const target = targetFile(urlValue);
    if (!target) continue;
    internalReferences += 1;
    if (target.startsWith("outside-base:") || !fs.existsSync(target)) broken.add(`${path.relative(outRoot, htmlFile)} -> ${urlValue}`);
  }
}

const relativeFiles = files.map((file) => path.relative(outRoot, file).replaceAll("\\", "/"));
const forbidden = relativeFiles.filter((file) => /(^|\/)raw\/|\.(docx|zip)$/iu.test(file));
const size = (relative: string) => fs.existsSync(path.join(outRoot, relative)) ? fs.statSync(path.join(outRoot, relative)).size : 0;
const report = {
  schema_version: 1,
  base_path: basePath,
  html_files: htmlFiles.length,
  files: files.length,
  total_bytes: files.reduce((sum, file) => sum + fs.statSync(file).size, 0),
  internal_references: internalReferences,
  broken_links: [...broken],
  forbidden_archives: forbidden,
  budgets: {
    search_html_bytes: size("search/index.html"),
    search_index_bytes: size("data/search-index.json"),
    search_html_limit: 250_000,
    search_index_limit: 800_000,
  },
};
fs.mkdirSync(path.join(process.cwd(), "data", "reports"), { recursive: true });
fs.writeFileSync(path.join(process.cwd(), "data", "reports", "static-artifacts.json"), `${JSON.stringify(report, null, 2)}\n`);
console.log(`Static export · base=${basePath || "/"} · html=${report.html_files} · refs=${internalReferences} · broken=${broken.size} · total=${report.total_bytes} bytes`);
console.log(`Budgets · search.html=${report.budgets.search_html_bytes}/${report.budgets.search_html_limit} · search-index.json=${report.budgets.search_index_bytes}/${report.budgets.search_index_limit} · forbidden=${forbidden.length}`);
if (broken.size || forbidden.length || report.budgets.search_html_bytes > report.budgets.search_html_limit || report.budgets.search_index_bytes > report.budgets.search_index_limit) process.exit(1);
