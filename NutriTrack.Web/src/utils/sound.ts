const bellAudio = new Audio('/boxing-bell.mp3');
bellAudio.preload = 'auto';

export function playRestFinishedSound() {
  try {
    bellAudio.currentTime = 0;
    bellAudio.volume = 0.9;
    void bellAudio.play();
  } catch {
    // Ignorujemy blokadę autoodtwarzania przed pierwszą interakcją
  }
}