
'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, DocumentReference, Query } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { useMemo } from 'react';
import { useCollection as useCollectionHook } from './firestore/use-collection';
import { useDoc as useDocHook } from './firestore/use-doc';
import { firebaseConfig } from './config';
import { useUser as useUserHook } from './auth/use-user';
import { 
  FirebaseProvider,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useFirebase
} from './provider';
import { FirebaseClientProvider } from './client-provider';

export function initializeFirebase() {
    const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
    const firestore = getFirestore(app);
    const auth = getAuth(app);
    return { app, auth, firestore };
}

export function useMemoFirebase<T extends Query | DocumentReference>(queryFactory: () => T | null, deps: any[]): (T & { __memo?: boolean }) | null {
    const firestore = useFirestore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const memoizedQuery = useMemo(() => {
      if (!firestore) return null;
      const query = queryFactory();
      if(query){
        (query as any).__memo = true;
      }
      return query
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [firestore, ...deps]);
    return memoizedQuery;
}

// Re-exporting the custom hooks
export const useCollection = useCollectionHook;
export const useDoc = useDocHook;
export const useUser = useUserHook;

// Re-exporting provider and context hooks
export {
  FirebaseProvider,
  FirebaseClientProvider,
  useFirebaseApp,
  useFirestore,
  useAuth,
  useFirebase
};
