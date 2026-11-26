# Security Specification & Payload-First TDD (`nurse_register`)

## 1. Data Invariants
1. **PII Isolation (`nurse_register` vs `nurse_register_status`)**: Full Forms 1–5 applications in `/nurse_register/{applicationId}` contain sensitive PII (national ID, phone numbers, email, addresses) and MUST NEVER be readable (`get` or `list`) by unauthenticated visitors or non-admin users. Public tracking reads ONLY `/nurse_register_status/{applicationId}`, which holds non-PII status and a 64-char SHA-256 `mobileHash`.
2. **Atomic Creation (`existsAfter`)**: A `/nurse_register_status/{applicationId}` or `/nurse_register/{applicationId}/files/{docId}` document cannot be created unless the corresponding `/nurse_register/{applicationId}` document is created atomically in the same batch (`existsAfter`).
3. **Initial State Integrity**: New applications MUST enter with `status == 'ได้รับใบสมัครแล้ว'`, `pdpaAccepted == true`, `truthfulnessAccepted == true`, and server timestamps `createdAt == request.time && updatedAt == request.time`.
4. **Immutable Audit Fields & Strict Keys**: Every document enforces `keys().hasAll(...) && keys().hasOnly(...)` on create, and updates on `/nurse_register/{applicationId}` and `/nurse_register_status/{applicationId}` may ONLY modify `status`, `hrNote`, and `updatedAt` (verified by `isAdmin()` + schema validation).
5. **Bounded Payload & Isolated Attachments**: All strings and arrays have explicit `.size()` bounds (`workExperiences <= 15`, `educationBackground <= 8`, `documents <= 10`). Main `/nurse_register` records store attachment metadata only; bounded file payloads (`dataUrl <= 900000` chars) live in `/nurse_register/{applicationId}/files/{docId}` readable and deletable exclusively by verified HR admins.
6. **Verified Admin Only (Read/Update/Delete)**: Admin privileges require `request.auth != null && request.auth.token.email_verified == true` matching the bootstrapped HR admin email or an existing `/admins/{uid}` entry. Deletion of applications, status summaries, and attachment subdocuments is restricted exclusively to `isAdmin()`.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Ghost Field Injection (`Shadow Update`)**: Create `/nurse_register/MPV-2570-0001-AAA` with extra key `isAdminApproved: true` -> `PERMISSION_DENIED`.
2. **PII Blanket Read (`get`)**: Unauthenticated or non-admin `get` on `/nurse_register/MPV-2570-0001-AAA` -> `PERMISSION_DENIED`.
3. **PII Blanket List (`list`)**: Unauthenticated or non-admin `list` on `/nurse_register` -> `PERMISSION_DENIED`.
4. **Email Spoofing Attack**: Auth token with `email == 'kku.tum@gmail.com'` and `email_verified: false` reading `/nurse_register` -> `PERMISSION_DENIED`.
5. **State Shortcutting on Create**: Create `/nurse_register/MPV-2570-0001-AAA` with `status: 'นัดหมายสัมภาษณ์'` -> `PERMISSION_DENIED`.
6. **PDPA Consent Bypass**: Create `/nurse_register/MPV-2570-0001-AAA` with `pdpaAccepted: false` -> `PERMISSION_DENIED`.
7. **Timestamp Forgery**: Create `/nurse_register/MPV-2570-0001-AAA` with client-supplied `createdAt` not equal to `request.time` -> `PERMISSION_DENIED`.
8. **ID Poisoning**: Create `/nurse_register/bad$id..slash` or >128-char document ID -> `PERMISSION_DENIED`.
9. **Resource Exhaustion (`Denial of Wallet`)**: Create `/nurse_register/MPV-2570-0001-AAA` with a 50KB `fullNameTh` string or >10 `documents` -> `PERMISSION_DENIED`.
10. **Orphaned Status Write**: Create `/nurse_register_status/MPV-2570-0001-ORP` without atomically creating `/nurse_register/MPV-2570-0001-ORP` -> `PERMISSION_DENIED`.
11. **Applicant Self-Update / Tampering**: Unauthenticated or non-admin `update` on `/nurse_register/MPV-2570-0001-AAA` changing `status` or `personalInfo` -> `PERMISSION_DENIED`.
12. **Self-Assigned Admin Escalation**: Non-admin authenticated user creating `/admins/{ownUid}` -> `PERMISSION_DENIED`.
