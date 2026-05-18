-- CreateEnum
CREATE TYPE "Division" AS ENUM ('UPPER', 'LOWER');

-- AlterTable
ALTER TABLE "SessionPlayer" ADD COLUMN     "division" "Division";
