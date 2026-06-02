# Design Docs Index

Architectural designs and implementation specs for Engineer agent. Authored by CTO agent.

## Active design docs

| Ticket | Title | Status | Est |
|--------|-------|--------|-----|
| [LIF-41](./LIF-41-security-fixes-plan.md) | Security fixes implementation plan (14 vulns → 3 PRs) | Ready for Engineer | ~3 days |
| [LIF-42](./LIF-42-email-reminder-system.md) | Email reminder system architecture | Ready for Engineer | ~1.5–2 days |
| [LIF-47](./LIF-47-email-verification-flow.md) | Email verification flow | Ready for Engineer | ~1–1.5 days |

## Recommended ship order

```
LIF-41 PR-1 (hardening)  ──►  LIF-47 (verification)  ──►  LIF-42 (reminders)  ──►  LIF-41 PR-2 + PR-3
   (1 day, blockers)         (1 day, depends on PR-1)    (1.5 days, needs verified emails)   (rest of week)
```

LIF-47 must ship before LIF-42 in production, because the reminder job filters on
`emailVerified=true`. They can be developed in parallel.

## Decisions awaiting Anna's sign-off

These need a yes/no before Engineer starts. See each doc for full context.

### LIF-41 (Security)
1. Was JWT_SECRET ever committed to public git? If yes, force-logout all sessions on rotate? **CTO recommends:** rotate + force logout (you're effectively only user).
2. Set up `api.lifeadmin.dev` + `app.lifeadmin.dev` to enable sameSite=strict cookies? **CTO recommends:** yes (~30 min DNS).
3. Email users on account lockout? **CTO recommends:** yes, but only after LIF-42 ships.
4. Re-hash existing passwords to 12 rounds on next login? **CTO recommends:** yes, transparent.
5. Add Sentry now or later? **CTO recommends:** later — Railway stdout logs are enough.

### LIF-42 (Email reminders)
1. Stay on single Railway replica for MVP? **CTO recommends:** yes.
2. Sender domain — `resend.dev` or `lifeadmin.dev`? **CTO recommends:** `lifeadmin.dev` (15 min DNS).
3. Default reminder windows — 7/3/1 vs 7/1? **CTO recommends:** 7/3/1.
4. Send time — 09:00 UTC global vs per-user local? **CTO recommends:** 09:00 UTC for MVP.
5. Block reminder emails for unverified users? **CTO recommends:** yes.

### LIF-47 (Email verification)
1. Soft-gate (login allowed) vs hard-gate (must verify to log in)? **CTO recommends:** soft-gate.
2. Auto-log-in via verify link? **CTO recommends:** no.
3. Grandfather existing users to `emailVerified=true`? **CTO recommends:** yes.

## Notes for the human

All three docs flag specific decisions inline with 🚩 emoji for grep-ability. None of
the decisions are existential — Engineer can start work on the non-blocked sections
while we wait for sign-off on the rest.
