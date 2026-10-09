/* Headless game test (jsdom). Run: npm run build && npm test */
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = 0;
function ok(cond, name) {
  console.log((cond ? 'PASS ' : 'FAIL ') + name);
  if (!cond) failed++;
}

let fakeNow = 1_000_000;
const errors = [];
const vc = new (require('jsdom').VirtualConsole)();
vc.on('jsdomError', (e) => { if (!/Not implemented/.test(String(e.message))) errors.push(String(e.message)); });

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'https://riddle.test/',
  virtualConsole: vc,
  beforeParse(w) {
    w.scrollTo = () => {};
    w.Date.now = () => fakeNow;
  },
});
const w = dom.window;
const d = w.document;
const $ = (s) => d.querySelector(s);
const state = () => JSON.parse(w.localStorage.getItem('riddleBlocks.v2'));

function tileFor(ch) {
  return [...d.querySelectorAll('.tile')].find((t) => t.textContent === ch && !t.hidden && !t.classList.contains('used'));
}
function typeAnswer(ans) {
  for (const ch of ans) tileFor(ch).click();
}
function wrongTiles(ans, count) {
  return [...d.querySelectorAll('.tile')].filter((t) => !t.hidden && ans.indexOf(t.textContent) < 0).slice(0, count);
}

(async () => {
  const W = w.WORDS;
  ok(W.length === 200 && new Set(W.map((x) => x[0])).size === 200, '200 unique levels');
  ok(W.every((x) => /^[A-Z]{3,11}$/.test(x[0])), 'answers are A-Z, 3-11 letters');
  ok($('#count').textContent === '0 / 200', 'map shows 0 / 200');
  ok(d.querySelectorAll('.cell').length === 200, '200 level cells');
  ok(d.querySelectorAll('.cell:disabled').length === 199, 'only level 1 unlocked');
  ok(state().coins === 120, 'daily bonus gives 20 coins on first open (120)');

  // Level 1: start gate hides the clue, then solve
  $('#go').click();
  ok(!$('#ready').hidden, 'start gate shown');
  ok($('#clue').textContent.includes('Hidden'), 'clue hidden before Start');
  ok(d.querySelector('.tile').closest('#pool') && $('#hSkip').disabled, 'hints disabled before Start');
  $('#start').click();
  ok($('#clue').textContent === W[0][1], 'clue shown after Start');
  ok($('#secs').textContent === '30', 'timer starts at 30');
  typeAnswer(W[0][0]);
  await sleep(850);
  ok(!$('#overlay').hidden && $('#winAns').textContent === W[0][0], 'level 1 solved overlay');
  ok(state().coins === 140 && state().solved[1] === 'done' && state().streak === 1, 'reward 20 (10 + 10 speed), streak 1');

  // Level 2: wrong answer shakes, clears, clock keeps running
  $('#next').click();
  $('#start').click();
  const a2 = W[1][0];
  wrongTiles(a2, a2.length).forEach((t) => t.click());
  for (const ch of a2.split('').reverse()) {
    if (d.querySelectorAll('.slot.filled').length < a2.length) tileFor(ch).click();
  }
  if (d.querySelectorAll('.slot.filled').length === a2.length) {
    ok($('#slots').classList.contains('shake'), 'wrong answer shakes');
    await sleep(600);
    ok(d.querySelectorAll('.slot.filled').length === 0, 'wrong answer clears slots');
  } else {
    ok(false, 'could not fill slots with decoys (pool too small)');
  }

  // Hints
  let c = state().coins;
  $('#hReveal').click();
  ok(state().coins === c - 25 && d.querySelectorAll('.slot.locked').length === 1, 'reveal letter costs 25 and locks a slot');
  const lockedLetter = d.querySelector('.slot.locked').textContent;
  ok(lockedLetter === a2[0], 'revealed letter is correct');
  c = state().coins;
  const tilesBefore = [...d.querySelectorAll('.tile')].filter((t) => !t.hidden).length;
  $('#hRemove').click();
  const tilesAfter = [...d.querySelectorAll('.tile')].filter((t) => !t.hidden).length;
  ok(state().coins === c - 15 && tilesAfter === a2.length && tilesBefore > tilesAfter, 'remove extras costs 15 and leaves only answer letters');
  ok($('#hRemove').disabled, 'remove extras only once per level');
  c = state().coins;
  fakeNow += 5000;
  await sleep(250);
  const secsBefore = +$('#secs').textContent;
  $('#hTime').click();
  await sleep(150);
  ok(state().coins === c - 30 && +$('#secs').textContent >= secsBefore + 9, '+10 seconds costs 30 and adds time');
  // finish level 2 using remaining tiles (slot 0 is locked)
  for (const ch of a2.slice(1)) tileFor(ch).click();
  await sleep(850);
  ok(!$('#overlay').hidden && $('#winAns').textContent === a2, 'level 2 solved after hints');
  ok(/^\+10 coins/.test($('#winNote').textContent), 'no speed bonus after using hints');

  // Level 3: time out twice, then mercy letter
  $('#next').click();
  $('#start').click();
  fakeNow += 31000;
  await sleep(250);
  ok(!$('#timeup').hidden, 'time-up overlay appears after 30s');
  ok(state().fails[3] === 1 && state().streak === 0, 'miss recorded and streak reset');
  $('#retry').click();
  $('#start').click();
  ok(d.querySelectorAll('.slot.locked').length === 0, 'no free letter after one miss');
  fakeNow += 31000;
  await sleep(250);
  ok(!$('#timeup').hidden && state().fails[3] === 2, 'second miss recorded');
  $('#retry').click();
  ok($('#readyNote').textContent.includes('first letter is free'), 'ready note mentions free first letter');
  $('#start').click();
  ok(d.querySelector('.slot.locked') && d.querySelector('.slot.locked').textContent === W[2][0][0], 'free first letter is locked in');

  // Skip
  c = state().coins;
  $('#hSkip').click();
  ok(state().coins === c - 60 && state().solved[3] === 'skip', 'skip costs 60 and marks level skipped');
  ok(!$('#ready').hidden && $('#lvl').textContent === 'Level 4', 'skip moves to level 4');

  // Back to map, toggles, reset
  $('#readyBack').click();
  ok(!$('#mapView').hidden && d.querySelectorAll('.cell:disabled').length === 196, 'map unlocks through level 4');
  $('#tSound').click();
  ok(state().sound === false && $('#tSound').getAttribute('aria-pressed') === 'false', 'sound toggle persists');
  $('#reset').click();
  $('#reset').click();
  ok(state().coins === 100 && Object.keys(state().solved).length === 0 && state().sound === false, 'reset clears progress, keeps settings');

  ok(errors.length === 0, 'no script errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
  console.log(failed ? `\n${failed} FAILED` : '\nall tests passed');
  process.exit(failed ? 1 : 0);
})();
