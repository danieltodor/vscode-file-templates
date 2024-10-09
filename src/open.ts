import * as vscode from 'vscode';
import * as util from './util';

export async function openTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {extensionDirectory, existingTemplates} = await util.getCommonVariables(context);
    const templateName = await vscode.window.showQuickPick(existingTemplates);
    if (!templateName) {
        return;
    }
    const URI = vscode.Uri.joinPath(extensionDirectory, templateName);
    await vscode.env.openExternal(URI);
}
