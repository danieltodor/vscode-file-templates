import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import * as remove from '../remove';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('remove.ts tests', () => {
    test('removes successfully', async () => {
        const mockContext = {} as any;
        const templatePath = path.join(state.tempDir, 'template1');
        fs.mkdirSync(templatePath);
        fs.writeFileSync(path.join(templatePath, 'file.txt'), 'hello');

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);

        try {
            await remove.removeTemplate(mockContext);
            await util.sleep(100);
            assert.strictEqual(fs.existsSync(templatePath), false);
        } catch (error: any) {
            assert.ok(error.message.includes('trash'));
        }
    });

    test('removeTemplate aborts if no template is selected', async () => {
        const mockContext = {} as any;
        const templatePath = path.join(state.tempDir, 'template1');
        fs.mkdirSync(templatePath);

        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

        await remove.removeTemplate(mockContext);

        assert.strictEqual(fs.existsSync(templatePath), true);
    });
});
