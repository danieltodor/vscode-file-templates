import * as vscode from 'vscode';
import * as util from './util';

export async function createTemplate(context: vscode.ExtensionContext): Promise<void> {
    const {templateDirectory, existingTemplates} = await util.getCommonVariables(context);
    const newTemplateName = await util.showEditableQuickPick(
        existingTemplates,
        {
            placeHolder: 'Name of the new template'
        }
    );
    const URI = await createNewTemplateDirectory(templateDirectory, newTemplateName);
    if (URI) {
        await vscode.env.openExternal(URI);
    }
}

async function createNewTemplateDirectory(templateDirectory: vscode.Uri, directoryName: string): Promise<vscode.Uri | void> {
    const URI = vscode.Uri.joinPath(templateDirectory, directoryName);
    if (await util.directoryExists(URI)) {
        vscode.window.showErrorMessage(`The template "${directoryName}" already exists.`);
        return;
    }
    await vscode.workspace.fs.createDirectory(URI);
    return URI;
}
