import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Icon } from "@/components/ui/Icon";
import { STR } from "@/lib/strings";

/** 登録されたやる気メッセージからランダムに 1 つ表示する */
export const MotivationCard = ({ messages }: { messages: string[] }) => {
  const [index, setIndex] = useState(() => Math.floor(Math.random() * messages.length));

  if (messages.length === 0) return null;
  const message = messages[index % messages.length];

  // 現在と違うメッセージからランダムに選ぶ
  const shuffle = () => {
    if (messages.length <= 1) return;
    setIndex(
      (i) =>
        (i + 1 + Math.floor(Math.random() * (messages.length - 1))) % messages.length,
    );
  };

  return (
    <figure className="flex w-full max-w-xl flex-col items-center gap-3">
      <blockquote className="text-lg leading-relaxed font-medium text-balance sm:text-xl">
        {message}
      </blockquote>
      {messages.length > 1 && (
        <Button variant="quiet" size="sm" onClick={shuffle}>
          <Icon name="undo" size={14} />
          {STR.anotherMessage}
        </Button>
      )}
    </figure>
  );
};
