// Soft generated sounds for the Intend app preview, made with the Web Audio API.
// Every sound is synthesised in the browser the moment it plays, except the water pour, which uses one
// recording (/assets/sounds/pour.mp3) and falls back to a generated pour until that file has loaded.

const noiseCache = new WeakMap();
function noise(ctx) {
  let buffer = noiseCache.get(ctx);
  if (!buffer) {
    buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buffer);
  }
  return buffer;
}
const rand = (a, b) => a + Math.random() * (b - a);

// Quick fade in, hold, gentle fade out. Exponential ramps, so nothing clicks.
function envelope(param, t, attack, hold, release, peak) {
  param.setValueAtTime(.0001, t);
  param.exponentialRampToValueAtTime(peak, t + attack);
  param.setValueAtTime(peak, t + attack + hold);
  param.exponentialRampToValueAtTime(.0001, t + attack + hold + release);
}

function tone(ctx, out, {f, to, at = 0, len = .2, vol = .05, type = 'sine'}) {
  const t = ctx.currentTime + at, o = ctx.createOscillator(), g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (to) o.frequency.exponentialRampToValueAtTime(to, t + len);
  g.gain.setValueAtTime(.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + .012);
  g.gain.exponentialRampToValueAtTime(.0001, t + len);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + len + .05);
}

// A soft bell: a few slightly inharmonic partials that fade at different speeds.
function bell(ctx, out, f, at, vol) {
  [[1, 1, 1.5], [2.01, .3, .8], [3.02, .1, .5], [4.17, .05, .3]]
    .forEach(([ratio, amp, len]) => tone(ctx, out, {f: f * ratio, at, len, vol: vol * amp}));
}

// One air bubble: a short sine whose pitch rises as it closes (the "bloop" you hear in a filling glass).
function bubble(ctx, out, at, f, vol) {
  tone(ctx, out, {f, to: f * rand(1.6, 2.2), at, len: rand(.04, .09), vol});
}

// Water poured into a glass, in three layers:
// 1. the stream: noise through a resonant band whose pitch rises while the glass fills (the air above
//    the water gets shorter, like filling a bottle), 2. a soft splash hiss, 3. a scatter of bubbles.
// `level` (0 to 1) is how full the glass will be, so each glass sounds a little higher than the last.
function pour(ctx, out, {level = .4} = {}) {
  const at = .02, t = ctx.currentTime + at, dur = .95, buf = noise(ctx);

  // Irregular "glug" movement: two slow oscillators wobble the overall loudness.
  const flutter = ctx.createGain();
  flutter.gain.value = .65;
  flutter.connect(out);
  for (const [hz, depth] of [[13, .2], [23, .15]]) {
    const lfo = ctx.createOscillator(), amount = ctx.createGain();
    lfo.frequency.value = hz * rand(.85, 1.15);
    amount.gain.value = depth;
    lfo.connect(amount).connect(flutter.gain);
    lfo.start(t);
    lfo.stop(t + dur + .2);
  }

  const stream = ctx.createBufferSource();
  stream.buffer = buf;
  stream.loop = true;
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.Q.value = 4.5;
  const f0 = 300 + level * 450;
  band.frequency.setValueAtTime(f0, t);
  band.frequency.exponentialRampToValueAtTime(f0 * 1.7, t + dur);
  const body = ctx.createGain();
  envelope(body.gain, t, .05, dur - .35, .3, .62);
  stream.connect(band).connect(body).connect(flutter);

  const hiss = ctx.createBufferSource();
  hiss.buffer = buf;
  hiss.loop = true;
  const high = ctx.createBiquadFilter();
  high.type = 'highpass';
  high.frequency.value = 1100;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass';
  low.frequency.value = 5200;
  const splash = ctx.createGain();
  envelope(splash.gain, t, .03, dur - .4, .32, .045);
  hiss.connect(high).connect(low).connect(splash).connect(flutter);

  const offset = rand(0, 1);
  stream.start(t, offset);
  hiss.start(t, (offset + .5) % 1.5);
  stream.stop(t + dur + .1);
  hiss.stop(t + dur + .1);

  const count = 7 + Math.floor(rand(0, 5));
  for (let i = 0; i < count; i++) bubble(ctx, out, at + rand(.08, dur - .15), rand(500, 950) + level * 500, rand(.018, .04));
  bubble(ctx, out, at + dur + .02, 1100 + level * 400, .03); // the last drop
}

// Taking a glass away: three small falling sips.
function sip(ctx, out) {
  [0, .075, .16].forEach((at, i) => { const f = 820 - i * 140; tone(ctx, out, {f, to: f * .6, at, len: .08, vol: .03}); });
}

const VOICES = {
  tap: (ctx, out) => tone(ctx, out, {f: 620, to: 760, len: .1, vol: .04}),
  toggle: (ctx, out) => { tone(ctx, out, {f: 520, to: 600, len: .07, vol: .025}); tone(ctx, out, {f: 780, at: .05, len: .09, vol: .018}); },
  done: (ctx, out) => [[659.25, 0], [987.77, .07]].forEach(([f, at]) => { tone(ctx, out, {f, at, len: .5, vol: .045}); tone(ctx, out, {f: f * 4, at, len: .12, vol: .008}); }),
  undo: (ctx, out) => tone(ctx, out, {f: 600, to: 420, len: .14, vol: .035}),
  complete: (ctx, out) => [392, 493.88, 587.33, 783.99].forEach((f, i) => bell(ctx, out, f, i * .09, .032)),
  pour,
  sip
};
export {VOICES};

// A recorded pour (supplied by the project owner). Only the opening pour is used: it starts just after
// the beginning of the file and fades out to match the ~1 second glass animation. It plays through Web
// Audio so the fade is smooth everywhere, and its pitch lifts a little as the glass fills.
const RECORDED_POUR = {src: '/assets/sounds/pour.mp3', start: .05, length: 1.35, fade: .35, gain: 2.4};

export function createSounds() {
  let ctx, out, players = [], turn = 0;
  function ready() {
    if (!ctx) {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return false;
      ctx = new Context();
      out = ctx.createGain();
      out.gain.value = 1.2;
      out.connect(ctx.destination);
      loadRecording();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }
  // Three players, so quick taps can overlap instead of cutting each other off. The second and third
  // are made once the first has loaded, so they come from the browser cache instead of downloading again.
  function addPlayer() {
    try {
      const el = new Audio(RECORDED_POUR.src);
      el.preload = 'auto';
      el.preservesPitch = false;
      el.webkitPreservesPitch = false;
      const gain = ctx.createGain();
      gain.gain.value = 0;
      ctx.createMediaElementSource(el).connect(gain).connect(out);
      players.push({el, gain, timer: 0});
      return el;
    } catch { return null; }
  }
  function loadRecording() {
    addPlayer()?.addEventListener('canplaythrough', () => { addPlayer(); addPlayer(); }, {once: true});
  }
  // Returns false when the recording isn't ready yet, so the generated pour can play instead.
  function playRecording(level = .4) {
    const player = players[turn++ % (players.length || 1)];
    if (!player || player.el.readyState < 2) return false;
    const {el, gain} = player, {start, length, fade} = RECORDED_POUR, t = ctx.currentTime, g = gain.gain;
    clearTimeout(player.timer);
    el.pause();
    el.currentTime = start;
    el.playbackRate = .96 + level * .12;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0, t);
    g.linearRampToValueAtTime(RECORDED_POUR.gain, t + .04);
    g.setValueAtTime(RECORDED_POUR.gain, t + length - fade);
    g.linearRampToValueAtTime(0, t + length);
    el.play().catch(() => {});
    player.timer = setTimeout(() => el.pause(), (length + .1) * 1000);
    return true;
  }
  return {
    play(kind, options) {
      try {
        if (!VOICES[kind] || !ready()) return;
        if (kind === 'pour' && playRecording(options?.level)) return;
        VOICES[kind](ctx, out, options);
      } catch { /* sound is a nicety */ }
    }
  };
}
