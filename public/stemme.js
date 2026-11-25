// Connys stemme: bruger telefonens egen danske stemme (Web Speech API).
// Intet sendes ud af telefonen, og der skal ingen nøgle til.

const synth = typeof window !== 'undefined' ? window.speechSynthesis : null;
export const canSpeak = !!synth && typeof SpeechSynthesisUtterance !== 'undefined';

let voice = null;
function findVoice() {
  if (!canSpeak) return null;
  const all = synth.getVoices();
  const da = all.filter((v) => /^da([-_]|$)/i.test(v.lang));
  // Foretræk en "forbedret"/"premium" stemme, hvis telefonen har en.
  voice = da.find((v) => /premium|enhanced|forbedret/i.test(v.name)) || da.find((v) => v.localService) || da[0] || null;
  return voice;
}
if (canSpeak) {
  findVoice();
  synth.addEventListener?.('voiceschanged', findVoice);
}
export const hasDanishVoice = () => !!(voice || findVoice());

// Til/fra gemmes på den enkelte telefon. Børn har stemmen slået til fra start.
const KEY = 'conny-stemme';
export function voiceOn(isKid) {
  try { const v = localStorage.getItem(KEY); if (v !== null) return v === '1'; } catch {}
  return !!isKid;
}
export function setVoiceOn(on) { try { localStorage.setItem(KEY, on ? '1' : '0'); } catch {} }

// Fjern emojis og tegn, som stemmen ellers læser højt ("stjerne", "krone" osv.).
export function clean(text) {
  return String(text)
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}️‍]/gu, '')
    .replace(/[~*_#·]/g, ' ')
    .replace(/\bca\.\s/g, 'cirka ')
    .replace(/(\d)\s*min\b/g, '$1 minutter')
    .replace(/\s+/g, ' ')
    .trim();
}

let talkingEl = null;
function setTalking(on) {
  const el = document.querySelector('.conny');
  if (talkingEl && talkingEl !== el) talkingEl.classList.remove('talking');
  talkingEl = el;
  el?.classList.toggle('talking', on);
}

export const isSpeaking = () => canSpeak && synth.speaking;

export function stop() { if (canSpeak) synth.cancel(); setTalking(false); }

// Skal kaldes direkte fra et tryk (iPhone kræver det første gang).
export function say(text) {
  if (!canSpeak) return false;
  const t = clean(text);
  if (!t) return false;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'da-DK';
  if (voice || findVoice()) u.voice = voice;
  u.rate = 1.02;
  u.pitch = 1.25; // lidt lysere og gladere
  u.onstart = () => setTalking(true);
  u.onend = u.onerror = () => setTalking(false);
  synth.speak(u);
  // Nogle browsere sender ikke onstart; start munden alligevel.
  setTimeout(() => { if (synth.speaking) setTalking(true); }, 150);
  return true;
}

const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Ros, når en opgave er klaret.
export function praiseLine(name, taskName, allDone) {
  if (allDone) return pick([
    `Wow, ${name}! Alt er klaret i dag. Du er en ægte rengøringshelt!`,
    `Jubii! Alle dine opgaver er færdige, ${name}. Conny laver en glædesdans!`,
    `${name}, du har klaret det hele! Nu er resten af dagen din.`,
  ]);
  return pick([
    `Sådan, ${name}! ${taskName} er klaret.`,
    `Flot klaret, ${name}! Støvnusserne flygter.`,
    `Swoosh! Væk med det. Godt gået, ${name}.`,
    `Yes! Endnu en opgave i hus, ${name}.`,
    `Du er hurtigere end en støvsuger, ${name}!`,
    `Super, ${name}! Det kan mærkes.`,
  ]);
}

// Lidt ekstra, når man trykker på Conny flere gange.
export function funLine(name) {
  return pick([
    `Vidste du, at jeg er en svamp, ${name}? Jeg elsker sæbebobler!`,
    `Små opgaver hver dag, og så er weekenden fri. Det er min hemmelighed.`,
    `Hvis du tænder for musikken, går det dobbelt så hurtigt.`,
    `Prøv at slå timeren til. Kan du nå det før tiden er gået?`,
    `Hver gang du klarer en opgave, bliver du rigere. Point bliver til lommepenge!`,
    `Kilder! Lad være med at trykke på min næse.`,
  ]);
}
