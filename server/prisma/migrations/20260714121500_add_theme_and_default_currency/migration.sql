-- AlterTable
ALTER TABLE "User" ADD COLUMN     "defaultCurrency" TEXT NOT NULL DEFAULT 'SGD',
ADD COLUMN     "theme" TEXT NOT NULL DEFAULT 'light';
