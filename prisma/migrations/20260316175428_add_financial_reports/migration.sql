-- CreateTable
CREATE TABLE "report_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "columns" JSONB NOT NULL DEFAULT '[]',
    "filters" JSONB NOT NULL DEFAULT '[]',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_data" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "metrics" JSONB NOT NULL DEFAULT '{}',
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_data_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_subscriptions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "format" TEXT NOT NULL DEFAULT 'pdf',
    "email" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSentAt" TIMESTAMP(3),
    "nextSendAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_export_logs" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "exportType" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "fileUrl" TEXT,
    "fileSize" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "report_export_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_code_key" ON "report_definitions"("code");

-- CreateIndex
CREATE INDEX "report_definitions_type_idx" ON "report_definitions"("type");

-- CreateIndex
CREATE INDEX "report_definitions_active_idx" ON "report_definitions"("isActive");

-- CreateIndex
CREATE INDEX "report_data_reportId_idx" ON "report_data"("reportId");

-- CreateIndex
CREATE INDEX "report_data_period_idx" ON "report_data"("period");

-- CreateIndex
CREATE INDEX "report_data_periodStart_periodEnd_idx" ON "report_data"("periodStart", "periodEnd");

-- CreateIndex
CREATE INDEX "report_subscriptions_reportId_idx" ON "report_subscriptions"("reportId");

-- CreateIndex
CREATE INDEX "report_subscriptions_userId_idx" ON "report_subscriptions"("userId");

-- CreateIndex
CREATE INDEX "report_subscriptions_active_idx" ON "report_subscriptions"("isActive");

-- CreateIndex
CREATE INDEX "report_export_logs_reportId_idx" ON "report_export_logs"("reportId");

-- CreateIndex
CREATE INDEX "report_export_logs_userId_idx" ON "report_export_logs"("userId");

-- CreateIndex
CREATE INDEX "report_export_logs_status_idx" ON "report_export_logs"("status");

-- CreateIndex
CREATE INDEX "report_schedules_reportId_idx" ON "report_schedules"("reportId");

-- CreateIndex
CREATE INDEX "report_schedules_active_idx" ON "report_schedules"("isActive");

-- AddForeignKey
ALTER TABLE "report_data" ADD CONSTRAINT "report_data_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
