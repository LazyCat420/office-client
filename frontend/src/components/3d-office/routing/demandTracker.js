/**
 * demandTracker.js
 *
 * Tracks event frequency per room using a sliding-window counter.
 * Used by the smart auto-revert system to detect when an overridden agent's
 * new room has no demand and should be sent back to its default station.
 *
 * The tracker uses 10-second buckets over a 60-second window.
 */

const WINDOW_MS = 60_000;   // 60-second sliding window
const BUCKET_MS = 10_000;   // 10-second buckets
const NUM_BUCKETS = Math.ceil(WINDOW_MS / BUCKET_MS);

class DemandTracker {
  constructor() {
    /** @type {Map<string, number[]>} roomId → array of bucket counts */
    this._buckets = new Map();
    this._currentBucketIndex = 0;
    this._lastBucketTime = Date.now();
  }

  /**
   * Advance the sliding window if time has passed, zeroing out old buckets.
   */
  _advanceBuckets() {
    const now = Date.now();
    const elapsed = now - this._lastBucketTime;

    if (elapsed < BUCKET_MS) return;

    const bucketsToAdvance = Math.min(
      Math.floor(elapsed / BUCKET_MS),
      NUM_BUCKETS
    );

    for (let i = 0; i < bucketsToAdvance; i++) {
      this._currentBucketIndex = (this._currentBucketIndex + 1) % NUM_BUCKETS;
      // Zero out the new current bucket for all rooms
      for (const [, buckets] of this._buckets) {
        buckets[this._currentBucketIndex] = 0;
      }
    }

    this._lastBucketTime = now - (elapsed % BUCKET_MS);
  }

  /**
   * Record an event for a room.
   * @param {string} roomId
   */
  recordEvent(roomId) {
    if (!roomId) return;
    this._advanceBuckets();

    if (!this._buckets.has(roomId)) {
      this._buckets.set(roomId, new Array(NUM_BUCKETS).fill(0));
    }

    this._buckets.get(roomId)[this._currentBucketIndex]++;
  }

  /**
   * Get the demand (total events in the sliding window) for a room.
   * @param {string} roomId
   * @returns {number}
   */
  getDemand(roomId) {
    this._advanceBuckets();

    const buckets = this._buckets.get(roomId);
    if (!buckets) return 0;

    let total = 0;
    for (let i = 0; i < NUM_BUCKETS; i++) {
      total += buckets[i];
    }
    return total;
  }

  /**
   * Get the room with the highest demand.
   * @param {string[]} [excludeRooms] - Rooms to exclude from consideration
   * @returns {string|null}
   */
  getHighestDemandRoom(excludeRooms = []) {
    this._advanceBuckets();

    const excludeSet = new Set(excludeRooms);
    let maxDemand = 0;
    let maxRoom = null;

    for (const [roomId, buckets] of this._buckets) {
      if (excludeSet.has(roomId)) continue;

      let total = 0;
      for (let i = 0; i < NUM_BUCKETS; i++) {
        total += buckets[i];
      }

      if (total > maxDemand) {
        maxDemand = total;
        maxRoom = roomId;
      }
    }

    return maxRoom;
  }

  /**
   * Get demand for all rooms as a map.
   * @returns {Object<string, number>}
   */
  getAllDemand() {
    this._advanceBuckets();

    const result = {};
    for (const [roomId, buckets] of this._buckets) {
      let total = 0;
      for (let i = 0; i < NUM_BUCKETS; i++) {
        total += buckets[i];
      }
      result[roomId] = total;
    }
    return result;
  }

  /**
   * Reset all tracking data (call on new cycle).
   */
  reset() {
    this._buckets.clear();
    this._currentBucketIndex = 0;
    this._lastBucketTime = Date.now();
  }
}

// Singleton instance
const demandTracker = new DemandTracker();
export default demandTracker;
