
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

/**
 * Initiates a setDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function setDocumentNonBlocking(docRef: DocumentReference, data: any, options: SetOptions) {
  return setDoc(docRef, data, options);
}


/**
 * Initiates an addDoc operation for a collection reference.
 * Returns the promise from the Firestore operation.
 */
export function addDocumentNonBlocking<T extends DocumentData>(colRef: CollectionReference<T>, data: T) {
  return addDoc(colRef, data);
}


/**
 * Initiates an updateDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function updateDocumentNonBlocking(docRef: DocumentReference, data: any) {
  return updateDoc(docRef, data);
}


/**
 * Initiates a deleteDoc operation for a document reference.
 * Returns the promise from the Firestore operation.
 */
export function deleteDocumentNonBlocking(docRef: DocumentReference) {
  return deleteDoc(docRef);
}

    