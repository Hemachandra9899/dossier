/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `DocumentAnalysis` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotencyKey` to the `DocumentAnalysis` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "DocumentAnalysisRunStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "DocumentAnalysis" ADD COLUMN     "analysisVersion" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "idempotencyKey" TEXT NOT NULL,
ADD COLUMN     "runStatus" "DocumentAnalysisRunStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "VerificationIssue" ADD COLUMN     "dismissalReason" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DocumentAnalysis_idempotencyKey_key" ON "DocumentAnalysis"("idempotencyKey");
