import * as vscode from 'vscode';
import * as util from './util';

export async function useTemplate(context: vscode.ExtensionContext, many: boolean = false): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Open a folder/workspace first');
        return;
    }
    const {extensionDirectory, existingTemplates} = await util.getCommonVariables(context);
    const result = await vscode.window.showQuickPick(existingTemplates, {canPickMany: many});
    if (!result) {
        return;
    }
    const templateNames = typeof result === 'string' ? [result] : result;
    const destinationURIs = await getDestinationURIs();
    for (const destinationURI of destinationURIs) {
        for (const templateName of templateNames) {
            const sourceURI = vscode.Uri.joinPath(extensionDirectory, templateName);
            await util.copyFiles(sourceURI, destinationURI);
        }
    }
}

async function getDestinationURIs(): Promise<vscode.Uri[]> {
    if (!vscode.workspace.workspaceFolders) {
        return [];
    }
    else if (vscode.workspace.workspaceFolders.length === 1) {
        return [vscode.workspace.workspaceFolders[0].uri];
    }
    else {
        const items = vscode.workspace.workspaceFolders.map(item => item.name);
        const result = await vscode.window.showQuickPick(items, {canPickMany: true});
        if (!result) {
            return [];
        }
        const selection = vscode.workspace.workspaceFolders.filter(item => result.includes(item.name));
        return selection.map(item => item.uri);
    }
}
