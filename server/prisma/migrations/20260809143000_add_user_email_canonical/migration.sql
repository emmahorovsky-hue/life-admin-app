-- Splits email identity from email display (LIF-80, take two).
--
-- `User.email` becomes the address as the user typed it (dots intact) and
-- `User.emailCanonical` becomes the key every lookup and uniqueness check uses.
-- Written by hand rather than generated: Prisma emits a bare NOT NULL ADD
-- COLUMN, which cannot execute against a populated table. Nullable first,
-- backfill, then constrain — so `prisma migrate deploy` is safe in production.

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
