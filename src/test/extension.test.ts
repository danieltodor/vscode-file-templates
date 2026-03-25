import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';
import * as create from '../create';
import * as extension from '../extension';
import * as use from '../use';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('extension.ts tests', () => {
    test('activate registers all contributed commands', () => {
        const registerCommandStub = state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => ({command, callback}) as any);
        const context = {subscriptions: [] as any[]} as vscode.ExtensionContext;

        extension.activate(context);

        assert.deepStrictEqual(registerCommandStub.getCalls().map(call => call.args[0]), [
            'fileTemplates.createTemplate',
            'fileTemplates.openTemplate',
            'fileTemplates.renameTemplate',
            'fileTemplates.removeTemplate',
            'fileTemplates.useTemplate',
            'fileTemplates.useTemplates'
        ]);
        assert.strictEqual(context.subscriptions.length, 6);
    });

    test('create command surfaces thrown errors through showErrorMessage', async () => {
        const callbacks = new Map<string, (...args: any[]) => void>();
        state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
            callbacks.set(command, callback);
            return {dispose() {}} as any;
        });
        state.sandbox.stub(create, 'createTemplate').rejects(new Error('create failed'));
        const showErrorStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        extension.activate({subscriptions: []} as any);
        callbacks.get('fileTemplates.createTemplate')?.();
        await util.sleep(0);

        assert.strictEqual(showErrorStub.calledOnce, true);
        assert.strictEqual(showErrorStub.firstCall.args[0], 'create failed');
    });

    test('useTemplate command forwards clicked explorer URI when no selection array is provided', async () => {
        const callbacks = new Map<string, (...args: any[]) => void>();
        state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
            callbacks.set(command, callback);
            return {dispose() {}} as any;
        });
        const useTemplateStub = state.sandbox.stub(use, 'useTemplate').resolves();
        const context = {subscriptions: []} as any;
        const clickedURI = vscode.Uri.file(path.join(state.tempDir, 'target'));

        extension.activate(context);
        callbacks.get('fileTemplates.useTemplate')?.(clickedURI, undefined);
        await util.sleep(0);

        assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, false, [clickedURI]), true);
    });

    test('useTemplates command prefers selected URIs over the clicked explorer URI', async () => {
        const callbacks = new Map<string, (...args: any[]) => void>();
        state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
            callbacks.set(command, callback);
            return {dispose() {}} as any;
        });
        const useTemplateStub = state.sandbox.stub(use, 'useTemplate').resolves();
        const context = {subscriptions: []} as any;
        const clickedURI = vscode.Uri.file(path.join(state.tempDir, 'clicked'));
        const selectedURIs = [vscode.Uri.file(path.join(state.tempDir, 'one')), vscode.Uri.file(path.join(state.tempDir, 'two'))];

        extension.activate(context);
        callbacks.get('fileTemplates.useTemplates')?.(clickedURI, selectedURIs);
        await util.sleep(0);

        assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, true, selectedURIs), true);
    });

    test('useTemplates command falls back to the clicked explorer URI when selection is empty', async () => {
        const callbacks = new Map<string, (...args: any[]) => void>();
        state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
            callbacks.set(command, callback);
            return {dispose() {}} as any;
        });
        const useTemplateStub = state.sandbox.stub(use, 'useTemplate').resolves();
        const context = {subscriptions: []} as any;
        const clickedURI = vscode.Uri.file(path.join(state.tempDir, 'clicked'));

        extension.activate(context);
        callbacks.get('fileTemplates.useTemplates')?.(clickedURI, []);
        await util.sleep(0);

        assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, true, [clickedURI]), true);
    });

    test('useTemplate command passes undefined destinations when invoked without explorer context', async () => {
        const callbacks = new Map<string, (...args: any[]) => void>();
        state.sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
            callbacks.set(command, callback);
            return {dispose() {}} as any;
        });
        const useTemplateStub = state.sandbox.stub(use, 'useTemplate').resolves();
        const context = {subscriptions: []} as any;

        extension.activate(context);
        callbacks.get('fileTemplates.useTemplate')?.(undefined, undefined);
        await util.sleep(0);

        assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, false, undefined), true);
    });
});
