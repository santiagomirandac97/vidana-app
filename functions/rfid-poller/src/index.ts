import * as admin from 'firebase-admin';
import express from 'express';
import { DeviceWatcher } from './device-watcher';

// ── Firebase Admin ─────────────────────────────────────────────────────
// Uses default service account on Cloud Run (no explicit credentials needed)
admin.initializeApp();

// ── Device Watcher ─────────────────────────────────────────────────────
const watcher = new DeviceWatcher();
watcher.start();

// ── Express Server ─────────────────────────────────────────────────────
const app = express();
app.use(express.json());

/** Health check endpoint (used by Cloud Run for liveness probes) */
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    activeDevices: watcher.activeDeviceCount,
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/** Manually trigger a poll for a specific device (for testing/debugging) */
app.get('/test-device/:deviceId', async (req, res) => {
  const { deviceId } = req.params;
  console.log(`[API] Manual poll triggered for device ${deviceId}`);

  try {
    const result = await watcher.triggerPoll(deviceId);
    res.json({
      deviceId,
      tapsWritten: result.taps,
      error: result.error ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[API] Error in manual poll for ${deviceId}:`, message);
    res.status(500).json({ deviceId, error: message });
  }
});

/** Root endpoint */
app.get('/', (_req, res) => {
  res.json({
    service: 'rfid-poller',
    version: '1.0.0',
    description: 'RFID device polling service for Vidana',
  });
});

// ── Start Server ───────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT ?? '8080', 10);

app.listen(PORT, () => {
  console.log(`[rfid-poller] Server running on port ${PORT}`);
  console.log(`[rfid-poller] MOCK_MODE=${process.env.MOCK_MODE ?? 'false'}`);
  console.log(`[rfid-poller] Health check: http://localhost:${PORT}/health`);
});

// ── Graceful Shutdown ──────────────────────────────────────────────────
function shutdown(signal: string): void {
  console.log(`[rfid-poller] Received ${signal}, shutting down...`);
  watcher.stop();
  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
