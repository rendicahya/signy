import { writable } from 'svelte/store';
import type { SignatureSpot } from '../lib/pdf/signatureDetect';

export interface SignatureSuggestion extends SignatureSpot {
  /** Scopes the suggestion to one document, so switching tabs doesn't leave a stale box floating on an unrelated document. */
  documentId: string;
}

/** The current "click here to place it" suggestion, if the user just ran Find Signature Spot. Cleared on placement, dismissal, or once acted on. */
export const signatureSuggestion = writable<SignatureSuggestion | null>(null);
