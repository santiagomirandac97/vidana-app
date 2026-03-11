
'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, initializeFirestore, memoryLocalCache, Firestore, DocumentReference, Query } from 'firebase/firestore';
import { getAuth, Auth, browserSessionPersistence, inMemoryPersistence, setPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';
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
  useFirebase,
  useStorage
} from './provider';
import { FirebaseClientProvider } from './client-provider';

// Helper to get a memoized Auth instance with persistence
const getAuthInstance = (app: FirebaseApp): Auth => {
    const auth = getAuth(app);
    // Use a flag to ensure persistence is only set once
    if (!(auth as any)._persistenceInitialized) {
        (auth as any)._persistenceInitialized = true;
        setPersistence(auth, typeof window !== 'undefined' ? browserSessionPersistence : inMemoryPersistence)
            .catch((error) => {
                console.error("Firebase persistence error:", error);
            });
    }
    return auth;
};


export function initializeFirebase() {
    const isFirstInit = getApps().length === 0;
    const app = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0];
    // Use memoryLocalCache on first init so Firestore never touches window.localStorage,
    // which crashes during Next.js SSR when window is partially polyfilled.
    const firestore = isFirstInit
        ? initializeFirestore(app, { localCache: memoryLocalCache() })
        : getFirestore(app);
    const auth = getAuthInstance(app);
    const storage = getStorage(app);
    return { app, auth, firestore, storage };
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
  useFirebase,
  useStorage
};
