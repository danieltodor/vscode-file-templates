import * as vscode from 'vscode';
import * as util from './util';

export async function openTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {templateDirectory, existingTemplates} = await util.getCommonVariables(context);
    const templateName = await vscode.window.showQuickPick(
        existingTemplates,
        {
            placeHolder: 'Select the template you want to open'
        }
    );
    if (!templateName) {
        return;
    }
    const URI = vscode.Uri.joinPath(templateDirectory, templateName);
    await vscode.env.openExternal(URI);
}
