import { type Firestore, doc, getDoc, setDoc } from 'firebase/firestore';
import { type User } from 'firebase/auth';
import { type UserProfile } from '@/lib/types';

export async function checkAndCreateUserProfile(firestore: Firestore, user: User): Promise<void> {
    if (!user.email) {
        throw new Error("No se pudo obtener el email de la cuenta de Google.");
    }

    const configDocRef = doc(firestore, 'configuration', 'app');
    const configDoc = await getDoc(configDocRef);
    const allowedDomains = configDoc.exists() ? configDoc.data()?.allowedDomains || [] : ["vidana.com.mx", "blacktrust.net", "activ8.com.mx"];

    const userDomain = user.email.split('@')[1];

    if (allowedDomains.length > 0 && !allowedDomains.includes(userDomain)) {
        throw new Error("El dominio de su correo no está autorizado para registrarse.");
    }

    const userDocRef = doc(firestore, 'users', user.uid);
    const userDoc = await getDoc(userDocRef);

    if (!userDoc.exists()) {
        const newUserProfile: UserProfile = {
            uid: user.uid,
            name: user.displayName || 'Usuario',
            email: user.email,
            role: 'user', // Default role
        };
        await setDoc(userDocRef, newUserProfile);
    }
}
