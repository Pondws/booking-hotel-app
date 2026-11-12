// Wrapper around `shadcn add` for this monorepo.
// Usage (from repo root): npm run ui:add -- button dialog ...
//
// Why: shadcn CLI 4.x emits `import { cn } from "cn"` for registry items and
// installs an unrelated npm package named "cn". This script runs the CLI
// inside packages/ui, then rewrites that import to our utils alias and removes
// the stray dependency.
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const uiRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: npm run ui:add -- <component> [...components]");
  process.exit(1);
}

const run = (cmd) => execSync(cmd, { cwd: uiRoot, stdio: "inherit" });

run(`npx shadcn@latest add ${args.join(" ")} --yes`);

// Rewrite bad imports
const UTILS = "@booking/ui/lib/utils";
let fixed = 0;
const walk = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
      const src = readFileSync(p, "utf8");
      const out = src.replace(/from (["'])cn\1/g, `from "${UTILS}"`);
      if (out !== src) {
        writeFileSync(p, out);
        fixed++;
      }
    }
  }
};
walk(join(uiRoot, "src"));
if (fixed) console.log(`Rewrote cn import in ${fixed} file(s).`);

// Remove the stray "cn" package if the CLI installed it
const pkg = JSON.parse(readFileSync(join(uiRoot, "package.json"), "utf8"));
if (pkg.dependencies?.cn || pkg.devDependencies?.cn) {
  run("npm uninstall cn");
}
