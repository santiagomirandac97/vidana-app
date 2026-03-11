# User Profile Page Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a `/perfil` page with editable name, phone, profile picture upload (Firebase Storage), and password change. Show avatar in sidebar footer as entry point.

**Architecture:** Extend `UserProfile` type with `photoURL` and `phone`. Configure Firebase Storage for avatar uploads. New `/perfil` page with two cards (personal info + password change). Sidebar footer becomes clickable avatar + name linking to `/perfil`.

**Tech Stack:** Next.js 15, Firebase Auth, Firestore, Firebase Storage, shadcn/ui Avatar, Radix UI, Tailwind CSS

---

### Task 1: Extend UserProfile Type

**Files:**
- Modify: `src/lib/types.ts:61-67`

**Step 1: Add new fields to UserProfile interface**

```typescript
export interface UserProfile {
    uid: string;
    name: string;
    email: string;
    role: 'admin' | 'user';
    companyId?: string;
    photoURL?: string;
    phone?: string;
}
```

**Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(profile): extend UserProfile with photoURL and phone fields"
```

---

### Task 2: Configure Firebase Storage

**Files:**
- Modify: `src/firebase/config.ts`
- Modify: `src/firebase/index.ts`
- Modify: `src/firebase/provider.tsx`
- Create: `storage.rules`
- Modify: `firebase.json`

**Step 1: Add storageBucket to Firebase config**

In `src/firebase/config.ts`, add the `storageBucket` field:

```typescript
export const firebaseConfig = {
  "projectId": "studio-2129569698-d805d",
  "appId": "1:650074038837:web:1b73aa8f5188f65b2b077c",
  "apiKey": "AIzaSyDHgHHmFJiNGH3LVRaq9tqwchCpx8d71QY",
  "authDomain": "studio-2129569698-d805d.firebaseapp.com",
  "storageBucket": "studio-2129569698-d805d.firebasestorage.app",
  "measurementId": "",
  "messagingSenderId": "650074038837"
};
```

> **Note:** The storage bucket follows the pattern `{projectId}.firebasestorage.app`. Verify this is correct in the Firebase Console > Storage before deploying.

**Step 2: Add Storage to Firebase initialization**

In `src/firebase/index.ts`, add Storage import and initialization:

```typescript
import { getStorage, FirebaseStorage } from 'firebase/storage';
```

Update `initializeFirebase()` to return storage:

```typescript
export function initializeFirebase() {
    const isFirstInit = getApps().length === 0;
    const app = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0];
    const firestore = isFirstInit
        ? initializeFirestore(app, { localCache: memoryLocalCache() })
        : getFirestore(app);
    const auth = getAuthInstance(app);
    const storage = getStorage(app);
    return { app, auth, firestore, storage };
}
```

Also re-export `useStorage` from the provider:

```typescript
export {
  FirebaseProvider,
  FirebaseClientProvider,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useFirebase,
  useStorage
};
```

**Step 3: Add Storage to provider context**

In `src/firebase/provider.tsx`, add storage to context:

```typescript
import { FirebaseStorage } from 'firebase/storage';

interface FirebaseContextValue {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

interface FirebaseProviderProps {
  children: React.ReactNode;
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  storage: FirebaseStorage;
}

export function FirebaseProvider({ children, app, auth, firestore, storage }: FirebaseProviderProps) {
  return (
    <FirebaseContext.Provider value={{ app, auth, firestore, storage }}>
      {children}
    </FirebaseContext.Provider>
  );
}

export function useStorage() {
  return useFirebase().storage;
}
```

**Step 4: Update FirebaseClientProvider to pass storage**

Check `src/firebase/client-provider.tsx` and update it to pass `storage` to the provider. It calls `initializeFirebase()` which now returns `storage`, so destructure it and pass it through.

**Step 5: Create Storage security rules**

Create `storage.rules`:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /avatars/{userId}.jpg {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

**Step 6: Add storage rules to firebase.json**

```json
{
  "firestore": {
    "rules": "firestore.rules",
    "indexes": "firestore.indexes.json"
  },
  "storage": {
    "rules": "storage.rules"
  },
  "functions": {
    "source": "functions",
    "codebase": "default",
    "ignore": ["node_modules", ".git", "firebase-debug.log", "firebase-debug.*.log"]
  }
}
```

**Step 7: Commit**

```bash
git add src/firebase/config.ts src/firebase/index.ts src/firebase/provider.tsx src/firebase/client-provider.tsx storage.rules firebase.json
git commit -m "feat(profile): configure Firebase Storage for avatar uploads"
```

---

### Task 3: Create Profile Page

**Files:**
- Create: `src/app/perfil/page.tsx`

**Step 1: Build the profile page**

This is the main page. It should:

1. Use `AppShell` wrapper + `PageHeader` with title "Mi Perfil"
2. Fetch `userProfile` from Firestore and `user` from Firebase Auth
3. Detect if user is email/password provider: `user.providerData.some(p => p.providerId === 'password')`

**Personal Info Card:**
- Large avatar (96px) at top with camera icon overlay
  - Use shadcn `Avatar` / `AvatarImage` / `AvatarFallback`
  - Overlay: absolute-positioned `<label>` with `<input type="file" className="hidden" accept="image/*" />`
  - Fallback shows initials from name (first letter of first + last name)
- If photo exists, show a small "Eliminar foto" button below avatar
- Name display + role badge next to avatar
- Form fields (use shadcn `Input` + `Label`):
  - Name (default value from `userProfile.name`)
  - Phone (default value from `userProfile.phone ?? ''`)
  - Email (disabled input, value from `userProfile.email`)
  - Role (read-only badge)
  - Company name (read-only, if `userProfile.companyId` exists — fetch company name)
- "Guardar cambios" button → `updateDoc(doc(firestore, 'users', user.uid), { name, phone })`
- Toast on success

**Avatar upload handler:**
```typescript
async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
  const file = e.target.files?.[0];
  if (!file || !user) return;

  // Validate
  if (file.size > 5 * 1024 * 1024) {
    toast({ title: 'Error', description: 'La imagen no debe superar 5MB.', variant: 'destructive' });
    return;
  }

  // Resize to 256x256 using canvas
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;
  // Center-crop: draw the largest square from center
  const size = Math.min(bitmap.width, bitmap.height);
  const sx = (bitmap.width - size) / 2;
  const sy = (bitmap.height - size) / 2;
  ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);

  const blob = await new Promise<Blob>((resolve) =>
    canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
  );

  // Upload to Firebase Storage
  const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
  await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
  const downloadURL = await getDownloadURL(storageRef);

  // Save URL to Firestore
  await updateDoc(doc(firestore, 'users', user.uid), { photoURL: downloadURL });
  toast({ title: 'Foto actualizada' });
}
```

**Avatar delete handler:**
```typescript
async function handleAvatarDelete() {
  if (!user) return;
  const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
  await deleteObject(storageRef).catch(() => {}); // ignore if doesn't exist
  await updateDoc(doc(firestore, 'users', user.uid), { photoURL: deleteField() });
  toast({ title: 'Foto eliminada' });
}
```

**Change Password Card** (only if `isPasswordUser`):
- Current password input
- New password input
- Confirm password input
- Validation: new password min 6 chars, confirm matches
- Handler:
```typescript
async function handleChangePassword() {
  if (newPassword !== confirmPassword) {
    toast({ title: 'Error', description: 'Las contraseñas no coinciden.', variant: 'destructive' });
    return;
  }
  if (newPassword.length < 6) {
    toast({ title: 'Error', description: 'La contraseña debe tener al menos 6 caracteres.', variant: 'destructive' });
    return;
  }
  const credential = EmailAuthProvider.credential(user.email!, currentPassword);
  await reauthenticateWithCredential(user, credential);
  await updatePassword(user, newPassword);
  toast({ title: 'Contraseña actualizada' });
  // Clear form
}
```
- Wrap in try/catch — if reauthenticate fails, show "Contraseña actual incorrecta"

**Imports needed:**
```typescript
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateDoc, doc, deleteField } from 'firebase/firestore';
import { EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AppShell } from '@/components/layout';
import { PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Trash2, Lock, Save } from 'lucide-react';
```

**Step 2: Commit**

```bash
git add src/app/perfil/page.tsx
git commit -m "feat(profile): create profile page with avatar upload and password change"
```

---

### Task 4: Update Sidebar Footer with Avatar

**Files:**
- Modify: `src/components/layout/sidebar.tsx:119-139`

**Step 1: Replace the sidebar footer**

Replace the current footer section (lines 119-139) with a clickable avatar + name that links to `/perfil`, plus the logout button:

```tsx
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import Link from 'next/link';
```

New footer JSX:

```tsx
{/* Footer */}
<div className={cn(
  'shrink-0 border-t border-sidebar-border p-3 space-y-2',
  collapsed ? 'flex flex-col items-center' : ''
)}>
  <Link
    href="/perfil"
    className={cn(
      'flex items-center gap-2 rounded-md px-1 py-1.5 hover:bg-sidebar-accent transition-colors',
      collapsed ? 'justify-center px-0' : ''
    )}
  >
    <Avatar className="h-7 w-7 shrink-0">
      <AvatarImage src={userProfile?.photoURL} alt={firstName} />
      <AvatarFallback className="text-[10px] font-medium bg-primary/10 text-primary">
        {firstName?.charAt(0)?.toUpperCase() ?? '?'}
      </AvatarFallback>
    </Avatar>
    {!collapsed && (
      <span className="text-xs font-medium text-foreground truncate">{firstName}</span>
    )}
  </Link>
  <Button
    variant="ghost"
    size={collapsed ? 'icon' : 'sm'}
    className={cn(
      'text-muted-foreground hover:text-foreground gap-2',
      collapsed ? 'h-8 w-8' : 'w-full justify-start h-8 text-xs'
    )}
    onClick={handleLogout}
  >
    <LogOut size={14} />
    {!collapsed && 'Cerrar sesión'}
  </Button>
</div>
```

**Step 2: Commit**

```bash
git add src/components/layout/sidebar.tsx
git commit -m "feat(profile): add avatar to sidebar footer with link to /perfil"
```

---

### Task 5: Deploy Storage Rules

**Step 1: Deploy storage rules via Firebase CLI**

```bash
cd "/Users/santiagomiranda/Documents/Vidana/Vidana App"
npx firebase deploy --only storage
```

Expected: Storage rules deployed successfully.

> **Important:** Before deploying, verify in Firebase Console that Storage is enabled for this project. If not enabled, go to Firebase Console > Storage > Get Started, select a location (us-central1 recommended), and enable it. Also verify the bucket name matches `studio-2129569698-d805d.firebasestorage.app` in the config.

**Step 2: Commit any changes and push**

```bash
git add -A
git commit -m "feat(profile): deploy storage rules for avatar uploads"
git push
```

---

### Task 6: Verify End-to-End

**Step 1: Test in preview server**

1. Navigate to login page, sign in
2. Check sidebar footer shows avatar with initials fallback + clickable name
3. Click name → navigates to `/perfil`
4. Verify profile page loads with correct user info
5. Edit name → save → verify toast + sidebar updates
6. Upload a profile picture → verify it appears on page + sidebar
7. Delete the photo → verify fallback initials return
8. Change password (if email/password user) → verify success
9. Check Google sign-in user → password section hidden

**Step 2: Final push**

```bash
git push
```
