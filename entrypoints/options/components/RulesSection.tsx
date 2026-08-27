import { STR } from "@/lib/strings";
import { MAX_RULES, type Settings } from "@/lib/types";
import { AddRuleForm } from "./AddRuleForm";
import { CategoryPresets } from "./PresetsCard";
import { RuleList } from "./RuleList";

export const RulesSection = ({ settings }: { settings: Settings }) => {
  return (
    <div>
      <header className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-xl font-semibold">{STR.sectionRules}</h1>
          <p className="mt-1 text-sm text-muted">
            気が散るサイトを登録しましょう。ツールバーのアイコンからワンクリックでも追加できます。
          </p>
        </div>
        <span className="mt-1 shrink-0 text-xs text-muted tabular-nums">
          {settings.rules.length} / {MAX_RULES}
        </span>
      </header>

      <div className="mt-6">
        <AddRuleForm settings={settings} />
      </div>

      <div className="mt-8 border-t hairline pt-6">
        <CategoryPresets settings={settings} />
      </div>

      <div className="mt-8 border-t hairline pt-6">
        <RuleList settings={settings} />
      </div>
    </div>
  );
};
