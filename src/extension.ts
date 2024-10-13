import * as vscode from 'vscode';
import * as util from './util';
import { createTemplate } from './create';
import { openTemplate } from './open';
import { renameTemplate } from './rename';
import { removeTemplate } from './remove';
import { useTemplate } from './use';

async function runCommand(command: (...args: any[]) => Promise<void>, ...args: any[]) {
    try {
        await command(...args);
    }
    catch (error) {
        const message = util.getErrorMessage(error);
        if (message) {
            vscode.window.showErrorMessage(message);
        }
    }
}

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.createTemplate', () => {
            runCommand(createTemplate, context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.openTemplate', () => {
            runCommand(openTemplate, context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.renameTemplate', () => {
            runCommand(renameTemplate, context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.removeTemplate', () => {
            runCommand(removeTemplate, context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.useTemplate', (clickedURI: vscode.Uri | undefined, selectedURIs: vscode.Uri[] | undefined) => {
            runCommand(useTemplate, context, false, selectedURIs);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates-n.useTemplates', (clickedURI: vscode.Uri | undefined, selectedURIs: vscode.Uri[] | undefined) => {
            runCommand(useTemplate, context, true, selectedURIs);
        })
    );
}

export function deactivate() {}
