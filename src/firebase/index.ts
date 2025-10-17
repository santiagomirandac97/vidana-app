'use client';

import { firebaseConfig } from '@/firebase/config';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore'

// IMPORTANT: DO NOT MODIFY THIS FUNCTION
export function initializeFirebase() {
  let firebaseApp;
  if (!getApps().length) {
    try {
      firebaseApp = initializeApp();
    } catch (e) {
      if (process.env.NODE_ENV === "production") {
        console.warn('Automatic initialization failed. Falling back to firebase config object.', e);
      }
      firebaseApp = initializeApp(firebaseConfig);
    }
  } else {
    firebaseApp = getApp();
  }

  const auth = getAuth(firebaseApp);
  
  // This is a simplified user setup for the demo.
  // In a real app, you'd manage this through a backend or admin panel.
  const companyUsers = {
    'inditex@rgstr.app': 'AIFA',
    'grupoaxo@rgstr.app': 'Piso 22'
  };

  for (const [email, password] of Object.entries(companyUsers)) {
    createUserWithEmailAndPassword(auth, email, password).catch((error) => {
        // We expect 'auth/email-already-in-use' if the user exists, which is fine.
        if (error.code !== 'auth/email-already-in-use') {
            console.error(`Failed to ensure user ${email} exists:`, error);
        }
    });
  }


  return getSdks(firebaseApp);
}

export function getSdks(firebaseApp: FirebaseApp) {
  return {
    firebaseApp,
    auth: getAuth(firebaseApp),
    firestore: getFirestore(firebaseApp)
  };
}

export * from './provider';
export * from './client-provider';
export * from './firestore/use-collection';
export * from './firestore/use-doc';
export * from './non-blocking-updates';
export * from './non-blocking-login';
export * from './errors';
export * from './error-emitter';

    