import * as vscode from 'vscode';
import { createTemplate } from './create';
import { openTemplate } from './open';
import { renameTemplate } from './rename';
import { removeTemplate } from './remove';
import { useTemplate } from './use';

export function activate(context: vscode.ExtensionContext) {
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.createTemplate', () => {
            createTemplate(context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.openTemplate', () => {
            openTemplate(context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.renameTemplate', () => {
            renameTemplate(context);
        })
    );
    context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.removeTemplate', () => {
            removeTemplate(context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.useTemplate', () => {
            useTemplate(context);
        })
    );
	context.subscriptions.push(
        vscode.commands.registerCommand('file-templates.useTemplates', () => {
            useTemplate(context, true);
        })
    );
}

export function deactivate() {}
