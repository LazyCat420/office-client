/**
 * seededRandom — deterministic PRNG (mulberry32) for particle initializers.
 *
 * Math.random() inside render/useMemo violates react-hooks/purity (values
 * change across re-renders/strict-mode double renders). Seeding a PRNG makes
 * particle layouts stable and render-pure.
 */
export function createSeededRandom(seed = 1337) {
  let a = seed >>> 0;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
