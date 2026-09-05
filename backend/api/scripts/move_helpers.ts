import { Project, SyntaxKind } from "ts-morph";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const project = new Project({
  tsConfigFilePath: path.join(__dirname, "../tsconfig.json"),
});

const routesFile = project.getSourceFileOrThrow(path.join(__dirname, "../src/routes/admin.routes.ts"));
const controllerFile = project.getSourceFileOrThrow(path.join(__dirname, "../src/controllers/admin.controller.ts"));

const funcsToMove = ["buildDiagnosticsText", "fetchCiStatus", "fetchLatestMain", "isAncestorOf"];

for (const name of funcsToMove) {
  const func = routesFile.getFunction(name);
  if (func) {
    controllerFile.addFunction({
      name: func.getName(),
      isAsync: func.isAsync(),
      isExported: false,
      parameters: func.getParameters().map(p => ({
        name: p.getName(),
        type: p.getTypeNode()?.getText(),
        hasQuestionToken: p.hasQuestionToken(),
        initializer: p.getInitializer()?.getText()
      })),
      returnType: func.getReturnTypeNode()?.getText(),
      statements: func.getBodyText() || ""
    });
    func.remove();
  }
}

// Also need to move types `CiStatus`, `Commit`, `Tree` etc if they exist
const typesToMove = ["CiStatus"];
for (const name of typesToMove) {
  const t = routesFile.getTypeAlias(name);
  if (t) {
    controllerFile.addTypeAlias({
      name: t.getName(),
      isExported: t.isExported(),
      type: t.getTypeNode()?.getText() || "any"
    });
    t.remove();
  }
  const i = routesFile.getInterface(name);
  if (i) {
    controllerFile.addInterface({
      name: i.getName(),
      isExported: i.isExported(),
      properties: i.getProperties().map(p => ({
        name: p.getName(),
        type: p.getTypeNode()?.getText(),
        hasQuestionToken: p.hasQuestionToken()
      }))
    });
    i.remove();
  }
}

routesFile.saveSync();
controllerFile.saveSync();
