import * as vscode from 'vscode';
import * as fs from 'fs';

enum State {
    initialized
}

export async function sleep(milliseconds: number) {
    return new Promise(resolve => setTimeout(resolve, milliseconds));
}

export function getErrorMessage(error: unknown): string | void {
    if (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

export function getConfigValue(name: string): unknown {
    return vscode.workspace.getConfiguration().get(name);
}

export async function getTemplateDirectory(context: vscode.ExtensionContext): Promise<vscode.Uri> {
    const customDirectory = getConfigValue('fileTemplates.template.customDirectory') as string;
    if (customDirectory) {
        return vscode.Uri.parse(fs.realpathSync(customDirectory));
    }
    const URI = context.globalStorageUri.with({scheme: 'file'});
    if (!context.globalState.get(State.initialized.toString())) {
        await vscode.workspace.fs.createDirectory(URI);
        context.globalState.update(State.initialized.toString(), true);
    }
    return URI;
}

export async function getTemplates(templateDirectory: vscode.Uri): Promise<string[]> {
    const directoryContent = await vscode.workspace.fs.readDirectory(templateDirectory);
    let templates = directoryContent.filter(item => item[1] === vscode.FileType.Directory);
    return templates.map(item => item[0]);
}

export async function getCommonVariables(context: vscode.ExtensionContext) {
    const templateDirectory = await getTemplateDirectory(context);
    const existingTemplates = await getTemplates(templateDirectory);
    return {templateDirectory, existingTemplates};
}

export async function showEditableQuickPick(items: string[], options: vscode.QuickPickOptions = {}): Promise<string> {
    return new Promise((resolve) => {
        const quickPick = vscode.window.createQuickPick();
        quickPick.title = options.title;
        quickPick.placeholder = options.placeHolder;
        quickPick.canSelectMany = options.canPickMany || false;
        quickPick.ignoreFocusOut = options.ignoreFocusOut || false;
        quickPick.matchOnDescription = options.matchOnDescription || false;
        quickPick.matchOnDetail = options.matchOnDetail || false;
        quickPick.items = items.map(item => ({label: item}));
        // Add current value to items, so new value can also be selected
        quickPick.onDidChangeValue(() => {
            if (!items.includes(quickPick.value)) {
                quickPick.items = [quickPick.value, ...items].map(item => ({label: item}));
            }
        });
        quickPick.onDidAccept(() => {
            const selection = quickPick.activeItems[0];
            resolve(selection.label);
            quickPick.hide();
        });
        quickPick.show();
    });
}

export async function directoryExists(URI: vscode.Uri): Promise<boolean> {
    try {
        const fileStat = await vscode.workspace.fs.stat(URI);
        if (fileStat.type === vscode.FileType.Directory) {
            return true;
        }
    }
    catch {}
    return false;
}

export async function copyFiles(sourceURI: vscode.Uri, destinationURI: vscode.Uri): Promise<void> {
    const cpOptions: fs.CopyOptions = {
        recursive: true,
        dereference: getConfigValue('fileTemplates.copy.dereferenceSymlinks') as boolean,
        force: getConfigValue('fileTemplates.copy.force') as boolean
    };
    await fs.cp(sourceURI.fsPath, destinationURI.fsPath, cpOptions, (error) => {
        const message = getErrorMessage(error);
        if (message) {
            vscode.window.showErrorMessage(message);
        }
    });
}
