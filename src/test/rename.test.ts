import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as rename from '../rename';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('rename.ts tests', () => {
    test('renames successfully', async () => {
        const mockContext = {} as any;

        const oldPath = path.join(state.tempDir, 'template1');
        fs.mkdirSync(oldPath);
        fs.writeFileSync(path.join(oldPath, 'file.txt'), 'hello');

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
        state.sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

        await rename.renameTemplate(mockContext);
        await util.sleep(50);

        assert.strictEqual(fs.existsSync(oldPath), false);
        assert.strictEqual(fs.existsSync(path.join(state.tempDir, 'template2', 'file.txt')), true);
    });

    test('fails if new name already exists', async () => {
        const mockContext = {} as any;

        const oldPath = path.join(state.tempDir, 'template1');
        const newPath = path.join(state.tempDir, 'template2');
        fs.mkdirSync(oldPath);
        fs.mkdirSync(newPath);

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1', 'template2']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
        state.sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

        const showErrorStub = state.sandbox.stub(vscode.window, 'showErrorMessage').resolves();

        await rename.renameTemplate(mockContext);
        assert.strictEqual(showErrorStub.calledOnce, true);
        assert.strictEqual(fs.existsSync(oldPath), true);
    });

    test('aborts before prompting for a new name when no template is selected', async () => {
        const mockContext = {} as any;

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
        const showInputBoxStub = state.sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

        await rename.renameTemplate(mockContext);

        assert.strictEqual(showInputBoxStub.called, false);
    });

    test('aborts when the new template name is not provided', async () => {
        const mockContext = {} as any;
        const oldPath = path.join(state.tempDir, 'template1');
        const newPath = path.join(state.tempDir, 'template2');
        fs.mkdirSync(oldPath);
        fs.writeFileSync(path.join(oldPath, 'file.txt'), 'hello');

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
        state.sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

        await rename.renameTemplate(mockContext);

        assert.strictEqual(fs.existsSync(oldPath), true);
        assert.strictEqual(fs.existsSync(newPath), false);
    });
});
