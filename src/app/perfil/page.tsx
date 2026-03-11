'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { updateDoc, doc, deleteField, getDoc } from 'firebase/firestore';
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth';
import { useFirebase, useUser, useDoc, useMemoFirebase } from '@/firebase';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { AppShell, PageHeader } from '@/components/layout';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Camera, Trash2, Lock, Save, Loader2 } from 'lucide-react';
import { type UserProfile, type Company } from '@/lib/types';

export default function PerfilPage() {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const { firestore, storage, auth } = useFirebase();
  const { toast } = useToast();

  // User profile doc
  const userProfileRef = useMemoFirebase(
    () => (firestore && user ? doc(firestore, `users/${user.uid}`) : null),
    [firestore, user]
  );
  const { data: userProfile, isLoading: profileLoading } =
    useDoc<UserProfile>(userProfileRef);

  // Form state
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [deletingAvatar, setDeletingAvatar] = useState(false);

  // Company name
  const [companyName, setCompanyName] = useState<string | null>(null);

  // Password change
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const isLoading = userLoading || profileLoading || (!!user && !userProfile);

  // Populate form when profile loads
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setPhone(userProfile.phone || '');
    }
  }, [userProfile]);

  // Fetch company name
  useEffect(() => {
    if (!firestore || !userProfile?.companyId) return;
    getDoc(doc(firestore, 'companies', userProfile.companyId)).then((snap) => {
      if (snap.exists()) {
        setCompanyName((snap.data() as Company).name);
      }
    });
  }, [firestore, userProfile?.companyId]);

  // Redirect if not logged in
  useEffect(() => {
    if (!isLoading && !user) {
      router.replace('/login');
    }
  }, [user, isLoading, router]);

  // Initials for avatar fallback
  const initials = (userProfile?.name || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  const isPasswordProvider = user?.providerData.some(
    (p) => p.providerId === 'password'
  );

  // ── Handlers ──────────────────────────────────────────────────────────────

  async function handleSaveProfile() {
    if (!firestore || !user) return;
    setSavingProfile(true);
    try {
      await updateDoc(doc(firestore, 'users', user.uid), {
        name: name.trim(),
        phone: phone.trim() || deleteField(),
      });
      toast({ title: 'Perfil actualizado' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el perfil.',
        variant: 'destructive',
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !user || !storage || !firestore) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: 'Error',
        description: 'La imagen no debe superar 5MB.',
        variant: 'destructive',
      });
      return;
    }
    setUploadingAvatar(true);
    try {
      // Resize to 256x256 center-crop
      const bitmap = await createImageBitmap(file);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d')!;
      const size = Math.min(bitmap.width, bitmap.height);
      const sx = (bitmap.width - size) / 2;
      const sy = (bitmap.height - size) / 2;
      ctx.drawImage(bitmap, sx, sy, size, size, 0, 0, 256, 256);
      const blob = await new Promise<Blob>((resolve) =>
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.85)
      );
      // Upload
      const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
      await uploadBytes(storageRef, blob, { contentType: 'image/jpeg' });
      const downloadURL = await getDownloadURL(storageRef);
      await updateDoc(doc(firestore, 'users', user.uid), {
        photoURL: downloadURL,
      });
      toast({ title: 'Foto actualizada' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo subir la imagen.',
        variant: 'destructive',
      });
    } finally {
      setUploadingAvatar(false);
      // Reset input so same file can be re-selected
      e.target.value = '';
    }
  }

  async function handleAvatarDelete() {
    if (!user || !storage || !firestore) return;
    setDeletingAvatar(true);
    try {
      const storageRef = ref(storage, `avatars/${user.uid}.jpg`);
      await deleteObject(storageRef).catch(() => {});
      await updateDoc(doc(firestore, 'users', user.uid), {
        photoURL: deleteField(),
      });
      toast({ title: 'Foto eliminada' });
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la foto.',
        variant: 'destructive',
      });
    } finally {
      setDeletingAvatar(false);
    }
  }

  async function handleChangePassword() {
    if (!auth?.currentUser || !user) return;

    if (newPassword.length < 6) {
      toast({
        title: 'Error',
        description: 'La nueva contrasena debe tener al menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({
        title: 'Error',
        description: 'Las contrasenas no coinciden.',
        variant: 'destructive',
      });
      return;
    }

    setChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(
        user.email!,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast({ title: 'Contrasena actualizada' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch {
      toast({
        title: 'Error',
        description: 'Contrasena actual incorrecta.',
        variant: 'destructive',
      });
    } finally {
      setChangingPassword(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex h-screen w-full items-center justify-center">
          <Loader2 className="h-10 w-10 animate-spin" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <PageHeader title="Mi Perfil" subtitle="Administra tu informacion personal" />

        {/* ── Personal Info Card ─────────────────────────────────────────── */}
        <div className="rounded-lg border bg-card shadow-card p-6 space-y-6">
          {/* Avatar row */}
          <div className="flex items-center gap-5">
            <div className="relative">
              <Avatar className="h-24 w-24 text-2xl">
                {userProfile?.photoURL && (
                  <AvatarImage src={userProfile.photoURL} alt={userProfile.name} />
                )}
                <AvatarFallback>{initials || '?'}</AvatarFallback>
              </Avatar>

              {/* Camera overlay */}
              <label
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 hover:opacity-100 transition-opacity cursor-pointer"
                aria-label="Cambiar foto de perfil"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarUpload}
                  disabled={uploadingAvatar}
                />
              </label>
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-semibold truncate">
                {userProfile?.name}
              </h2>
              <span className="inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                {userProfile?.role === 'admin' ? 'Administrador' : 'Usuario'}
              </span>
              {userProfile?.photoURL && (
                <button
                  onClick={handleAvatarDelete}
                  disabled={deletingAvatar}
                  className="flex items-center gap-1 mt-2 text-xs text-destructive hover:underline disabled:opacity-50"
                >
                  <Trash2 className="h-3 w-3" />
                  Eliminar foto
                </button>
              )}
            </div>
          </div>

          {/* Form fields */}
          <div className="grid gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nombre</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Tu nombre completo"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="phone">Telefono</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Opcional"
                type="tel"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="email">Correo electronico</Label>
              <Input
                id="email"
                value={userProfile?.email || ''}
                disabled
                className="bg-muted"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label>Rol</Label>
                <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground">
                  {userProfile?.role === 'admin' ? 'Administrador' : 'Usuario'}
                </div>
              </div>

              {userProfile?.companyId && (
                <div className="space-y-1.5">
                  <Label>Empresa</Label>
                  <div className="flex items-center h-9 px-3 rounded-md border bg-muted text-sm text-muted-foreground truncate">
                    {companyName || 'Cargando...'}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile || !name.trim()}
            >
              {savingProfile ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Guardar cambios
            </Button>
          </div>
        </div>

        {/* ── Change Password Card ──────────────────────────────────────── */}
        {isPasswordProvider && (
          <div className="rounded-lg border bg-card shadow-card p-6 space-y-4 mt-6">
            <div className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-muted-foreground" />
              <h3 className="text-base font-semibold">Cambiar contrasena</h3>
            </div>

            <div className="grid gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="currentPassword">Contrasena actual</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="newPassword">Nueva contrasena</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirmPassword">Confirmar contrasena</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={
                  changingPassword ||
                  !currentPassword ||
                  !newPassword ||
                  !confirmPassword
                }
                variant="outline"
              >
                {changingPassword ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="mr-2 h-4 w-4" />
                )}
                Cambiar contrasena
              </Button>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
