// Trueno sintetizado con Web Audio: un chasquido seco y un retumbo grave que se apaga.
// Si se agrega un archivo real (public/sounds/trueno.mp3) se puede reemplazar por ese.

function noise(ctx: AudioContext, seconds: number, brown: boolean) {
  const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * seconds), ctx.sampleRate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.5;
    } else {
      data[i] = white;
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf;
  return src;
}

export function playThunder(delay = 0) {
  let ctx: AudioContext;
  try {
    ctx = new AudioContext();
  } catch {
    return;
  }
  const t0 = ctx.currentTime + delay;
  const master = ctx.createGain();
  master.gain.value = 0.7;
  master.connect(ctx.destination);

  // chasquido
  const crack = noise(ctx, 0.4, false);
  const hp = ctx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 1100;
  const crackGain = ctx.createGain();
  crackGain.gain.setValueAtTime(0, t0);
  crackGain.gain.linearRampToValueAtTime(0.9, t0 + 0.005);
  crackGain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.35);
  crack.connect(hp).connect(crackGain).connect(master);
  crack.start(t0);

  // retumbo con altibajos
  const dur = 3.4;
  const rumble = noise(ctx, dur, true);
  const lp = ctx.createBiquadFilter();
  lp.type = "lowpass";
  lp.frequency.value = 190;
  const rumbleGain = ctx.createGain();
  const steps = 64;
  const curve = new Float32Array(steps);
  for (let i = 0; i < steps; i++) {
    const x = i / (steps - 1);
    const env = Math.min(1, x * 25) * Math.exp(-x * 3.2);
    curve[i] = env * (0.65 + 0.35 * Math.random());
  }
  curve[steps - 1] = 0;
  rumbleGain.gain.setValueAtTime(0, t0);
  rumbleGain.gain.setValueCurveAtTime(curve, t0 + 0.03, dur - 0.05);
  rumble.connect(lp).connect(rumbleGain).connect(master);
  rumble.start(t0);

  setTimeout(() => ctx.close(), (delay + dur + 0.5) * 1000);
}
