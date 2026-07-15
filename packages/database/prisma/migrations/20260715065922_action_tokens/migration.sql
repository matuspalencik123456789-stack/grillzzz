-- CreateEnum
CREATE TYPE "ActionTokenPurpose" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION');

-- CreateTable
CREATE TABLE "ActionToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "purpose" "ActionTokenPurpose" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActionToken_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ActionToken_tokenHash_key" ON "ActionToken"("tokenHash");

-- CreateIndex
CREATE INDEX "ActionToken_userId_purpose_idx" ON "ActionToken"("userId", "purpose");

-- AddForeignKey
ALTER TABLE "ActionToken" ADD CONSTRAINT "ActionToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
