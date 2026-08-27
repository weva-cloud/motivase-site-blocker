import { isScheduleBoundaryAlarm, syncDynamicRules } from "@/lib/dnr-sync";
import type { BgRequest, BgResponse } from "@/lib/messages";
import {
  handlePomodoroCommand,
  onPomodoroAlarm,
  POMODORO_ALARM,
} from "@/lib/pomodoro-sw";
import { quickBlockTab } from "@/lib/quick-block";
import {
  armReviewAlarms,
  MIDNIGHT_ALARM,
  onMidnightAlarm,
  onWeeklyReviewAlarm,
  WEEKLY_REVIEW_ALARM,
} from "@/lib/review-sw";
import { recordBlockHit, updateBadge } from "@/lib/stats-sw";
import { pomodoroItem, settingsItem } from "@/lib/storage";
import {
  domainFromAlarmName,
  expireTempAllow,
  grantTempAllow,
  reconcileTempAllows,
} from "@/lib/temp-allow";

const CONTEXT_MENU_ID = "msb-block-site";

export default defineBackground(() => {
  // SW 起動のたびに storage → DNR の整合性を回復する
  void syncDynamicRules();
  void reconcileTempAllows();
  void updateBadge();
  armReviewAlarms();

  chrome.runtime.onInstalled.addListener(() => {
    void syncDynamicRules();
    armReviewAlarms();
    chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: "このサイトをブロック",
      contexts: ["page"],
    });
  });
  chrome.runtime.onStartup.addListener(() => {
    void syncDynamicRules();
    void reconcileTempAllows();
    void updateBadge();
    armReviewAlarms();
  });

  // UI はどのサーフェスも storage に書くだけでよい（watch が DNR に反映する）。
  // ポモドーロのフェーズ変化もフォーカスモード経由でブロック対象に影響する。
  settingsItem.watch(() => {
    void syncDynamicRules();
  });
  pomodoroItem.watch(() => {
    void syncDynamicRules();
  });

  chrome.runtime.onMessage.addListener(
    (msg: BgRequest, _sender, sendResponse: (res: BgResponse) => void) => {
      (async (): Promise<BgResponse> => {
        switch (msg.type) {
          case "TEMP_ALLOW":
            await grantTempAllow(msg.domain, msg.durationSec, msg.reason);
            return { ok: true };
          case "TEMP_ALLOW_REVOKE":
            await expireTempAllow(msg.domain, true);
            return { ok: true };
          case "POMODORO":
            await handlePomodoroCommand(msg.cmd);
            return { ok: true };
          case "BLOCK_HIT":
            await recordBlockHit(msg.domain);
            return { ok: true };
          case "RESYNC":
            await syncDynamicRules();
            return { ok: true };
        }
      })().then(sendResponse, (e: unknown) => {
        sendResponse({
          ok: false,
          error: e instanceof Error ? e.message : String(e),
        });
      });
      return true; // 非同期で sendResponse を呼ぶ
    },
  );

  chrome.alarms.onAlarm.addListener((alarm) => {
    const domain = domainFromAlarmName(alarm.name);
    if (domain !== null) {
      void expireTempAllow(domain);
    } else if (alarm.name === POMODORO_ALARM) {
      void onPomodoroAlarm();
    } else if (isScheduleBoundaryAlarm(alarm.name)) {
      void syncDynamicRules();
    } else if (alarm.name === WEEKLY_REVIEW_ALARM) {
      void onWeeklyReviewAlarm();
    } else if (alarm.name === MIDNIGHT_ALARM) {
      void onMidnightAlarm();
    }
  });

  // キーボードショートカット（Ctrl/⌘+Shift+B）と右クリックメニュー
  chrome.commands.onCommand.addListener((command) => {
    if (command === "block-current-site") {
      void chrome.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => quickBlockTab(tabs[0]));
    }
  });
  chrome.contextMenus.onClicked.addListener((info, tab) => {
    if (info.menuItemId === CONTEXT_MENU_ID) {
      void quickBlockTab(tab);
    }
  });
});
