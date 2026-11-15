#!/usr/bin/env node
// Generates convex/_generated without a deployment, using the templates shipped in the installed
// convex package. Replace with `npx convex dev --once` once an authorized deployment is configured.
const fs = require("node:fs");
const path = require("node:path");
const templates = path.join(path.dirname(require.resolve("convex/package.json")), "dist/cjs/cli/codegen_templates");
const { apiCodegen } = require(path.join(templates, "api.js"));
const { serverCodegen } = require(path.join(templates, "server.js"));
const Module = require("node:module");
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (request.endsWith("directoryStructure.js")) return {};
  return originalLoad.call(this, request, parent, isMain);
};
const { dynamicDataModelDTS } = require(path.join(templates, "dataModel.js"));
Module._load = originalLoad;

const convexDir = path.join(path.dirname(require.resolve("../package.json")), "convex");
const outDir = path.join(convexDir, "_generated");
const modules = [];
(function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(convexDir, full).split(path.sep).join("/");
    if (entry.isDirectory()) {
      if (!entry.name.startsWith("_")) walk(full);
      continue;
    }
    if (!/\.ts$/.test(entry.name) || /\.test\.ts$/.test(entry.name) || /\.d\.ts$/.test(entry.name)) continue;
    if (["schema.ts", "convex.config.ts", "auth.config.ts", "crons.ts", "http.ts"].includes(rel)) continue;
    modules.push(rel);
  }
})(convexDir);
modules.sort();

const api = apiCodegen(modules, { useTypeScript: false });
const server = serverCodegen({ useTypeScript: false });
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(path.join(outDir, "api.d.ts"), api.DTS);
fs.writeFileSync(path.join(outDir, "api.js"), api.JS);
fs.writeFileSync(path.join(outDir, "server.d.ts"), server.DTS);
fs.writeFileSync(path.join(outDir, "server.js"), server.JS);
fs.writeFileSync(path.join(outDir, "dataModel.d.ts"), dynamicDataModelDTS());
console.log("Generated convex/_generated for modules:", modules.join(", "));
