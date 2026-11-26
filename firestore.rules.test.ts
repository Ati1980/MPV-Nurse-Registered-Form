/**
 * Security Rules Verification Suite (Phase 0 TDD)
 * Designed for @firebase/rules-unit-testing against Firestore Emulator.
 */
import { readFileSync } from 'node:fs';

export const DIRTY_DOZEN_CASES = [
  '1. Shadow field injection on create /nurse_register/{id} -> PERMISSION_DENIED',
  '2. Non-admin get on /nurse_register/{id} -> PERMISSION_DENIED',
  '3. Non-admin list on /nurse_register -> PERMISSION_DENIED',
  '4. Spoofed email without email_verified=true -> PERMISSION_DENIED',
  '5. Create with non-initial status -> PERMISSION_DENIED',
  '6. Create with pdpaAccepted=false -> PERMISSION_DENIED',
  '7. Client-forged createdAt timestamp != request.time -> PERMISSION_DENIED',
  '8. Invalid document ID poisoning -> PERMISSION_DENIED',
  '9. Oversized string/array payload (>limits) -> PERMISSION_DENIED',
  '10. Orphaned /nurse_register_status create without /nurse_register batch -> PERMISSION_DENIED',
  '11. Non-admin update on /nurse_register or /nurse_register_status -> PERMISSION_DENIED',
  '12. Privilege escalation create on /admins/{uid} -> PERMISSION_DENIED',
] as const;

export function loadDraftRules(): string {
  return readFileSync('firestore.rules', 'utf-8');
}
