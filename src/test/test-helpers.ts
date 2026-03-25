import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';

function ensure<T>(value: T | undefined, name: string): T {
    if (value === undefined) {
        throw new Error(`${name} has not been initialized`);
    }
    return value;
}

export function setupTestSuite() {
    let sandbox: sinon.SinonSandbox | undefined;
    let tempDir: string | undefined;

    setup(() => {
        sandbox = sinon.createSandbox();
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-file-templates-test-'));
    });

    teardown(() => {
        ensure(sandbox, 'sandbox').restore();
        fs.rmSync(ensure(tempDir, 'tempDir'), {recursive: true, force: true});
    });

    return {
        get sandbox() {
            return ensure(sandbox, 'sandbox');
        },
        get tempDir() {
            return ensure(tempDir, 'tempDir');
        }
    };
}

export function createMockQuickPick() {
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
