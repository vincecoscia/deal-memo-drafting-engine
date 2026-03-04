-- AlterTable
ALTER TABLE "DealMemo" ADD COLUMN     "anthropicFileId" TEXT,
ADD COLUMN     "dealSubType" TEXT,
ADD COLUMN     "memoFormat" TEXT;

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "memoId" TEXT,
    "errorMsg" TEXT,
    "fileName" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);
