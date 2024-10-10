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
        vscode.commands.registerCommand('file-templates.createTemplate', () => {
            runCommand(createTemplate, context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.openTemplate', () => {
            runCommand(openTemplate, context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.renameTemplate', () => {
            runCommand(renameTemplate, context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.removeTemplate', () => {
            runCommand(removeTemplate, context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.useTemplate', () => {
            runCommand(useTemplate, context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.useTemplates', () => {
            runCommand(useTemplate, context, true);
        })
    );
}

export function deactivate() {}
