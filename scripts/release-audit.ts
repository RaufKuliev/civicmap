import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { parse } from "yaml";

const root = process.cwd();
const ignoredRoots = new Set([".git", ".next", ".supergoal", "node_modules", "out", "playwright-report", "test-results"]);

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (ignoredRoots.has(entry.name)) return [];
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [path.relative(root, fullPath).replaceAll("\\", "/")];
  });
}

let files: string[];
try {
  files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard"], { cwd: root, encoding: "utf8" }).split(/\r?\n/u).filter(Boolean);
} catch {
  files = walk(root);
}

const largeFiles = files.map((file) => ({ file, bytes: fs.statSync(path.join(root, file)).size })).filter((item) => item.bytes > 2_000_000).sort((a, b) => b.bytes - a.bytes);
const blockingLargeFiles = largeFiles.filter((item) => item.bytes > 10_000_000);
const secretPatterns = [
  { name: "private_key", pattern: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u },
  { name: "github_token", pattern: /(?:ghp|github_pat)_[A-Za-z0-9_]{20,}/u },
  { name: "aws_access_key", pattern: /AKIA[0-9A-Z]{16}/u },
  { name: "generic_bearer", pattern: /Bearer\s+[A-Za-z0-9._-]{30,}/u },
];
const secretHits: Array<{ file: string; pattern: string }> = [];
for (const file of files) {
  const fullPath = path.join(root, file);
  const bytes = fs.readFileSync(fullPath);
  if (bytes.includes(0) || bytes.length > 5_000_000) continue;
  const text = bytes.toString("utf8");
  for (const candidate of secretPatterns) if (candidate.pattern.test(text)) secretHits.push({ file, pattern: candidate.name });
}

const workflowFiles = files.filter((file) => file.startsWith(".github/workflows/") && /\.ya?ml$/u.test(file));
const workflowErrors: string[] = [];
for (const file of workflowFiles) {
  try { parse(fs.readFileSync(path.join(root, file), "utf8")); } catch (error) { workflowErrors.push(`${file}: ${error instanceof Error ? error.message : String(error)}`); }
}
const verifyText = fs.readFileSync(path.join(root, ".github/workflows/verify.yml"), "utf8");
for (const command of ["pnpm typecheck", "pnpm lint", "pnpm test", "pnpm data:validate", "pnpm data:coverage", "pnpm build", "pnpm static:check", "pnpm release:audit"]) if (!verifyText.includes(command)) workflowErrors.push(`verify.yml missing ${command}`);
const pagesText = fs.readFileSync(path.join(root, ".github/workflows/pages-preview.yml"), "utf8");
for (const action of ["actions/configure-pages@v5", "actions/upload-pages-artifact@v3", "actions/deploy-pages@v4"]) if (!pagesText.includes(action)) workflowErrors.push(`pages-preview.yml missing ${action}`);
const releaseConfig = JSON.parse(fs.readFileSync(path.join(root, "release-config.json"), "utf8")) as { deployment_guard_removed?: boolean };
const pagesGuardPresent = pagesText.includes("if: ${{ false }}");
if (releaseConfig.deployment_guard_removed === true && pagesGuardPresent) workflowErrors.push("Pages deploy remains disabled after owner approval");
if (releaseConfig.deployment_guard_removed !== true && !pagesGuardPresent) workflowErrors.push("Pages deploy guard was removed without owner approval");
if (releaseConfig.deployment_guard_removed === true && !/push:\r?\n\s+branches: \[main\]/u.test(pagesText)) workflowErrors.push("Pages deploy is enabled but main push trigger is missing");

const requiredDocs = ["README.md", "CONTRIBUTING.md", "CODE_OF_CONDUCT.md", "SECURITY.md", "CITATION.md", "LICENSE", "LICENSE-STATUS.md", "RELEASE_CHECKLIST.md", "docs/data-methodology.md", "docs/sources-and-attribution.md", "docs/privacy.md", "docs/corrections.md", "docs/governance.md", "docs/operations.md"];
const missingDocs = requiredDocs.filter((file) => !files.includes(file));
console.log(`Release audit · files=${files.length} · workflows=${workflowFiles.length} · yaml_errors=${workflowErrors.length}`);
console.log(`Secrets · hits=${secretHits.length}`);
console.log(`Large files · >2MB=${largeFiles.length} · blocking>10MB=${blockingLargeFiles.length}`);
for (const item of largeFiles) console.log(`  ${item.bytes} ${item.file}`);
console.log(`Required docs · missing=${missingDocs.length}`);
if (secretHits.length) console.error(secretHits);
if (workflowErrors.length) console.error(workflowErrors);
if (missingDocs.length) console.error(missingDocs);
if (secretHits.length || blockingLargeFiles.length || workflowErrors.length || missingDocs.length) process.exit(1);
