let cache = null;

export async function loadDictionary() {
  if (cache) return cache;
  const res = await fetch("/enable1.txt");
  const text = await res.text();
  const words = text
    .split("\n")
    .map((w) => w.trim().toUpperCase())
    .filter((w) => w.length > 0);
  words.sort();
  const set = new Set(words);
  cache = { words, set };
  return cache;
}

export function isWord(dict, w) {
  return dict.set.has(w);
}

export function isPrefix(dict, p) {
  if (!p) return true;
  const { words } = dict;
  let lo = 0;
  let hi = words.length;
  while (lo < hi) {
    const mid = (lo + hi) >>> 1;
    if (words[mid] < p) lo = mid + 1;
    else hi = mid;
  }
  return lo < words.length && words[lo].startsWith(p);
}

const LETTER_VALUES = {
  A: 1, E: 1, I: 1, O: 1, U: 1, L: 1, N: 1, S: 1, T: 1, R: 1,
  D: 2, G: 2,
  B: 3, C: 3, M: 3, P: 3,
  F: 4, H: 4, V: 4, W: 4, Y: 4,
  K: 5,
  J: 8, X: 8,
  Q: 10, Z: 10,
};

export function wordScore(w) {
  let sum = 0;
  for (const ch of w) sum += LETTER_VALUES[ch] ?? 0;
  return Math.round(sum * (1 + 0.1 * w.length));
}

const FREQ = {
  A: 9, B: 2, C: 2, D: 4, E: 12, F: 2, G: 3, H: 2, I: 9, J: 1,
  K: 1, L: 4, M: 2, N: 6, O: 8, P: 2, Q: 1, R: 6, S: 4, T: 6,
  U: 4, V: 2, W: 2, X: 1, Y: 2, Z: 1,
};

const WEIGHTED_POOL = (() => {
  const pool = [];
  for (const [ch, n] of Object.entries(FREQ)) {
    for (let i = 0; i < n; i++) pool.push(ch);
  }
  return pool;
})();

export function randomLetter() {
  return WEIGHTED_POOL[Math.floor(Math.random() * WEIGHTED_POOL.length)];
}
