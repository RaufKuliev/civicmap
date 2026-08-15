import fs from "node:fs";
import path from "node:path";

export type RawRecord = Record<string, unknown>;
export type ImportContext = { observedAt: string; inputPath: string };
export type ImportResult = { format: string; parserVersion: string; records: RawRecord[] };

export interface OfficialDataAdapter {
  readonly format: string;
  readonly parserVersion: string;
  canParse(inputPath: string, bytes: Buffer): boolean;
  parse(context: ImportContext, bytes: Buffer): ImportResult;
}

const fixtureJsonAdapter: OfficialDataAdapter = {
  format: "fixture-json",
  parserVersion: "0.1.0",
  canParse(inputPath, bytes) { return path.extname(inputPath).toLowerCase() === ".json" && bytes.toString("utf8").trimStart().startsWith("["); },
  parse(_context, bytes) {
    const value = JSON.parse(bytes.toString("utf8"));
    if (!Array.isArray(value)) throw new Error("Fixture JSON должен быть массивом записей");
    return { format: this.format, parserVersion: this.parserVersion, records: value };
  },
};

const adapters: OfficialDataAdapter[] = [fixtureJsonAdapter];
const args = process.argv.slice(2);
const valueOf = (flag: string) => { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : undefined; };
const inputPath = valueOf("--input");
const observedAt = valueOf("--observed-at");

if (!inputPath || !observedAt || !/^\d{4}-\d{2}-\d{2}$/.test(observedAt)) {
  console.error("Использование: pnpm data:import --input <file> --observed-at YYYY-MM-DD");
  process.exit(1);
}

const resolved = path.resolve(inputPath);
const bytes = fs.readFileSync(resolved);
const adapter = adapters.find((candidate) => candidate.canParse(resolved, bytes));
if (!adapter) {
  console.error("Неизвестный формат. Импорт остановлен: добавьте отдельный проверяемый adapter после получения официального файла.");
  process.exit(1);
}
const result = adapter.parse({ inputPath: resolved, observedAt, }, bytes);
console.log(`Распознан ${result.format} (${result.parserVersion}), записей: ${result.records.length}.`);
console.log("Dry run завершен. Нормализация official-данных намеренно не выполняется без согласованной схемы источника.");
