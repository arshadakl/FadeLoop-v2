import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import ts from "typescript";

const roots = ["apps/web/src", "packages/contracts/src", "packages/domain/src"];
async function check(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isDirectory()) await check(file);
    else if (/\.[cm]?[jt]sx?$/.test(file)) {
      const source = await readFile(file, "utf8");
      const ast = ts.createSourceFile(
        file,
        source,
        ts.ScriptTarget.Latest,
        true,
      );
      function visit(node) {
        const specifier =
          ts.isImportDeclaration(node) || ts.isExportDeclaration(node)
            ? node.moduleSpecifier
            : ts.isCallExpression(node) &&
                node.expression.kind === ts.SyntaxKind.ImportKeyword
              ? node.arguments[0]
              : undefined;
        if (specifier && ts.isStringLiteral(specifier)) {
          const name = specifier.text;
          const resolved = ts
            .resolveModuleName(
              name,
              path.resolve(file),
              { moduleResolution: ts.ModuleResolutionKind.Bundler },
              ts.sys,
            )
            .resolvedModule?.resolvedFileName.replaceAll("\\", "/");
          if (
            /^(@fadeloop\/worker-common|cloudflare:|node:)/.test(name) ||
            (resolved &&
              /\/(apps\/(api|ingress|consumer|server)|packages\/worker-common)\//.test(
                resolved,
              ))
          ) {
            throw new Error(
              `Server dependency in browser-safe source: ${file}: ${name}`,
            );
          }
        }
        ts.forEachChild(node, visit);
      }
      visit(ast);
    }
  }
}
for (const root of roots) await check(root);
