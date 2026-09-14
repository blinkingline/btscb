// Game engine for "But Then She Came Back".
//
// A few mechanics in the source rules are terse or ambiguous. Confirmed
// interpretations (from design discussion) are marked CONFIRMED; anything
// else this file guesses at is marked ASSUMPTION so it's easy to find and
// revise later.
//
// CONFIRMED: choosing the heart-line card at position N (1-based) lets you
//   act on action-track spaces 1..min(N,5) this turn.
// CONFIRMED: each of the 4 pieces (eyes/hand/foot/heart) may take one
//   action-track action per turn (up to 4 total), moving left to right.
// CONFIRMED: a She-Benefit special ability (e.g. "eyes twice") applies only
//   during the turn you choose that specific card.
//
// ASSUMPTION: only choosing a Thing-side card ("paying its cost") grows the
//   heart line and triggers the rightmost-she-flips-to-thing rule; choosing
//   a She-side card is a free benefit with no line growth.
// ASSUMPTION: "flipped over friends" (Night guilt) means every friend ever
//   sacrificed, cumulatively, not just ones sacrificed this Evening.
// ASSUMPTION: F1/F3's "place your hand here" abilities let you commit the
//   Hand piece to that friend instead of using it on the track that turn;
//   F1 grants +1 lock while committed and alive, F3 grants a second
//   "heart" trigger (friend action) next turn when Hand is used on the
//   track. The rules describe these as a multi-turn hold ("leave it until
//   you kill this friend"); this build only implements a single-turn
//   commit (the Hand piece is free again the following morning) since
//   cross-turn piece-locking isn't modeled yet. Worth revisiting.
// ASSUMPTION: F2's "spend 2 knives as 1 blood" is resolved as an immediate
//   one-time conversion when its action triggers, rather than a standing
//   option for the rest of the turn.
// ASSUMPTION: the face-down 5th friend is revealed the first time the Heart
//   piece is used on action-track space 5.
// ASSUMPTION: "nothing left of her" triggers when all 12 heart cards are on
//   the Thing side and the draw pile is empty; "nothing left of you"
//   triggers when the Heart piece itself is lost (the last piece you're
//   allowed to lose).

const state = {
  phase: 'title',
  resources: { blood: 0, knife: 0, lock: 0 },
  heartLine: [],
  heartDeck: [],
  friendRow: [], // 5 slots, each null or { card, faceUp, dead, committedBy }
  friendDeck: [],
  spentFriends: [], // ids of friends ever sacrificed (for guilt)
  pieces: { eyes: { used: false, lost: false }, hand: { used: false, lost: false }, foot: { used: false, lost: false }, heart: { used: false, lost: false } },
  selectedPiece: null,
  lastChosenIndex: null,
  choseThisTurn: false,
  maxReach: 0,
  lastUsedSpace: 0,
  usedOptions: new Set(),
  turnModifiers: {},
  pendingBonusSpace: null, // set by S5's "foot" ability
  handSecondHeartActive: false, // set by F3's commit ability; survives into next turn
  ending: null,
  log: [],
};

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function logMsg(text) {
  state.log.push(text);
  renderLog();
}

function canAfford(cost) {
  if (!cost) return true;
  return Object.entries(cost).every(([k, v]) => (state.resources[k] || 0) >= v);
}

function spend(cost) {
  if (!cost) return;
  Object.entries(cost).forEach(([k, v]) => { state.resources[k] -= v; });
}

function gain(amount) {
  if (!amount) return;
  Object.entries(amount).forEach(([k, v]) => {
    if (k === 'special') return;
    state.resources[k] = (state.resources[k] || 0) + v;
  });
}

// ---------- Setup ----------

function newGame() {
  state.resources = { blood: 0, knife: 0, lock: 0 };
  const heartDeck = shuffle(HEART_CARDS);
  const initial = heartDeck.splice(0, 4);
  state.heartLine = initial.map((c, i) => ({ ...c, side: i < 3 ? 'she' : 'thing' }));
  state.heartDeck = heartDeck;

  const friendDeck = shuffle(FRIEND_CARDS);
  const dealt = friendDeck.splice(0, 5);
  state.friendRow = dealt.map((c, i) => ({ card: c, faceUp: i < 4, dead: false, committedBy: null }));
  state.friendDeck = friendDeck;

  state.spentFriends = [];
  state.pieces = { eyes: { used: false, lost: false }, hand: { used: false, lost: false }, foot: { used: false, lost: false }, heart: { used: false, lost: false } };
  state.selectedPiece = null;
  state.lastChosenIndex = null;
  state.choseThisTurn = false;
  state.maxReach = 0;
  state.lastUsedSpace = 0;
  state.usedOptions = new Set();
  state.turnModifiers = {};
  state.pendingBonusSpace = null;
  state.handSecondHeartActive = false;
  state.ending = null;
  state.log = [];

  state.phase = 'choosingCard';
  logMsg('The house is quiet. Morning comes.');
  enterMorning();
}

function enterMorning() {
  if (!anyHeartCardChoosable()) {
    skipMorning();
  } else {
    renderAll();
  }
}

// ---------- Morning: choosing a heart-line card ----------

function heartCardChoosable(index) {
  if (index === state.lastChosenIndex) return false;
  const card = state.heartLine[index];
  if (!card) return false;
  if (card.side === 'thing') return canAfford(card.thingCost);
  return true;
}

function anyHeartCardChoosable() {
  return state.heartLine.some((_, i) => heartCardChoosable(i));
}

function chooseHeartCard(index) {
  if (state.phase !== 'choosingCard' || !heartCardChoosable(index)) return;
  const card = state.heartLine[index];
  let costPaid = false;

  if (card.side === 'thing') {
    spend(card.thingCost);
    costPaid = true;
    logMsg(`You pay ${describeAmount(card.thingCost)} to face ${card.id}.`);
  } else {
    const benefit = card.sheBenefit || {};
    const resourceGain = {};
    Object.entries(benefit).forEach(([k, v]) => { if (k !== 'special') resourceGain[k] = v; });
    if (Object.keys(resourceGain).length) gain(resourceGain);
    if (benefit.special) {
      state.turnModifiers[benefit.special] = true;
      logMsg(`${card.id}: ${card.sheBenefitText}`);
    } else {
      logMsg(`She gives you ${describeAmount(resourceGain)}. (${card.id})`);
    }
  }

  state.lastChosenIndex = index;
  state.choseThisTurn = true;
  state.maxReach = Math.min(index + 1, 5);

  if (costPaid) {
    const last = state.heartLine[state.heartLine.length - 1];
    if (last && last.side === 'she') last.side = 'thing';
    if (state.heartDeck.length) {
      const drawn = state.heartDeck.pop();
      state.heartLine.push({ ...drawn, side: 'she' });
      logMsg('The line grows. Something new arrives.');
    }
  }

  state.phase = 'actions';
  renderAll();
}

function skipMorning() {
  logMsg('You cannot bring yourself to choose. The morning passes in silence.');
  state.choseThisTurn = false;
  state.phase = 'actions'; // no card chosen, maxReach stays 0 so no track actions possible
  state.maxReach = 0;
  renderAll();
}

// ---------- Morning: action track ----------

function selectPiece(name) {
  if (state.phase !== 'actions') return;
  const p = state.pieces[name];
  if (!p || p.used || p.lost) return;
  state.selectedPiece = state.selectedPiece === name ? null : name;
  renderAll();
}

function optionAvailable(space, option) {
  if (space > state.maxReach) return false;
  if (space < state.lastUsedSpace) return false;
  if (state.usedOptions.has(`${space}-${option}`)) return false;
  const def = ACTION_TRACK[space - 1].options[option];
  if (!def) return false;
  if (def.spend && !canAfford(def.spend)) return false;
  return true;
}

function describeAmount(amount) {
  if (!amount) return 'nothing';
  return Object.entries(amount)
    .filter(([k]) => k !== 'special')
    .map(([k, v]) => `${v} ${k}`)
    .join(', ') || 'nothing';
}

const RESOURCE_ICONS = { blood: '&#129656;', knife: '&#128298;', lock: '&#128274;' };
const PIECE_ICONS = { eyes: '&#128065;&#65039;', hand: '&#9995;', foot: '&#129462;', heart: '&#10084;&#65039;' };

// Render an amount ({blood:1, knife:2, ...}) as icon+number spans, e.g.
// for the action track and choice prompts, in place of a resource name.
function amountIcons(amount, sign) {
  if (!amount) return '';
  return Object.entries(amount)
    .filter(([k]) => RESOURCE_ICONS[k])
    .map(([k, v]) => `<span class="amt amt-${k}"><span class="amt-icon">${RESOURCE_ICONS[k]}</span>${sign}${v}</span>`)
    .join('');
}

function formatEffectIcons(def) {
  const parts = [];
  if (def.spend) parts.push(amountIcons(def.spend, '−'));
  if (def.gain) parts.push(amountIcons(def.gain, '+'));
  if (def.choice) parts.push(def.choice.map((c) => amountIcons(c, '+')).join('<span class="opt-or">or</span>'));
  return parts.join('') || def.text;
}

function applyEffect(def) {
  return new Promise((resolve) => {
    if (def.choice) {
      presentChoice(def.choice, (picked) => {
        gain(picked);
        resolve(picked);
      });
      return;
    }
    if (def.spend) spend(def.spend);
    if (def.gain) gain(def.gain);
    resolve(def.gain || {});
  });
}

async function chooseTrackOption(space, option) {
  if (state.phase !== 'actions') return;
  const isBonus = state.pendingBonusSpace === space;
  if (!isBonus && !state.selectedPiece) return;
  if (!optionAvailable(space, option)) return;
  if (!isBonus) state.pendingBonusSpace = null; // taking a different action forfeits an unused bonus

  const piece = isBonus ? 'foot' : state.selectedPiece;
  const def = ACTION_TRACK[space - 1].options[option];

  await applyEffect(def);
  logMsg(`${isBonus ? 'Foot (bonus)' : capitalize(piece)}: space ${space}${option} — ${def.text}`);

  if (!isBonus && piece === 'eyes' && state.turnModifiers.eyes_twice) {
    await applyEffect(def);
    logMsg(`Eyes see it twice: ${def.text}`);
  }
  if (!isBonus && piece === 'hand' && state.turnModifiers.hand_blood) {
    gain({ blood: 1 });
    logMsg('Her hand in yours: +1 blood.');
  }

  state.usedOptions.add(`${space}-${option}`);
  state.lastUsedSpace = space;

  if (!isBonus) {
    state.pieces[piece].used = true;
    state.selectedPiece = null;
  }

  if (piece === 'heart') {
    await resolveFriendAction(space - 1);
  } else if (!isBonus && piece === 'hand' && state.handSecondHeartActive) {
    logMsg('Your hand remembers what it held. A friend acts again.');
    await resolveFriendAction(space - 1);
    state.handSecondHeartActive = false;
  }

  if (!isBonus && piece === 'foot' && state.turnModifiers.foot_extra_space) {
    const nextSpace = space + 1;
    if (nextSpace <= state.maxReach && (optionAvailable(nextSpace, 'a') || optionAvailable(nextSpace, 'b'))) {
      state.pendingBonusSpace = nextSpace;
      logMsg('Her ease behind the wheel carries you further. Activate the next space at no cost.');
    }
  } else if (isBonus) {
    state.pendingBonusSpace = null;
  }

  renderAll();
}

async function resolveFriendAction(slotIndex) {
  const slot = state.friendRow[slotIndex];
  if (!slot || slot.dead) return;
  if (!slot.faceUp) {
    slot.faceUp = true; // ASSUMPTION: revealed the first time Heart lands here
    logMsg(`A face-down friend is revealed: ${slot.card.id}.`);
  }
  const action = slot.card.action;
  logMsg(`Friend ${slot.card.id} acts: ${action.text}`);

  if (action.choice) {
    await new Promise((resolve) => {
      presentChoice(action.choice, (picked) => { gain(picked); resolve(); });
    });
  } else if (action.special === 'lock_to_knife') {
    gain({ knife: state.resources.lock });
  } else if (action.special === 'knife_as_blood') {
    if (canAfford({ knife: 2 })) {
      spend({ knife: 2 });
      gain({ blood: 1 });
      logMsg('You convert 2 knives into 1 blood.');
    }
  } else if (action.special === 'replace_self') {
    if (action.gain) gain(action.gain);
    slot.dead = true; // leaves the row; see replacement below
    if (state.friendDeck.length) {
      const next = state.friendDeck.pop();
      state.friendRow[slotIndex] = { card: next, faceUp: true, dead: false, committedBy: null };
      logMsg(`A new friend steps in: ${next.id}.`);
    } else {
      state.friendRow[slotIndex] = null;
    }
  } else if (action.special === 'hand_lock_hold' || action.special === 'hand_second_heart') {
    // Passive commit abilities are handled via commitPieceToFriend(), not here.
  } else if (action.gain) {
    gain(action.gain);
  }
}

function commitPieceToFriend(slotIndex) {
  if (state.phase !== 'actions') return;
  if (state.selectedPiece !== 'hand') return;
  const slot = state.friendRow[slotIndex];
  if (!slot || slot.dead || !slot.faceUp) return;
  const special = slot.card.action.special;
  if (special !== 'hand_lock_hold' && special !== 'hand_second_heart') return;
  if (state.pieces.hand.used) return;

  slot.committedBy = 'hand';
  state.pieces.hand.used = true;
  state.selectedPiece = null;
  if (special === 'hand_lock_hold') {
    logMsg(`Your hand rests on ${slot.card.id}. +1 lock while it stays.`);
  } else {
    state.handSecondHeartActive = true;
    logMsg(`Your hand rests on ${slot.card.id}, ready to act again next turn.`);
  }
  renderAll();
}

function committedLockBonus() {
  return state.friendRow.some((s) => s && !s.dead && s.committedBy === 'hand' && s.card.action.special === 'hand_lock_hold') ? 1 : 0;
}

// ---------- Choice modal ----------

function presentChoice(options, callback) {
  const modal = document.getElementById('choice-modal');
  const optsEl = document.getElementById('choice-options');
  document.getElementById('choice-prompt').textContent = 'Choose one:';
  optsEl.innerHTML = '';
  options.forEach((opt) => {
    const btn = document.createElement('button');
    btn.className = 'btn btn-secondary';
    btn.innerHTML = amountIcons(opt, '+') || describeAmount(opt);
    btn.onclick = () => {
      modal.hidden = true;
      callback(opt);
    };
    optsEl.appendChild(btn);
  });
  modal.hidden = false;
}

// ---------- Ending Morning -> Evening -> Night ----------

function endMorning() {
  if (state.turnModifiers.skip_evening_night) {
    logMsg('Skip evening and night. Sleep comes easy, for once.');
    state.phase = 'rest-skipped';
    renderAll();
    return;
  }
  eveningPhase();
}

// Evening and Night resolve their bookkeeping immediately, but we pause
// here with a "Continue" prompt so the player actually sees what happened
// instead of being bounced straight back to the next Morning.
function finishEvening() {
  state.phase = 'evening-resolved';
  renderAll();
}

function finishNight() {
  state.phase = 'night-resolved';
  renderAll();
}

function eveningPhase() {
  state.phase = 'evening';
  if (state.choseThisTurn && state.lastChosenIndex !== null) {
    const chosen = state.heartLine[state.lastChosenIndex];
    if (chosen && chosen.side === 'she') {
      chosen.side = 'thing';
      logMsg(`${chosen.id} slips further away, and turns.`);
    }
  }

  const demand = state.heartLine.filter((c) => c.side === 'thing').reduce((sum, c) => sum + (c.thingFood || 0), 0);
  let remaining = demand;
  const spendable = Math.min(state.resources.blood, remaining);
  state.resources.blood -= spendable;
  remaining -= spendable;
  logMsg(`Evening: the thing demands ${demand} blood. You give ${spendable}.`);

  if (remaining > 0) {
    resolveEveningSacrifice(remaining);
  } else {
    finishEvening();
  }
}

function resolveEveningSacrifice(remaining) {
  const livingFriends = state.friendRow.filter((s) => s && !s.dead && s.faceUp);
  if (remaining <= 0) {
    finishEvening();
    return;
  }
  if (!livingFriends.length) {
    loseAPiece(finishEvening);
    return;
  }
  state.phase = 'evening-sacrifice';
  state.eveningRemaining = remaining;
  logMsg(`You are short ${remaining} blood. Choose a friend to give to it.`);
  renderAll();
}

function sacrificeFriend(slotIndex) {
  if (state.phase !== 'evening-sacrifice') return;
  const slot = state.friendRow[slotIndex];
  if (!slot || slot.dead || !slot.faceUp) return;
  slot.dead = true;
  state.spentFriends.push(slot.card.id);
  state.eveningRemaining -= slot.card.blood;
  logMsg(`${slot.card.id} is given to it. You will carry this.`);
  resolveEveningSacrifice(state.eveningRemaining);
}

function loseAPiece(then) {
  const available = ['eyes', 'hand', 'foot'].filter((p) => !state.pieces[p].lost);
  if (available.length === 0) {
    state.pieces.heart.lost = true;
    logMsg('There is nothing left to lose but your heart. You lose that too.');
    triggerEnding('nothing-left-of-you');
    return;
  }
  if (available.length === 1) {
    state.pieces[available[0]].lost = true;
    logMsg(`You cannot protect yourself. You lose your ${available[0]}.`);
    then();
    return;
  }
  state.phase = 'evening-lose-piece';
  state.pieceLossCallback = then;
  logMsg('You cannot protect yourself. Choose what to lose.');
  renderAll();
}

function choosePieceLoss(name) {
  if (state.phase !== 'evening-lose-piece') return;
  if (name === 'heart' || state.pieces[name].lost) return;
  state.pieces[name].lost = true;
  logMsg(`You lose your ${name}.`);
  const cb = state.pieceLossCallback;
  state.pieceLossCallback = null;
  cb();
}

function nightPhase() {
  state.phase = 'night';
  const guilt = state.spentFriends
    .map((id) => FRIEND_CARDS.find((f) => f.id === id))
    .reduce((sum, f) => sum + (f ? f.guilt : 0), 0);

  if (state.resources.knife >= guilt) {
    state.resources.knife -= guilt;
    logMsg(`Night: guilt weighs ${guilt}. You pay it in knives.`);
  } else {
    logMsg(`Night: guilt weighs ${guilt}. You cannot pay it.`);
    triggerEnding('she-killed');
    return;
  }

  const thingIcons = state.heartLine.filter((c) => c.side === 'thing').reduce((sum, c) => sum + (c.thingIcon || 0), 0);
  const lockAvailable = state.resources.lock + committedLockBonus();
  if (lockAvailable >= thingIcons) {
    state.resources.lock = Math.max(0, state.resources.lock - thingIcons);
    logMsg(`It watches the doors and windows. ${thingIcons} locks hold it back.`);
  } else {
    logMsg(`It watches the doors and windows. ${thingIcons} locks are not enough.`);
    triggerEnding('you-killed');
    return;
  }

  if (state.heartLine.every((c) => c.side === 'thing') && state.heartDeck.length === 0) {
    triggerEnding('nothing-left-of-her');
    return;
  }

  finishNight();
}

function startNextMorning() {
  state.choseThisTurn = false;
  state.maxReach = 0;
  state.lastUsedSpace = 0;
  state.usedOptions = new Set();
  state.turnModifiers = {};
  state.pendingBonusSpace = null;
  ['eyes', 'hand', 'foot', 'heart'].forEach((p) => { if (!state.pieces[p].lost) state.pieces[p].used = false; });
  state.friendRow.forEach((s) => { if (s) s.committedBy = null; });

  if (state.pieces.eyes.lost && state.pieces.hand.lost && state.pieces.foot.lost && state.pieces.heart.lost) {
    triggerEnding('nothing-left-of-you');
    return;
  }

  state.phase = 'choosingCard';
  logMsg('Morning comes again.');
  enterMorning();
}

const ENDINGS = {
  'she-killed': { title: 'She Will Be Killed', text: 'The guilt is more than you can carry. You cannot protect her from what she has become, or from what you have to do.' },
  'you-killed': { title: 'You Will Be Killed', text: 'The locks give way. It has been patient. It is not patient anymore.' },
  'nothing-left-of-her': { title: 'There Is Nothing Left of Her', text: 'Every part of her has turned. Whatever answers to her name now is only the thing wearing her skin.' },
  'nothing-left-of-you': { title: 'There Is Nothing Left of You', text: 'Eyes, hand, foot, heart — you gave all of it. There is nothing left to give.' },
};

function triggerEnding(key) {
  state.phase = 'ended';
  state.ending = key;
  renderAll();
}

// ---------- Rendering ----------

function capitalize(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

function renderAll() {
  document.getElementById('screen-title').hidden = state.phase !== 'title';
  document.getElementById('screen-game').hidden = state.phase === 'title' || state.phase === 'ended';
  document.getElementById('screen-ending').hidden = state.phase !== 'ended';

  if (state.phase === 'ended') {
    const e = ENDINGS[state.ending];
    document.getElementById('ending-title').textContent = e.title;
    document.getElementById('ending-text').textContent = e.text;
    return;
  }
  if (state.phase === 'title') return;

  renderResources();
  renderForecast();
  renderPhaseIndicator();
  renderHeartLine();
  renderTrack();
  renderPieceTray();
  renderFriendLine();
  renderLog();

  const endBtn = document.getElementById('btn-end-morning');
  endBtn.hidden = state.phase !== 'actions';

  renderRecap();
}

const RECAPS = {
  'evening-resolved': { text: 'Evening has passed.', button: 'Continue to Night' },
  'night-resolved': { text: 'Night has passed.', button: 'Continue to Morning' },
  'rest-skipped': { text: 'You skip evening and night entirely.', button: 'Continue to Morning' },
};

function renderRecap() {
  const panel = document.getElementById('recap-panel');
  const recap = RECAPS[state.phase];
  panel.hidden = !recap;
  if (recap) {
    document.getElementById('recap-text').textContent = recap.text;
    document.getElementById('btn-continue').textContent = recap.button;
  }
}

function continueFromRecap() {
  if (state.phase === 'evening-resolved') {
    nightPhase();
  } else if (state.phase === 'night-resolved' || state.phase === 'rest-skipped') {
    startNextMorning();
  }
}

function renderResources() {
  document.getElementById('res-blood').textContent = state.resources.blood;
  document.getElementById('res-knife').textContent = state.resources.knife;
  document.getElementById('res-lock').textContent = state.resources.lock + committedLockBonus();
}

// What tonight will actually cost, computed straight from current state
// (thing-side cards demand blood and watch with locked-eyes; every friend
// ever sacrificed adds permanent guilt paid in knives) so it can be shown
// live instead of only after the fact in the log.
function computeForecast() {
  const thingCards = state.heartLine.filter((c) => c.side === 'thing');
  const blood = thingCards.reduce((sum, c) => sum + (c.thingFood || 0), 0);
  const lock = thingCards.reduce((sum, c) => sum + (c.thingIcon || 0), 0);
  const knife = state.spentFriends
    .map((id) => FRIEND_CARDS.find((f) => f.id === id))
    .reduce((sum, f) => sum + (f ? f.guilt : 0), 0);
  return { blood, knife, lock };
}

function renderForecast() {
  const el = document.getElementById('forecast');
  if (state.phase === 'ended') { el.innerHTML = ''; return; }
  const need = computeForecast();
  if (!need.blood && !need.knife && !need.lock) { el.innerHTML = ''; return; }
  const lockAvailable = state.resources.lock + committedLockBonus();
  const short = {
    blood: state.resources.blood < need.blood,
    knife: state.resources.knife < need.knife,
    lock: lockAvailable < need.lock,
  };
  el.innerHTML = `
    <span class="forecast-label">Tonight costs</span>
    <span class="forecast-item${short.blood ? ' forecast-short' : ''}"><span class="amt-icon">${RESOURCE_ICONS.blood}</span>${need.blood}</span>
    <span class="forecast-item${short.knife ? ' forecast-short' : ''}"><span class="amt-icon">${RESOURCE_ICONS.knife}</span>${need.knife}</span>
    <span class="forecast-item${short.lock ? ' forecast-short' : ''}"><span class="amt-icon">${RESOURCE_ICONS.lock}</span>${need.lock}</span>`;
}

function renderPhaseIndicator() {
  const labels = {
    choosingCard: 'Morning — choose',
    actions: 'Morning — act',
    evening: 'Evening',
    'evening-sacrifice': 'Evening — sacrifice',
    'evening-lose-piece': 'Evening — loss',
    night: 'Night',
    'evening-resolved': 'Evening',
    'night-resolved': 'Night',
    'rest-skipped': 'Evening — skipped',
  };
  document.getElementById('phase-indicator').textContent = labels[state.phase] || state.phase;
}

function renderHeartLine() {
  const el = document.getElementById('heart-line');
  el.innerHTML = '';
  state.heartLine.forEach((card, i) => {
    const div = document.createElement('div');
    const choosable = state.phase === 'choosingCard' && heartCardChoosable(i);
    div.className = `card side-${card.side}` + (choosable ? '' : ' card-disabled') + (i === state.lastChosenIndex ? ' card-chosen' : '');
    if (card.side === 'she') {
      div.innerHTML = `
        <span class="card-tag tag-she">Her</span>
        <p class="card-flavor" title="${card.sheText}">${card.sheText}</p>
        <p class="card-effect">${card.sheBenefitText || amountIcons(card.sheBenefit, '+')}</p>`;
    } else {
      div.innerHTML = `
        <span class="card-tag tag-thing">Thing</span>
        <p class="card-flavor">Something wears her face.</p>
        <p class="card-effect">Cost to face it: ${amountIcons(card.thingCost, '−')}<br>
          Feeds on <span class="amt amt-blood"><span class="amt-icon">${RESOURCE_ICONS.blood}</span>${card.thingFood}</span> each evening.${card.thingIcon ? `<br>Watches with ${card.thingIcon} <span class="amt-icon">${PIECE_ICONS.eyes}</span> each night.` : ''}</p>`;
    }
    if (choosable) div.onclick = () => chooseHeartCard(i);
    el.appendChild(div);
  });
}

function renderTrack() {
  const el = document.getElementById('action-track');
  el.innerHTML = '';
  ACTION_TRACK.forEach((spaceDef) => {
    const space = spaceDef.space;
    const locked = space > state.maxReach;
    const cell = document.createElement('div');
    cell.className = 'track-cell' + (locked ? ' space-locked' : '');

    const label = document.createElement('div');
    label.className = 'track-space-label';
    label.textContent = space;
    cell.appendChild(label);

    Object.entries(spaceDef.options).forEach(([opt, def]) => {
      const btn = document.createElement('button');
      btn.className = 'track-option' + (state.usedOptions.has(`${space}-${opt}`) ? ' option-used' : '');
      btn.innerHTML = formatEffectIcons(def);
      btn.title = def.text;
      const canUse = state.phase === 'actions' && optionAvailable(space, opt) &&
        (state.pendingBonusSpace === space || state.selectedPiece);
      btn.disabled = !canUse;
      btn.onclick = () => chooseTrackOption(space, opt);
      cell.appendChild(btn);
    });

    el.appendChild(cell);
  });
}

function renderPieceTray() {
  const el = document.getElementById('piece-tray');
  el.innerHTML = '';
  const losing = state.phase === 'evening-lose-piece';
  PIECES.forEach((name) => {
    const p = state.pieces[name];
    const btn = document.createElement('button');
    btn.className = 'piece' + (state.selectedPiece === name ? ' piece-selected' : '') + ((p.used || p.lost) ? ' piece-used' : '');
    btn.innerHTML = `<span class="piece-icon">${PIECE_ICONS[name]}</span>${capitalize(name)}${p.lost ? ' (lost)' : ''}`;
    if (losing) {
      btn.disabled = p.lost || name === 'heart';
      btn.onclick = () => choosePieceLoss(name);
    } else {
      btn.disabled = p.used || p.lost || state.phase !== 'actions';
      btn.onclick = () => selectPiece(name);
    }
    el.appendChild(btn);
  });
}

function renderFriendLine() {
  const el = document.getElementById('friend-line');
  el.innerHTML = '';
  state.friendRow.forEach((slot, i) => {
    const div = document.createElement('div');
    if (!slot) {
      div.className = 'card card-empty';
      div.textContent = 'gone';
      el.appendChild(div);
      return;
    }
    if (slot.dead) {
      div.className = 'card friend-card friend-dead';
      div.innerHTML = `
        <p class="card-flavor">Given to it.</p>
        <p class="friend-blood">Guilt: ${slot.card.guilt}</p>`;
      el.appendChild(div);
      return;
    }
    if (!slot.faceUp) {
      div.className = 'card friend-card card-empty';
      div.textContent = 'a stranger, face down';
      el.appendChild(div);
      return;
    }
    const committable = state.phase === 'actions' && state.selectedPiece === 'hand' && !slot.committedBy &&
      (slot.card.action.special === 'hand_lock_hold' || slot.card.action.special === 'hand_second_heart');
    const sacrificeable = state.phase === 'evening-sacrifice';
    div.className = 'card friend-card' + (slot.committedBy ? ' friend-committed' : '') + (committable || sacrificeable ? ' friend-committable' : '');
    div.innerHTML = `
      <p class="card-flavor" title="${slot.card.text}">${slot.card.text}</p>
      <p class="friend-blood">If lost: <span class="amt amt-blood"><span class="amt-icon">${RESOURCE_ICONS.blood}</span>${slot.card.blood}</span></p>
      <p class="card-effect">${!slot.card.action.special && (slot.card.action.gain || slot.card.action.choice) ? formatEffectIcons(slot.card.action) : slot.card.action.text}</p>`;
    if (committable) div.onclick = () => commitPieceToFriend(i);
    if (sacrificeable) div.onclick = () => sacrificeFriend(i);
    el.appendChild(div);
  });
}

function renderLog() {
  const el = document.getElementById('log-list');
  el.innerHTML = '';
  state.log.slice(-40).forEach((line) => {
    const li = document.createElement('li');
    li.textContent = line;
    el.appendChild(li);
  });
  el.scrollTop = el.scrollHeight;
}

// ---------- Wiring ----------

document.getElementById('btn-start').addEventListener('click', newGame);
document.getElementById('btn-restart').addEventListener('click', newGame);
document.getElementById('btn-end-morning').addEventListener('click', () => {
  if (state.phase === 'actions') endMorning();
});
document.getElementById('btn-continue').addEventListener('click', continueFromRecap);
renderAll();
