import fs from "node:fs";

const config = JSON.parse(fs.readFileSync("release-config.json", "utf8")) as Record<string, unknown>;
const blockers: string[] = [];
if (!config.github_owner) blockers.push("GitHub owner не указан");
if (!config.license) blockers.push("Лицензия не выбрана");
if (!config.security_contact) blockers.push("Security contact не назначен");
if (!config.editorial_contact) blockers.push("Редакционный contact не назначен");
if (config.source_terms_reviewed !== true) blockers.push("Условия источников не подтверждены владельцем");
if (config.pages_enabled !== true || config.deployment_guard_removed !== true) blockers.push("Pages/deploy не включён владельцем");
if (!config.custom_domain_decision) blockers.push("Решение по custom domain не записано (домен или none)");
if (config.geocoder_policy_reviewed !== true) blockers.push("Политика production-геокодера не подтверждена");

if (blockers.length) {
  console.error(`Release blocked: ${blockers.length} owner decisions:\n${blockers.map((item) => `  • ${item}`).join("\n")}`);
  process.exit(1);
}
console.log("Release owner decisions are complete.");
