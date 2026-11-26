let ctx: AudioContext | undefined;

/** A soft rising chime for a right answer, a low falling buzz for a wrong one. No audio files: the tones are synthesized. */
export function playFeedback(correct: boolean) {
  try {
    const Ctx = window.AudioContext;
    if (!Ctx) return; // jsdom and very old browsers: stay silent
    ctx ??= new Ctx();
    if (ctx.state === "suspended") void ctx.resume();
    const notes = correct ? [523.25, 783.99] : [196, 146.83];
    const type: OscillatorType = correct ? "sine" : "triangle";
    notes.forEach((freq, i) => {
      const start = ctx!.currentTime + i * 0.12;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch {
    // Sound is a nicety; never let it break answering.
  }
}
