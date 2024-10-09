import * as vscode from 'vscode';
import * as util from './util';

export async function removeTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {extensionDirectory, existingTemplates} = await util.getCommonVariables(context);
    const templateName = await vscode.window.showQuickPick(existingTemplates);
    if (!templateName) {
        return;
    }
    const URI = vscode.Uri.joinPath(extensionDirectory, templateName);
    await vscode.workspace.fs.delete(URI, {recursive: true, useTrash: true});
}
