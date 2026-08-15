import fs from "node:fs";
import path from "node:path";

const outRoot = path.join(process.cwd(), "out");
if (!fs.existsSync(outRoot)) throw new Error("Static export directory out/ does not exist");

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

let aliases = 0;
for (const sourcePath of walk(outRoot).filter((file) => file.endsWith(`${path.sep}__PAGE__.txt`) && file.includes(`${path.sep}__next.`))) {
  const routeDirectory = sourcePath.slice(0, sourcePath.indexOf(`${path.sep}__next.`));
  const nestedRelative = path.relative(routeDirectory, sourcePath);
  const aliasName = nestedRelative.replaceAll(path.sep, ".");
  const aliasPath = path.join(routeDirectory, aliasName);
  if (!fs.existsSync(aliasPath)) {
    fs.copyFileSync(sourcePath, aliasPath);
    aliases += 1;
  }
}
console.log(`Static RSC aliases: ${aliases}`);
