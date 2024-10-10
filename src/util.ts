import * as vscode from 'vscode';
import * as fs from 'fs';

enum State {
    initialized
}

export function getErrorMessage(error: unknown): string | void {
    if (error) {
        return error instanceof Error ? error.message : String(error);
    }
}

export function getConfigValue(name: string, extensionName: string = 'file-templates-n'): unknown {
    return vscode.workspace.getConfiguration(extensionName).get(name);
}

export async function getExtensionDirectory(context: vscode.ExtensionContext): Promise<vscode.Uri> {
    const URI = context.globalStorageUri.with({scheme: 'file'});
    if (!context.globalState.get(State.initialized.toString())) {
        await vscode.workspace.fs.createDirectory(URI);
        context.globalState.update(State.initialized.toString(), true);
    }
    return URI;
}

export async function getTemplates(extensionDirectory: vscode.Uri): Promise<string[]> {
    const directoryList = await vscode.workspace.fs.readDirectory(extensionDirectory);
    return directoryList.map(item => item[0]);
}

export async function getCommonVariables(context: vscode.ExtensionContext) {
    const extensionDirectory = await getExtensionDirectory(context);
    const existingTemplates = await getTemplates(extensionDirectory);
    return {extensionDirectory, existingTemplates};
}

export async function showEditableQuickPick(placeholder: string, items: string[]): Promise<string> {
    return new Promise((resolve) => {
        const quickPick = vscode.window.createQuickPick();
        quickPick.placeholder = placeholder;
        quickPick.items = items.map(item => ({label: item}));
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
        dereference: getConfigValue('dereferenceSymlinks') as boolean,
        force: getConfigValue('force') as boolean
    };
    await fs.cp(sourceURI.fsPath, destinationURI.fsPath, cpOptions, (error) => {
        const message = getErrorMessage(error);
        if (message) {
            vscode.window.showErrorMessage(message);
        }
    });
}
