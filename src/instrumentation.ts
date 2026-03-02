/**
 * Next.js instrumentation file — runs before any request handling.
 *
 * Problem:
 *   Node.js 22+ (tested on v25) exposes `localStorage` / `sessionStorage` as
 *   experimental globals (WinterCG compatibility), but without a backing file
 *   (`--localstorage-file`) they are empty `{}` objects with NO methods.
 *
 *   Firebase's browser ESM bundle (loaded by Turbopack for SSR of Client
 *   Components) accesses these globals.  The floating initialization Promise
 *   created by `getAuth()` calls `localStorage.getItem(key)` → TypeError →
 *   unhandledRejection → HTTP 500 on every page.
 *
 * Fix:
 *   Replace the broken Node.js localStorage/sessionStorage with a proper
 *   in-memory implementation before any Firebase code runs.
 *   The fake storage is per-process only and is never persisted to disk.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const g = globalThis as any;

    function makeMemoryStorage() {
      const store: Record<string, string> = {};
      return {
        getItem:    (k: string)            => store[k] ?? null,
        setItem:    (k: string, v: string) => { store[k] = String(v); },
        removeItem: (k: string)            => { delete store[k]; },
        clear:      ()                     => { Object.keys(store).forEach(k => delete store[k]); },
        key:        (i: number)            => Object.keys(store)[i] ?? null,
        get length()                       { return Object.keys(store).length; },
      };
    }

    function patchStorage(name: 'localStorage' | 'sessionStorage') {
      const current = g[name];
      // Only patch if the global exists but is broken (no getItem method)
      if (current !== undefined && current !== null && typeof current.getItem !== 'function') {
        try {
          // localStorage/sessionStorage in Node 22+ are accessor properties;
          // redefine as a writable data property so the patching sticks.
          Object.defineProperty(g, name, {
            value: makeMemoryStorage(),
            writable: true,
            configurable: true,
            enumerable: true,
          });
        } catch {
          // Fallback: direct assignment
          g[name] = makeMemoryStorage();
        }
      }
    }

    patchStorage('localStorage');
    patchStorage('sessionStorage');
  }
}
