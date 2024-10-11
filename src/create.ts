import * as vscode from 'vscode';
import * as util from './util';

export async function createTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {extensionDirectory, existingTemplates} = await util.getCommonVariables(context);
    const newTemplateName = await util.showEditableQuickPick(
        existingTemplates,
        {
            placeHolder: 'Name of the new template'
        }
    );
    const URI = await createNewTemplateDirectory(extensionDirectory, newTemplateName);
    if (URI) {
        await vscode.env.openExternal(URI);
    }
}

async function createNewTemplateDirectory(extensionDirectory: vscode.Uri, directoryName: string): Promise<vscode.Uri | void> {
    const URI = vscode.Uri.joinPath(extensionDirectory, directoryName);
    if (await util.directoryExists(URI)) {
        vscode.window.showErrorMessage(`The template "${directoryName}" already exists.`);
        return;
    }
    await vscode.workspace.fs.createDirectory(URI);
    return URI;
}
