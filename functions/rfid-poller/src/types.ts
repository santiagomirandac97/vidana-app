/** Mirrors the RfidDevice type from the Vidana app (src/lib/types.ts) */
export interface RfidDevice {
  id: string;
  name: string;
  ipAddress: string;
  port?: number;
  type: 'idemia-morphoaccess';
  companyId: string;
  active: boolean;
  lastSeen?: string;
  username?: string;
  password?: string;
  pollIntervalMs?: number;
}

/** Mirrors the RfidTap type from the Vidana app (src/lib/types.ts) */
export interface RfidTap {
  deviceId: string;
  companyId: string;
  cardNumber: string;
  timestamp: string;
  processedAt?: string;
  status: 'pending' | 'registered' | 'already-eaten' | 'unknown-card';
  employeeId?: string;
  employeeName?: string;
  consumptionId?: string;
}

/** Raw tap event returned by a device adapter */
export interface RawTapEvent {
  cardNumber: string;
  timestamp: string;
}

/** Pluggable adapter interface for different RFID device types */
export interface DeviceAdapter {
  /** Fetch new tap events from the device since the given ISO timestamp */
  fetchNewTaps(device: RfidDevice, since: string): Promise<RawTapEvent[]>;
  /** Test connectivity to the device */
  testConnection(device: RfidDevice): Promise<boolean>;
}

/** Default polling interval in milliseconds */
export const DEFAULT_POLL_INTERVAL_MS = 2000;
