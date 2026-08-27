import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Icon } from "./Icon";

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastInput {
  message: string;
  /** 「元に戻す」など。押すとトーストは閉じる */
  action?: ToastAction;
}

interface ToastItem extends ToastInput {
  id: string;
}

const ToastContext = createContext<(t: ToastInput) => void>(() => {});

/** 取り消せる操作の通知先。確認ダイアログの代わりに使う */
export const useToast = (): ((t: ToastInput) => void) => {
  return useContext(ToastContext);
};

const DISMISS_MS = 7000;

const ToastRow = ({ toast, onClose }: { toast: ToastItem; onClose: () => void }) => {
  return (
    <output className="animate-toast-in card flex items-center gap-3 py-2.5 pr-2 pl-4 shadow-lg">
      <span className="text-sm">{toast.message}</span>
      {toast.action !== undefined && (
        <button
          type="button"
          onClick={() => {
            toast.action?.onClick();
            onClose();
          }}
          className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-accent-600 transition-colors hover:bg-accent-500/10 dark:text-accent-400"
        >
          <Icon name="undo" size={15} />
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        onClick={onClose}
        aria-label="通知を閉じる"
        className="cursor-pointer rounded-lg p-1.5 text-muted transition-colors hover:bg-black/5 dark:hover:bg-white/10"
      >
        <Icon name="x" size={15} />
      </button>
    </output>
  );
};

/**
 * 削除などの取り消し可能な操作を「実行 → 元に戻せる通知」で扱うための入れ物。
 * 事前の確認ダイアログは操作のたびに手を止めさせるので使わない。
 */
export const ToastProvider = ({ children }: { children: ReactNode }) => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const remove = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((list) => list.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (input: ToastInput) => {
      const id = crypto.randomUUID();
      setToasts((list) => [...list.slice(-2), { ...input, id }]);
      timers.current.set(
        id,
        setTimeout(() => remove(id), DISMISS_MS),
      );
    },
    [remove],
  );

  // ページを離れるときに残っているタイマーを片付ける
  useEffect(() => {
    const pending = timers.current;
    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      {toasts.length > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex flex-col items-center gap-2 px-4">
          {toasts.map((toast) => (
            <div key={toast.id} className="pointer-events-auto">
              <ToastRow toast={toast} onClose={() => remove(toast.id)} />
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
};
