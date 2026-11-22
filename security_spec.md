# Security Specification — 𝕏 Boost

## Data Invariants
1. **PII Isolation**: User documents (`users/{userId}`) contain emails and are readable only by the owning user or an administrator (`isOwner(userId) || isAdmin()`). Blanket `list` is restricted to admins.
2. **No Self-Assigned Admin Privileges**: A user cannot create or update `users/{userId}` with `role: 'admin'` or write to `admins/{userId}` unless they are already an admin or the verified bootstrap administrator email (`jedidiahobongha139@gmail.com` with `email_verified == true`).
3. **Wallet Integrity (No Client-Side Balance Inflation)**: Non-admin users can only initialize `wallets/{userId}` with `balance == 0`, `totalDeposited == 0`, `totalSpent == 0`. Non-admin users can never increase their `balance` or `totalDeposited`. Wallet deductions are allowed only atomically inside a batch alongside a newly created `orders/{orderId}` whose `charge` matches `existing.balance - incoming.balance` and matches the authoritative `services/{serviceId}` pricing.
4. **Order Price & Service Validation**: Creating an order requires `email_verified == true`, an existing `active` service, `quantity` within `[minQuantity, maxQuantity]`, `charge` matching `ratePer1000 * quantity / 1000` (within floating-point tolerance), `status == 'pending'`, and atomic wallet deduction.
5. **Immutable Transaction Ledger**: `transactions/{txId}` documents cannot be updated or deleted once written. Non-admin users can only create `order_debit` transactions linked via `getAfter()` to an order created in the same atomic batch.
6. **Server-Verified Payments Only**: Non-admin users cannot create or update `paymentRecords` with `status == 'verified'` or `verifiedByServer == true`.
7. **Admin-Only Configuration**: Only verified administrators can write to `services`, `adminSettings`, and `announcements`. Secret API keys and payment credentials are never stored in Firestore.

## Dirty Dozen Adversarial Payloads (Must Return PERMISSION_DENIED)
1. **Self-Elevation on Registration**: `users/{uid}` create with `role: "admin"` by non-admin user.
2. **Role Update Escalation**: `users/{uid}` update changing `role` from `"user"` to `"admin"`.
3. **Cross-User PII Read**: Authenticated user A calling `get` or `list` on `users/{userB}` or `users`.
4. **Wallet Zero-Day Inflation**: `wallets/{uid}` create with `balance: 5000` by non-admin user.
5. **Wallet Direct Credit Update**: `wallets/{uid}` update increasing `balance` from `10` to `1000` without admin role.
6. **Orphaned Wallet Debit**: `wallets/{uid}` update subtracting `5` without an atomic `orders/{lastOrderId}` in the same batch.
7. **Underpriced Order Spoof**: `orders/{orderId}` create with `quantity: 10000` and `charge: 0.01` when service `ratePer1000` is `12.50`.
8. **Paused Service Order**: `orders/{orderId}` create referencing a service with `status: "paused"`.
9. **Terminal Order Hijack**: `orders/{orderId}` update by owner changing `status` from `"completed"` to `"refunded"`.
10. **Fake Payment Verification**: `paymentRecords/{id}` create or update setting `verifiedByServer: true` or `status: "verified"` by non-admin user.
11. **Shadow Field Injection**: `supportTickets/{id}` create with an undocumented ghost field `isPriorityAdmin: true`.
12. **Unverified Email Spoof**: Request where `request.auth.token.email == "jedidiahobongha139@gmail.com"` but `request.auth.token.email_verified == false`.
