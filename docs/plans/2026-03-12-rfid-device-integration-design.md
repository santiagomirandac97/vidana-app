# RFID Device Integration Design

## Overview

Add RFID card-tap consumption registration to Vidana. Each company can connect to an IDEMIA MorphoAccess (or other future device) via its LAN IP. A new "Tap" tab on the registros page listens for card taps and auto-registers consumption when a matching employee is found.

## Data Model

### Employee type — add field
- `cardNumber?: string` — MIFARE DESFire card UID, editable in employee edit dialog (admin only)

### New: RfidDevice type — stored at `companies/{companyId}/rfidDevices/{id}`
```typescript
interface RfidDevice {
  id?: string;
  name: string;              // e.g., "IDEMIA Comedor Principal"
  ipAddress: string;         // e.g., "192.168.1.10"
  type: 'idemia-morphoaccess'; // extensible for future device types
  companyId: string;
  active: boolean;
  lastSeen?: string;         // ISO timestamp of last successful poll
}
```

### Consumption type — no changes
Tap-registered consumptions use the exact same schema, just triggered by card instead of manual entry.

## Configuración Page — RFID Device Management

New "Dispositivos RFID" section on `/configuracion`:
- Table of devices per company: name, IP, type, status dot (green/red), last seen
- "+ Agregar Dispositivo" button → dialog with: company dropdown, name, IP address, device type dropdown
- "Probar Conexión" button — attempts fetch to device's web interface to verify reachability
- Edit and deactivate actions per device

## Registros Page — "Tap" Tab

Third tab alongside "Por Número" and "Por Nombre":
- Large centered card showing:
  - Connection status: green dot + "Conectado a [device name]" or red dot + "Sin conexión"
  - Animated contactless/NFC pulse icon
  - Text: "Esperando tarjeta..."
- When active + device configured for company: polls IDEMIA transaction log API every 2 seconds
- On new card tap:
  1. Match employee by `cardNumber`
  2. Found + not eaten today → auto-register consumption + show confirmation + auto-print receipt
  3. Found + already eaten → warning "Ya registrado hoy"
  4. Not found → error "Tarjeta no reconocida"
- Polling stops when user leaves tab

## Device Communication

- Try direct browser `fetch` to device IP first (browser must be on same LAN)
- If CORS blocks it, fall back to Next.js API route proxy at `/api/rfid/poll`
- Cloud-hosted app cannot reach LAN devices — Tap feature requires same-network access

## Firestore Rules

```
match /companies/{companyId}/rfidDevices/{deviceId} {
  allow get, list: if request.auth != null && isUserAdmin(request.auth.uid);
  allow create, update: if request.auth != null && isUserAdmin(request.auth.uid);
  allow delete: if false;
}
```
