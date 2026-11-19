export function playRestFinishedSound() {
  try {
    // Wibracja na telefonach (Android)
    if ('vibrate' in navigator) {
      navigator.vibrate([200, 100, 200]);
    }

    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AudioCtx();

    const playBeep = (startTime: number, freq: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, startTime);

      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.exponentialRampToValueAtTime(0.35, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.25);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(startTime + 0.26);
    };

    const now = ctx.currentTime;
    playBeep(now, 880);        // A5
    playBeep(now + 0.3, 1174.66); // D6
  } catch {
    // Ignorujemy błąd, jeśli przeglądarka zablokowała dźwięk przed interakcją użytkownika
  }
}