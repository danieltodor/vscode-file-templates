import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as create from '../create';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('create.ts tests', () => {
    test('createTemplate success', async () => {
        const mockContext = {
            globalStorageUri: vscode.Uri.file(state.tempDir),
            globalState: {get: () => true}
        } as any;
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: []
        });
        state.sandbox.stub(util, 'showEditableQuickPick').resolves('newTemplate');

        const openExternalStub = state.sandbox.stub(vscode.env, 'openExternal').resolves(true);

        await create.createTemplate(mockContext);
        await util.sleep(50);

        assert.strictEqual(openExternalStub.calledOnce, true);
        const createdDirPath = path.join(state.tempDir, 'newTemplate');
        assert.strictEqual(fs.existsSync(createdDirPath), true);
        assert.strictEqual(fs.statSync(createdDirPath).isDirectory(), true);
    });

    test('createTemplate fails if already exists', async () => {
        const mockContext = {
            globalStorageUri: vscode.Uri.file(state.tempDir),
            globalState: {get: () => true}
        } as any;

        const existingDirPath = path.join(state.tempDir, 'existingTemplate');
        fs.mkdirSync(existingDirPath);

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['existingTemplate']
        });
        state.sandbox.stub(util, 'showEditableQuickPick').resolves('existingTemplate');

        const showErrorMessageStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();
        const openExternalStub = state.sandbox.stub(vscode.env, 'openExternal').resolves(true);

        await create.createTemplate(mockContext);

        assert.strictEqual(openExternalStub.called, false);
        assert.strictEqual(showErrorMessageStub.calledOnce, true);
        assert.ok(showErrorMessageStub.firstCall.args[0].includes('already exists'));
    });

    test('createTemplate aborts when the picker is dismissed', async () => {
        const mockContext = {
            globalStorageUri: vscode.Uri.file(state.tempDir),
            globalState: {get: () => true}
        } as any;
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: []
        });
        state.sandbox.stub(util, 'showEditableQuickPick').resolves(undefined);
        const openExternalStub = state.sandbox.stub(vscode.env, 'openExternal').resolves(true);

        await create.createTemplate(mockContext);

        assert.strictEqual(openExternalStub.called, false);
        assert.strictEqual(fs.existsSync(path.join(state.tempDir, 'undefined')), false);
    });
});
