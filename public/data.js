// Startdata til Conny: familiens rum og opgaver.
// Alt kan ændres bagefter inde i appen.

// Forslag i opret-skærmen. Familiens rigtige navne skrives ind i appen
// og gemmes kun i databasen, ikke i koden på GitHub.
export const DEFAULT_MEMBERS = [
  { name: 'Mor', role: 'parent' },
  { name: 'Far', role: 'parent' },
  { name: '', role: 'kid' },
  { name: '', role: 'kid' },
];

export const CHEERS = [
  'Sådan! ✨', 'Fremtidens dig siger tak.', 'Støvnusserne er bange for dig nu.',
  'Se lige, hvor det skinner!', 'Små sejre tæller.', 'Færdig er bedre end perfekt.',
  'Én weekendopgave mindre.', 'Små skridt, skinnende hjem.', 'Swoosh! Væk.',
  'Conny laver en lille glædesdans.', 'Dit hjem smiler.', 'Ren legende-stil.',
];

const genitive = (n) => (/[sxz]$/i.test(n) ? n + "'" : n + 's');

// [id, rum, ikon, navn, minutter, hver N. dag, hvem]
// hvem: adults = de voksnes fælles plan, rotate = børnene skiftes,
//       k1/k2 = ældste/yngste barn, p2 = anden voksen
const TASKS = [
  ['opvasker', 'kokken', '🍽️', 'Tøm opvaskemaskinen', 5, 1, 'rotate'],
  ['kokkenbord', 'kokken', '🧽', 'Tør køkkenbord og spisebord af', 5, 2, 'adults'],
  ['kogeplader', 'kokken', '🔥', 'Tør kogepladerne af', 5, 3, 'adults'],
  ['stovsug-kokken', 'kokken', '🌀', 'Støvsug køkken-alrum', 10, 3, 'adults'],
  ['gulv-kokken', 'kokken', '🪣', 'Vask gulv i køkken-alrum', 10, 7, 'adults'],
  ['vask', 'kokken', '🚰', 'Gør vask og vandhane skinnende', 5, 7, 'adults'],
  ['koleskab', 'kokken', '🥶', 'Tjek køleskabet for gamle madvarer', 5, 7, 'adults'],
  ['laager', 'kokken', '🚪', 'Tør skabslågerne af', 10, 30, 'adults'],
  ['stovsug-stue', 'stue', '🌀', 'Støvsug stuen og tæpperne', 10, 4, 'k1'],
  ['oprydning-stue', 'stue', '🎯', '5 minutters oprydning i stuen', 5, 2, 'adults'],
  ['stov-stue', 'stue', '🪶', 'Tør støv af alle flader', 10, 7, 'adults'],
  ['gulv-stue', 'stue', '🪣', 'Vask gulv i stuen', 10, 14, 'adults'],
  ['planter', 'stue', '🪴', 'Vand planterne i stue og køkken', 5, 7, 'k2'],
  ['toilet1', 'bad1', '🚽', 'Gør toilettet rent', 5, 4, 'adults'],
  ['handvask1', 'bad1', '🪞', 'Gør håndvask og spejl rene', 5, 4, 'adults'],
  ['glasvaeg', 'bad1', '🚿', 'Skrab glasvæggen og tør bruseren af', 5, 7, 'adults'],
  ['gulv-bad1', 'bad1', '🧼', 'Vask gulvet på badeværelset', 5, 7, 'adults'],
  ['toilet2', 'bad2', '🚽', 'Gør toilettet rent', 5, 4, 'adults'],
  ['handvask2', 'bad2', '🪞', 'Gør håndvask og spejl rene', 5, 4, 'adults'],
  ['forhaeng', 'bad2', '🛁', 'Vask bruseforhænget', 3, 30, 'adults'],
  ['gulv-bad2', 'bad2', '🧼', 'Vask gulvet på badeværelset', 5, 7, 'adults'],
  ['stovsug-sove', 'sove', '🌀', 'Støvsug soveværelset', 10, 7, 'adults'],
  ['stov-sove', 'sove', '🪶', 'Tør støv af i soveværelset', 5, 14, 'adults'],
  ['seng-k1', 'v-k1', '🛏️', 'Red seng og ryd op på værelset', 3, 1, 'k1'],
  ['vaerelse-k1', 'v-k1', '🧹', 'Støvsug og tør støv af på værelset', 15, 7, 'k1'],
  ['seng-k2', 'v-k2', '🛏️', 'Red seng og ryd op på værelset', 3, 1, 'k2'],
  ['vaerelse-k2', 'v-k2', '🧹', 'Støvsug og tør støv af på værelset', 15, 7, 'k2'],
  ['sko', 'bryggers', '👟', 'Sæt skoene på plads', 3, 3, 'k2'],
  ['gulv-bryggers', 'bryggers', '🪣', 'Støvsug og vask gulv i bryggers', 10, 7, 'adults'],
  ['haandklaeder', 'hele', '🧺', 'Skift håndklæder, viskestykker og karklude', 5, 7, 'adults'],
  ['sengetoj', 'hele', '🛏️', 'Skift sengetøj i alle senge', 20, 14, 'adults'],
  ['skraldespande', 'hele', '🗑️', 'Tøm de små skraldespande', 5, 7, 'adults'],
  ['handtag', 'hele', '💡', 'Tør dørhåndtag og kontakter af', 5, 14, 'adults'],
  ['elkedel', 'store', '☕', 'Afkalk elkedlen', 5, 30, 'adults'],
  ['afkalk-bad', 'store', '🚿', 'Afkalk bruser og vandhaner', 10, 30, 'adults'],
  ['koleskab-ind', 'store', '🧊', 'Gør køleskabet rent indvendigt', 15, 30, 'adults'],
  ['filter-opvasker', 'store', '🍽️', 'Rens filteret i opvaskemaskinen', 5, 30, 'adults'],
  ['kaffemaskine', 'store', '☕', 'Afkalk kaffemaskinen', 5, 60, 'adults'],
  ['emhaette', 'store', '💨', 'Rens emhættefilteret', 10, 60, 'adults'],
  ['vaskemaskine', 'store', '🫧', 'Rens vaskemaskinen', 5, 60, 'adults'],
  ['lamper', 'store', '💡', 'Tør støv af lamperne', 10, 60, 'adults'],
  ['ovn', 'store', '🔥', 'Rens ovnen', 20, 90, 'adults'],
  ['paneler', 'store', '🚪', 'Tør paneler, døre og karme af', 20, 90, 'adults'],
  ['under-mobler', 'store', '🛋️', 'Støvsug under og bag møblerne', 20, 90, 'adults'],
  ['fryser', 'store', '❄️', 'Afrim og gør fryseren ren', 30, 180, 'adults'],
  ['dyner', 'store', '☁️', 'Vask dyner og puder', 15, 180, 'adults'],
  ['vinduer', 'store', '🪟', 'Pudse vinduer', 60, 180, 'p2'],
];

export function buildSeed(members, { today, addDays, wd }) {
  const parents = members.filter((m) => m.role === 'parent');
  const kids = members.filter((m) => m.role === 'kid');
  const map = { p2: parents[1]?.id, k1: kids[0]?.id, k2: kids[1]?.id };

  const rooms = [
    { id: 'kokken', name: 'Køkken-alrum', icon: '🍳' },
    { id: 'stue', name: 'Stue', icon: '🛋️' },
    { id: 'bad1', name: 'Bad med glasvæg', icon: '🚿' },
    { id: 'bad2', name: 'Bad med forhæng', icon: '🛁' },
    { id: 'sove', name: 'Soveværelse', icon: '🌙' },
    ...kids.map((k, i) => ({ id: 'v-' + k.id, name: genitive(k.name) + ' værelse', icon: ['🎮', '⚽', '🎨', '🎸'][i % 4] })),
    { id: 'bryggers', name: 'Bryggers', icon: '👟' },
    { id: 'hele', name: 'Hele huset', icon: '🏠' },
    { id: 'store', name: 'Store opgaver', icon: '⭐' },
  ];

  const tasks = [];
  for (const [id, roomId, icon, name, min, every, who] of TASKS) {
    let room = roomId, tid = id, assignee = who;
    for (const key of ['k1', 'k2']) {
      if (room === 'v-' + key) room = map[key] ? 'v-' + map[key] : null;
      if (tid.endsWith('-' + key)) tid = tid.slice(0, -key.length) + (map[key] || key);
    }
    if (!room) continue;
    if (assignee in map) assignee = map[assignee] || 'adults';
    if (assignee === 'rotate' && !kids.length) assignee = 'adults';
    // Spred startdatoerne, så ikke alt er "for sent" på dag ét
    const lastDone = every > 1 ? addDays(today, -1 - Math.floor(Math.random() * every)) : null;
    tasks.push({ id: tid, room, icon, name, min, every, assignee, active: true, lastDone, lastBy: null, prevDone: null });
  }

  // Skraldet hentes hver anden torsdag, første gang 26. november 2026
  const thursday = '2026-11-26';

  const family = {
    name: 'Familien',
    members: members.map(({ id, name, role }) => ({ id, name, role })),
    rooms,
    settings: {
      adultMinutes: 20,
      rotate: kids.slice(0, 2).map((k) => k.id),
      morningHour: 7,
      trashHour: 19,
      trash: { weekly: [1], biweekly: { anchor: thursday }, notify: parents.map((p) => p.id) },
      krPer100: 20,
      goal: { points: 250, prize: 'Pizza og film fredag 🍕' },
    },
    created: today,
  };
  return { family, tasks };
}
