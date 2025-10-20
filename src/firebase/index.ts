
'use client';

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getFirestore, Firestore, addDoc, DocumentReference, collection, doc, Query } from 'firebase/firestore';
import { useState, useEffect, useMemo } from 'react';
import { useCollection as useCollectionHook } from './firestore/use-collection';
import { useDoc as useDocHook } from './firestore/use-doc';
import { firebaseConfig } from './config'; // Import the hardcoded config

function getFirebaseApp(): FirebaseApp {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
}

interface FirebaseInstances {
    app: FirebaseApp | null;
    firestore: Firestore | null;
}

export function useFirebase(): FirebaseInstances {
    const [instances, setInstances] = useState<FirebaseInstances>({ app: null, firestore: null });

    useEffect(() => {
        const app = getFirebaseApp();
        const firestore = getFirestore(app);
        setInstances({ app, firestore });
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


/** (non-blocking) */
export function addDocumentNonBlocking<T extends object>(
    collectionRef: any, 
    data: T,
    options: { onSuccess?: (docRef: DocumentReference) => void; onError?: (error: any) => void; } = {}
  ): Promise<DocumentReference | null> {
    return addDoc(collectionRef, data)
      .then(docRef => {
        if (options.onSuccess) {
          options.onSuccess(docRef);
        }
        return docRef;
      })
      .catch(error => {
        console.error("Error adding document: ", error);
        if (options.onError) {
          options.onError(error);
        }
        return null;
      });
  }
