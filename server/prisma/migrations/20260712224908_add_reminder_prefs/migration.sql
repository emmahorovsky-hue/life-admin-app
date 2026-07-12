-- AlterTable
ALTER TABLE "NotificationLog" ADD COLUMN     "channel" TEXT NOT NULL DEFAULT 'email';

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "remindersMuted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "reminderEmailsEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "reminderPushEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'UTC';
