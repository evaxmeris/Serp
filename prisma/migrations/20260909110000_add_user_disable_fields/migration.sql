-- 用户停用/启用功能（Arch: docs/user-disable-arch.md）
-- AlterTable: users 增加停用相关字段
ALTER TABLE "users" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "users" ADD COLUMN "disabledAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "disabledBy" TEXT;
ALTER TABLE "users" ADD COLUMN "disabledReason" TEXT;

-- CreateIndex
CREATE INDEX "users_isActive_idx" ON "users"("isActive");
