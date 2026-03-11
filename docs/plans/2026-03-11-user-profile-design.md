# User Profile Page Design

## Summary

Add a `/perfil` page where all authenticated users can view and edit their profile info, upload a profile picture, and change their password. Profile avatar displayed in the sidebar footer as the entry point.

## Navigation

- New route: `/perfil` (all authenticated users)
- Sidebar footer: replace plain text name with clickable avatar + name → navigates to `/perfil`
- Avatar uses initials fallback when no photo is set (existing `Avatar` component)
- Accessible from mobile sidebar sheet

## Page Layout

Single page using `AppShell` + `PageHeader`, two cards:

### Personal Info Card
- Large avatar (96px) with camera overlay button to upload/change photo
- Name and role displayed next to avatar
- Editable fields:
  - **Name** (text input)
  - **Phone** (optional text input)
- Read-only fields:
  - **Email** (greyed out)
  - **Role** (badge: "Administrador" / "Usuario")
  - **Company** (if assigned)
- Save button for personal info changes

### Change Password Card
- Only shown for email/password users (hidden for Google sign-in, detected via `user.providerData`)
- Fields: current password, new password, confirm password
- Uses `reauthenticateWithCredential` + `updatePassword` from Firebase Auth
- Separate submit button
- Success toast + clear form on completion

## Profile Picture Flow

- **Upload**: Click avatar overlay → native file picker → `.jpg`, `.png`, `.webp`, max 5MB
- **Processing**: Client-side resize to 256x256 before upload
- **Storage path**: `avatars/{uid}.jpg` in Firebase Storage
- **Storage rules**: Owner can write, any authenticated user can read
- **Firestore**: Download URL saved as `photoURL` on user document
- **Display**: Sidebar, mobile top bar, and profile page read from `userProfile.photoURL`; fallback to initials
- **Delete**: Option to remove photo, reverting to initials

## Data Model Changes

Extend `UserProfile` in `src/lib/types.ts`:

```typescript
photoURL?: string;    // Firebase Storage download URL
phone?: string;       // Optional phone number
```

## Firebase Configuration

- Add `storageBucket` to Firebase config in `src/firebase/index.ts`
- Add Firebase Storage security rules for `avatars/{uid}` path
- Firestore rules: no changes needed (owner updates already allowed)

## Files to Create/Modify

- `src/app/perfil/page.tsx` — new profile page
- `src/lib/types.ts` — extend UserProfile
- `src/firebase/index.ts` — add storageBucket + Storage export
- `src/components/layout/sidebar.tsx` — avatar + clickable profile link in footer
- `src/components/layout/mobile-top-bar.tsx` — show avatar if desired
- `storage.rules` — new file for Storage security rules
- `firebase.json` — add storage rules reference
