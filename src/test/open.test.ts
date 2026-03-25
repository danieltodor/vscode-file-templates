import * as assert from 'assert';
import * as vscode from 'vscode';
import * as open from '../open';
import * as util from '../util';
import { setupTestSuite } from './test-helpers';

const state = setupTestSuite();

suite('open.ts tests', () => {
    test('openTemplate opens it externally', async () => {
        const mockContext = {} as any;
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
        const openExternalStub = state.sandbox.stub(vscode.env, 'openExternal').resolves(true);

        await open.openTemplate(mockContext);
        assert.strictEqual(openExternalStub.calledOnce, true);
    });

    test('openTemplate aborts if no selection', async () => {
        const mockContext = {} as any;
        state.sandbox.stub(util, 'getCommonVariables').resolves({
            templateDirectory: vscode.Uri.file(state.tempDir),
            existingTemplates: ['template1']
        });
        state.sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
        const openExternalStub = state.sandbox.stub(vscode.env, 'openExternal').resolves(true);

        await open.openTemplate(mockContext);
        assert.strictEqual(openExternalStub.called, false);
    });
});
