
'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, DocumentReference, collection, doc, Query } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { useState, useEffect, useMemo } from 'react';
import { useCollection as useCollectionHook } from './firestore/use-collection';
import { useDoc as useDocHook } from './firestore/use-doc';
import { firebaseConfig } from './config'; // Import the hardcoded config
import { useUser as useUserHook } from './auth/use-user';

function getFirebaseApp(): FirebaseApp {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

interface FirebaseInstances {
    app: FirebaseApp | null;
    firestore: Firestore | null;
    auth: Auth | null;
}

export function useFirebase(): FirebaseInstances {
    const [instances, setInstances] = useState<FirebaseInstances>({ app: null, firestore: null, auth: null });

    useEffect(() => {
        const app = getFirebaseApp();
        const firestore = getFirestore(app);
        const auth = getAuth(app);
        setInstances({ app, firestore, auth });
    }, []);

    return instances;
}

export function useMemoFirebase<T extends Query | DocumentReference>(queryFactory: () => T | null, deps: any[]): (T & { __memo?: boolean }) | null {
    const { firestore } = useFirebase();
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

export const useAuth = () => {
    const { auth } = useFirebase();
    return auth;
}
