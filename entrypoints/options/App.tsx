import { useState } from "react";
import { ToastProvider } from "@/components/ui/Toast";
import { useSettings } from "@/lib/hooks/useSettings";
import { useTheme } from "@/lib/hooks/useTheme";
import { BackupSection } from "./components/BackupSection";
import { RulesSection } from "./components/RulesSection";
import { SafetySection } from "./components/SafetySection";
import { ScheduleSection } from "./components/ScheduleSection";
import { type Section, Sidebar } from "./components/Sidebar";
import { StatsSection } from "./components/StatsSection";
import { TempAllowSection } from "./components/TempAllowSection";
import { WidgetsSection } from "./components/WidgetsSection";

const App = () => {
  const [section, setSection] = useState<Section>("rules");
  const settings = useSettings();
  useTheme(settings?.theme);

  if (settings === undefined) return null;

  return (
    <ToastProvider>
      <div className="mx-auto flex min-h-screen w-full max-w-5xl">
        <Sidebar
          section={section}
          onSelect={setSection}
          ruleCount={settings.rules.length}
          strictMode={settings.strictMode}
          theme={settings.theme}
        />
        <main className="min-w-0 flex-1 px-8 py-10 sm:px-12">
          {section === "rules" && <RulesSection settings={settings} />}
          {section === "schedule" && <ScheduleSection settings={settings} />}
          {section === "widgets" && <WidgetsSection settings={settings} />}
          {section === "tempallow" && <TempAllowSection settings={settings} />}
          {section === "stats" && <StatsSection settings={settings} />}
          {section === "safety" && <SafetySection settings={settings} />}
          {section === "backup" && <BackupSection settings={settings} />}
        </main>
      </div>
    </ToastProvider>
  );
};

export default App;
