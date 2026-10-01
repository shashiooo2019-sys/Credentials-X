# Security Specification: Staff Credentials Verification System

## 1. Data Invariants
1. `master_credentials`: Each staff record is keyed by their sanitized U-Number. Contains baseline system authorization keys.
2. `submissions`: Each record represents a verification event by a staff member for a specific fortnight audit cycle. Cannot have empty `uNumber`, `name`, `verificationDate`, or missing `verifications`.
3. Verifications array must contain valid field keys and statuses (`CONFIRMED` or `CHANGE_REQUESTED`).
4. Updates to submissions must maintain referential integrity with the audit cycle and cannot change the staff `uNumber`.

## 2. The "Dirty Dozen" Threat Vectors & Security Payloads
1. **Unauthenticated Write to Master Credentials**: Attempting to overwrite master credentials without authorization.
2. **Invalid Schema Injection (Master Credentials)**: Injecting unauthorized keys or oversized payloads into master record.
3. **Ghost Status Bypass**: Spoofing submission status without proper verification records.
4. **Denial of Wallet Document ID Flooding**: Submitting IDs with > 128 characters or special injection characters.
5. **PII / Secret Extraction**: Attempting unauthorized mass deletion or extraction of staff credentials.
6. **Mismatched Staff Identifier**: Submitting a verification record where the payload U-Number does not match the record ID.
7. **Malformed Verifications Array**: Sending non-array or malicious objects inside verifications.
8. **Overly Long Remark Injection**: Injecting multi-megabyte remark strings to cause storage exhaustion.
9. **Tampering with Past Submissions**: Mutating submittedAt or fortnightPeriod after creation.
10. **Shadow Field Injection**: Adding unexpected admin bypass fields (e.g. `isAdmin: true`) into user records.
11. **Negative Counters Attack**: Sending negative numbers for `confirmedCount` or `changeRequestCount`.
12. **Malformed Fortnight Period**: Submitting invalid fortnight strings that bypass partitioning filters.
