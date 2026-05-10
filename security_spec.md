# Security Specification - KiddieCreator

## Data Invariants
1. A Score must reference a valid project.
2. Only the owner of a project can edit or delete it.
3. Scores are immutable once recorded.
4. Users can only see their own projects (private mode) or public ones (if implemented).
5. Scores are only recordable by signed-in users.

## The Dirty Dozen Payloads (Rejection Targets)

1. **Identity Spoofing (Project)**: Creating a project where `ownerId` is not the sender's UID.
2. **Identity Spoofing (Score)**: Recording a score for another user's account.
3. **Ghost Field Injection**: Adding `isVerified: true` to a project document.
4. **Out-of-Order Status**: Updating a finished score (immutable score).
5. **PII Leak**: Non-owner trying to 'get' a user's private data.
6. **Query Scraping**: `allow list: if isSignedIn()` without resource data validation.
7. **Resource Poisoning**: Document ID with 2KB of junk characters.
8. **Temporal Integrity**: Setting `createdAt` to a date in the past instead of `request.time`.
9. **Update Gap**: Modifying `ownerId` of a project during an update.
10. **Validation Bypass**: Updating a score with a negative `correctPairs` value.
11. **Orphaned Write**: Creating a score for a `projectId` that doesn't exist.
12. **Self-Promotion**: Increasing `correctPairs` to be higher than `totalPairs`.

## Test Runner (Mock Logic)
The `firestore.rules` will be mathematically audited against these scenarios.
