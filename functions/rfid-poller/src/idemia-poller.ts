import { DeviceAdapter, RawTapEvent, RfidDevice } from './types';

/**
 * Adapter for IDEMIA MorphoAccess SIGMA Lite+ devices.
 *
 * The device exposes an HTTP web interface on the local network.
 * Exact API endpoints are TBD — placeholders are marked with TODO comments.
 */
export class IdemiaAdapter implements DeviceAdapter {
  async fetchNewTaps(device: RfidDevice, since: string): Promise<RawTapEvent[]> {
    const baseUrl = `http://${device.ipAddress}:${device.port ?? 80}`;
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };

    // Add Basic Auth if credentials are configured
    if (device.username && device.password) {
      const credentials = Buffer.from(`${device.username}:${device.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    try {
      // TODO: Replace with actual IDEMIA API endpoint for transaction/event log
      // The MorphoAccess SIGMA Lite+ likely exposes something like:
      //   GET /api/v1/transactions?since=<timestamp>
      //   GET /api/v1/events?type=card_read&after=<timestamp>
      //   GET /cgi-bin/getlog.cgi?from=<timestamp>
      const response = await fetch(`${baseUrl}/api/v1/transactions?since=${encodeURIComponent(since)}`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });

      if (!response.ok) {
        console.warn(`[IdemiaAdapter] Device ${device.name} (${device.ipAddress}) returned HTTP ${response.status}`);
        return [];
      }

      const data = await response.json() as Record<string, any>;

      // TODO: Replace with actual response parsing based on IDEMIA API response format
      // Expected structure (placeholder):
      // {
      //   "transactions": [
      //     { "card_uid": "AB12CD34", "timestamp": "2026-03-26T10:30:00Z", "type": "identification" },
      //     ...
      //   ]
      // }
      const transactions: Array<{ card_uid: string; timestamp: string; type?: string }> =
        (data.transactions ?? data.events ?? []) as Array<{ card_uid: string; timestamp: string; type?: string }>;

      return transactions
        .filter((t) => {
          // TODO: Adjust filter based on actual event types from IDEMIA
          // We only want card-read events, not door-open or admin events
          return !t.type || t.type === 'identification' || t.type === 'card_read';
        })
        .map((t) => ({
          cardNumber: t.card_uid,
          timestamp: t.timestamp,
        }));
    } catch (error) {
      if (error instanceof Error) {
        console.warn(`[IdemiaAdapter] Error polling ${device.name} (${device.ipAddress}): ${error.message}`);
      }
      return [];
    }
  }

  async testConnection(device: RfidDevice): Promise<boolean> {
    const baseUrl = `http://${device.ipAddress}:${device.port ?? 80}`;
    const headers: Record<string, string> = {};

    if (device.username && device.password) {
      const credentials = Buffer.from(`${device.username}:${device.password}`).toString('base64');
      headers['Authorization'] = `Basic ${credentials}`;
    }

    try {
      // TODO: Replace with actual IDEMIA health/status endpoint
      // Possible endpoints:
      //   GET /api/v1/status
      //   GET /cgi-bin/status.cgi
      //   GET / (just check if HTTP responds)
      const response = await fetch(`${baseUrl}/api/v1/status`, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(3000),
      });

      return response.ok;
    } catch {
      return false;
    }
  }
}

/**
 * Mock adapter for development and testing.
 * Generates random tap events at roughly 1 per 5 polls.
 */
export class MockAdapter implements DeviceAdapter {
  private readonly sampleCards = [
    'A1B2C3D4',
    'E5F6G7H8',
    'I9J0K1L2',
    'M3N4O5P6',
    'Q7R8S9T0',
  ];

  async fetchNewTaps(_device: RfidDevice, _since: string): Promise<RawTapEvent[]> {
    // ~20% chance of generating a tap event per poll
    if (Math.random() > 0.2) {
      return [];
    }

    const cardNumber = this.sampleCards[Math.floor(Math.random() * this.sampleCards.length)];
    return [
      {
        cardNumber,
        timestamp: new Date().toISOString(),
      },
    ];
  }

  async testConnection(_device: RfidDevice): Promise<boolean> {
    // Mock always succeeds
    return true;
  }
}
