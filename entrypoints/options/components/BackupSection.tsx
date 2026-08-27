import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { Modal } from "@/components/ui/Modal";
import {
  type BackupFile,
  backupFilename,
  createBackup,
  serializeBackup,
  validateBackup,
} from "@/lib/backup";
import { getSettings, settingsItem, statsItem, todosItem } from "@/lib/storage";
import { STR } from "@/lib/strings";

export const BackupSection = () => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pendingImport, setPendingImport] = useState<BackupFile | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const doExport = async () => {
    const [settings, todos, stats] = await Promise.all([
      getSettings(),
      todosItem.getValue(),
      statsItem.getValue(),
    ]);
    const now = new Date();
    const blob = new Blob([serializeBackup(createBackup(settings, todos, stats, now))], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = backupFilename(now);
    a.click();
    URL.revokeObjectURL(url);
  };

  const onFileSelected = async (file: File) => {
    setMessage(null);
    let json: unknown;
    try {
      json = JSON.parse(await file.text());
    } catch {
      setMessage({ ok: false, text: "JSON ファイルとして読み込めませんでした" });
      return;
    }
    const result = validateBackup(json);
    if (!result.ok) {
      setMessage({ ok: false, text: result.error });
      return;
    }
    setPendingImport(result.data);
  };

  const applyImport = async () => {
    if (pendingImport === null) return;
    // storage に書けば background の watch が DNR ルールを自動で再同期する
    await settingsItem.setValue(pendingImport.settings);
    await todosItem.setValue(pendingImport.todos);
    if (pendingImport.stats !== undefined) {
      await statsItem.setValue(pendingImport.stats);
    }
    setPendingImport(null);
    setMessage({ ok: true, text: "インポートが完了しました" });
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-xl font-semibold">{STR.sectionBackup}</h1>
        <p className="mt-1 text-sm text-muted">
          設定はこの端末の Chrome にのみ保存されます。買い替えや他の PC
          への引っ越しにはエクスポート / インポートを使ってください。
        </p>
      </header>

      <Card title="エクスポート">
        <p className="mb-3 text-xs text-muted">
          ブロックルール・ウィジェット設定・一時許可の選択肢・やることリストを JSON
          ファイルとして保存します。
        </p>
        <Button variant="primary" onClick={() => void doExport()}>
          <Icon name="archive" size={15} />
          エクスポート
        </Button>
      </Card>

      <Card title="インポート">
        <p className="mb-3 text-xs text-muted">
          エクスポートした JSON ファイルから設定を復元します。現在の設定は上書きされます。
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file !== undefined) void onFileSelected(file);
            e.target.value = "";
          }}
        />
        <Button onClick={() => fileInputRef.current?.click()}>
          ファイルを選択してインポート
        </Button>
        {message !== null && (
          <p
            className={`mt-3 text-xs font-medium ${
              message.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
            }`}
          >
            {message.text}
          </p>
        )}
      </Card>

      <Modal
        open={pendingImport !== null}
        title="設定をインポートしますか？"
        onClose={() => setPendingImport(null)}
        footer={
          <>
            <Button onClick={() => setPendingImport(null)}>キャンセル</Button>
            <Button variant="primary" onClick={() => void applyImport()}>
              上書きしてインポート
            </Button>
          </>
        }
      >
        {pendingImport !== null && (
          <ul className="list-inside list-disc space-y-1">
            <li>ブロックルール: {pendingImport.settings.rules.length} 件</li>
            <li>
              やる気メッセージ:{" "}
              {pendingImport.settings.widgets.motivation.messages.length} 件
            </li>
            <li>一時許可の選択肢: {pendingImport.settings.allowDurations.length} 個</li>
            <li>やること: {pendingImport.todos.length} 件</li>
          </ul>
        )}
        <p className="mt-3">現在の設定はすべて上書きされます。</p>
      </Modal>
    </div>
  );
};
