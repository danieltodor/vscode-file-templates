import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as util from '../util';
import { createMockQuickPick, setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('util.ts tests', () => {
    test('getErrorMessage returns correct message', () => {
        assert.strictEqual(util.getErrorMessage(new Error('Test error')), 'Test error');
        assert.strictEqual(util.getErrorMessage('String error'), 'String error');
    });

    test('getTemplateDirectory uses the custom directory when configured', async () => {
        const customDir = path.join(state.tempDir, 'custom');
        fs.mkdirSync(customDir);

        const getConfigurationStub = state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => name === 'fileTemplates.template.customDirectory' ? customDir : undefined
        } as any);
        const updateStub = state.sandbox.stub().resolves();
        const storageUri = vscode.Uri.file(path.join(state.tempDir, 'storage'));

        const result = await util.getTemplateDirectory({
            globalStorageUri: storageUri,
            globalState: {get: () => false, update: updateStub}
        } as any);

        assert.strictEqual(result.fsPath, fs.realpathSync(customDir));
        assert.strictEqual(updateStub.called, false);
        assert.strictEqual(getConfigurationStub.calledOnce, true);
        assert.strictEqual(fs.existsSync(storageUri.fsPath), false);
    });

    test('getTemplateDirectory initializes global storage on first run', async () => {
        const storageUri = vscode.Uri.file(path.join(state.tempDir, 'storage'));
        const updateStub = state.sandbox.stub().resolves();
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({get: () => ''} as any);

        const result = await util.getTemplateDirectory({
            globalStorageUri: storageUri,
            globalState: {get: () => false, update: updateStub}
        } as any);

        assert.strictEqual(result.fsPath, storageUri.fsPath);
        assert.strictEqual(fs.existsSync(storageUri.fsPath), true);
        assert.strictEqual(updateStub.calledOnceWithExactly('0', true), true);
    });

    test('getTemplateDirectory skips initialization when already initialized', async () => {
        const storageUri = vscode.Uri.file(path.join(state.tempDir, 'storage'));
        const updateStub = state.sandbox.stub().resolves();
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({get: () => ''} as any);

        const result = await util.getTemplateDirectory({
            globalStorageUri: storageUri,
            globalState: {get: () => true, update: updateStub}
        } as any);

        assert.strictEqual(result.fsPath, storageUri.fsPath);
        assert.strictEqual(fs.existsSync(storageUri.fsPath), false);
        assert.strictEqual(updateStub.called, false);
    });

    test('getTemplates merges virtual templates, removes duplicates and sorts names', async () => {
        fs.mkdirSync(path.join(state.tempDir, 'beta'));
        fs.mkdirSync(path.join(state.tempDir, 'alpha'));
        fs.writeFileSync(path.join(state.tempDir, 'file.txt'), 'ignored');
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => name === 'fileTemplates.template.virtual' ? {gamma: ['beta'], alpha: ['gamma']} : undefined
        } as any);

        const result = await util.getTemplates(vscode.Uri.file(state.tempDir), true);

        assert.deepStrictEqual(result, ['alpha', 'beta', 'gamma']);
    });

    test('getTemplates ignores invalid virtual template configuration', async () => {
        fs.mkdirSync(path.join(state.tempDir, 'beta'));
        fs.mkdirSync(path.join(state.tempDir, 'alpha'));
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => name === 'fileTemplates.template.virtual' ? 'invalid' : undefined
        } as any);

        const result = await util.getTemplates(vscode.Uri.file(state.tempDir), true);

        assert.deepStrictEqual(result, ['alpha', 'beta']);
    });

    test('showEditableQuickPick resolves the typed value when nothing is selected', async () => {
        const controller = createMockQuickPick();
        state.sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

        const resultPromise = util.showEditableQuickPick(['existing'], {placeHolder: 'Template name'});
        controller.fireChange('new-template');
        controller.fireAccept();

        assert.strictEqual(await resultPromise, 'new-template');
        assert.strictEqual(controller.quickPick.items[0].label, 'new-template');
    });

    test('showEditableQuickPick resolves undefined when dismissed', async () => {
        const controller = createMockQuickPick();
        state.sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

        const resultPromise = util.showEditableQuickPick(['existing']);
        controller.fireHide();

        assert.strictEqual(await resultPromise, undefined);
    });

    test('showEditableQuickPick prefers the selected item over the typed value and applies options', async () => {
        const controller = createMockQuickPick();
        state.sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

        const resultPromise = util.showEditableQuickPick(['existing'], {
            title: 'Pick a template',
            placeHolder: 'Template',
            canPickMany: true,
            ignoreFocusOut: true,
            matchOnDescription: true,
            matchOnDetail: true
        });
        controller.fireChange('new-template');
        controller.fireAccept(['existing']);

        assert.strictEqual(await resultPromise, 'existing');
        assert.strictEqual(controller.quickPick.title, 'Pick a template');
        assert.strictEqual(controller.quickPick.placeholder, 'Template');
        assert.strictEqual(controller.quickPick.canSelectMany, true);
        assert.strictEqual(controller.quickPick.ignoreFocusOut, true);
        assert.strictEqual(controller.quickPick.matchOnDescription, true);
        assert.strictEqual(controller.quickPick.matchOnDetail, true);
    });

    test('directoryExists returns true for existing directory', async () => {
        const dirUri = vscode.Uri.file(state.tempDir);
        const result = await util.directoryExists(dirUri);
        assert.strictEqual(result, true);
    });

    test('directoryExists returns false for file or non-existent', async () => {
        const fileUri = vscode.Uri.file(path.join(state.tempDir, 'non-existent'));
        const result = await util.directoryExists(fileUri);
        assert.strictEqual(result, false);

        const realFile = path.join(state.tempDir, 'file.txt');
        fs.writeFileSync(realFile, 'test');
        const result2 = await util.directoryExists(vscode.Uri.file(realFile));
        assert.strictEqual(result2, false);
    });

    test('copyFiles respects force=false by preserving existing files', async () => {
        const sourcePath = path.join(state.tempDir, 'template-source');
        const destinationPath = path.join(state.tempDir, 'workspace');
        fs.mkdirSync(sourcePath);
        fs.mkdirSync(destinationPath);
        fs.writeFileSync(path.join(sourcePath, 'test.txt'), 'new content');
        fs.writeFileSync(path.join(destinationPath, 'test.txt'), 'old content');
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => {
                if (name === 'fileTemplates.copy.force') {
                    return false;
                }
                if (name === 'fileTemplates.copy.dereferenceSymlinks') {
                    return true;
                }
                return undefined;
            }
        } as any);

        await util.copyFiles(vscode.Uri.file(sourcePath), vscode.Uri.file(destinationPath));
        await util.sleep(50);

        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'test.txt'), 'utf8'), 'old content');
    });

    test('copyFiles respects force=true by overwriting existing files', async () => {
        const sourcePath = path.join(state.tempDir, 'template-source');
        const destinationPath = path.join(state.tempDir, 'workspace');
        fs.mkdirSync(sourcePath);
        fs.mkdirSync(destinationPath);
        fs.writeFileSync(path.join(sourcePath, 'test.txt'), 'new content');
        fs.writeFileSync(path.join(destinationPath, 'test.txt'), 'old content');
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => {
                if (name === 'fileTemplates.copy.force') {
                    return true;
                }
                if (name === 'fileTemplates.copy.dereferenceSymlinks') {
                    return true;
                }
                return undefined;
            }
        } as any);

        await util.copyFiles(vscode.Uri.file(sourcePath), vscode.Uri.file(destinationPath));
        await util.sleep(50);

        assert.strictEqual(fs.readFileSync(path.join(destinationPath, 'test.txt'), 'utf8'), 'new content');
    });

    test('copyFiles surfaces copy errors to the user', async () => {
        const destinationPath = path.join(state.tempDir, 'workspace');
        fs.mkdirSync(destinationPath);
        const showErrorStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();
        state.sandbox.stub(vscode.workspace, 'getConfiguration').returns({
            get: (name: string) => {
                if (name === 'fileTemplates.copy.force') {
                    return false;
                }
                if (name === 'fileTemplates.copy.dereferenceSymlinks') {
                    return true;
                }
                return undefined;
            }
        } as any);

        await util.copyFiles(
            vscode.Uri.file(path.join(state.tempDir, 'missing-template')),
            vscode.Uri.file(destinationPath)
        );
        await util.sleep(50);

        assert.strictEqual(showErrorStub.calledOnce, true);
        assert.ok(showErrorStub.firstCall.args[0].includes('ENOENT'));
    });
});
