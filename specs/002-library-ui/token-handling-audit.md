# Token Handling Audit

Date: 2026-06-26

## Scope

- `frontend/src/lib/auth/session.ts`
- `frontend/src/lib/auth/sign-out.ts`
- `frontend/src/lib/api/client.ts`
- `frontend/src/lib/api/errors.ts`
- `frontend/src/app/providers.tsx`

## Findings

- Access tokens remain memory-only in `authSession`. The session store keeps token state in module memory and does not call `localStorage`, `sessionStorage`, cookies, or IndexedDB.
- API requests attach the bearer token from the in-memory snapshot only when a request requires auth.
- A `401` response clears the memory session with reason `expired`.
- Staff and member sign-out both call the shared sign-out helper, which clears the memory session and calls `queryClient.clear()` before returning the role-specific login route.
- Error normalization returns status/message/details without persisting sensitive API data.
- App providers share one TanStack Query client instance, so `queryClient.clear()` clears cached staff and member query data for the current frontend runtime.

## Result

No implementation defect was found in the reviewed token/session flow. The current behavior matches the v1 requirement: no persistent frontend token storage, and sign-out clears cached protected data.
