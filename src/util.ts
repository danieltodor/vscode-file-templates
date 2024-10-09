import * as vscode from 'vscode';
import * as fs from 'fs';

enum State {
    initialized
}

export async function getExtensionDirectory(context: vscode.ExtensionContext): Promise<vscode.Uri> {
    console.log('Get extension directory');
    const URI = context.globalStorageUri.with({scheme: 'file'});
    if (!context.globalState.get(State.initialized.toString())) {
        console.log('Creating directory because it does not exist');
        await vscode.workspace.fs.createDirectory(URI);
        context.globalState.update(State.initialized.toString(), true);
    }
    return URI;
}

export async function getTemplates(extensionDirectory: vscode.Uri): Promise<string[]> {
    console.log('Get templates');
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
        force: false,
        dereference: true
    };
    await fs.cp(sourceURI.path, destinationURI.path, cpOptions, () => {});
}
