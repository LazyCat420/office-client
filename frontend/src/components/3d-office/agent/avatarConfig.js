/**
 * Avatar config: the single source of truth for accessory slots and defaults.
 *
 * An agent wears at most one accessory per slot, so a cap can coexist with
 * glasses and a tie. Older records stored a single `accessory` string; the
 * readers here accept that shape and writers mirror back into it so anything
 * still reading the old field keeps working.
 */

export const DEFAULT_AVATAR_CONFIG = {
  skin_color: '#fde68a',
  hair_color: '#1e293b',
  outfit_color: '#3b82f6',
  accent_color: '#f59e0b',
  accessories: [],
};

export const ACCESSORY_SLOTS = {
  top_hat: 'head',
  cap: 'head',
  crown: 'head',
  beanie: 'head',
  glasses: 'face',
  headset: 'ears',
  tie: 'neck',
};

// Render/serialise order. Head first so the legacy single-string mirror keeps
// showing the most visually dominant piece.
export const SLOT_ORDER = ['head', 'face', 'ears', 'neck'];

export const SLOT_LABELS = {
  head: 'Headwear',
  face: 'Eyewear',
  ears: 'Headset',
  neck: 'Neckwear',
};

export const ACCESSORY_OPTIONS = {
  head: [
    { value: '', label: 'None' },
    { value: 'top_hat', label: 'Top Hat' },
    { value: 'cap', label: 'Baseball Cap' },
    { value: 'crown', label: 'Crown' },
    { value: 'beanie', label: 'Beanie' },
  ],
  face: [
    { value: '', label: 'None' },
    { value: 'glasses', label: 'Glasses' },
  ],
  ears: [
    { value: '', label: 'None' },
    { value: 'headset', label: 'Headset' },
  ],
  neck: [
    { value: '', label: 'None' },
    { value: 'tie', label: 'Tie' },
  ],
};

const isEmptyAccessory = (v) => !v || v === 'none';

/**
 * Resolve an avatar_config into an ordered list of accessory types to render.
 * Accepts the new `accessories` array or the legacy `accessory` string, drops
 * unknown/empty entries, and keeps only the first pick per slot.
 */
export function normalizeAccessories(config) {
  if (!config) return [];

  const raw = Array.isArray(config.accessories)
    ? config.accessories
    : config.accessories
      ? [config.accessories]
      : [];

  const candidates = raw.length ? raw : [config.accessory];

  const bySlot = new Map();
  for (const item of candidates) {
    if (isEmptyAccessory(item)) continue;
    const slot = ACCESSORY_SLOTS[item];
    if (!slot || bySlot.has(slot)) continue;
    bySlot.set(slot, item);
  }

  return SLOT_ORDER.map((slot) => bySlot.get(slot)).filter(Boolean);
}

export function accessoryForSlot(config, slot) {
  return normalizeAccessories(config).find((a) => ACCESSORY_SLOTS[a] === slot) || '';
}

/** Immutably set one slot, returning a config with both the array and the legacy mirror. */
export function setAccessorySlot(config, slot, value) {
  const kept = normalizeAccessories(config).filter((a) => ACCESSORY_SLOTS[a] !== slot);
  if (!isEmptyAccessory(value)) kept.push(value);

  const accessories = SLOT_ORDER
    .map((s) => kept.find((a) => ACCESSORY_SLOTS[a] === s))
    .filter(Boolean);

  return { ...config, accessories, accessory: accessories[0] || '' };
}

export function hasAccessory(config, type) {
  return normalizeAccessories(config).includes(type);
}

/** Read an agent's avatar config regardless of which casing the source used. */
export function readAvatarConfig(agent) {
  return agent?.avatar_config || null;
}
