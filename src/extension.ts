// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import * as fs from "fs";
import { extname, basename, resolve, dirname, join } from "path";
import { createCallbackGroup } from "./utils/createCallbackGroup";
import { isDataFile, processFile, TextGenerator } from "./utils/generator";

const generatorCache = new Map<string, Function>();
let generatorCacheExpiry = 0;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  let disabled = false;
  let generating = false;

  const dispose = createCallbackGroup();

  console.log("ymlgen is activated");

  dispose.add(
    vscode.workspace.onDidSaveTextDocument(
      async (document: vscode.TextDocument) => {
        if (disabled || generating) {
          return;
        }

        const path = document.uri.fsPath;

        const workspace = vscode.workspace.getWorkspaceFolder(document.uri);

        if (!workspace) {
          return;
        }

        const ext = extname(path);
        const content = document.getText();

        if (!content) {
          return;
        }

        if (!isDataFile(content)) {
          return;
        }

        try {
          const fileName = basename(path, ext);

          await processFile(
            path,
            fileName,
            content,
            (generatorName: string) =>
              findGenerator(generatorName, workspace.uri.fsPath),
            async (fileName, content) => {
              const fullPath = resolve(dirname(path), fileName);
              fs.writeFileSync(fullPath, content);
              vscode.window.showInformationMessage(
                `ymlgen: The output file is generated successfully: ${fullPath}`
              );
            }
          );
        } catch (ex) {
          console.log("ymlgen", ex);
          vscode.window.showErrorMessage((ex as Error).message, {
            detail: `${String(ex)}\n${(ex as Error).stack}`,
          });
        }
      }
    ).dispose
  );

  dispose.add(
    vscode.commands.registerCommand("ymlgen.enable", () => {
      disabled = false;
      vscode.window.showInformationMessage("ymlgen: enabled");
    }).dispose
  );

  dispose.add(
    vscode.commands.registerCommand("ymlgen.disable", () => {
      disabled = true;
      vscode.window.showInformationMessage("ymlgen: disabled");
    }).dispose
  );

  dispose.add(
    vscode.commands.registerCommand("ymlgen.generate", () => {}).dispose
  );

  context.subscriptions.push({ dispose: dispose.call });
}

const requireUncached = <T>(path: string) => {
  const resolvedPath = require.resolve(path);
  delete require.cache[resolvedPath];
  return require(path) as T;
};

const findGenerator = async (
  generatorName: string,
  workspaceFolder: string
): Promise<TextGenerator<any>> => {
  if (!generatorCacheExpiry || generatorCacheExpiry < Date.now()) {
    generatorCache.clear();
  }

  const generatorPath = join(
    workspaceFolder,
    `.ymlgen/generators/${generatorName}.js`
  );

  return requireUncached<TextGenerator<any>>(generatorPath);
};

// this method is called when your extension is deactivated
export function deactivate() {}
