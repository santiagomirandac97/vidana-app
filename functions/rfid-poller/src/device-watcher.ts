import * as admin from 'firebase-admin';
import { DeviceAdapter, RfidDevice, RfidTap, RawTapEvent, DEFAULT_POLL_INTERVAL_MS } from './types';
import { IdemiaAdapter, MockAdapter } from './idemia-poller';

/** Tracks the polling state for a single device */
interface DevicePollingState {
  device: RfidDevice;
  timer: ReturnType<typeof setTimeout> | null;
  lastPolledTimestamp: string;
  running: boolean;
}

/**
 * Watches Firestore for active RFID devices and manages polling loops.
 * Each active device gets its own polling loop that fetches tap events
 * via the appropriate DeviceAdapter and writes them to Firestore.
 */
export class DeviceWatcher {
  private db: admin.firestore.Firestore;
  private adapter: DeviceAdapter;
  private pollingStates: Map<string, DevicePollingState> = new Map();
  private unsubscribes: Array<() => void> = [];

  constructor() {
    this.db = admin.firestore();
    const mockMode = process.env.MOCK_MODE === 'true';
    this.adapter = mockMode ? new MockAdapter() : new IdemiaAdapter();
    console.log(`[DeviceWatcher] Using ${mockMode ? 'MockAdapter' : 'IdemiaAdapter'}`);
  }

  /** Number of devices currently being polled */
  get activeDeviceCount(): number {
    let count = 0;
    for (const state of this.pollingStates.values()) {
      if (state.running) count++;
    }
    return count;
  }

  /**
   * Start listening to all companies' rfidDevices collections.
   * Uses a collectionGroup query to watch all devices across all companies.
   */
  start(): void {
    console.log('[DeviceWatcher] Starting Firestore listener for rfidDevices...');

    const unsubscribe = this.db
      .collectionGroup('rfidDevices')
      .where('active', '==', true)
      .onSnapshot(
        (snapshot) => {
          this.handleSnapshot(snapshot);
        },
        (error) => {
          console.error('[DeviceWatcher] Firestore listener error:', error.message);
          // Re-establish listener after a delay
          setTimeout(() => this.start(), 10_000);
        },
      );

    this.unsubscribes.push(unsubscribe);
  }

  /** Stop all polling loops and Firestore listeners */
  stop(): void {
    console.log('[DeviceWatcher] Stopping all polling loops...');
    for (const unsubscribe of this.unsubscribes) {
      unsubscribe();
    }
    this.unsubscribes = [];

    for (const [deviceId, state] of this.pollingStates) {
      this.stopPolling(deviceId, state);
    }
    this.pollingStates.clear();
  }

  /** Manually trigger a poll for a specific device (for testing) */
  async triggerPoll(deviceId: string): Promise<{ taps: number; error?: string }> {
    // Try to find the device in our active states
    const state = this.pollingStates.get(deviceId);
    if (state) {
      const taps = await this.pollDevice(state);
      return { taps };
    }

    // Device not in active states — fetch it from Firestore
    try {
      const snapshot = await this.db
        .collectionGroup('rfidDevices')
        .where(admin.firestore.FieldPath.documentId(), '==', deviceId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        // Try finding by iterating companies (collectionGroup documentId queries can be tricky)
        return { taps: 0, error: `Device ${deviceId} not found` };
      }

      const doc = snapshot.docs[0];
      const device = { id: doc.id, ...doc.data() } as RfidDevice;
      const tempState: DevicePollingState = {
        device,
        timer: null,
        lastPolledTimestamp: device.lastSeen ?? new Date(Date.now() - 60_000).toISOString(),
        running: false,
      };

      const taps = await this.pollDevice(tempState);
      return { taps };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { taps: 0, error: message };
    }
  }

  // ── Private ──────────────────────────────────────────────────────────

  private handleSnapshot(snapshot: admin.firestore.QuerySnapshot): void {
    const activeDeviceIds = new Set<string>();

    for (const change of snapshot.docChanges()) {
      const doc = change.doc;
      const device = { id: doc.id, ...doc.data() } as RfidDevice;
      activeDeviceIds.add(doc.id);

      switch (change.type) {
        case 'added':
          console.log(`[DeviceWatcher] Device added: ${device.name} (${device.ipAddress})`);
          this.startPolling(device);
          break;

        case 'modified': {
          const existing = this.pollingStates.get(doc.id);
          if (existing) {
            // Update device config (IP, credentials, interval may have changed)
            existing.device = device;
            console.log(`[DeviceWatcher] Device updated: ${device.name}`);
          } else {
            this.startPolling(device);
          }
          break;
        }

        case 'removed':
          console.log(`[DeviceWatcher] Device removed/deactivated: ${device.name}`);
          this.stopAndRemove(doc.id);
          break;
      }
    }

    // Stop polling for any devices no longer in the active set
    for (const [deviceId, state] of this.pollingStates) {
      if (!activeDeviceIds.has(deviceId) && !snapshot.docChanges().some((c) => c.doc.id === deviceId)) {
        // Only remove if this is a full snapshot (not incremental)
        // For incremental updates, 'removed' change type handles this
      }
    }
  }

  private startPolling(device: RfidDevice): void {
    // Stop existing polling if any
    const existing = this.pollingStates.get(device.id);
    if (existing) {
      this.stopPolling(device.id, existing);
    }

    const state: DevicePollingState = {
      device,
      timer: null,
      lastPolledTimestamp: device.lastSeen ?? new Date(Date.now() - 60_000).toISOString(),
      running: true,
    };

    this.pollingStates.set(device.id, state);
    this.scheduleNextPoll(state);
  }

  private stopPolling(deviceId: string, state: DevicePollingState): void {
    state.running = false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    console.log(`[DeviceWatcher] Stopped polling for ${state.device.name}`);
  }

  private stopAndRemove(deviceId: string): void {
    const state = this.pollingStates.get(deviceId);
    if (state) {
      this.stopPolling(deviceId, state);
      this.pollingStates.delete(deviceId);
    }
  }

  private scheduleNextPoll(state: DevicePollingState): void {
    if (!state.running) return;

    const interval = state.device.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    state.timer = setTimeout(async () => {
      if (!state.running) return;

      try {
        await this.pollDevice(state);
      } catch (error) {
        console.error(
          `[DeviceWatcher] Unexpected error polling ${state.device.name}:`,
          error instanceof Error ? error.message : error,
        );
      }

      // Schedule next poll regardless of success/failure
      this.scheduleNextPoll(state);
    }, interval);
  }

  /**
   * Poll a device for new taps, deduplicate, and write to Firestore.
   * Returns the number of new taps written.
   */
  private async pollDevice(state: DevicePollingState): Promise<number> {
    const { device } = state;

    let rawTaps: RawTapEvent[];
    try {
      rawTaps = await this.adapter.fetchNewTaps(device, state.lastPolledTimestamp);
    } catch (error) {
      console.warn(
        `[DeviceWatcher] Failed to fetch taps from ${device.name}: ${error instanceof Error ? error.message : error}`,
      );
      return 0;
    }

    if (rawTaps.length === 0) {
      // Still update lastSeen to show the device is reachable
      await this.updateLastSeen(device);
      return 0;
    }

    let newTapCount = 0;

    for (const raw of rawTaps) {
      const isDuplicate = await this.checkDuplicate(device.companyId, device.id, raw.cardNumber, raw.timestamp);
      if (isDuplicate) {
        continue;
      }

      const tap: RfidTap = {
        deviceId: device.id,
        companyId: device.companyId,
        cardNumber: raw.cardNumber,
        timestamp: raw.timestamp,
        processedAt: new Date().toISOString(),
        status: 'pending',
      };

      try {
        const tapsCollection = this.db.collection(`companies/${device.companyId}/rfidTaps`);
        await tapsCollection.add(tap);
        newTapCount++;
        console.log(
          `[DeviceWatcher] New tap: card=${raw.cardNumber} device=${device.name} company=${device.companyId}`,
        );
      } catch (error) {
        console.error(
          `[DeviceWatcher] Failed to write tap for card ${raw.cardNumber}:`,
          error instanceof Error ? error.message : error,
        );
      }
    }

    // Update lastPolledTimestamp to the most recent tap
    const latestTimestamp = rawTaps.reduce((latest, t) => (t.timestamp > latest ? t.timestamp : latest), state.lastPolledTimestamp);
    state.lastPolledTimestamp = latestTimestamp;

    // Update lastSeen on the device document
    await this.updateLastSeen(device);

    if (newTapCount > 0) {
      console.log(`[DeviceWatcher] Wrote ${newTapCount} new tap(s) from ${device.name}`);
    }

    return newTapCount;
  }

  /**
   * Check if a tap with the same card + timestamp already exists (deduplication).
   * Uses a narrow query window to avoid scanning the entire collection.
   */
  private async checkDuplicate(
    companyId: string,
    deviceId: string,
    cardNumber: string,
    timestamp: string,
  ): Promise<boolean> {
    try {
      const snapshot = await this.db
        .collection(`companies/${companyId}/rfidTaps`)
        .where('deviceId', '==', deviceId)
        .where('cardNumber', '==', cardNumber)
        .where('timestamp', '==', timestamp)
        .limit(1)
        .get();

      return !snapshot.empty;
    } catch (error) {
      console.warn('[DeviceWatcher] Dedup check failed, allowing tap through:', error);
      return false;
    }
  }

  /** Update the lastSeen timestamp on the device document */
  private async updateLastSeen(device: RfidDevice): Promise<void> {
    try {
      // Resolve the parent path from companyId
      const deviceRef = this.db.doc(`companies/${device.companyId}/rfidDevices/${device.id}`);
      await deviceRef.update({ lastSeen: new Date().toISOString() });
    } catch (error) {
      // Non-critical — log but don't throw
      console.warn(
        `[DeviceWatcher] Failed to update lastSeen for ${device.name}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
