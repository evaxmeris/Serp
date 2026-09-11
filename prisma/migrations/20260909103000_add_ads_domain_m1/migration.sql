-- 广告域 M1 迁移（表已通过 db push 建于开发库，此文件用于版本控制/生产部署）

-- CreateTable
CREATE TABLE "ad_marketplaces" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "marketplaceId" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "adEndpoint" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_marketplaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_accounts" (
    "id" TEXT NOT NULL,
    "platformCode" TEXT NOT NULL DEFAULT 'amazon',
    "marketplaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "externalId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "refreshToken" TEXT,
    "platformAccountId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" TIMESTAMP(3),
    "settings" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ENABLED',
    "dailyBudget" DOUBLE PRECISION,
    "currency" TEXT DEFAULT 'USD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_keywords" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "campaignId" TEXT,
    "amazonCampaignId" TEXT,
    "adGroupId" TEXT,
    "externalId" TEXT,
    "keywordText" TEXT NOT NULL,
    "matchType" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "bid" DOUBLE PRECISION,
    "familyL1" TEXT,
    "duplicateOf" TEXT,
    "action" TEXT,
    "actionBid" DOUBLE PRECISION,
    "actionReason" TEXT NOT NULL,
    "rawRowIndex" INTEGER,
    "source" TEXT NOT NULL DEFAULT 'CLOSE_MATRIX',
    "acos" DOUBLE PRECISION,
    "orders" INTEGER,
    "spend" DOUBLE PRECISION,
    "clicks" INTEGER,
    "impressions" INTEGER,
    "ctr" DOUBLE PRECISION,
    "reportId" TEXT,
    "isSelected" BOOLEAN NOT NULL DEFAULT false,
    "overrideAction" TEXT,
    "overrideBid" DOUBLE PRECISION,
    "overriddenBy" TEXT,
    "overriddenAt" TIMESTAMP(3),
    "recommendationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_reports" (
    "id" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "uploadBatchId" TEXT NOT NULL,
    "reportType" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'MANUAL_UPLOAD',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "originalName" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "fileSize" INTEGER,
    "summary" JSONB NOT NULL,
    "rawRows" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "consistencyCheck" JSONB,
    "analyzeStatus" TEXT NOT NULL DEFAULT 'UPLOADED',
    "analyzeError" JSONB,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ad_recommendations" (
    "id" TEXT NOT NULL,
    "adReportId" TEXT NOT NULL,
    "adAccountId" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "result" JSONB NOT NULL,
    "params" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ad_marketplaces_code_key" ON "ad_marketplaces"("code");

-- CreateIndex
CREATE UNIQUE INDEX "ad_marketplaces_marketplaceId_key" ON "ad_marketplaces"("marketplaceId");

-- CreateIndex
CREATE INDEX "ad_marketplaces_isActive_idx" ON "ad_marketplaces"("isActive");

-- CreateIndex
CREATE INDEX "ad_accounts_marketplaceId_idx" ON "ad_accounts"("marketplaceId");

-- CreateIndex
CREATE INDEX "ad_accounts_isActive_idx" ON "ad_accounts"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ad_accounts_platformCode_marketplaceId_key" ON "ad_accounts"("platformCode", "marketplaceId");

-- CreateIndex
CREATE INDEX "ad_campaigns_adAccountId_idx" ON "ad_campaigns"("adAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "ad_campaigns_adAccountId_externalId_key" ON "ad_campaigns"("adAccountId", "externalId");

-- CreateIndex
CREATE INDEX "ad_keywords_adAccountId_familyL1_idx" ON "ad_keywords"("adAccountId", "familyL1");

-- CreateIndex
CREATE INDEX "ad_keywords_recommendationId_isSelected_idx" ON "ad_keywords"("recommendationId", "isSelected");

-- CreateIndex
CREATE INDEX "ad_keywords_adAccountId_matchType_idx" ON "ad_keywords"("adAccountId", "matchType");

-- CreateIndex
CREATE INDEX "ad_keywords_keywordText_matchType_idx" ON "ad_keywords"("keywordText", "matchType");

-- CreateIndex
CREATE UNIQUE INDEX "ad_keywords_recommendationId_externalId_key" ON "ad_keywords"("recommendationId", "externalId");

-- CreateIndex
CREATE INDEX "ad_reports_adAccountId_createdAt_idx" ON "ad_reports"("adAccountId", "createdAt");

-- CreateIndex
CREATE INDEX "ad_reports_uploadBatchId_idx" ON "ad_reports"("uploadBatchId");

-- CreateIndex
CREATE INDEX "ad_reports_adAccountId_reportType_idx" ON "ad_reports"("adAccountId", "reportType");

-- CreateIndex
CREATE INDEX "ad_reports_analyzeStatus_idx" ON "ad_reports"("analyzeStatus");

-- CreateIndex
CREATE INDEX "ad_recommendations_adReportId_idx" ON "ad_recommendations"("adReportId");

-- CreateIndex
CREATE INDEX "ad_recommendations_adAccountId_createdAt_idx" ON "ad_recommendations"("adAccountId", "createdAt");

-- AddForeignKey
ALTER TABLE "ad_accounts" ADD CONSTRAINT "ad_accounts_marketplaceId_fkey" FOREIGN KEY ("marketplaceId") REFERENCES "ad_marketplaces"("marketplaceId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_keywords" ADD CONSTRAINT "ad_keywords_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_keywords" ADD CONSTRAINT "ad_keywords_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_keywords" ADD CONSTRAINT "ad_keywords_recommendationId_fkey" FOREIGN KEY ("recommendationId") REFERENCES "ad_recommendations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_reports" ADD CONSTRAINT "ad_reports_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_recommendations" ADD CONSTRAINT "ad_recommendations_adAccountId_fkey" FOREIGN KEY ("adAccountId") REFERENCES "ad_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ad_recommendations" ADD CONSTRAINT "ad_recommendations_adReportId_fkey" FOREIGN KEY ("adReportId") REFERENCES "ad_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;
