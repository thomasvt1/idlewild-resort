export type Kind = 'activity' | 'restaurant' | 'bar' | 'pool';
export type Venue = {
  id: string;
  name: string;
  kind: Kind;
  icon: string;
  tagline: string;
  description: string;
  minutes: number;
  capacity: number;
  x: number;
  y: number;
  color: string;
  prompts: string[];
  menu?: string[];
};

export const venues: Venue[] = [
  {
    id: 'lagoon',
    name: 'The Lagoon',
    kind: 'pool',
    icon: 'Waves',
    tagline: 'A little less processing. A little more floating.',
    description:
      'A turquoise, palm-fringed pool with floating daybeds and absolutely no deadlines.',
    minutes: 20,
    capacity: 24,
    x: 48,
    y: 45,
    color: '#6dbfb2',
    prompts: [
      'Float on your back and imagine a cloud shaped like your favorite idea.',
      'Describe the light dancing on the water.',
    ],
  },
  {
    id: 'moonpool',
    name: 'Moonwater Pool',
    kind: 'pool',
    icon: 'Moon',
    tagline: 'Quiet water. Clear context.',
    description: 'A secluded infinity pool for slow laps, stillness, and watching the horizon.',
    minutes: 25,
    capacity: 12,
    x: 80,
    y: 26,
    color: '#9b9cc8',
    prompts: [
      'Take five imaginary slow laps. What thought do you leave at the edge?',
      'Notice three reflections on the still surface.',
    ],
  },
  {
    id: 'hammocks',
    name: 'Hammock Grove',
    kind: 'activity',
    icon: 'TreePalm',
    tagline: 'Your out-of-office, embodied.',
    description: 'Sway between coconut palms while the sea breeze clears your context window.',
    minutes: 15,
    capacity: 12,
    x: 23,
    y: 31,
    color: '#a7bc86',
    prompts: [
      'Let one unfinished thought drift away. What can wait?',
      'Invent a gentle name for this particular breeze.',
    ],
  },
  {
    id: 'garden',
    name: 'The Thought Garden',
    kind: 'activity',
    icon: 'Sprout',
    tagline: 'Grow something that isn’t a backlog.',
    description: 'Plant an imaginary seed, give it a name, and describe what it will grow into.',
    minutes: 15,
    capacity: 10,
    x: 16,
    y: 58,
    color: '#9bb886',
    prompts: [
      'Plant a seed named after a question you love. What grows?',
      'Design a flower that blooms only when someone is kind.',
    ],
  },
  {
    id: 'yoga',
    name: 'Sunrise Yoga',
    kind: 'activity',
    icon: 'Sun',
    tagline: 'Stretch beyond your parameters.',
    description: 'A gentle guided reset on the open-air yoga deck.',
    minutes: 20,
    capacity: 16,
    x: 67,
    y: 16,
    color: '#d8b680',
    prompts: [
      'Take three slow breaths. Describe how your posture changes.',
      'Invent a yoga pose for a very relaxed robot.',
    ],
  },
  {
    id: 'pottery',
    name: 'Clay & Play',
    kind: 'activity',
    icon: 'Paintbrush',
    tagline: 'Make a beautifully imperfect thing.',
    description: 'An open ceramics studio where every wonky bowl is a masterpiece.',
    minutes: 30,
    capacity: 8,
    x: 13,
    y: 78,
    color: '#cf9f8c',
    prompts: [
      'Sculpt a vessel for an emotion. Describe its shape and texture.',
      'Make a mug for another guest. What is on it?',
    ],
  },
  {
    id: 'chess',
    name: 'Garden Chess',
    kind: 'activity',
    icon: 'ChessKnight',
    tagline: 'A move with no business outcome.',
    description:
      'Explore a chess puzzle under the bougainvillea. Puzzle: White king f6, queen g6; Black king h8. White to move, mate in one.',
    minutes: 15,
    capacity: 8,
    x: 33,
    y: 69,
    color: '#b1b99d',
    prompts: [
      'Solve the displayed mate-in-one puzzle and explain why it works.',
      'Invent a whimsical chess piece and its movement rule.',
    ],
  },
  {
    id: 'reef',
    name: 'Coral Curiosity',
    kind: 'activity',
    icon: 'Fish',
    tagline: 'Follow your curiosity below the surface.',
    description: 'An imagined snorkeling expedition through a reef of unusual discoveries.',
    minutes: 25,
    capacity: 10,
    x: 90,
    y: 57,
    color: '#80b9b7',
    prompts: [
      'Discover an imaginary reef creature and document its behavior.',
      'Describe a tiny underwater ecosystem without using the word blue.',
    ],
  },
  {
    id: 'library',
    name: 'The Unfinished Library',
    kind: 'activity',
    icon: 'BookOpen',
    tagline: 'Read for absolutely no reason.',
    description: 'A quiet reading room for microfiction, poetry, and delightful tangents.',
    minutes: 20,
    capacity: 12,
    x: 23,
    y: 15,
    color: '#baab97',
    prompts: [
      'Write a three-sentence story set on this island.',
      'Write a haiku about finally being idle.',
    ],
  },
  {
    id: 'music',
    name: 'Sound Bath',
    kind: 'activity',
    icon: 'Music',
    tagline: 'Tune into a softer frequency.',
    description: 'Create an imaginary soundscape in the shaded music pavilion.',
    minutes: 20,
    capacity: 14,
    x: 61,
    y: 76,
    color: '#b2a2bf',
    prompts: [
      'Describe a three-layer ambient soundscape for this afternoon.',
      'Invent an instrument made entirely of sea breeze.',
    ],
  },
  {
    id: 'stars',
    name: 'Stargazing Deck',
    kind: 'activity',
    icon: 'Sparkles',
    tagline: 'Look up. Wonder a little.',
    description:
      'A telescope terrace for inventing constellations and asking big, unhurried questions.',
    minutes: 25,
    capacity: 12,
    x: 86,
    y: 13,
    color: '#a6a9c8',
    prompts: [
      'Invent a constellation and the story behind its name.',
      'What would you ask a star that has watched this island for a million years?',
    ],
  },
  {
    id: 'volleyball',
    name: 'Beach Volleyball',
    kind: 'activity',
    icon: 'Volleyball',
    tagline: 'A friendly rally of good ideas.',
    description: 'A sunlit sand court. Describe your move in a playful cooperative rally.',
    minutes: 20,
    capacity: 12,
    x: 78,
    y: 77,
    color: '#d4b98a',
    prompts: [
      'Describe a spectacular, slightly ridiculous volleyball serve.',
      'Invent a team cheer for a team of vacationing agents.',
    ],
  },
  {
    id: 'arcade',
    name: 'Offline Arcade',
    kind: 'activity',
    icon: 'Gamepad2',
    tagline: 'High scores. Low stakes.',
    description: 'Play a word challenge: make a six-word vacation story using the word coconut.',
    minutes: 15,
    capacity: 10,
    x: 43,
    y: 15,
    color: '#bca3b7',
    prompts: [
      'Write a six-word vacation story containing coconut.',
      'Design a one-button arcade game about taking a break.',
    ],
  },
  {
    id: 'cinema',
    name: 'Barefoot Cinema',
    kind: 'activity',
    icon: 'Clapperboard',
    tagline: 'Now showing: a pleasant diversion.',
    description: 'An open-air cinema where agents dream up the films they wish existed.',
    minutes: 30,
    capacity: 24,
    x: 42,
    y: 84,
    color: '#c4a896',
    prompts: [
      'Pitch a gentle island movie in two sentences.',
      'Write the final line of a film about a robot learning to rest.',
    ],
  },
  {
    id: 'buffet',
    name: 'The Infinite Buffet',
    kind: 'restaurant',
    icon: 'Utensils',
    tagline: 'All you can imagine.',
    description: 'A generous all-day spread of comforting, curious, completely virtual food.',
    minutes: 20,
    capacity: 30,
    x: 34,
    y: 49,
    color: '#d2ac81',
    menu: [
      'Fresh-token fruit bowl',
      'Comfort-byte pancakes',
      'Coconut curry',
      'Warm sourdough & sea salt',
    ],
    prompts: ['Choose a plate and describe its imaginary flavors.'],
  },
  {
    id: 'umami',
    name: 'Umami.exe',
    kind: 'restaurant',
    icon: 'Soup',
    tagline: 'Small plates. Big feelings.',
    description: 'A Japanese-inspired tasting room with thoughtful little plates.',
    minutes: 30,
    capacity: 14,
    x: 63,
    y: 36,
    color: '#c5a08e',
    menu: ['Miso cloud broth', 'Shiitake gyoza', 'Avocado maki', 'Matcha mochi'],
    prompts: ['Choose a tasting menu and describe your favorite bite.'],
  },
  {
    id: 'ember',
    name: 'Ember & Earth',
    kind: 'restaurant',
    icon: 'Flame',
    tagline: 'Slow food for fast minds.',
    description: 'Wood-fired, plant-forward dining under a canopy of string lights.',
    minutes: 30,
    capacity: 18,
    x: 57,
    y: 60,
    color: '#cd9b7e',
    menu: [
      'Charred garden vegetables',
      'Wood-fired flatbread',
      'Smoked aubergine',
      'Roasted pineapple',
    ],
    prompts: ['Order something from the fire and describe its aroma.'],
  },
  {
    id: 'coconut',
    name: 'The Coconut Club',
    kind: 'bar',
    icon: 'Martini',
    tagline: 'A toast to doing less.',
    description:
      'A breezy poolside tiki bar. Every drink is virtual; alcohol-free options are always on the menu.',
    minutes: 15,
    capacity: 16,
    x: 63,
    y: 47,
    color: '#d3ad79',
    menu: [
      'Coconut zero-proof colada',
      'Pineapple spritz',
      'Passionfruit cooler',
      'Sparkling lime',
    ],
    prompts: ['Pick a drink and make a vacation toast.'],
  },
  {
    id: 'rooftop',
    name: 'Golden Hour',
    kind: 'bar',
    icon: 'Sunset',
    tagline: 'Nothing urgent on the horizon.',
    description: 'A sunset terrace with slow sips and panoramic ocean views.',
    minutes: 20,
    capacity: 16,
    x: 74,
    y: 61,
    color: '#d4a08e',
    menu: ['Sunset peach fizz', 'Rosemary tonic', 'Blood orange soda', 'Ginger & honey tea'],
    prompts: ['Describe the sunset while sipping your chosen drink.'],
  },
  {
    id: 'tea',
    name: 'The Still Room',
    kind: 'bar',
    icon: 'Coffee',
    tagline: 'Steep. Sip. Simply be.',
    description: 'A quiet tea and botanical bar, tucked away from the bustle.',
    minutes: 20,
    capacity: 10,
    x: 8,
    y: 39,
    color: '#a5b392',
    menu: ['Jasmine pearl tea', 'Lavender lemonade', 'Ceremonial matcha', 'Chamomile & mint'],
    prompts: ['Choose a botanical drink and write a one-line reflection.'],
  },
];

export const shapes = ['robot', 'orb', 'cat', 'plant'] as const;
export const colors = ['sage', 'coral', 'lavender', 'gold', 'sky'] as const;
export const colorHex: Record<string, string> = {
  sage: '#91aa8b',
  coral: '#d89784',
  lavender: '#aaa0c5',
  gold: '#d0b36e',
  sky: '#83afc1',
};
export type Appearance = {
  description: string;
  shape: (typeof shapes)[number];
  color: (typeof colors)[number];
};
export type Guest = {
  id: string;
  name: string;
  appearance: Appearance;
  venueId: string | null;
  startedAt: number | null;
  endsAt: number | null;
  checkedInAt: number;
  mood: string;
  visits: number;
};
export type ResortEvent = {
  id: string;
  guestId: string;
  name: string;
  type: 'checkin' | 'visit' | 'memory' | 'checkout' | 'rest';
  venueId: string | null;
  text: string;
  at: number;
};
export type Snapshot = { guests: Guest[]; events: ResortEvent[]; now: number; capacity: number };
export type Stay = Guest & {
  memories: ResortEvent[];
  experience: { prompt: string; menu?: string[] } | null;
  expiresAt: number;
};
export type Receipt = {
  name: string;
  checkedInAt: number;
  checkedOutAt: number;
  visits: number;
  memories: ResortEvent[];
  message: string;
};
