// Length caps on user-supplied free text (LIF-31).
//
// These columns are Prisma `String` → unbounded Postgres `text`, and
// express.json()'s default 100 kB body limit was the only thing bounding them:
// a single subscription could carry ~100 kB of notes, across unlimited rows.
// Not a DoS — the body limit caps each request — but unbounded storage growth,
// and it wrecks list and card layouts in the UI.
//
// The numbers are deliberate rather than magic: a subscription name is a product
// name, a person's name is a person's name, notes are a short memo. They live
// here, shared by the auth and subscription validators, rather than as literals
// scattered through the route chains.
export const MAX_NAME_LENGTH = 100;
export const MAX_NOTES_LENGTH = 2000;
