-- CreateEnum
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'MANUFACTURER', 'ADMIN');

-- CreateEnum
CREATE TYPE "OrganizationType" AS ENUM ('STUDIO', 'MANUFACTURER');

-- CreateEnum
CREATE TYPE "OrgMemberRole" AS ENUM ('OWNER', 'MANAGER', 'TECHNICIAN');

-- CreateEnum
CREATE TYPE "ProjectStatus" AS ENUM ('DRAFT', 'SCANNING', 'DESIGNING', 'REVIEW', 'ORDERED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ScanFormat" AS ENUM ('STL', 'PLY', 'OBJ', 'GLB', 'GLTF');

-- CreateEnum
CREATE TYPE "JawKind" AS ENUM ('UPPER', 'LOWER', 'FULL', 'UNKNOWN');

-- CreateEnum
CREATE TYPE "ScanStatus" AS ENUM ('AWAITING_UPLOAD', 'UPLOADED', 'VALIDATING', 'OPTIMIZING', 'ANALYZING', 'SEGMENTING', 'READY', 'FAILED');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('GOLD_10K', 'GOLD_14K', 'GOLD_18K', 'WHITE_GOLD', 'ROSE_GOLD', 'SILVER', 'PLATINUM');

-- CreateEnum
CREATE TYPE "SurfaceFinish" AS ENUM ('GLOSS', 'MATTE', 'BRUSHED', 'HAMMERED');

-- CreateEnum
CREATE TYPE "StoneType" AS ENUM ('NATURAL_DIAMOND', 'LAB_DIAMOND', 'CZ');

-- CreateEnum
CREATE TYPE "StoneShape" AS ENUM ('ROUND', 'PRINCESS', 'EMERALD', 'HEART');

-- CreateEnum
CREATE TYPE "PatternKind" AS ENUM ('CLASSIC', 'HONEYCOMB', 'BAGUETTE', 'FLOODED', 'ICED', 'SNAKE', 'FLAME', 'CUSTOM_ENGRAVING');

-- CreateEnum
CREATE TYPE "GrillzSetType" AS ENUM ('SINGLE', 'DUO', 'QUAD', 'SIX', 'EIGHT', 'UPPER', 'LOWER', 'FULL_SET');

-- CreateEnum
CREATE TYPE "GrillzStatus" AS ENUM ('DRAFT', 'PRICED', 'LOCKED', 'IN_PRODUCTION', 'COMPLETED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING_PAYMENT', 'PAID', 'IN_PRODUCTION', 'QUALITY_CHECK', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('REQUIRES_ACTION', 'PROCESSING', 'SUCCEEDED', 'FAILED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('QUEUED', 'CAD_REVIEW', 'PRINTING', 'CASTING', 'STONE_SETTING', 'POLISHING', 'QUALITY_CONTROL', 'SHIPPED');

-- CreateEnum
CREATE TYPE "RenderJobType" AS ENUM ('THUMBNAIL', 'TURNTABLE', 'EXPORT_STL', 'EXPORT_OBJ', 'EXPORT_GLTF', 'PRODUCTION_PDF');

-- CreateEnum
CREATE TYPE "RenderJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCAN_READY', 'SCAN_FAILED', 'QUOTE_READY', 'ORDER_STATUS', 'PRODUCTION_UPDATE', 'SYSTEM');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "name" TEXT,
    "image" TEXT,
    "passwordHash" TEXT,
    "role" "Role" NOT NULL DEFAULT 'CUSTOMER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefreshToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" "OrganizationType" NOT NULL DEFAULT 'STUDIO',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "OrgMemberRole" NOT NULL DEFAULT 'TECHNICIAN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "status" "ProjectStatus" NOT NULL DEFAULT 'DRAFT',
    "ownerId" TEXT NOT NULL,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DentalScan" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" "ScanFormat" NOT NULL,
    "jaw" "JawKind" NOT NULL DEFAULT 'UNKNOWN',
    "status" "ScanStatus" NOT NULL DEFAULT 'AWAITING_UPLOAD',
    "originalFileKey" TEXT NOT NULL,
    "processedGlbKey" TEXT,
    "thumbnailKey" TEXT,
    "fileSizeBytes" INTEGER,
    "meshStats" JSONB,
    "boundingBox" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DentalScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Tooth" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "fdiNumber" INTEGER NOT NULL,
    "centroid" JSONB NOT NULL,
    "boundingBox" JSONB NOT NULL,
    "surfaceAreaMm2" DOUBLE PRECISION NOT NULL,
    "triangleRange" JSONB NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tooth_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Material" (
    "id" TEXT NOT NULL,
    "type" "MaterialType" NOT NULL,
    "name" TEXT NOT NULL,
    "densityGCm3" DOUBLE PRECISION NOT NULL,
    "pricePerGram" INTEGER NOT NULL,
    "colorHex" TEXT NOT NULL,
    "metalness" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "roughness" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Material_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiamondSetting" (
    "id" TEXT NOT NULL,
    "grillzId" TEXT NOT NULL,
    "stoneType" "StoneType" NOT NULL,
    "shape" "StoneShape" NOT NULL DEFAULT 'ROUND',
    "stoneSizeMm" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "spacingMm" DOUBLE PRECISION NOT NULL DEFAULT 0.6,
    "density" DOUBLE PRECISION NOT NULL DEFAULT 0.5,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiamondSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Pattern" (
    "id" TEXT NOT NULL,
    "kind" "PatternKind" NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "params" JSONB NOT NULL,
    "previewKey" TEXT,
    "laborFactor" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Grillz" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "GrillzStatus" NOT NULL DEFAULT 'DRAFT',
    "setType" "GrillzSetType" NOT NULL,
    "toothNumbers" INTEGER[],
    "materialId" TEXT NOT NULL,
    "finish" "SurfaceFinish" NOT NULL DEFAULT 'GLOSS',
    "patternId" TEXT,
    "engravingText" TEXT,
    "thicknessMm" DOUBLE PRECISION NOT NULL DEFAULT 0.8,
    "offsetMm" DOUBLE PRECISION NOT NULL DEFAULT 0.05,
    "fitToleranceMm" DOUBLE PRECISION NOT NULL DEFAULT 0.08,
    "chamferMm" DOUBLE PRECISION NOT NULL DEFAULT 0.2,
    "edgeRadiusMm" DOUBLE PRECISION NOT NULL DEFAULT 0.15,
    "configJson" JSONB NOT NULL,
    "priceSnapshot" JSONB,
    "exportedFiles" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Grillz_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "grillzId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "subtotalMinor" INTEGER NOT NULL,
    "taxMinor" INTEGER NOT NULL,
    "shippingMinor" INTEGER NOT NULL,
    "totalMinor" INTEGER NOT NULL,
    "quoteJson" JSONB NOT NULL,
    "shippingAddress" JSONB NOT NULL,
    "placedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "grillzId" TEXT NOT NULL,
    "unitPriceMinor" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerRef" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PROCESSING',
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "failureReason" TEXT,
    "capturedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionJob" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "organizationId" TEXT,
    "assigneeId" TEXT,
    "stage" "ProductionStage" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "files" JSONB,
    "notes" TEXT,
    "dueAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RenderingJob" (
    "id" TEXT NOT NULL,
    "grillzId" TEXT,
    "scanId" TEXT,
    "type" "RenderJobType" NOT NULL,
    "status" "RenderJobStatus" NOT NULL DEFAULT 'QUEUED',
    "outputKey" TEXT,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RenderingJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "data" JSONB,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_idx" ON "RefreshToken"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");

-- CreateIndex
CREATE INDEX "OrganizationMember_userId_idx" ON "OrganizationMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationMember_organizationId_userId_key" ON "OrganizationMember"("organizationId", "userId");

-- CreateIndex
CREATE INDEX "Project_ownerId_status_idx" ON "Project"("ownerId", "status");

-- CreateIndex
CREATE INDEX "Project_organizationId_idx" ON "Project"("organizationId");

-- CreateIndex
CREATE INDEX "DentalScan_projectId_status_idx" ON "DentalScan"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Tooth_scanId_fdiNumber_key" ON "Tooth"("scanId", "fdiNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Material_type_key" ON "Material"("type");

-- CreateIndex
CREATE UNIQUE INDEX "DiamondSetting_grillzId_key" ON "DiamondSetting"("grillzId");

-- CreateIndex
CREATE UNIQUE INDEX "Pattern_kind_key" ON "Pattern"("kind");

-- CreateIndex
CREATE INDEX "Grillz_projectId_status_idx" ON "Grillz"("projectId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Favorite_userId_grillzId_key" ON "Favorite"("userId", "grillzId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_number_key" ON "Order"("number");

-- CreateIndex
CREATE INDEX "Order_userId_status_idx" ON "Order"("userId", "status");

-- CreateIndex
CREATE INDEX "Order_status_placedAt_idx" ON "Order"("status", "placedAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "Payment_orderId_idx" ON "Payment"("orderId");

-- CreateIndex
CREATE INDEX "Payment_provider_providerRef_idx" ON "Payment"("provider", "providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "ProductionJob_orderId_key" ON "ProductionJob"("orderId");

-- CreateIndex
CREATE INDEX "ProductionJob_stage_priority_idx" ON "ProductionJob"("stage", "priority");

-- CreateIndex
CREATE INDEX "ProductionJob_organizationId_stage_idx" ON "ProductionJob"("organizationId", "stage");

-- CreateIndex
CREATE INDEX "RenderingJob_status_createdAt_idx" ON "RenderingJob"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RenderingJob_grillzId_idx" ON "RenderingJob"("grillzId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_createdAt_idx" ON "AuditLog"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_readAt_createdAt_idx" ON "Notification"("userId", "readAt", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefreshToken" ADD CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DentalScan" ADD CONSTRAINT "DentalScan_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tooth" ADD CONSTRAINT "Tooth_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "DentalScan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiamondSetting" ADD CONSTRAINT "DiamondSetting_grillzId_fkey" FOREIGN KEY ("grillzId") REFERENCES "Grillz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grillz" ADD CONSTRAINT "Grillz_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grillz" ADD CONSTRAINT "Grillz_materialId_fkey" FOREIGN KEY ("materialId") REFERENCES "Material"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Grillz" ADD CONSTRAINT "Grillz_patternId_fkey" FOREIGN KEY ("patternId") REFERENCES "Pattern"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_grillzId_fkey" FOREIGN KEY ("grillzId") REFERENCES "Grillz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_grillzId_fkey" FOREIGN KEY ("grillzId") REFERENCES "Grillz"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionJob" ADD CONSTRAINT "ProductionJob_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RenderingJob" ADD CONSTRAINT "RenderingJob_grillzId_fkey" FOREIGN KEY ("grillzId") REFERENCES "Grillz"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
