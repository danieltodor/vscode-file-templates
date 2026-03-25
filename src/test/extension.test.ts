import * as assert from 'assert';
import * as vscode from 'vscode';
import * as sinon from 'sinon';
import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';
import * as create from '../create';
import * as open from '../open';
import * as rename from '../rename';
import * as remove from '../remove';
import * as use from '../use';
import * as util from '../util';
import * as extension from '../extension';

function createMockQuickPick() {
    const acceptHandlers: Array<() => void> = [];
    const changeHandlers: Array<() => void> = [];
    const hideHandlers: Array<() => void> = [];

    const quickPick = {
        title: undefined as string | undefined,
        placeholder: undefined as string | undefined,
        canSelectMany: false,
        ignoreFocusOut: false,
        matchOnDescription: false,
        matchOnDetail: false,
        items: [] as vscode.QuickPickItem[],
        activeItems: [] as vscode.QuickPickItem[],
        value: '',
        onDidChangeValue: (handler: () => void) => {
            changeHandlers.push(handler);
            return {dispose() {}};
        },
        onDidAccept: (handler: () => void) => {
            acceptHandlers.push(handler);
            return {dispose() {}};
        },
        onDidHide: (handler: () => void) => {
            hideHandlers.push(handler);
            return {dispose() {}};
        },
        show: () => {},
        hide: () => {
            for (const handler of hideHandlers) {
                handler();
            }
        },
        dispose: () => {}
    };

    return {
        quickPick,
        fireChange(value: string) {
            quickPick.value = value;
            for (const handler of changeHandlers) {
                handler();
            }
        },
        fireAccept(labels: string[] = []) {
            quickPick.activeItems = labels.map(label => ({label}));
            for (const handler of acceptHandlers) {
                handler();
            }
        },
        fireHide() {
            for (const handler of hideHandlers) {
                handler();
            }
        }
    };
}

suite('Extension Test Suite', () => {
    let sandbox: sinon.SinonSandbox;
    let tempDir: string;

    setup(() => {
        sandbox = sinon.createSandbox();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-file-templates-test-'));
    });

    teardown(() => {
        sandbox.restore();
        fs.rmSync(tempDir, { recursive: true, force: true });
    });

    suite('util.ts tests', () => {
        test('getErrorMessage returns correct message', () => {
            assert.strictEqual(util.getErrorMessage(new Error('Test error')), 'Test error');
            assert.strictEqual(util.getErrorMessage('String error'), 'String error');
        });

        test('getTemplateDirectory uses the custom directory when configured', async () => {
            const customDir = path.join(tempDir, 'custom');
            fs.mkdirSync(customDir);

            const getConfigurationStub = sandbox.stub(vscode.workspace, 'getConfiguration').returns({
                get: (name: string) => name === 'fileTemplates.template.customDirectory' ? customDir : undefined
            } as any);
            const updateStub = sandbox.stub().resolves();
            const storageUri = vscode.Uri.file(path.join(tempDir, 'storage'));

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
            const storageUri = vscode.Uri.file(path.join(tempDir, 'storage'));
            const updateStub = sandbox.stub().resolves();
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({get: () => ''} as any);

            const result = await util.getTemplateDirectory({
                globalStorageUri: storageUri,
                globalState: {get: () => false, update: updateStub}
            } as any);

            assert.strictEqual(result.fsPath, storageUri.fsPath);
            assert.strictEqual(fs.existsSync(storageUri.fsPath), true);
            assert.strictEqual(updateStub.calledOnceWithExactly('0', true), true);
        });

        test('getTemplateDirectory skips initialization when already initialized', async () => {
            const storageUri = vscode.Uri.file(path.join(tempDir, 'storage'));
            const updateStub = sandbox.stub().resolves();
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({get: () => ''} as any);

            const result = await util.getTemplateDirectory({
                globalStorageUri: storageUri,
                globalState: {get: () => true, update: updateStub}
            } as any);

            assert.strictEqual(result.fsPath, storageUri.fsPath);
            assert.strictEqual(fs.existsSync(storageUri.fsPath), false);
            assert.strictEqual(updateStub.called, false);
        });

        test('getTemplates merges virtual templates, removes duplicates and sorts names', async () => {
            fs.mkdirSync(path.join(tempDir, 'beta'));
            fs.mkdirSync(path.join(tempDir, 'alpha'));
            fs.writeFileSync(path.join(tempDir, 'file.txt'), 'ignored');
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({
                get: (name: string) => name === 'fileTemplates.template.virtual' ? {gamma: ['beta'], alpha: ['gamma']} : undefined
            } as any);

            const result = await util.getTemplates(vscode.Uri.file(tempDir), true);

            assert.deepStrictEqual(result, ['alpha', 'beta', 'gamma']);
        });

        test('getTemplates ignores invalid virtual template configuration', async () => {
            fs.mkdirSync(path.join(tempDir, 'beta'));
            fs.mkdirSync(path.join(tempDir, 'alpha'));
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({
                get: (name: string) => name === 'fileTemplates.template.virtual' ? 'invalid' : undefined
            } as any);

            const result = await util.getTemplates(vscode.Uri.file(tempDir), true);

            assert.deepStrictEqual(result, ['alpha', 'beta']);
        });

        test('showEditableQuickPick resolves the typed value when nothing is selected', async () => {
            const controller = createMockQuickPick();
            sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

            const resultPromise = util.showEditableQuickPick(['existing'], {placeHolder: 'Template name'});
            controller.fireChange('new-template');
            controller.fireAccept();

            assert.strictEqual(await resultPromise, 'new-template');
            assert.strictEqual(controller.quickPick.items[0].label, 'new-template');
        });

        test('showEditableQuickPick resolves undefined when dismissed', async () => {
            const controller = createMockQuickPick();
            sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

            const resultPromise = util.showEditableQuickPick(['existing']);
            controller.fireHide();

            assert.strictEqual(await resultPromise, undefined);
        });

        test('showEditableQuickPick prefers the selected item over the typed value and applies options', async () => {
            const controller = createMockQuickPick();
            sandbox.stub(vscode.window, 'createQuickPick').returns(controller.quickPick as any);

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
            const dirUri = vscode.Uri.file(tempDir);
            const result = await util.directoryExists(dirUri);
            assert.strictEqual(result, true);
        });

        test('directoryExists returns false for file or non-existent', async () => {
            const fileUri = vscode.Uri.file(path.join(tempDir, 'non-existent'));
            const result = await util.directoryExists(fileUri);
            assert.strictEqual(result, false);

            const realFile = path.join(tempDir, 'file.txt');
            fs.writeFileSync(realFile, 'test');
            const result2 = await util.directoryExists(vscode.Uri.file(realFile));
            assert.strictEqual(result2, false);
        });

        test('copyFiles respects force=false by preserving existing files', async () => {
            const sourcePath = path.join(tempDir, 'template-source');
            const destinationPath = path.join(tempDir, 'workspace');
            fs.mkdirSync(sourcePath);
            fs.mkdirSync(destinationPath);
            fs.writeFileSync(path.join(sourcePath, 'test.txt'), 'new content');
            fs.writeFileSync(path.join(destinationPath, 'test.txt'), 'old content');
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({
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
            const sourcePath = path.join(tempDir, 'template-source');
            const destinationPath = path.join(tempDir, 'workspace');
            fs.mkdirSync(sourcePath);
            fs.mkdirSync(destinationPath);
            fs.writeFileSync(path.join(sourcePath, 'test.txt'), 'new content');
            fs.writeFileSync(path.join(destinationPath, 'test.txt'), 'old content');
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({
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
            const destinationPath = path.join(tempDir, 'workspace');
            fs.mkdirSync(destinationPath);
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();
            sandbox.stub(vscode.workspace, 'getConfiguration').returns({
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
                vscode.Uri.file(path.join(tempDir, 'missing-template')),
                vscode.Uri.file(destinationPath)
            );
            await util.sleep(50);

            assert.strictEqual(showErrorStub.calledOnce, true);
            assert.ok(showErrorStub.firstCall.args[0].includes('ENOENT'));
        });
    });

    suite('createTemplate tests', () => {
        test('createTemplate success', async () => {
            const mockContext = {
                globalStorageUri: vscode.Uri.file(tempDir),
                globalState: { get: () => true }
            } as any;
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: []
            });
            sandbox.stub(util, 'showEditableQuickPick').resolves('newTemplate');

            const openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);

            await create.createTemplate(mockContext);
            await util.sleep(50); // wait for fs

            assert.strictEqual(openExternalStub.calledOnce, true);
            const createdDirPath = path.join(tempDir, 'newTemplate');
            assert.strictEqual(fs.existsSync(createdDirPath), true);
            assert.strictEqual(fs.statSync(createdDirPath).isDirectory(), true);
        });

        test('createTemplate fails if already exists', async () => {
             const mockContext = {
                globalStorageUri: vscode.Uri.file(tempDir),
                globalState: { get: () => true }
            } as any;

            const existingDirPath = path.join(tempDir, 'existingTemplate');
            fs.mkdirSync(existingDirPath);

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['existingTemplate']
            });
            sandbox.stub(util, 'showEditableQuickPick').resolves('existingTemplate');

            const showErrorMessageStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();
            const openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);

            await create.createTemplate(mockContext);

            assert.strictEqual(openExternalStub.called, false);
            assert.strictEqual(showErrorMessageStub.calledOnce, true);
            assert.ok(showErrorMessageStub.firstCall.args[0].includes('already exists'));
        });

        test('createTemplate aborts when the picker is dismissed', async () => {
            const mockContext = {
                globalStorageUri: vscode.Uri.file(tempDir),
                globalState: {get: () => true}
            } as any;
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: []
            });
            sandbox.stub(util, 'showEditableQuickPick').resolves(undefined);
            const openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);

            await create.createTemplate(mockContext);

            assert.strictEqual(openExternalStub.called, false);
            assert.strictEqual(fs.existsSync(path.join(tempDir, 'undefined')), false);
        });
    });

    suite('openTemplate tests', () => {
        test('openTemplate opens it externally', async () => {
            const mockContext = {} as any;
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
            const openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);

            await open.openTemplate(mockContext);
            assert.strictEqual(openExternalStub.calledOnce, true);
        });

        test('openTemplate aborts if no selection', async () => {
            const mockContext = {} as any;
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
            const openExternalStub = sandbox.stub(vscode.env, 'openExternal').resolves(true);

            await open.openTemplate(mockContext);
            assert.strictEqual(openExternalStub.called, false);
        });
    });

    suite('renameTemplate tests', () => {
        test('renames successfully', async () => {
            const mockContext = {} as any;

            const oldPath = path.join(tempDir, 'template1');
            fs.mkdirSync(oldPath);
            fs.writeFileSync(path.join(oldPath, 'file.txt'), 'hello');

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
            sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

            await rename.renameTemplate(mockContext);
            await util.sleep(50);

            assert.strictEqual(fs.existsSync(oldPath), false);
            assert.strictEqual(fs.existsSync(path.join(tempDir, 'template2', 'file.txt')), true);
        });

        test('fails if new name already exists', async () => {
            const mockContext = {} as any;

            const oldPath = path.join(tempDir, 'template1');
            const newPath = path.join(tempDir, 'template2');
            fs.mkdirSync(oldPath);
            fs.mkdirSync(newPath);

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1', 'template2']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
            sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

            await rename.renameTemplate(mockContext);
            assert.strictEqual(showErrorStub.calledOnce, true);
            assert.strictEqual(fs.existsSync(oldPath), true); // old still there
        });

        test('aborts before prompting for a new name when no template is selected', async () => {
            const mockContext = {} as any;

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);
            const showInputBoxStub = sandbox.stub(vscode.window, 'showInputBox').resolves('template2');

            await rename.renameTemplate(mockContext);

            assert.strictEqual(showInputBoxStub.called, false);
        });

        test('aborts when the new template name is not provided', async () => {
            const mockContext = {} as any;
            const oldPath = path.join(tempDir, 'template1');
            const newPath = path.join(tempDir, 'template2');
            fs.mkdirSync(oldPath);
            fs.writeFileSync(path.join(oldPath, 'file.txt'), 'hello');

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
            sandbox.stub(vscode.window, 'showInputBox').resolves(undefined);

            await rename.renameTemplate(mockContext);

            assert.strictEqual(fs.existsSync(oldPath), true);
            assert.strictEqual(fs.existsSync(newPath), false);
        });
    });

    suite('removeTemplate tests', () => {
        test('removes successfully', async () => {
            const mockContext = {} as any;
            const templatePath = path.join(tempDir, 'template1');
            fs.mkdirSync(templatePath);
            fs.writeFileSync(path.join(templatePath, 'file.txt'), 'hello');

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);

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
            const templatePath = path.join(tempDir, 'template1');
            fs.mkdirSync(templatePath);

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            await remove.removeTemplate(mockContext);

            assert.strictEqual(fs.existsSync(templatePath), true);
        });
    });

    suite('useTemplate tests', () => {
        test('uses template correctly', async () => {
            const mockContext = {} as any;

            const wsPath = path.join(tempDir, 'workspace');
            fs.mkdirSync(wsPath);

            const srcPath = path.join(tempDir, 'template1');
            fs.mkdirSync(srcPath);
            fs.writeFileSync(path.join(srcPath, 'test.txt'), 'content');

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ name: 'ws', uri: vscode.Uri.file(wsPath) }]);

            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('template1' as any);
            sandbox.stub(util, 'getConfigValue').returns({});

            await use.useTemplate(mockContext, false, undefined);

            // fs.cp takes short time
            await util.sleep(100);

            assert.strictEqual(fs.existsSync(path.join(wsPath, 'test.txt')), true);
            assert.strictEqual(fs.readFileSync(path.join(wsPath, 'test.txt'), 'utf8'), 'content');
        });

        test('handles circular dependencies cleanly', async () => {
            const mockContext = {} as any;
            const wsPath = path.join(tempDir, 'workspace');
            fs.mkdirSync(wsPath);

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ name: 'ws', uri: vscode.Uri.file(wsPath) }]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['vTemplate']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('vTemplate' as any);
            sandbox.stub(util, 'getConfigValue').returns({
                'vTemplate': ['vTemplate']
            });

            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

            await use.useTemplate(mockContext, false, undefined);

            assert.strictEqual(showErrorStub.calledOnce, true);
            assert.ok(showErrorStub.firstCall.args[0].includes('Circular dependency'));
        });

        test('expands nested virtual templates before copying', async () => {
            const mockContext = {} as any;
            const wsPath = path.join(tempDir, 'workspace');
            const copyFilesStub = sandbox.stub(util, 'copyFiles').resolves();
            const sleepStub = sandbox.stub(util, 'sleep').resolves();

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ name: 'ws', uri: vscode.Uri.file(wsPath) }]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['combo', 'base', 'child']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves('combo' as any);
            sandbox.stub(util, 'getConfigValue').returns({
                combo: ['base', 'nested'],
                nested: ['child']
            });

            await use.useTemplate(mockContext, false, undefined);

            assert.deepStrictEqual(copyFilesStub.getCalls().map(call => call.args[0].fsPath), [
                path.join(tempDir, 'base'),
                path.join(tempDir, 'child')
            ]);
            assert.deepStrictEqual(copyFilesStub.getCalls().map(call => call.args[1].fsPath), [wsPath, wsPath]);
            assert.strictEqual(sleepStub.callCount, 2);
        });

        test('returns early when no template is selected', async () => {
            const mockContext = {} as any;
            const copyFilesStub = sandbox.stub(util, 'copyFiles').resolves();

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ name: 'ws', uri: vscode.Uri.file(tempDir) }]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves(undefined);

            await use.useTemplate(mockContext, false, undefined);

            assert.strictEqual(copyFilesStub.called, false);
        });

        test('copies multiple templates into explicit destination URIs', async () => {
            const mockContext = {} as any;
            const destinationOne = vscode.Uri.file(path.join(tempDir, 'folder-one'));
            const destinationTwo = vscode.Uri.file(path.join(tempDir, 'folder-two'));
            const copyFilesStub = sandbox.stub(util, 'copyFiles').resolves();
            const sleepStub = sandbox.stub(util, 'sleep').resolves();

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([{ name: 'ws', uri: vscode.Uri.file(tempDir) }]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1', 'template2']
            });
            sandbox.stub(vscode.window, 'showQuickPick').resolves(['template1', 'template2'] as any);
            sandbox.stub(util, 'getConfigValue').returns({});

            await use.useTemplate(mockContext, true, [destinationOne, destinationTwo]);

            assert.strictEqual(copyFilesStub.callCount, 4);
            assert.deepStrictEqual(copyFilesStub.getCalls().map(call => [call.args[0].fsPath, call.args[1].fsPath]), [
                [path.join(tempDir, 'template1'), destinationOne.fsPath],
                [path.join(tempDir, 'template1'), destinationTwo.fsPath],
                [path.join(tempDir, 'template2'), destinationOne.fsPath],
                [path.join(tempDir, 'template2'), destinationTwo.fsPath]
            ]);
            assert.strictEqual(sleepStub.callCount, 4);
        });

        test('uses only selected workspaces in a multi-root workspace', async () => {
            const mockContext = {} as any;
            const workspaceOne = vscode.Uri.file(path.join(tempDir, 'workspace-one'));
            const workspaceTwo = vscode.Uri.file(path.join(tempDir, 'workspace-two'));
            const copyFilesStub = sandbox.stub(util, 'copyFiles').resolves();

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { name: 'one', uri: workspaceOne },
                { name: 'two', uri: workspaceTwo }
            ]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            showQuickPickStub.onFirstCall().resolves('template1' as any);
            showQuickPickStub.onSecondCall().resolves(['two'] as any);
            sandbox.stub(util, 'getConfigValue').returns({});

            await use.useTemplate(mockContext, false, undefined);

            assert.strictEqual(copyFilesStub.calledOnce, true);
            assert.strictEqual(copyFilesStub.firstCall.args[1].fsPath, workspaceTwo.fsPath);
        });

        test('does nothing when multi-root destination selection is cancelled', async () => {
            const mockContext = {} as any;
            const copyFilesStub = sandbox.stub(util, 'copyFiles').resolves();

            sandbox.stub(vscode.workspace, 'workspaceFolders').value([
                { name: 'one', uri: vscode.Uri.file(path.join(tempDir, 'workspace-one')) },
                { name: 'two', uri: vscode.Uri.file(path.join(tempDir, 'workspace-two')) }
            ]);
            sandbox.stub(util, 'getCommonVariables').resolves({
                templateDirectory: vscode.Uri.file(tempDir),
                existingTemplates: ['template1']
            });
            const showQuickPickStub = sandbox.stub(vscode.window, 'showQuickPick');
            showQuickPickStub.onFirstCall().resolves('template1' as any);
            showQuickPickStub.onSecondCall().resolves(undefined);
            sandbox.stub(util, 'getConfigValue').returns({});

            await use.useTemplate(mockContext, false, undefined);

            assert.strictEqual(copyFilesStub.called, false);
        });

        test('does nothing if no workspace is opened', async () => {
            const mockContext = {} as any;
            sandbox.stub(vscode.workspace, 'workspaceFolders').value(undefined);
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

            await use.useTemplate(mockContext, false, undefined);
            assert.strictEqual(showErrorStub.calledOnce, true);
        });
    });

    suite('extension.ts tests', () => {
        test('activate registers all contributed commands', () => {
            const registerCommandStub = sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => ({command, callback}) as any);
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
            sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
                callbacks.set(command, callback);
                return {dispose() {}} as any;
            });
            sandbox.stub(create, 'createTemplate').rejects(new Error('create failed'));
            const showErrorStub = sandbox.stub(vscode.window, 'showErrorMessage').resolves();

            extension.activate({subscriptions: []} as any);
            callbacks.get('fileTemplates.createTemplate')?.();
            await util.sleep(0);

            assert.strictEqual(showErrorStub.calledOnce, true);
            assert.strictEqual(showErrorStub.firstCall.args[0], 'create failed');
        });

        test('useTemplate command forwards clicked explorer URI when no selection array is provided', async () => {
            const callbacks = new Map<string, (...args: any[]) => void>();
            sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
                callbacks.set(command, callback);
                return {dispose() {}} as any;
            });
            const useTemplateStub = sandbox.stub(use, 'useTemplate').resolves();
            const context = {subscriptions: []} as any;
            const clickedURI = vscode.Uri.file(path.join(tempDir, 'target'));

            extension.activate(context);
            callbacks.get('fileTemplates.useTemplate')?.(clickedURI, undefined);
            await util.sleep(0);

            assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, false, [clickedURI]), true);
        });

        test('useTemplates command prefers selected URIs over the clicked explorer URI', async () => {
            const callbacks = new Map<string, (...args: any[]) => void>();
            sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
                callbacks.set(command, callback);
                return {dispose() {}} as any;
            });
            const useTemplateStub = sandbox.stub(use, 'useTemplate').resolves();
            const context = {subscriptions: []} as any;
            const clickedURI = vscode.Uri.file(path.join(tempDir, 'clicked'));
            const selectedURIs = [vscode.Uri.file(path.join(tempDir, 'one')), vscode.Uri.file(path.join(tempDir, 'two'))];

            extension.activate(context);
            callbacks.get('fileTemplates.useTemplates')?.(clickedURI, selectedURIs);
            await util.sleep(0);

            assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, true, selectedURIs), true);
        });

        test('useTemplates command falls back to the clicked explorer URI when selection is empty', async () => {
            const callbacks = new Map<string, (...args: any[]) => void>();
            sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
                callbacks.set(command, callback);
                return {dispose() {}} as any;
            });
            const useTemplateStub = sandbox.stub(use, 'useTemplate').resolves();
            const context = {subscriptions: []} as any;
            const clickedURI = vscode.Uri.file(path.join(tempDir, 'clicked'));

            extension.activate(context);
            callbacks.get('fileTemplates.useTemplates')?.(clickedURI, []);
            await util.sleep(0);

            assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, true, [clickedURI]), true);
        });

        test('useTemplate command passes undefined destinations when invoked without explorer context', async () => {
            const callbacks = new Map<string, (...args: any[]) => void>();
            sandbox.stub(vscode.commands, 'registerCommand').callsFake((command, callback) => {
                callbacks.set(command, callback);
                return {dispose() {}} as any;
            });
            const useTemplateStub = sandbox.stub(use, 'useTemplate').resolves();
            const context = {subscriptions: []} as any;

            extension.activate(context);
            callbacks.get('fileTemplates.useTemplate')?.(undefined, undefined);
            await util.sleep(0);

            assert.strictEqual(useTemplateStub.calledOnceWithExactly(context, false, undefined), true);
        });
    });
});
