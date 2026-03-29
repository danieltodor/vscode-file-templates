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
        return vscode.Uri.parse('file:' + fs.realpathSync(customDirectory));
    }
    const URI = context.globalStorageUri.with({scheme: 'file'});
    if (!context.globalState.get(State.initialized.toString())) {
        await vscode.workspace.fs.createDirectory(URI);
        context.globalState.update(State.initialized.toString(), true);
    }
    return URI;
}

export async function getTemplates(templateDirectory: vscode.Uri, includeVirtual: boolean = false): Promise<string[]> {
    const directoryContent = await vscode.workspace.fs.readDirectory(templateDirectory);
    let templates = directoryContent.filter(item => item[1] === vscode.FileType.Directory).map(item => item[0]);
    if (includeVirtual) {
        const virtualConfig = getConfigValue('fileTemplates.template.virtual') as Record<string, string[]>;
        if (virtualConfig && typeof virtualConfig === 'object') {
            const virtualNames = Object.keys(virtualConfig);
            templates.push(...virtualNames);
        }
    }
    templates = [...new Set(templates)];
    templates.sort((a, b) => a.localeCompare(b));
    return templates;
}

export async function getCommonVariables(context: vscode.ExtensionContext, includeVirtual: boolean = false) {
    const templateDirectory = await getTemplateDirectory(context);
    const existingTemplates = await getTemplates(templateDirectory, includeVirtual);
    return {templateDirectory, existingTemplates};
}

export async function showEditableQuickPick(items: string[], options: vscode.QuickPickOptions = {}): Promise<string | undefined> {
    return new Promise((resolve) => {
        const quickPick = vscode.window.createQuickPick();
        let settled = false;

        const finish = (value: string | undefined) => {
            if (settled) {
                return;
            }
            settled = true;
            quickPick.dispose();
            resolve(value);
        };

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
            const selection = quickPick.activeItems[0]?.label ?? (quickPick.value || undefined);
            finish(selection);
            quickPick.hide();
        });
        quickPick.onDidHide(() => {
            finish(undefined);
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
    try {
        await fs.promises.cp(sourceURI.fsPath, destinationURI.fsPath, cpOptions);
    }
    catch (error) {
        const message = getErrorMessage(error);
        if (message) {
            vscode.window.showErrorMessage(message);
        }
    }
}
