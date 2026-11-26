import * as path from 'path';
import * as vscode from 'vscode';
import { parseElf } from './parser';
import { getElfWebviewContent } from './webview';

class ElfViewProvider implements vscode.CustomReadonlyEditorProvider {
  public static readonly viewType = 'elfviewer.elfView';

  public openCustomDocument(
    uri: vscode.Uri,
    _openContext: vscode.CustomDocumentOpenContext,
    _token: vscode.CancellationToken
  ): vscode.CustomDocument {
    return { uri, dispose: () => {} };
  }

  public async resolveCustomEditor(
    document: vscode.CustomDocument,
    webviewPanel: vscode.WebviewPanel,
    _token: vscode.CancellationToken
  ): Promise<void> {
    webviewPanel.webview.options = { enableScripts: true };
    const fsPath = document.uri.fsPath;
    const baseName = path.basename(fsPath) || fsPath;
    webviewPanel.title = `${baseName} (elf)`;

    let initialized = false;
    const load = async () => {
      try {
        const bytes = await vscode.workspace.fs.readFile(document.uri);
        const parsed = parseElf(Buffer.from(bytes));
        if (!initialized) {
          initialized = true;
          webviewPanel.webview.html = getElfWebviewContent(parsed, baseName);
        } else {
          void webviewPanel.webview.postMessage({
            type: 'update',
            payload: { fileName: baseName, ...parsed },
          });
        }
      } catch (err) {
        initialized = false;
        webviewPanel.webview.html = `<!DOCTYPE html><body style="font-family:sans-serif;padding:16px;color:#f48771">
          Failed to parse ELF file: ${String(err)}</body>`;
      }
    };

    await load();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const scheduleLoad = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void load(); }, 250);
    };
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(path.dirname(fsPath)), baseName)
    );
    watcher.onDidChange(scheduleLoad);
    watcher.onDidCreate(scheduleLoad);

    webviewPanel.onDidDispose(() => {
      if (timer) clearTimeout(timer);
      watcher.dispose();
    });
  }
}

export function activate(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.window.registerCustomEditorProvider(ElfViewProvider.viewType, new ElfViewProvider(), {
      webviewOptions: { retainContextWhenHidden: true },
    })
  );
}

export function deactivate(): void {}
