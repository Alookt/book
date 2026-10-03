export interface SyncMapEntry {
  charIndex: number;
  visualAssetId: string;
  audioTimestamp: number;
}

export class SyncEngine {
  private currentEntry: SyncMapEntry | null = null;

  /**
   * Finds the closest SyncMap entry for the current character index.
   */
  public findClosestEntry(charIndex: number, syncMap: SyncMapEntry[]): SyncMapEntry | null {
    if (!syncMap || syncMap.length === 0) return null;

    // Find the entry with the largest charIndex that is <= current charIndex
    const entry = syncMap
      .filter(e => e.charIndex <= charIndex)
      .sort((a, b) => b.charIndex - a.charIndex)[0];

    return entry || null;
  }

  public updatePointer(charIndex: number, syncMap: SyncMapEntry[]) {
    const entry = this.findClosestEntry(charIndex, syncMap);
    if (entry && entry !== this.currentEntry) {
      this.currentEntry = entry;
      return entry;
    }
    return null;
  }
}

export const syncEngine = new SyncEngine();
