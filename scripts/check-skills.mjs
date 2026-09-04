#!/usr/bin/env node
// Usage:
//   node scripts/check-skills.mjs --assistant-ui ../assistant-ui [--skill <name>] [--write-exports <file>]
//   node scripts/check-skills.mjs --exports <file> [--skill <name>]
// The checkout must be built (`pnpm build`) so packages/*/dist/index.d.ts exist.

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
};

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const skillsRoot = path.join(repoRoot, "assistant-ui", "skills");
const onlySkill = flag("--skill");
const auiRoot = flag("--assistant-ui");
const exportsFile = flag("--exports");
const writeExports = flag("--write-exports");

const PACKAGES = {
  "@assistant-ui/react": "react",
  "@assistant-ui/ai-sdk": "ai-sdk",
  "@assistant-ui/react-ai-sdk": "react-ai-sdk",
  "@assistant-ui/core": "core",
  "@assistant-ui/store": "store",
  "@assistant-ui/tap": "tap",
  "@assistant-ui/react-markdown": "react-markdown",
  "@assistant-ui/react-streamdown": "react-streamdown",
  "@assistant-ui/react-syntax-highlighter": "react-syntax-highlighter",
  "@assistant-ui/react-mcp": "react-mcp",
  "@assistant-ui/react-langgraph": "react-langgraph",
  "@assistant-ui/react-langchain": "react-langchain",
  "@assistant-ui/react-ag-ui": "react-ag-ui",
  "@assistant-ui/react-a2a": "react-a2a",
  "@assistant-ui/react-google-adk": "react-google-adk",
  "@assistant-ui/react-native": "react-native",
  "@assistant-ui/react-ink": "react-ink",
  "@assistant-ui/react-ink-markdown": "react-ink-markdown",
  "@assistant-ui/react-o11y": "react-o11y",
  "@assistant-ui/react-data-stream": "react-data-stream",
  "@assistant-ui/react-devtools": "react-devtools",
  "@assistant-ui/react-generative-ui": "react-generative-ui",
  "@assistant-ui/react-opencode": "react-opencode",
  "@assistant-ui/react-pi": "react-pi",
  "@assistant-ui/react-hook-form": "react-hook-form",
  "@assistant-ui/react-lexical": "react-lexical",
  "@assistant-ui/eve": "eve",
  "@assistant-ui/cloud-ai-sdk": "cloud-ai-sdk",
  "@assistant-ui/next": "next",
  "@assistant-ui/vite": "vite",
  "@assistant-ui/metro": "metro",
  "assistant-stream": "assistant-stream",
  "assistant-stream/resumable": "assistant-stream/resumable",
  "assistant-cloud": "cloud",
  "safe-content-frame": "safe-content-frame",
};

const RETIRED = [
  { re: /from ["']@assistant-ui\/react-ai-sdk["']/, why: "import from @assistant-ui/ai-sdk (react-ai-sdk only re-exports it)" },
  { re: /useAui\(\s*\{/, why: "useAui() takes no config; build one with AuiConfig({...}) and pass it to AuiProvider or AssistantRuntimeProvider" },
  { re: /<AuiProvider[^>]*\svalue=/, why: "AuiProvider value= is deprecated; use extends= plus config=" },
  { re: /<AssistantRuntimeProvider[^>]*\saui=/, why: "AssistantRuntimeProvider aui= was replaced by config=" },
  { re: /@\/components\/assistant-ui\/(thread|thread-list|assistant-modal|assistant-sidebar|markdown-text|tool-fallback|tool-group|attachment|reasoning|sources)["']/, why: "elements live at @/components/assistant-ui/elements/<name>.aui (or <name> for renderers)" },
  { re: /threadListItem\.switched(To|Away)/, why: "use the threads.selectionChanged event" },
  { re: /gpt-5\.4-nano/, why: "docs standardize on gpt-5.6-luna in examples" },
  { re: /\bmaxSteps\b/, why: "AI SDK v7 uses stopWhen: stepCountIs(n)" },
  { re: /toDataStreamResponse|toUIMessageStreamResponse\(\)\s*;?\s*\/\/ v5/, why: "AI SDK v7 response helpers" },
];

function loadExports() {
  if (exportsFile) return JSON.parse(fs.readFileSync(exportsFile, "utf8"));
  if (!auiRoot) throw new Error("pass --assistant-ui <checkout> or --exports <json>");
  const store = path.join(auiRoot, "node_modules", ".pnpm");
  const ts5 = fs.existsSync(store) ? fs.readdirSync(store).filter((d) => /^typescript@5\./.test(d)).sort().pop() : undefined;
  const require = createRequire(path.join(auiRoot, "packages", "react", "package.json"));
  const ts = ts5 ? require(path.join(store, ts5, "node_modules", "typescript")) : require("typescript");
  if (typeof ts.createProgram !== "function") throw new Error("a TypeScript 5.x install with the compiler API is required; the checkout only exposes the native port");
  const out = {};
  for (const [pkg, dir] of Object.entries(PACKAGES)) {
    const file = path.join(auiRoot, "packages", dir.replace("/resumable", ""), "dist", dir.endsWith("/resumable") ? "resumable/index.d.ts" : "index.d.ts");
    if (!fs.existsSync(file)) {
      out[pkg] = null;
      continue;
    }
    const program = ts.createProgram([file], { skipLibCheck: true, moduleResolution: ts.ModuleResolutionKind.Bundler, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext });
    const checker = program.getTypeChecker();
    const symbol = checker.getSymbolAtLocation(program.getSourceFile(file));
    out[pkg] = symbol ? checker.getExportsOfModule(symbol).map((s) => s.getName()).sort() : [];
  }
  if (writeExports) fs.writeFileSync(writeExports, JSON.stringify(out, null, 1));
  return out;
}

const exportsByPackage = loadExports();
const files = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full);
    else if (full.endsWith(".md")) files.push(full);
  }
})(skillsRoot);

const problems = [];
const stats = { files: 0, codeBlocks: 0, importsChecked: 0 };
for (const file of files) {
  const rel = path.relative(skillsRoot, file);
  const skill = rel.split(path.sep)[0];
  if (onlySkill && skill !== onlySkill) continue;
  stats.files++;
  const src = fs.readFileSync(file, "utf8");
  const report = (msg) => problems.push(`${rel}: ${msg}`);

  if (rel.endsWith("SKILL.md")) {
    const fm = /^---\n([\s\S]*?)\n---/.exec(src);
    if (!fm) report("missing frontmatter");
    else {
      const name = /^name:\s*(\S+)/m.exec(fm[1])?.[1];
      if (name !== skill) report(`frontmatter name '${name}' does not match directory '${skill}'`);
      if (!/^description:\s*\S/m.test(fm[1])) report("frontmatter missing description");
    }
  }

  const linkRe = /\]\((\.{1,2}\/[^)#\s]+)(#[^)]*)?\)/g;
  for (let m; (m = linkRe.exec(src)); ) {
    if (!fs.existsSync(path.resolve(path.dirname(file), m[1]))) report(`broken link ${m[1]}`);
  }

  if (/[—–]/.test(src)) report("contains an em dash or en dash");

  const blockRe = /(<!--\s*before\s*-->\s*)?```(\w+)?[^\n]*\n([\s\S]*?)```/g;
  for (let m; (m = blockRe.exec(src)); ) {
    stats.codeBlocks++;
    const code = m[3];
    const isBefore = Boolean(m[1]) || /^\s*\/\/\s*Before\b/m.test(code) || skill === "update";
    const importRe = /import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+["']([^"']+)["']/g;
    for (let im; (im = importRe.exec(code)); ) {
      const pkg = im[2];
      const names = exportsByPackage[pkg];
      if (names === undefined) continue;
      if (names === null) {
        report(`${pkg} has no built types in the checkout`);
        continue;
      }
      for (const raw of im[1].replace(/\/\/[^\n]*/g, "").split(",")) {
        const name = raw.trim().replace(/^type\s+/, "").split(/\s+as\s+/)[0]?.trim();
        if (!name) continue;
        stats.importsChecked++;
        if (!names.includes(name) && !isBefore) report(`'${name}' is not exported by ${pkg}`);
      }
    }
    if (isBefore) continue;
    for (const { re, why } of RETIRED) {
      if (re.test(code)) report(`retired convention (${why}): ${re}`);
    }
  }
  if (skill !== "update" && /@assistant-ui\/react-ai-sdk/.test(src.replace(/```[\s\S]*?```/g, ""))) {
    const ok = /re-export|re-exports|superseded|renamed|legacy|older|pinned/i.test(src);
    if (!ok) report("mentions @assistant-ui/react-ai-sdk without noting it only re-exports @assistant-ui/ai-sdk");
  }
}

for (const p of problems) console.log(p);
console.log(JSON.stringify(stats), "problems:", problems.length);
process.exit(problems.length ? 1 : 0);
