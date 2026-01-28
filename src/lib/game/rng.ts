/**
 * Mulberry32 - Fast, deterministic 32-bit PRNG
 * Same seed always produces the same sequence of random numbers
 * Used for reproducible combat simulations
 */
export function mulberry32(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded RNG wrapper with utility methods
 */
export class SeededRNG {
  private rng: () => number;

  constructor(seed: number) {
    this.rng = mulberry32(seed);
  }

  /** Returns random float between 0 and 1 */
  random(): number {
    return this.rng();
  }

  /** Returns random integer between min (inclusive) and max (inclusive) */
  randomInt(min: number, max: number): number {
    return Math.floor(this.random() * (max - min + 1)) + min;
  }

  /** Returns random float between min and max */
  randomFloat(min: number, max: number): number {
    return this.random() * (max - min) + min;
  }

  /** Returns true with given probability (0-1) */
  chance(probability: number): boolean {
    return this.random() < probability;
  }

  /** Picks a random element from array */
  pick<T>(array: T[]): T | undefined {
    if (array.length === 0) return undefined;
    return array[this.randomInt(0, array.length - 1)];
  }

  /** Shuffles array in place using Fisher-Yates */
  shuffle<T>(array: T[]): T[] {
    for (let i = array.length - 1; i > 0; i--) {
      const j = this.randomInt(0, i);
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }
}
