import * as vscode from 'vscode';
import * as util from './util';

export async function removeTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {templateDirectory, existingTemplates} = await util.getCommonVariables(context);
    const templateName = await vscode.window.showQuickPick(
        existingTemplates,
        {
            placeHolder: 'Select the template you want to remove'
        }
    );
    if (!templateName) {
        return;
    }
    const URI = vscode.Uri.joinPath(templateDirectory, templateName);
    await vscode.workspace.fs.delete(URI, {recursive: true, useTrash: true});
}
