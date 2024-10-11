import * as vscode from 'vscode';
import * as util from './util';

export async function renameTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {extensionDirectory, existingTemplates} = await util.getCommonVariables(context);
    const templateName = await vscode.window.showQuickPick(
        existingTemplates,
        {
            placeHolder: 'Select the template you want to rename'
        }
    );
    const newName = await vscode.window.showInputBox({placeHolder: 'New name for the template'});
    if (!templateName || !newName) {
        return;
    }
    const URI = vscode.Uri.joinPath(extensionDirectory, templateName);
    const newURI = vscode.Uri.joinPath(extensionDirectory, newName);
    if (await util.directoryExists(newURI)) {
        vscode.window.showErrorMessage(`The template "${newName}" already exists.`);
        return;
    }
    await vscode.workspace.fs.rename(URI, newURI);
}
