
'use client';
    
import {
  setDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  CollectionReference,
  DocumentReference,
  SetOptions,
  DocumentData,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';


/**
 * Initiates a setDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  return setDoc(docRef, data, options).catch((error) => {
    const contextualError = new FirestorePermissionError({
        operation: 'write',
        path: docRef.path,
        requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Re-throw original error if needed elsewhere
  });
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Returns the promise from the Firestore operation.
 */
export function addDocumentNonBlocking<T extends DocumentData>(colRef: CollectionReference<T>, data: T) {
  return addDoc(colRef, data).catch((error) => {
    const contextualError = new FirestorePermissionError({
        operation: 'create',
        path: colRef.path,
        requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
    // Don't rethrow, as we want to return a resolved promise with null
    return null;
  });
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  return updateDoc(docRef, data).catch((error) => {
    const contextualError = new FirestorePermissionError({
        operation: 'update',
        path: docRef.path,
        requestResourceData: data,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Re-throw original error
  });
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  return deleteDoc(docRef).catch((error) => {
    const contextualError = new FirestorePermissionError({
        operation: 'delete',
        path: docRef.path,
    });
    errorEmitter.emit('permission-error', contextualError);
    throw error; // Re-throw original error
  });
}

    
