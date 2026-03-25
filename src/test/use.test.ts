import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as use from '../use';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('use.ts tests', () => {
    test('uses template correctly', async () => {
        const mockContext = {} as any;

        const wsPath = path.join(state.tempDir, 'workspace');
        fs.mkdirSync(wsPath);

        const srcPath = path.join(state.tempDir, 'template1');
        fs.mkdirSync(srcPath);
        fs.writeFileSync(path.join(srcPath, 'test.txt'), 'content');

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([{name: 'ws', uri: vscode.Uri.file(wsPath)}]);

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
        state.sandbox.stub(util, 'getConfigValue').returns({});

        await use.useTemplate(mockContext, false, undefined);
        await util.sleep(100);

        assert.strictEqual(fs.existsSync(path.join(wsPath, 'test.txt')), true);
        assert.strictEqual(fs.readFileSync(path.join(wsPath, 'test.txt'), 'utf8'), 'content');
    });

    test('handles circular dependencies cleanly', async () => {
        const mockContext = {} as any;
        const wsPath = path.join(state.tempDir, 'workspace');
        fs.mkdirSync(wsPath);

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([{name: 'ws', uri: vscode.Uri.file(wsPath)}]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['vTemplate']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('vTemplate' as any);
        state.sandbox.stub(util, 'getConfigValue').returns({
            vTemplate: ['vTemplate']
        });

        const showErrorStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        await use.useTemplate(mockContext, false, undefined);

        assert.strictEqual(showErrorStub.calledOnce, true);
        assert.ok(showErrorStub.firstCall.args[0].includes('Circular dependency'));
    });

    test('expands nested virtual templates before copying', async () => {
        const mockContext = {} as any;
        const wsPath = path.join(state.tempDir, 'workspace');
        const copyFilesStub = state.sandbox.stub(util, 'copyFiles').resolves();
        const sleepStub = state.sandbox.stub(util, 'sleep').resolves();

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([{name: 'ws', uri: vscode.Uri.file(wsPath)}]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['combo', 'base', 'child']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('combo' as any);
        state.sandbox.stub(util, 'getConfigValue').returns({
            combo: ['base', 'nested'],
            nested: ['child']
        });

        await use.useTemplate(mockContext, false, undefined);

        assert.deepStrictEqual(copyFilesStub.getCalls().map(call => call.args[0].fsPath), [
            path.join(state.tempDir, 'base'),
            path.join(state.tempDir, 'child')
        ]);
        assert.deepStrictEqual(copyFilesStub.getCalls().map(call => call.args[1].fsPath), [wsPath, wsPath]);
        assert.strictEqual(sleepStub.callCount, 2);
    });

    test('returns early when no template is selected', async () => {
        const mockContext = {} as any;
        const copyFilesStub = state.sandbox.stub(util, 'copyFiles').resolves();

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([{name: 'ws', uri: vscode.Uri.file(state.tempDir)}]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

        await use.useTemplate(mockContext, false, undefined);

        assert.strictEqual(copyFilesStub.called, false);
    });

    test('copies multiple templates into explicit destination URIs', async () => {
        const mockContext = {} as any;
        const destinationOne = vscode.Uri.file(path.join(state.tempDir, 'folder-one'));
        const destinationTwo = vscode.Uri.file(path.join(state.tempDir, 'folder-two'));
        const copyFilesStub = state.sandbox.stub(util, 'copyFiles').resolves();
        const sleepStub = state.sandbox.stub(util, 'sleep').resolves();

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([{name: 'ws', uri: vscode.Uri.file(state.tempDir)}]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1', 'template2']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves(['template1', 'template2'] as any);
        state.sandbox.stub(util, 'getConfigValue').returns({});

        await use.useTemplate(mockContext, true, [destinationOne, destinationTwo]);

        assert.strictEqual(copyFilesStub.callCount, 4);
        assert.deepStrictEqual(copyFilesStub.getCalls().map(call => [call.args[0].fsPath, call.args[1].fsPath]), [
            [path.join(state.tempDir, 'template1'), destinationOne.fsPath],
            [path.join(state.tempDir, 'template1'), destinationTwo.fsPath],
            [path.join(state.tempDir, 'template2'), destinationOne.fsPath],
            [path.join(state.tempDir, 'template2'), destinationTwo.fsPath]
        ]);
        assert.strictEqual(sleepStub.callCount, 4);
    });

    test('uses only selected workspaces in a multi-root workspace', async () => {
        const mockContext = {} as any;
        const workspaceOne = vscode.Uri.file(path.join(state.tempDir, 'workspace-one'));
        const workspaceTwo = vscode.Uri.file(path.join(state.tempDir, 'workspace-two'));
        const copyFilesStub = state.sandbox.stub(util, 'copyFiles').resolves();

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            {name: 'one', uri: workspaceOne},
            {name: 'two', uri: workspaceTwo}
        ]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        const showQuickPickStub = state.sandbox.stub(vscode.window, 'showQuickPick');
        showQuickPickStub.onFirstCall().resolves('template1' as any);
        showQuickPickStub.onSecondCall().resolves(['two'] as any);
        state.sandbox.stub(util, 'getConfigValue').returns({});

        await use.useTemplate(mockContext, false, undefined);

        assert.strictEqual(copyFilesStub.calledOnce, true);
        assert.strictEqual(copyFilesStub.firstCall.args[1].fsPath, workspaceTwo.fsPath);
    });

    test('does nothing when multi-root destination selection is cancelled', async () => {
        const mockContext = {} as any;
        const copyFilesStub = state.sandbox.stub(util, 'copyFiles').resolves();

        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value([
            {name: 'one', uri: vscode.Uri.file(path.join(state.tempDir, 'workspace-one'))},
            {name: 'two', uri: vscode.Uri.file(path.join(state.tempDir, 'workspace-two'))}
        ]);
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        const showQuickPickStub = state.sandbox.stub(vscode.window, 'showQuickPick');
        showQuickPickStub.onFirstCall().resolves('template1' as any);
        showQuickPickStub.onSecondCall().resolves(undefined);
        state.sandbox.stub(util, 'getConfigValue').returns({});

        await use.useTemplate(mockContext, false, undefined);

        assert.strictEqual(copyFilesStub.called, false);
    });

    test('does nothing if no workspace is opened', async () => {
        const mockContext = {} as any;
        state.sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);
        const showErrorStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        await use.useTemplate(mockContext, false, undefined);
        assert.strictEqual(showErrorStub.calledOnce, true);
    });
});
