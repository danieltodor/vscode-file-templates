import * as vscode from 'vscode';
import * as util from './util';

export async function useTemplate(context: vscode.ExtensionContext, many: boolean = false, URIs: vscode.Uri[] | undefined): Promise<void> {
    if (!vscode.workspace.workspaceFolders) {
        vscode.window.showErrorMessage('Open a folder/workspace first');
        return;
    }
    const {templateDirectory, existingTemplates} = await util.getCommonVariables(context, true);
    const result = await vscode.window.showQuickPick(
        existingTemplates,
        {
            placeHolder: 'Select the template you want to use',
            canPickMany: many
        }
    );
    if (!result) {
        return;
    }
    const templateNames = typeof result === 'string' ? [result] : result;
    const virtualConfig = util.getConfigValue('fileTemplates.template.virtual') as Record<string, string[]> || {};

    const resolveTemplates = (names: string[], visited: Set<string> = new Set()): string[] => {
        const resolved: string[] = [];
        for (const name of names) {
            if (virtualConfig[name]) {
                if (visited.has(name)) {
                    vscode.window.showErrorMessage(`Circular dependency detected in virtual template: ${name}`);
                    continue;
                }
                visited.add(name);
                resolved.push(...resolveTemplates(virtualConfig[name], visited));
                visited.delete(name);
            } else {
                resolved.push(name);
            }
        }
        return resolved;
    };

    const flatTemplateNames = resolveTemplates(templateNames);

    const destinationURIs = URIs?.length ? URIs : await getDestinationURIs();
    for (const templateName of flatTemplateNames) {
        const sourceURI = vscode.Uri.joinPath(templateDirectory, templateName);
        for (const destinationURI of destinationURIs) {
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
        const result = await vscode.window.showQuickPick(
            items,
            {
                placeHolder: 'Select the target workspace(s)',
                canPickMany: true
            }
        );
        if (!result) {
            return [];
        }
        const selection = vscode.workspace.workspaceFolders.filter(item => result.includes(item.name));
        return selection.map(item => item.uri);
    }
}
