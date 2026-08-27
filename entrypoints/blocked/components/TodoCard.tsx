import { type DragEvent, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/ui/Icon";
import { TextField } from "@/components/ui/TextField";
import { useToast } from "@/components/ui/Toast";
import { useStorageItem } from "@/lib/hooks/useStorageItem";
import { todosItem, updateTodos } from "@/lib/storage";
import type { TodoItem } from "@/lib/types";

/** 配列の要素を from から to へ動かした新しい配列を返す */
const moveItem = <T,>(list: T[], from: number, to: number): T[] => {
  if (to < 0 || to >= list.length || from === to) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

/** ブロック画面のやることリスト（storage.local 保存なのでタブ間で同期される） */
export const TodoCard = () => {
  const stored = useStorageItem(todosItem);
  const [text, setText] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  // ドラッグ中は storage に書かずローカルの並びを見せる（書き込みの嵐を避ける）
  const [dragging, setDragging] = useState<{ id: string; order: TodoItem[] } | null>(
    null,
  );
  const toast = useToast();

  if (stored === undefined) return null;
  const todos = dragging?.order ?? stored;
  const remaining = todos.filter((t) => !t.done).length;

  const add = () => {
    const trimmed = text.trim();
    if (trimmed === "") return;
    void updateTodos((list) => [
      ...list,
      { id: crypto.randomUUID(), text: trimmed, done: false, createdAt: Date.now() },
    ]);
    setText("");
  };

  /** 並べ替え。先頭が「いま最優先」なので、上げ下げできることに意味がある */
  const move = (from: number, to: number) =>
    void updateTodos((list) => moveItem(list, from, to));

  const onDragStart = (e: DragEvent<HTMLLIElement>, todo: TodoItem) => {
    setDragging({ id: todo.id, order: todos });
    e.dataTransfer.effectAllowed = "move";
    // Firefox はデータを入れないとドラッグが始まらない
    e.dataTransfer.setData("text/plain", todo.id);
  };

  const onDragOver = (e: DragEvent<HTMLLIElement>, index: number) => {
    if (dragging === null) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const from = dragging.order.findIndex((t) => t.id === dragging.id);
    if (from === -1 || from === index) return;
    setDragging({ ...dragging, order: moveItem(dragging.order, from, index) });
  };

  const onDrop = (e: DragEvent<HTMLLIElement>) => {
    if (dragging === null) return;
    e.preventDefault();
    const order = dragging.order.map((t) => t.id);
    setDragging(null);
    // ドラッグ中に他サーフェスで増減していても壊れないよう、id で並べ直す
    void updateTodos((list) => {
      const byId = new Map(list.map((t) => [t.id, t]));
      const sorted = order.map((id) => byId.get(id)).filter((t) => t !== undefined);
      const added = list.filter((t) => !order.includes(t.id));
      return [...sorted, ...added];
    });
  };

  const startEdit = (todo: TodoItem) => {
    setEditingId(todo.id);
    setDraft(todo.text);
  };

  const commitEdit = (todo: TodoItem) => {
    const trimmed = draft.trim();
    setEditingId(null);
    if (trimmed === "" || trimmed === todo.text) return;
    void updateTodos((list) =>
      list.map((t) => (t.id === todo.id ? { ...t, text: trimmed } : t)),
    );
  };

  /** 削除は即実行し、トーストから元の位置に戻せるようにする */
  const remove = (todo: TodoItem, index: number) => {
    void updateTodos((list) => list.filter((t) => t.id !== todo.id));
    toast({
      message: `「${todo.text}」を削除しました`,
      action: {
        label: "元に戻す",
        onClick: () =>
          void updateTodos((list) => {
            if (list.some((t) => t.id === todo.id)) return list;
            const restored = [...list];
            restored.splice(Math.min(index, restored.length), 0, todo);
            return restored;
          }),
      },
    });
  };

  return (
    <Card
      title="やることリスト"
      action={
        <span className="text-xs text-muted tabular-nums">残り {remaining} 件</span>
      }
    >
      <form
        className="mb-3"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <TextField
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Enter で追加（例: レポートを1章書く）"
          aria-label="やることを追加"
        />
      </form>

      {todos.length === 0 ? (
        <p className="py-6 text-center text-xs text-muted">
          まだ何もありません。最初の一歩を書き出してみましょう。
        </p>
      ) : (
        // 件数が増えてもカードが伸び続けないよう、一定の高さで内側をスクロールさせる
        <ul className="-mr-1 -ml-2.5 max-h-72 space-y-0.5 overflow-y-auto pr-1">
          {todos.map((todo, index) => {
            // 未完了の先頭 = 「いま最優先」（代替行動を 1 つに絞って提示する）
            const isTop = !todo.done && todos.find((t) => !t.done)?.id === todo.id;
            const editing = editingId === todo.id;
            const isDragged = dragging?.id === todo.id;
            return (
              <li
                key={todo.id}
                draggable={!editing}
                onDragStart={(e) => onDragStart(e, todo)}
                onDragOver={(e) => onDragOver(e, index)}
                onDrop={onDrop}
                onDragEnd={() => setDragging(null)}
                className={`group flex items-center gap-1.5 rounded-md border-l-2 py-1 pl-2 transition-opacity ${
                  isTop ? "border-accent-500" : "border-transparent"
                } ${isDragged ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  // ドラッグは li 側で処理する。ここはつまみ（掴む場所）の提示と
                  // キーボードでの並べ替えを担う
                  onKeyDown={(e) => {
                    if (e.key === "ArrowUp") {
                      e.preventDefault();
                      move(index, index - 1);
                    } else if (e.key === "ArrowDown") {
                      e.preventDefault();
                      move(index, index + 1);
                    }
                  }}
                  title="ドラッグで並べ替え（↑↓ キーでも移動できます）"
                  aria-label={`${todo.text} を並べ替え`}
                  className="shrink-0 cursor-grab rounded p-0.5 text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
                >
                  <Icon name="grip" size={14} />
                </button>

                <input
                  type="checkbox"
                  checked={todo.done}
                  onChange={() =>
                    void updateTodos((list) =>
                      list.map((t) => (t.id === todo.id ? { ...t, done: !t.done } : t)),
                    )
                  }
                  className="size-3.5 shrink-0 cursor-pointer accent-amber-500"
                  aria-label={`${todo.text} を完了にする`}
                />

                {editing ? (
                  <TextField
                    value={draft}
                    autoFocus
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitEdit(todo);
                      } else if (e.key === "Escape") {
                        setEditingId(null);
                      }
                    }}
                    onBlur={() => commitEdit(todo)}
                    className="py-1 text-sm"
                    aria-label={`${todo.text} の名前を変更`}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => startEdit(todo)}
                    title="クリックで名前を変更"
                    aria-label={`${todo.text} の名前を変更`}
                    className={`ml-1 min-w-0 flex-1 cursor-text truncate text-left text-sm ${
                      todo.done ? "text-muted line-through" : ""
                    } ${isTop ? "font-medium" : ""}`}
                  >
                    {todo.text}
                  </button>
                )}

                {!editing && (
                  <button
                    type="button"
                    onClick={() => remove(todo, index)}
                    className="shrink-0 cursor-pointer rounded p-1 text-muted opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-red-500"
                    aria-label={`${todo.text} を削除`}
                  >
                    <Icon name="x" size={14} />
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {todos.length > 1 && (
        <p className="mt-2 text-[11px] text-muted">
          ドラッグで並べ替え（先頭が「いま最優先」）。項目をクリックすると名前を変更できます。
        </p>
      )}
    </Card>
  );
};
