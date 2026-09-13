// Card and board data for "But Then She Came Back"
// Transcribed from design notes. Resource keys: blood, knife, lock.

// The 12 double-sided Heart cards. Each starts as "she" (front) and
// eventually flips to "thing" (back) as the game escalates.
const HEART_CARDS = [
  {
    id: 'S1',
    sheText: "It used to be the other way around. She used to protect you. She was fearless once. It's easier, for both of you, to pretend that's still the case",
    sheBenefit: { knife: 1, lock: 1 },
    thingCost: { lock: 1 },
    thingFood: 0,
    thingIcon: 1,
  },
  {
    id: 'S2',
    sheText: "In the old house, she doesn't get confused. These walls, these rooms, she knows them like she knows how to breathe. She delights in the bathroom, still wallpapered with lotto tickets",
    sheBenefit: { lock: 1 },
    thingCost: { knife: 2 },
    thingFood: 0,
    thingIcon: 1,
  },
  {
    id: 'S3',
    sheText: "You turn the pages for her, and she presses her fingers against the photos. She knows her father's face; She's held onto that much. But she seems to have forgotten that he is gone now.",
    sheBenefit: { lock: 2 },
    thingCost: { lock: 1 },
    thingFood: 0,
    thingIcon: 1,
  },
  {
    id: 'S4',
    sheText: "She brings out the chess set. She remembers the pieces with her fingertips, and how she always beat you. She makes mistakes now, bad ones, but you haven't the heart to win.",
    sheBenefit: { blood: 2 },
    thingCost: { blood: 1 },
    thingFood: 1,
    thingIcon: 0,
  },
  {
    id: 'S5',
    sheText: "It broke her heart when she couldn't drive anymore. She was happiest in a car, running a dozen errands for her friends. It's not the same, but she seems calm riding with you.",
    sheBenefit: { special: 'foot_extra_space' },
    sheBenefitText: 'After using foot, move it and activate the next empty space',
    thingCost: { blood: 1 },
    thingFood: 1,
    thingIcon: 0,
  },
  {
    id: 'S6',
    sheText: "You let her garden die when she did. You tried, but as days melted into each other you kept forgetting. She doesn't seem to notice, and gently putters about its wilted dead things",
    sheBenefit: { blood: 2 },
    thingCost: { lock: 1 },
    thingFood: 2,
    thingIcon: 0,
  },
  {
    id: 'S7',
    sheText: "She snored when she was alive. Now it's a wet noise, sounds the way an eff feels slipping through your fingers. But she looks so peaceful when she sleeps, so you hear a snore instead",
    sheBenefit: { special: 'skip_evening_night' },
    sheBenefitText: 'Skip evening and night',
    thingCost: { lock: 1 },
    thingFood: 2,
    thingIcon: 0,
  },
  {
    id: 'S8',
    sheText: "She hides your glasses; she always liked a mischief. Without them, she is a gentle blur. In her face, for the first time in a long time, you see her, instead of the thing wearing her skin.",
    sheBenefit: { special: 'eyes_twice' },
    sheBenefitText: 'When using eyes, do the action twice.',
    thingCost: { knife: 2 },
    thingFood: 1,
    thingIcon: 0,
  },
  {
    id: 'S9',
    sheText: "She dances and laughs. She's slower than she was when she was alive. Clumsier, too. But when you think about it, she was always a little clumsy, and that was endearing.",
    sheBenefit: { blood: 1 },
    thingCost: { knife: 2 },
    thingFood: 1,
    thingIcon: 0,
  },
  {
    id: 'S10',
    sheText: "The two of you had a secret language, single words that implied whole stories, collections of names you gave each other. She remembers them, even if all she can do now is mutter and scream.",
    sheBenefit: { blood: 2 },
    thingCost: { lock: 1 },
    thingFood: 2,
    thingIcon: 0,
  },
  {
    id: 'S11',
    sheText: "She remembers how to hold your hand, the way your fingers lace together. Her grip is weaker now, and the skin is taut against her finger bones.",
    sheBenefit: { special: 'hand_blood' },
    sheBenefitText: 'Gain 1 blood when using Hand',
    thingCost: { knife: 2 },
    thingFood: 1,
    thingIcon: 0,
  },
  {
    id: 'S12',
    sheText: "Her taste in movies and TV was absolute dogshit. That used to irritate you, these mindless things blaring all the time, but you missed it when she died, and it makes her less restless",
    sheBenefit: { blood: 1, lock: 1 },
    thingCost: { blood: 1 },
    thingFood: 1,
    thingIcon: 1,
  },
];

// The 8 single-sided Friend cards. Five are dealt to the friend row
// (four face up, one face down) below the action track.
const FRIEND_CARDS = [
  {
    id: 'F1',
    text: "You always liked to crawl into traps. You even close the jaws yourself",
    blood: 4,
    guilt: 2,
    action: { special: 'hand_lock_hold', text: "If you haven't used it this turn, place your hand here. Leave it until you kill this friend. While it is here, you always have +1 lock" },
  },
  {
    id: 'F2',
    text: "Can't you see what she's doing to you? There won't be anything left.",
    blood: 4,
    guilt: 1,
    action: { special: 'knife_as_blood', text: 'This turn you may spend 2 knives as 1 blood' },
  },
  {
    id: 'F3',
    text: "You pretend that you don't have a choice, but you do. You chose this",
    blood: 5,
    guilt: 2,
    action: { special: 'hand_second_heart', text: 'If you haven’t used it this turn, place your hand here. Next turn, take it back and use it as a second heart, activating the associated friend.' },
  },
  {
    id: 'F4',
    text: "We've been so worried about you. Are you sure you're okay?",
    blood: 3,
    guilt: 0,
    action: { gain: { lock: 1 }, text: 'Gain 1 lock.' },
  },
  {
    id: 'F5',
    text: "You need to take care of yourself, too. This is hollowing you out.",
    blood: 3,
    guilt: 0,
    action: { gain: { knife: 2 }, text: 'Gain 2 knife' },
  },
  {
    id: 'F6',
    text: "There are other people who can do this. Why does it have to be you?",
    blood: 4,
    guilt: 1,
    action: { special: 'lock_to_knife', text: 'For each lock you have, gain 1 knife.' },
  },
  {
    id: 'F7',
    text: "I can't do this with you anymore. You're wearing me out",
    blood: 5,
    guilt: 2,
    action: { gain: { knife: 2, blood: 2 }, special: 'replace_self', text: 'Gain 2 knife. Gain 2 blood. Remove this card from play and replace it with a new friend (do not flip)' },
  },
  {
    id: 'F8',
    text: "What do you need. Just name it. Anyway I can help you, I will",
    blood: 3,
    guilt: 1,
    action: { choice: [{ knife: 2 }, { lock: 1 }, { blood: 1 }], text: 'Gain 2 knife or 1 lock or 1 blood.' },
  },
];

// The 5-space action track. Space 2, 3, 4, 5 each split into an "a"
// and "b" option; space 1 has a single option.
const ACTION_TRACK = [
  {
    space: 1,
    options: {
      a: { gain: { blood: 1 }, text: 'Gain 1 blood.' },
    },
  },
  {
    space: 2,
    options: {
      a: { gain: { knife: 1 }, text: 'Gain 1 knife.' },
      b: { gain: { lock: 1 }, text: 'Gain 1 lock.' },
    },
  },
  {
    space: 3,
    options: {
      a: { gain: { knife: 2 }, text: 'Gain 2 knives.' },
      b: { spend: { knife: 1 }, gain: { lock: 1 }, text: 'Spend 1 knife, gain 1 lock.' },
    },
  },
  {
    space: 4,
    options: {
      a: { spend: { lock: 1 }, gain: { blood: 1 }, text: 'Spend 1 lock, gain 1 blood.' },
      b: { choice: [{ knife: 1 }, { lock: 1 }], text: 'Gain 1 knife or gain 1 lock.' },
    },
  },
  {
    space: 5,
    options: {
      a: { gain: { knife: 1, lock: 1 }, text: 'Gain 1 knife and 1 lock.' },
      b: { spend: { knife: 1 }, gain: { blood: 2 }, text: 'Spend 1 knife, gain 2 blood.' },
    },
  },
];

// The four player pieces that can be placed on action-track spaces.
const PIECES = ['eyes', 'hand', 'foot', 'heart'];

if (typeof module !== 'undefined') {
  module.exports = { HEART_CARDS, FRIEND_CARDS, ACTION_TRACK, PIECES };
}
