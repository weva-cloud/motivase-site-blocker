// ポモドーロのフェーズ切替チャイム（WebAudio、音声ファイル不要）。
// 拡張ページ（ブロック画面など）が開いているときに鳴らす。

export function playChime(kind: "workDone" | "breakDone"): void {
  try {
    const ctx = new AudioContext();
    // 作業完了はやわらかい下降 2 音、休憩終了は上昇 2 音
    const freqs = kind === "workDone" ? [880, 660] : [660, 990];
    freqs.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = ctx.currentTime + i * 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.5);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.55);
    });
    setTimeout(() => void ctx.close(), 1500);
  } catch {
    // 音が鳴らせない環境では黙って無視する
  }
}
