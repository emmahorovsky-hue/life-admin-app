-- Splits email identity from email display (LIF-80, take two).
--
-- `User.email` becomes the address as the user typed it (dots intact) and
-- `User.emailCanonical` becomes the key every lookup and uniqueness check uses.
-- Written by hand rather than generated: Prisma emits a bare NOT NULL ADD
-- COLUMN, which cannot execute against a populated table. Nullable first,
-- backfill, then constrain — so `prisma migrate deploy` is safe in production.
--
--
-- ============================ RUN THIS FIRST ============================
--
-- The Gmail re-normalization below can map two existing rows onto one canonical
-- value: a pre-existing `firstlast@gmail.com` and a `first.last@gmail.com`
-- registered during the LIF-80 window are the same inbox, and the CREATE UNIQUE
-- INDEX at the bottom of this file will not have them. Against production data
-- nobody knows whether that pair exists until it is looked for, so look:
--
--   SELECT CASE WHEN split_part(lower("email"),'@',2) IN ('gmail.com','googlemail.com')
--            THEN replace(split_part(split_part(lower("email"),'@',1),'+',1),'.','') || '@gmail.com'
--            ELSE lower("email") END AS canonical,
--          count(*), array_agg("id" || ' ' || "email")
--   FROM "User" GROUP BY 1 HAVING count(*) > 1;
--
-- Zero rows means this migration is safe to deploy. Any row is two accounts for
-- one inbox and needs a person to decide which survives — merge or delete the
-- duplicate first, then re-run the query. The CASE is copied verbatim from the
-- backfill below so the check cannot disagree with what actually runs; keep the
-- two in step if either is edited.
--
-- Skipping the check costs more than a failed deploy. When CREATE UNIQUE INDEX
-- aborts, Prisma leaves a FAILED row in `_prisma_migrations`, and from that
-- moment `prisma migrate deploy` refuses to apply *anything* — including
-- releases that have nothing to do with this column. Railway runs it on every
-- deploy (see DEPLOYMENT.md 2.2), so one unchecked collision blocks the whole
-- pipeline until someone with database access intervenes by hand.
--
-- To recover: fix the colliding data, then clear the failed row with
--
--   npx prisma migrate resolve --rolled-back 20260809143000_add_user_email_canonical
--
-- and redeploy. `--rolled-back`, not `--applied`: Postgres has transactional DDL
-- and Prisma runs each migration file in one transaction, so the failure took
-- the ADD COLUMN with it and this file has to run again from the top.
--
-- =======================================================================

-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailCanonical" TEXT;

-- Backfill.
--
-- For every domain except gmail/googlemail the stored `email` IS already the
-- canonical form: normalizeEmail() ran on every write path since day one and
-- its non-Gmail rules (all_lowercase, outlook/icloud/yahoo subaddress
-- stripping, yandex domain folding) were never disabled. A straight copy.
--
-- Gmail is the exception. Between 0b415d7 (22 Jun 2026 06:49) and its revert
-- 87e886d (23 Jun 06:39) the auth routes ran with gmail_remove_dots:false, so
-- any account registered or email-changed inside that ~24h window holds a
-- DOTTED address. Copying those verbatim would make the dotted spelling the
-- identity key — reintroducing exactly the lockout that forced the revert.
-- So re-apply the Gmail rules here: drop the +subaddress, drop the dots,
-- fold googlemail.com onto gmail.com.
--
-- Removing every dot (rather than collapsing runs, as validator's dotsReplacer
-- does) is faithful for anything that can be in this table: isEmail() splits
-- the local part on "." and requires each segment to be non-empty, so
-- consecutive dots were never storable.
UPDATE "User"
SET "emailCanonical" = CASE
  WHEN split_part(lower("email"), '@', 2) IN ('gmail.com', 'googlemail.com')
    THEN replace(split_part(split_part(lower("email"), '@', 1), '+', 1), '.', '') || '@gmail.com'
  ELSE lower("email")
END
WHERE "emailCanonical" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "emailCanonical" SET NOT NULL;

-- CreateIndex
-- Name must match what Prisma derives from @unique, or every future
-- `migrate diff` reports permanent drift.
CREATE UNIQUE INDEX "User_emailCanonical_key" ON "User"("emailCanonical");
