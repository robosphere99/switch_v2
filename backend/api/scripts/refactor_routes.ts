import { Project, SyntaxKind, ArrowFunction, FunctionExpression } from "ts-morph";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const project = new Project({
  tsConfigFilePath: path.join(__dirname, "../tsconfig.json"),
});

function toCamelCase(str: string) {
  return str.replace(/[^a-zA-Z0-9]+(.)/g, (m, chr) => chr.toUpperCase());
}

function generateName(method: string, routePath: string) {
  const cleanPath = routePath.replace(/[:\/_-]+/g, " ").trim();
  const parts = cleanPath.split(" ").filter(Boolean);
  const pathName = parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join("");
  return `${method.toLowerCase()}${pathName || "Root"}`;
}

async function refactor(routeName: string) {
  const routesPath = path.join(__dirname, `../src/routes/${routeName}.routes.ts`);
  const controllerPath = path.join(__dirname, `../src/controllers/${routeName}.controller.ts`);

  if (!fs.existsSync(controllerPath)) {
    fs.writeFileSync(controllerPath, `import { Request, Response } from "express";\nimport { prisma } from "../lib/prisma";\nimport { ok } from "../lib/response";\n\n`);
  }

  const routesFile = project.addSourceFileAtPath(routesPath);
  const controllerFile = project.addSourceFileAtPath(controllerPath);
  
  // Ensure the controller is imported in the routes file
  const controllerImportName = `${routeName}Controller`;
  let hasImport = false;
  routesFile.getImportDeclarations().forEach(imp => {
    if (imp.getModuleSpecifierValue() === `../controllers/${routeName}.controller`) {
      hasImport = true;
    }
  });
  if (!hasImport) {
    routesFile.addImportDeclaration({
      namespaceImport: controllerImportName,
      moduleSpecifier: `../controllers/${routeName}.controller`
    });
  }

  let extractedCount = 0;

  routesFile.forEachDescendant(node => {
    if (node.getKind() === SyntaxKind.CallExpression) {
      const callExpr = node.asKind(SyntaxKind.CallExpression);
      if (!callExpr) return;
      const propAccess = callExpr.getExpressionIfKind(SyntaxKind.PropertyAccessExpression);
      if (!propAccess) return;
      
      const routerExpr = propAccess.getExpression();
      const method = propAccess.getName();
      
      if (!["get", "post", "put", "patch", "delete"].includes(method)) return;
      
      const args = callExpr.getArguments();
      if (args.length < 2) return;
      
      const pathArg = args[0];
      if (pathArg.getKind() !== SyntaxKind.StringLiteral) return;
      
      const routePath = pathArg.asKind(SyntaxKind.StringLiteral)!.getLiteralValue();
      
      const lastArg = args[args.length - 1];
      if (lastArg.getKind() === SyntaxKind.ArrowFunction || lastArg.getKind() === SyntaxKind.FunctionExpression) {
        const funcNode = lastArg as (ArrowFunction | FunctionExpression);
        
        // Skip if it's very small or looks like a middleware (not (req, res))
        const params = funcNode.getParameters();
        if (params.length > 0 && params[0].getName() !== "req" && params[0].getName() !== "_req") {
           // Might be an error handler or something else, but standard is req, res
        }

        let funcName = generateName(method, routePath);
        
        // Handle duplicates
        let counter = 1;
        while (controllerFile.getFunction(funcName) || controllerFile.getVariableDeclaration(funcName)) {
           funcName = `${generateName(method, routePath)}${counter}`;
           counter++;
        }

        // Add types to req, res if missing
        let funcText = funcNode.getText();
        
        // Replace `async (req, res) =>` or `async (req: Request, res: Response) =>` with full function definition
        // We can just export it as a const arrow function in controller
        
        // Some inline functions use (req: Request, res: Response). To simplify, we just write the text
        const isAsync = funcNode.hasModifier(SyntaxKind.AsyncKeyword);
        const asyncStr = isAsync ? "async " : "";
        
        // Format the parameters text properly
        const paramsText = funcNode.getParameters().map(p => {
           let type = p.getTypeNode()?.getText();
           if (!type) {
             if (p.getName() === "req" || p.getName() === "_req") type = "Request";
             else if (p.getName() === "res") type = "Response";
             else if (p.getName() === "next") type = "NextFunction";
             else type = "any";
           }
           return `${p.getName()}: ${type}`;
        }).join(", ");
        
        const bodyText = funcNode.getBody().getText();
        
        // Build the new function code
        const newFuncCode = `export const ${funcName} = ${asyncStr}(${paramsText}) => ${bodyText};`;
        
        controllerFile.addStatements(`\n${newFuncCode}\n`);
        
        // Replace the argument in routes file
        callExpr.removeArgument(args.length - 1);
        callExpr.addArgument(`${controllerImportName}.${funcName}`);
        
        extractedCount++;
      }
    }
  });

  await routesFile.save();
  await controllerFile.save();
  console.log(`Refactored ${extractedCount} routes in ${routeName}`);
}

async function run() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error("Provide a route name, e.g. admin");
    process.exit(1);
  }
  for (const name of args) {
    await refactor(name);
  }
}

run().catch(console.error);
