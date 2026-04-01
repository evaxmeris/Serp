-- CreateEnum
CREATE TYPE "RoleEnum" AS ENUM ('ADMIN', 'MANAGER', 'USER', 'VIEWER');

-- CreateEnum
CREATE TYPE "CustomerStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('ACTIVE', 'DISCONTINUED', 'DEVELOPING');

-- CreateEnum
CREATE TYPE "InquiryStatus" AS ENUM ('NEW', 'CONTACTED', 'QUOTED', 'NEGOTIATING', 'WON', 'LOST');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');

-- CreateEnum
CREATE TYPE "FollowUpType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'MESSAGE', 'OTHER');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'SENT', 'VIEWED', 'ACCEPTED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'SHIPPED', 'DELIVERED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "ProductionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DELAYED');

-- CreateEnum
CREATE TYPE "ProductionRecordStatus" AS ENUM ('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'ON_HOLD', 'CANCELLED');

-- CreateEnum
CREATE TYPE "QualityCheckType" AS ENUM ('RAW_MATERIAL', 'IN_PROCESS', 'FINAL', 'PRE_SHIPMENT');

-- CreateEnum
CREATE TYPE "QualityCheckStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'PASSED', 'FAILED', 'CONDITIONAL');

-- CreateEnum
CREATE TYPE "ShipmentStatus" AS ENUM ('PENDING', 'BOOKED', 'IN_TRANSIT', 'SHIPPED', 'DELIVERED');

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BLACKLISTED', 'PENDING');

-- CreateEnum
CREATE TYPE "SupplierType" AS ENUM ('DOMESTIC', 'OVERSEAS');

-- CreateEnum
CREATE TYPE "SupplierLevel" AS ENUM ('STRATEGIC', 'PREFERRED', 'NORMAL', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('PENDING', 'CONFIRMED', 'IN_PRODUCTION', 'READY', 'RECEIVED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ReceiptStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN');

-- CreateEnum
CREATE TYPE "InboundType" AS ENUM ('PURCHASE_IN', 'RETURN_IN', 'ADJUSTMENT_IN', 'TRANSFER_IN', 'OTHER_IN');

-- CreateEnum
CREATE TYPE "InboundStatus" AS ENUM ('PENDING', 'PARTIAL', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WarehouseStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "InventoryLogType" AS ENUM ('IN', 'OUT', 'ADJUSTMENT', 'TRANSFER', 'RETURN');

-- CreateEnum
CREATE TYPE "AttributeType" AS ENUM ('TEXT', 'NUMBER', 'DECIMAL', 'BOOLEAN', 'DATE', 'SELECT', 'MULTI_SELECT', 'LONG_TEXT', 'URL', 'IMAGE', 'FILE');

-- CreateEnum
CREATE TYPE "ResearchStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "ComparisonStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'COMPLETED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('TODO', 'IN_PROGRESS', 'REVIEW', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "CompetitorType" AS ENUM ('DOMESTIC', 'OVERSEAS');

-- CreateEnum
CREATE TYPE "MarketResearchType" AS ENUM ('TREND', 'COMPETITOR', 'CUSTOMER', 'PRICE', 'TECHNOLOGY');

-- CreateEnum
CREATE TYPE "TrendDirection" AS ENUM ('GROWING', 'STABLE', 'DECLINING', 'VOLATILE');

-- CreateEnum
CREATE TYPE "RegStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PlatformType" AS ENUM ('ALIBABA', 'ALIBABA_1688', 'AMAZON', 'TIKTOK', 'SHOPIFY', 'WISH', 'EBAY', 'OTHER');

-- CreateEnum
CREATE TYPE "OverseasWarehouseType" AS ENUM ('FBA', 'FBN', 'SELF_OWNED', 'THIRD_PARTY');

-- CreateEnum
CREATE TYPE "ApprovalType" AS ENUM ('USER_REGISTRATION', 'ORDER_APPROVAL', 'PURCHASE_APPROVAL', 'PAYMENT_APPROVAL', 'EXPENSE_APPROVAL', 'PRICE_CHANGE', 'DISCOUNT_APPROVAL', 'CUSTOM');

-- CreateEnum
CREATE TYPE "ApprovalFlowStatus" AS ENUM ('DRAFT', 'ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "ApprovalRecordStatus" AS ENUM ('PENDING', 'APPROVING', 'APPROVED', 'REJECTED', 'CANCELLED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ApprovalAction" AS ENUM ('APPROVE', 'REJECT', 'TRANSFER', 'RETURN', 'CANCEL');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('CASH', 'BANK', 'ALIPAY', 'WECHAT', 'PAYPAL', 'CREDIT_CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('INCOME', 'EXPENSE', 'TRANSFER_IN', 'TRANSFER_OUT', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "TransactionStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('RENT', 'UTILITY', 'SALARY', 'BONUS', 'COMMISSION', 'MARKETING', 'ADVERTISING', 'LOGISTICS', 'WAREHOUSE', 'PACKAGING', 'PLATFORM_FEE', 'TAX', 'INSURANCE', 'TRAVEL', 'ENTERTAINMENT', 'OFFICE', 'COMMUNICATION', 'SOFTWARE', 'HARDWARE', 'REPAIR', 'LEGAL', 'FINANCIAL', 'OTHER');

-- CreateEnum
CREATE TYPE "ReimbursementStatus" AS ENUM ('DRAFT', 'PENDING', 'APPROVED', 'PAID', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ProfitCalculationStatus" AS ENUM ('DRAFT', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PerformanceRuleType" AS ENUM ('SALES_REVENUE', 'NET_PROFIT', 'ORDER_COUNT', 'NEW_CUSTOMER', 'TARGET_BONUS', 'CUSTOM');

-- CreateEnum
CREATE TYPE "CalculationMethod" AS ENUM ('FIXED_AMOUNT', 'PERCENTAGE', 'TIERED', 'COMMISSION_RATE');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('DRAFT', 'CALCULATED', 'PENDING_APPROVAL', 'APPROVED', 'PAID', 'CANCELLED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "role" "RoleEnum" NOT NULL DEFAULT 'USER',
    "avatar" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "country" TEXT,
    "address" TEXT,
    "website" TEXT,
    "source" TEXT,
    "status" "CustomerStatus" NOT NULL DEFAULT 'ACTIVE',
    "creditLevel" TEXT,
    "notes" TEXT,
    "ownerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_contacts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "position" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "category" TEXT,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "costPrice" DECIMAL(10,2) NOT NULL,
    "salePrice" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "images" TEXT[],
    "description" TEXT,
    "descriptionEn" TEXT,
    "weight" DECIMAL(10,2),
    "volume" DECIMAL(10,2),
    "moq" INTEGER,
    "leadTime" INTEGER,
    "status" "ProductStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiries" (
    "id" TEXT NOT NULL,
    "inquiryNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "source" TEXT,
    "status" "InquiryStatus" NOT NULL DEFAULT 'NEW',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "products" TEXT,
    "quantity" INTEGER,
    "targetPrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "requirements" TEXT,
    "deadline" TIMESTAMP(3),
    "assignedTo" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "follow_ups" (
    "id" TEXT NOT NULL,
    "inquiryId" TEXT NOT NULL,
    "type" "FollowUpType" NOT NULL DEFAULT 'CALL',
    "content" TEXT NOT NULL,
    "nextFollowUp" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "follow_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "inquiryId" TEXT,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentTerms" TEXT,
    "deliveryTerms" TEXT,
    "validityDays" INTEGER,
    "notes" TEXT,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "specification" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "orderNo" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sourceInquiryId" TEXT,
    "sourceQuotationId" TEXT,
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentTerms" TEXT,
    "paymentDeadline" TIMESTAMP(3),
    "deliveryTerms" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "deliveryDeadline" TIMESTAMP(3),
    "shippingAddress" TEXT,
    "shippingContact" TEXT,
    "shippingPhone" TEXT,
    "salesRepId" TEXT,
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "notes" TEXT,
    "internalNotes" TEXT,
    "attachments" TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "order_items" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "specification" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "productionStatus" "ProductionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "productionNote" TEXT,
    "estimatedProductionDate" TIMESTAMP(3),
    "actualProductionDate" TIMESTAMP(3),
    "shippedQty" INTEGER NOT NULL DEFAULT 0,
    "deliveredQty" INTEGER NOT NULL DEFAULT 0,
    "productImage" TEXT,
    "productWeight" DECIMAL(10,2),
    "productVolume" DECIMAL(10,2),
    "hsCode" TEXT,
    "originCountry" TEXT DEFAULT 'CN',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "production_records" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productionNo" TEXT NOT NULL,
    "productId" TEXT,
    "quantity" INTEGER NOT NULL,
    "plannedStartDate" TIMESTAMP(3) NOT NULL,
    "plannedEndDate" TIMESTAMP(3) NOT NULL,
    "actualStartDate" TIMESTAMP(3),
    "actualEndDate" TIMESTAMP(3),
    "status" "ProductionRecordStatus" NOT NULL DEFAULT 'PLANNED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "department" TEXT,
    "factory" TEXT,
    "supervisor" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "production_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_checks" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "qcNo" TEXT NOT NULL,
    "type" "QualityCheckType" NOT NULL DEFAULT 'FINAL',
    "inspector" TEXT,
    "inspectionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "passRate" DECIMAL(5,2),
    "defectCount" INTEGER DEFAULT 0,
    "defectReasons" TEXT[],
    "photos" TEXT[],
    "report" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quality_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quality_check_items" (
    "id" TEXT NOT NULL,
    "qualityCheckId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "standard" TEXT,
    "result" TEXT,
    "passed" BOOLEAN NOT NULL,

    CONSTRAINT "quality_check_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "paymentMethod" TEXT,
    "paymentDate" TIMESTAMP(3),
    "bankReference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "shipmentNo" TEXT NOT NULL,
    "carrier" TEXT,
    "trackingNo" TEXT,
    "etd" TIMESTAMP(3),
    "eta" TIMESTAMP(3),
    "portOfLoading" TEXT,
    "portOfDischarge" TEXT,
    "containerNo" TEXT,
    "sealNo" TEXT,
    "packages" INTEGER,
    "grossWeight" DECIMAL(10,2),
    "volume" DECIMAL(10,2),
    "status" "ShipmentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "supplierNo" TEXT NOT NULL,
    "companyName" TEXT NOT NULL,
    "companyEn" TEXT,
    "contactName" TEXT,
    "contactTitle" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "fax" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'CN',
    "postalCode" TEXT,
    "website" TEXT,
    "taxId" TEXT,
    "businessLicense" TEXT,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankCode" TEXT,
    "products" TEXT,
    "categories" TEXT[],
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "type" "SupplierType" NOT NULL DEFAULT 'DOMESTIC',
    "level" "SupplierLevel" NOT NULL DEFAULT 'NORMAL',
    "score" DECIMAL(3,2),
    "creditTerms" TEXT,
    "paymentMethods" TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "minOrderAmount" DECIMAL(12,2),
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "lastOrderDate" TIMESTAMP(3),
    "ownerId" TEXT,
    "notes" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "wechat" TEXT,
    "qq" TEXT,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "evaluationDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatorId" TEXT,
    "period" TEXT NOT NULL,
    "qualityScore" DECIMAL(2,1) NOT NULL,
    "deliveryScore" DECIMAL(2,1) NOT NULL,
    "priceScore" DECIMAL(2,1) NOT NULL,
    "serviceScore" DECIMAL(2,1) NOT NULL,
    "totalScore" DECIMAL(3,2) NOT NULL,
    "level" "SupplierLevel" NOT NULL,
    "comments" TEXT,
    "improvementPlan" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "salesOrderId" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "approvalStatus" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "deliveryDate" TIMESTAMP(3),
    "deliveryDeadline" TIMESTAMP(3),
    "deliveryAddress" TEXT,
    "shippingMethod" TEXT,
    "paymentTerms" TEXT,
    "paymentDeadline" TIMESTAMP(3),
    "purchaserId" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "attachments" TEXT[],
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "cancelReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "productName" TEXT NOT NULL,
    "productSku" TEXT,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discountRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "taxRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "pendingQty" INTEGER NOT NULL DEFAULT 0,
    "expectedDeliveryDate" TIMESTAMP(3),
    "actualDeliveryDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "receiptNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "receiptDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receiptBy" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "qualityCheckId" TEXT,
    "qualityStatus" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "acceptedQty" INTEGER NOT NULL DEFAULT 0,
    "rejectedQty" INTEGER NOT NULL DEFAULT 0,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "paymentNo" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "paymentMethod" TEXT,
    "paymentDate" TIMESTAMP(3),
    "bankName" TEXT,
    "bankAccount" TEXT,
    "bankReference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "attachments" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_items" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "minStock" INTEGER,
    "maxStock" INTEGER,
    "location" TEXT,
    "lastInboundDate" TIMESTAMP(3),
    "lastOutboundDate" TIMESTAMP(3),
    "lastCountedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inventory_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_movements" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "type" "MovementType" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_orders" (
    "id" TEXT NOT NULL,
    "inboundNo" TEXT NOT NULL,
    "type" "InboundType" NOT NULL DEFAULT 'PURCHASE_IN',
    "status" "InboundStatus" NOT NULL DEFAULT 'PENDING',
    "purchaseOrderId" TEXT,
    "supplierId" TEXT,
    "warehouseId" TEXT,
    "expectedDate" TIMESTAMP(3),
    "actualDate" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_order_items" (
    "id" TEXT NOT NULL,
    "inboundOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "expectedQuantity" INTEGER NOT NULL,
    "actualQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "batchNo" TEXT,
    "productionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),

    CONSTRAINT "inbound_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "inboundOrderId" TEXT,
    "outboundOrderId" TEXT,
    "type" "InventoryLogType" NOT NULL DEFAULT 'IN',
    "quantity" INTEGER NOT NULL,
    "beforeQuantity" INTEGER NOT NULL,
    "afterQuantity" INTEGER NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "manager" TEXT,
    "phone" TEXT,
    "status" "WarehouseStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "code" TEXT NOT NULL,
    "parentId" TEXT,
    "level" INTEGER NOT NULL DEFAULT 1,
    "path" TEXT,
    "description" TEXT,
    "icon" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attribute_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "code" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "type" "AttributeType" NOT NULL DEFAULT 'TEXT',
    "unit" TEXT,
    "options" TEXT[],
    "isRequired" BOOLEAN NOT NULL DEFAULT false,
    "isComparable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "validationRule" TEXT,
    "defaultValue" TEXT,
    "placeholder" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attribute_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_research" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "nameEn" TEXT,
    "categoryId" TEXT NOT NULL,
    "brand" TEXT,
    "brandEn" TEXT,
    "model" TEXT,
    "manufacturer" TEXT,
    "manufacturerEn" TEXT,
    "originCountry" TEXT DEFAULT 'CN',
    "sourceUrl" TEXT,
    "sourcePlatform" TEXT,
    "mainImage" TEXT,
    "images" TEXT[],
    "status" "ResearchStatus" NOT NULL DEFAULT 'DRAFT',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "assignedTo" TEXT,
    "tags" TEXT[],
    "notes" TEXT,
    "conclusion" TEXT,
    "rating" DECIMAL(2,1),
    "costPrice" DECIMAL(10,2),
    "salePrice" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "moq" INTEGER,
    "leadTime" INTEGER,
    "specification" TEXT,
    "weight" DECIMAL(10,2),
    "volume" DECIMAL(10,2),
    "dimensions" TEXT,
    "researchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "researchTaskId" TEXT,

    CONSTRAINT "product_research_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_attribute_values" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "attributeId" TEXT NOT NULL,
    "valueText" TEXT,
    "valueNumber" DECIMAL(20,4),
    "valueBoolean" BOOLEAN,
    "valueDate" TIMESTAMP(3),
    "valueOptions" TEXT[],
    "unit" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_attribute_values_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_comparisons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "comparedBy" TEXT,
    "status" "ComparisonStatus" NOT NULL DEFAULT 'DRAFT',
    "attributes" TEXT[],
    "highlightDiff" BOOLEAN NOT NULL DEFAULT true,
    "summary" TEXT,
    "recommendation" TEXT,
    "rating" DECIMAL(2,1),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "productResearchId" TEXT,

    CONSTRAINT "product_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_comparison_items" (
    "id" TEXT NOT NULL,
    "comparisonId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isRecommended" BOOLEAN NOT NULL DEFAULT false,
    "score" DECIMAL(3,1),
    "pros" TEXT[],
    "cons" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_comparison_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_tasks" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "categoryId" TEXT,
    "assignedTo" TEXT NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'TODO',
    "priority" "Priority" NOT NULL DEFAULT 'MEDIUM',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "targetProducts" INTEGER,
    "requirements" TEXT,
    "budgetRange" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competitor_analyses" (
    "id" TEXT NOT NULL,
    "competitorName" TEXT NOT NULL,
    "competitorNameEn" TEXT,
    "website" TEXT,
    "country" TEXT DEFAULT 'CN',
    "type" "CompetitorType" NOT NULL DEFAULT 'DOMESTIC',
    "productName" TEXT NOT NULL,
    "productModel" TEXT,
    "category" TEXT,
    "price" DECIMAL(10,2),
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "specifications" JSONB,
    "features" TEXT[],
    "images" TEXT[],
    "strengths" TEXT[],
    "weaknesses" TEXT[],
    "marketShare" TEXT,
    "targetCustomer" TEXT,
    "vsOurProduct" TEXT,
    "suggestion" TEXT,
    "analyzedBy" TEXT,
    "analyzedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competitor_analyses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "market_researches" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT,
    "type" "MarketResearchType" NOT NULL DEFAULT 'TREND',
    "marketSize" TEXT,
    "growthRate" TEXT,
    "trendDirection" "TrendDirection" NOT NULL DEFAULT 'STABLE',
    "summary" TEXT,
    "content" TEXT,
    "sources" TEXT[],
    "attachments" TEXT[],
    "researchPeriod" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_researches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "research_attachments" (
    "id" TEXT NOT NULL,
    "productId" TEXT,
    "taskId" TEXT,
    "comparisonId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "fileType" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "url" TEXT NOT NULL,
    "thumbnailUrl" TEXT,
    "description" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "research_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_orders" (
    "id" TEXT NOT NULL,
    "outboundNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "shipmentId" TEXT,

    CONSTRAINT "outbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outbound_order_items" (
    "id" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "outbound_order_items_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "id" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_registrations" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "department" TEXT,
    "position" TEXT,
    "status" "RegStatus" NOT NULL DEFAULT 'PENDING',
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_accounts" (
    "id" TEXT NOT NULL,
    "platformType" "PlatformType" NOT NULL,
    "platformName" TEXT NOT NULL,
    "accountName" TEXT NOT NULL,
    "accountId" TEXT,
    "shopId" TEXT,
    "clientId" TEXT,
    "clientSecret" TEXT,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "apiKey" TEXT,
    "apiSecret" TEXT,
    "authCode" TEXT,
    "region" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastSyncAt" TIMESTAMP(3),
    "syncStatus" TEXT,
    "errorMessage" TEXT,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_orders" (
    "id" TEXT NOT NULL,
    "platformOrderId" TEXT NOT NULL,
    "platformOrderSn" TEXT,
    "platformAccountId" TEXT NOT NULL,
    "platformType" "PlatformType" NOT NULL,
    "sellerId" TEXT,
    "buyerId" TEXT,
    "buyerName" TEXT,
    "buyerEmail" TEXT,
    "buyerPhone" TEXT,
    "status" TEXT NOT NULL,
    "paymentStatus" TEXT,
    "fulfillmentStatus" TEXT,
    "orderDate" TIMESTAMP(3),
    "paymentDate" TIMESTAMP(3),
    "shipmentDate" TIMESTAMP(3),
    "deliveryDate" TIMESTAMP(3),
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "subtotal" DECIMAL(12,2),
    "shippingFee" DECIMAL(10,2),
    "platformFee" DECIMAL(10,2),
    "commissionFee" DECIMAL(10,2),
    "tax" DECIMAL(10,2),
    "discount" DECIMAL(10,2),
    "coupon" DECIMAL(10,2),
    "shippingAddress" JSONB,
    "billingAddress" JSONB,
    "buyerMessage" TEXT,
    "notes" TEXT,
    "internalOrderId" TEXT,
    "items" JSONB NOT NULL DEFAULT '[]',
    "tags" TEXT[],
    "syncVersion" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overseas_warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "OverseasWarehouseType" NOT NULL,
    "country" TEXT NOT NULL,
    "province" TEXT,
    "city" TEXT,
    "address" TEXT NOT NULL,
    "postcode" TEXT,
    "contactName" TEXT,
    "contactPhone" TEXT,
    "email" TEXT,
    "warehouseId" TEXT,
    "region" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "apiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "apiKey" TEXT,
    "apiUrl" TEXT,
    "fbaSyncEnabled" BOOLEAN NOT NULL DEFAULT false,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overseas_warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "overseas_inventory" (
    "id" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "fnsku" TEXT,
    "asin" TEXT,
    "availableQty" INTEGER NOT NULL DEFAULT 0,
    "inboundQty" INTEGER NOT NULL DEFAULT 0,
    "reservedQty" INTEGER NOT NULL DEFAULT 0,
    "totalQty" INTEGER NOT NULL DEFAULT 0,
    "lastFulfillableQty" INTEGER,
    "costPerUnit" DECIMAL(10,2),
    "location" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "updatedAtSource" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "overseas_inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_flows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "description" TEXT,
    "config" JSONB NOT NULL DEFAULT '{}',
    "isActive" "ApprovalFlowStatus" NOT NULL DEFAULT 'ACTIVE',
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_flows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_records" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "flowCode" TEXT,
    "title" TEXT NOT NULL,
    "type" "ApprovalType" NOT NULL,
    "businessId" TEXT NOT NULL,
    "businessType" TEXT NOT NULL,
    "status" "ApprovalRecordStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL DEFAULT 1,
    "initiatorId" TEXT NOT NULL,
    "approverId" TEXT,
    "initiatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "comments" TEXT,

    CONSTRAINT "approval_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "approval_history" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "step" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "action" "ApprovalAction" NOT NULL,
    "comments" TEXT,
    "actionAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "approval_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "AccountType" NOT NULL,
    "accountNumber" TEXT,
    "bankName" TEXT,
    "branchName" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "currentBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "transactionNo" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "amountCny" DECIMAL(14,2) NOT NULL,
    "counterParty" TEXT,
    "counterPartyAccount" TEXT,
    "description" TEXT,
    "category" TEXT,
    "businessType" TEXT,
    "businessId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "status" "TransactionStatus" NOT NULL DEFAULT 'CONFIRMED',
    "receiptUrl" TEXT,
    "notes" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseNo" TEXT NOT NULL,
    "applicantId" TEXT NOT NULL,
    "department" TEXT,
    "category" "ExpenseCategory" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "description" TEXT NOT NULL,
    "receiptCount" INTEGER NOT NULL DEFAULT 0,
    "receiptUrls" TEXT[],
    "expenseDate" TIMESTAMP(3) NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'DRAFT',
    "approvalId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "accountId" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reimbursements" (
    "id" TEXT NOT NULL,
    "reimbursementNo" TEXT NOT NULL,
    "expenseIds" TEXT[],
    "applicantId" TEXT NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "ReimbursementStatus" NOT NULL DEFAULT 'DRAFT',
    "description" TEXT,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "accountId" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reimbursements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_calculations" (
    "id" TEXT NOT NULL,
    "calculationNo" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "periodType" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "ProfitCalculationStatus" NOT NULL DEFAULT 'DRAFT',
    "totalRevenue" DECIMAL(14,2) NOT NULL,
    "totalCost" DECIMAL(14,2) NOT NULL,
    "totalExpense" DECIMAL(14,2) NOT NULL,
    "totalProfit" DECIMAL(14,2) NOT NULL,
    "netProfit" DECIMAL(14,2) NOT NULL,
    "profitMargin" DECIMAL(5,2),
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "platformStats" JSONB NOT NULL DEFAULT '{}',
    "calculatedBy" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "profit_calculations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "profit_details" (
    "id" TEXT NOT NULL,
    "calculationId" TEXT NOT NULL,
    "orderId" TEXT,
    "platformOrderId" TEXT,
    "productId" TEXT,
    "sku" TEXT,
    "platformType" "PlatformType",
    "platformAccountId" TEXT,
    "salesRepId" TEXT,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "exchangeRate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "salesAmount" DECIMAL(12,2) NOT NULL,
    "shippingIncome" DECIMAL(10,2),
    "totalIncome" DECIMAL(12,2) NOT NULL,
    "productCost" DECIMAL(12,2) NOT NULL,
    "shippingCost" DECIMAL(10,2),
    "internationalShipping" DECIMAL(10,2),
    "warehouseCost" DECIMAL(10,2),
    "packagingCost" DECIMAL(10,2),
    "platformFee" DECIMAL(10,2),
    "paymentFee" DECIMAL(10,2),
    "adFee" DECIMAL(10,2),
    "tax" DECIMAL(10,2),
    "otherFees" DECIMAL(10,2),
    "totalCost" DECIMAL(12,2) NOT NULL,
    "grossProfit" DECIMAL(12,2) NOT NULL,
    "netProfit" DECIMAL(12,2) NOT NULL,
    "profitMargin" DECIMAL(5,2),
    "totalIncomeCny" DECIMAL(12,2) NOT NULL,
    "totalCostCny" DECIMAL(12,2) NOT NULL,
    "netProfitCny" DECIMAL(12,2) NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "tags" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "commissionId" TEXT,

    CONSTRAINT "profit_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "PerformanceRuleType" NOT NULL,
    "calculationMethod" "CalculationMethod" NOT NULL,
    "department" TEXT,
    "position" TEXT,
    "targetUserType" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "baseFormula" TEXT,
    "tierConfig" JSONB NOT NULL DEFAULT '[]',
    "conditionConfig" JSONB NOT NULL DEFAULT '{}',
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "performance_metrics" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "periodStart" TIMESTAMP(3) NOT NULL,
    "periodEnd" TIMESTAMP(3) NOT NULL,
    "salesAmount" DECIMAL(14,2) NOT NULL,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "newCustomers" INTEGER NOT NULL DEFAULT 0,
    "grossProfit" DECIMAL(14,2) NOT NULL,
    "netProfit" DECIMAL(14,2) NOT NULL,
    "targetAmount" DECIMAL(14,2),
    "achievement" DECIMAL(5,2),
    "score" DECIMAL(5,2),
    "calculatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "performance_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commissions" (
    "id" TEXT NOT NULL,
    "commissionNo" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'DRAFT',
    "ruleId" TEXT,
    "salesCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "profitCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "otherBonus" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "adjustment" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalCommission" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSales" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "totalProfit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "orderCount" INTEGER NOT NULL DEFAULT 0,
    "approvedById" TEXT,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "accountId" TEXT,
    "transactionId" TEXT,
    "notes" TEXT,
    "details" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_ReimbursementExpenses" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_ReimbursementExpenses_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "customers_status_createdAt_idx" ON "customers"("status", "createdAt");

-- CreateIndex
CREATE INDEX "customers_ownerId_idx" ON "customers"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "inquiries_inquiryNo_key" ON "inquiries"("inquiryNo");

-- CreateIndex
CREATE INDEX "inquiries_assignedTo_status_idx" ON "inquiries"("assignedTo", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationNo_key" ON "quotations"("quotationNo");

-- CreateIndex
CREATE UNIQUE INDEX "orders_orderNo_key" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "orders_customerId_status_idx" ON "orders"("customerId", "status");

-- CreateIndex
CREATE INDEX "orders_salesRepId_createdAt_idx" ON "orders"("salesRepId", "createdAt");

-- CreateIndex
CREATE INDEX "orders_status_deliveryDate_idx" ON "orders"("status", "deliveryDate");

-- CreateIndex
CREATE INDEX "orders_createdAt_idx" ON "orders"("createdAt");

-- CreateIndex
CREATE INDEX "orders_orderNo_idx" ON "orders"("orderNo");

-- CreateIndex
CREATE INDEX "order_items_orderId_idx" ON "order_items"("orderId");

-- CreateIndex
CREATE INDEX "order_items_productId_idx" ON "order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "production_records_productionNo_key" ON "production_records"("productionNo");

-- CreateIndex
CREATE INDEX "production_records_orderId_idx" ON "production_records"("orderId");

-- CreateIndex
CREATE INDEX "production_records_status_idx" ON "production_records"("status");

-- CreateIndex
CREATE UNIQUE INDEX "quality_checks_qcNo_key" ON "quality_checks"("qcNo");

-- CreateIndex
CREATE INDEX "quality_checks_orderId_idx" ON "quality_checks"("orderId");

-- CreateIndex
CREATE INDEX "quality_checks_status_idx" ON "quality_checks"("status");

-- CreateIndex
CREATE UNIQUE INDEX "payments_paymentNo_key" ON "payments"("paymentNo");

-- CreateIndex
CREATE UNIQUE INDEX "shipments_shipmentNo_key" ON "shipments"("shipmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplierNo_key" ON "suppliers"("supplierNo");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "suppliers_companyName_idx" ON "suppliers"("companyName");

-- CreateIndex
CREATE INDEX "suppliers_ownerId_idx" ON "suppliers"("ownerId");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplierId_idx" ON "supplier_contacts"("supplierId");

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplierId_period_idx" ON "supplier_evaluations"("supplierId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_poNo_key" ON "purchase_orders"("poNo");

-- CreateIndex
CREATE INDEX "purchase_orders_supplierId_status_idx" ON "purchase_orders"("supplierId", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_salesOrderId_idx" ON "purchase_orders"("salesOrderId");

-- CreateIndex
CREATE INDEX "purchase_orders_status_deliveryDate_idx" ON "purchase_orders"("status", "deliveryDate");

-- CreateIndex
CREATE INDEX "purchase_orders_createdAt_idx" ON "purchase_orders"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchaseOrderId_idx" ON "purchase_order_items"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_order_items_productId_idx" ON "purchase_order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_receiptNo_key" ON "purchase_receipts"("receiptNo");

-- CreateIndex
CREATE INDEX "purchase_receipts_purchaseOrderId_idx" ON "purchase_receipts"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "purchase_receipts_warehouse_idx" ON "purchase_receipts"("warehouse");

-- CreateIndex
CREATE INDEX "purchase_receipts_receiptDate_idx" ON "purchase_receipts"("receiptDate");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_receiptId_idx" ON "purchase_receipt_items"("receiptId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_paymentNo_key" ON "supplier_payments"("paymentNo");

-- CreateIndex
CREATE INDEX "supplier_payments_purchaseOrderId_idx" ON "supplier_payments"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "supplier_payments_paymentDate_idx" ON "supplier_payments"("paymentDate");

-- CreateIndex
CREATE INDEX "inventory_items_warehouse_idx" ON "inventory_items"("warehouse");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_items_productId_warehouse_key" ON "inventory_items"("productId", "warehouse");

-- CreateIndex
CREATE INDEX "stock_movements_productId_createdAt_idx" ON "stock_movements"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "stock_movements_type_createdAt_idx" ON "stock_movements"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "inbound_orders_inboundNo_key" ON "inbound_orders"("inboundNo");

-- CreateIndex
CREATE INDEX "inbound_orders_status_idx" ON "inbound_orders"("status");

-- CreateIndex
CREATE INDEX "inbound_orders_warehouseId_status_idx" ON "inbound_orders"("warehouseId", "status");

-- CreateIndex
CREATE INDEX "inbound_orders_createdAt_idx" ON "inbound_orders"("createdAt");

-- CreateIndex
CREATE INDEX "inbound_order_items_inboundOrderId_idx" ON "inbound_order_items"("inboundOrderId");

-- CreateIndex
CREATE INDEX "inbound_order_items_productId_idx" ON "inbound_order_items"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_createdAt_idx" ON "inventory_logs"("createdAt");

-- CreateIndex
CREATE INDEX "inventory_logs_inboundOrderId_idx" ON "inventory_logs"("inboundOrderId");

-- CreateIndex
CREATE INDEX "inventory_logs_outboundOrderId_idx" ON "inventory_logs"("outboundOrderId");

-- CreateIndex
CREATE INDEX "inventory_logs_productId_idx" ON "inventory_logs"("productId");

-- CreateIndex
CREATE INDEX "inventory_logs_type_idx" ON "inventory_logs"("type");

-- CreateIndex
CREATE INDEX "inventory_logs_warehouseId_idx" ON "inventory_logs"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_code_key" ON "warehouses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_code_key" ON "product_categories"("code");

-- CreateIndex
CREATE INDEX "product_categories_parentId_idx" ON "product_categories"("parentId");

-- CreateIndex
CREATE INDEX "product_categories_code_idx" ON "product_categories"("code");

-- CreateIndex
CREATE INDEX "product_categories_isActive_idx" ON "product_categories"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "attribute_templates_code_key" ON "attribute_templates"("code");

-- CreateIndex
CREATE INDEX "attribute_templates_categoryId_idx" ON "attribute_templates"("categoryId");

-- CreateIndex
CREATE INDEX "attribute_templates_code_idx" ON "attribute_templates"("code");

-- CreateIndex
CREATE INDEX "attribute_templates_type_idx" ON "attribute_templates"("type");

-- CreateIndex
CREATE INDEX "attribute_templates_isActive_idx" ON "attribute_templates"("isActive");

-- CreateIndex
CREATE INDEX "product_research_categoryId_idx" ON "product_research"("categoryId");

-- CreateIndex
CREATE INDEX "product_research_status_idx" ON "product_research"("status");

-- CreateIndex
CREATE INDEX "product_research_assignedTo_idx" ON "product_research"("assignedTo");

-- CreateIndex
CREATE INDEX "product_research_createdAt_idx" ON "product_research"("createdAt");

-- CreateIndex
CREATE INDEX "product_research_brand_idx" ON "product_research"("brand");

-- CreateIndex
CREATE INDEX "product_attribute_values_productId_idx" ON "product_attribute_values"("productId");

-- CreateIndex
CREATE INDEX "product_attribute_values_attributeId_idx" ON "product_attribute_values"("attributeId");

-- CreateIndex
CREATE UNIQUE INDEX "product_attribute_values_productId_attributeId_key" ON "product_attribute_values"("productId", "attributeId");

-- CreateIndex
CREATE INDEX "product_comparisons_categoryId_idx" ON "product_comparisons"("categoryId");

-- CreateIndex
CREATE INDEX "product_comparisons_status_idx" ON "product_comparisons"("status");

-- CreateIndex
CREATE INDEX "product_comparisons_comparedBy_idx" ON "product_comparisons"("comparedBy");

-- CreateIndex
CREATE INDEX "product_comparison_items_comparisonId_idx" ON "product_comparison_items"("comparisonId");

-- CreateIndex
CREATE INDEX "product_comparison_items_productId_idx" ON "product_comparison_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_comparison_items_comparisonId_productId_key" ON "product_comparison_items"("comparisonId", "productId");

-- CreateIndex
CREATE INDEX "research_tasks_assignedTo_idx" ON "research_tasks"("assignedTo");

-- CreateIndex
CREATE INDEX "research_tasks_status_idx" ON "research_tasks"("status");

-- CreateIndex
CREATE INDEX "research_tasks_dueDate_idx" ON "research_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "competitor_analyses_competitorName_idx" ON "competitor_analyses"("competitorName");

-- CreateIndex
CREATE INDEX "competitor_analyses_type_idx" ON "competitor_analyses"("type");

-- CreateIndex
CREATE INDEX "competitor_analyses_analyzedAt_idx" ON "competitor_analyses"("analyzedAt");

-- CreateIndex
CREATE INDEX "market_researches_categoryId_idx" ON "market_researches"("categoryId");

-- CreateIndex
CREATE INDEX "market_researches_type_idx" ON "market_researches"("type");

-- CreateIndex
CREATE INDEX "market_researches_publishedAt_idx" ON "market_researches"("publishedAt");

-- CreateIndex
CREATE INDEX "research_attachments_productId_idx" ON "research_attachments"("productId");

-- CreateIndex
CREATE INDEX "research_attachments_taskId_idx" ON "research_attachments"("taskId");

-- CreateIndex
CREATE INDEX "research_attachments_comparisonId_idx" ON "research_attachments"("comparisonId");

-- CreateIndex
CREATE INDEX "research_attachments_fileType_idx" ON "research_attachments"("fileType");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_orders_outboundNo_key" ON "outbound_orders"("outboundNo");

-- CreateIndex
CREATE INDEX "outbound_orders_orderId_idx" ON "outbound_orders"("orderId");

-- CreateIndex
CREATE INDEX "outbound_orders_status_idx" ON "outbound_orders"("status");

-- CreateIndex
CREATE INDEX "outbound_orders_createdAt_idx" ON "outbound_orders"("createdAt");

-- CreateIndex
CREATE INDEX "outbound_order_items_outboundOrderId_idx" ON "outbound_order_items"("outboundOrderId");

-- CreateIndex
CREATE INDEX "outbound_order_items_productId_idx" ON "outbound_order_items"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "report_definitions_code_key" ON "report_definitions"("code");

-- CreateIndex
CREATE INDEX "report_definitions_type_idx" ON "report_definitions"("type");

-- CreateIndex
CREATE INDEX "report_definitions_isActive_idx" ON "report_definitions"("isActive");

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
CREATE INDEX "report_subscriptions_isActive_idx" ON "report_subscriptions"("isActive");

-- CreateIndex
CREATE INDEX "report_export_logs_reportId_idx" ON "report_export_logs"("reportId");

-- CreateIndex
CREATE INDEX "report_export_logs_userId_idx" ON "report_export_logs"("userId");

-- CreateIndex
CREATE INDEX "report_export_logs_status_idx" ON "report_export_logs"("status");

-- CreateIndex
CREATE INDEX "report_schedules_reportId_idx" ON "report_schedules"("reportId");

-- CreateIndex
CREATE INDEX "report_schedules_isActive_idx" ON "report_schedules"("isActive");

-- CreateIndex
CREATE INDEX "permissions_module_isActive_idx" ON "permissions"("module", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "permissions"("name");

-- CreateIndex
CREATE INDEX "roles_isActive_idx" ON "roles"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "roles"("name");

-- CreateIndex
CREATE INDEX "user_roles_userId_idx" ON "user_roles"("userId");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "user_roles_userId_roleId_key" ON "user_roles"("userId", "roleId");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "role_permissions_roleId_permissionId_key" ON "role_permissions"("roleId", "permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "user_registrations_email_key" ON "user_registrations"("email");

-- CreateIndex
CREATE INDEX "user_registrations_status_idx" ON "user_registrations"("status");

-- CreateIndex
CREATE INDEX "user_registrations_email_idx" ON "user_registrations"("email");

-- CreateIndex
CREATE INDEX "user_registrations_createdAt_idx" ON "user_registrations"("createdAt");

-- CreateIndex
CREATE INDEX "platform_accounts_platformType_isActive_idx" ON "platform_accounts"("platformType", "isActive");

-- CreateIndex
CREATE INDEX "platform_accounts_userId_idx" ON "platform_accounts"("userId");

-- CreateIndex
CREATE INDEX "platform_accounts_accountId_idx" ON "platform_accounts"("accountId");

-- CreateIndex
CREATE INDEX "platform_accounts_shopId_idx" ON "platform_accounts"("shopId");

-- CreateIndex
CREATE INDEX "platform_orders_platformAccountId_orderDate_idx" ON "platform_orders"("platformAccountId", "orderDate");

-- CreateIndex
CREATE INDEX "platform_orders_platformType_status_idx" ON "platform_orders"("platformType", "status");

-- CreateIndex
CREATE INDEX "platform_orders_internalOrderId_idx" ON "platform_orders"("internalOrderId");

-- CreateIndex
CREATE INDEX "platform_orders_orderDate_idx" ON "platform_orders"("orderDate");

-- CreateIndex
CREATE UNIQUE INDEX "platform_orders_platformOrderId_platformAccountId_key" ON "platform_orders"("platformOrderId", "platformAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "overseas_warehouses_code_key" ON "overseas_warehouses"("code");

-- CreateIndex
CREATE INDEX "overseas_warehouses_type_country_isActive_idx" ON "overseas_warehouses"("type", "country", "isActive");

-- CreateIndex
CREATE INDEX "overseas_warehouses_code_idx" ON "overseas_warehouses"("code");

-- CreateIndex
CREATE INDEX "overseas_inventory_warehouseId_idx" ON "overseas_inventory"("warehouseId");

-- CreateIndex
CREATE INDEX "overseas_inventory_sku_idx" ON "overseas_inventory"("sku");

-- CreateIndex
CREATE INDEX "overseas_inventory_fnsku_idx" ON "overseas_inventory"("fnsku");

-- CreateIndex
CREATE INDEX "overseas_inventory_asin_idx" ON "overseas_inventory"("asin");

-- CreateIndex
CREATE UNIQUE INDEX "overseas_inventory_warehouseId_productId_key" ON "overseas_inventory"("warehouseId", "productId");

-- CreateIndex
CREATE INDEX "approval_flows_type_isActive_idx" ON "approval_flows"("type", "isActive");

-- CreateIndex
CREATE INDEX "approval_records_flowId_idx" ON "approval_records"("flowId");

-- CreateIndex
CREATE INDEX "approval_records_status_idx" ON "approval_records"("status");

-- CreateIndex
CREATE INDEX "approval_records_initiatorId_idx" ON "approval_records"("initiatorId");

-- CreateIndex
CREATE INDEX "approval_records_approverId_idx" ON "approval_records"("approverId");

-- CreateIndex
CREATE INDEX "approval_records_businessId_businessType_idx" ON "approval_records"("businessId", "businessType");

-- CreateIndex
CREATE INDEX "approval_records_initiatedAt_idx" ON "approval_records"("initiatedAt");

-- CreateIndex
CREATE INDEX "approval_history_recordId_idx" ON "approval_history"("recordId");

-- CreateIndex
CREATE INDEX "approval_history_approverId_idx" ON "approval_history"("approverId");

-- CreateIndex
CREATE INDEX "approval_history_actionAt_idx" ON "approval_history"("actionAt");

-- CreateIndex
CREATE INDEX "accounts_type_isActive_idx" ON "accounts"("type", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_transactionNo_key" ON "transactions"("transactionNo");

-- CreateIndex
CREATE INDEX "transactions_accountId_transactionDate_idx" ON "transactions"("accountId", "transactionDate");

-- CreateIndex
CREATE INDEX "transactions_type_category_idx" ON "transactions"("type", "category");

-- CreateIndex
CREATE INDEX "transactions_businessType_businessId_idx" ON "transactions"("businessType", "businessId");

-- CreateIndex
CREATE INDEX "transactions_transactionDate_idx" ON "transactions"("transactionDate");

-- CreateIndex
CREATE INDEX "transactions_status_idx" ON "transactions"("status");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_expenseNo_key" ON "expenses"("expenseNo");

-- CreateIndex
CREATE INDEX "expenses_applicantId_status_idx" ON "expenses"("applicantId", "status");

-- CreateIndex
CREATE INDEX "expenses_category_idx" ON "expenses"("category");

-- CreateIndex
CREATE INDEX "expenses_expenseDate_idx" ON "expenses"("expenseDate");

-- CreateIndex
CREATE INDEX "expenses_status_idx" ON "expenses"("status");

-- CreateIndex
CREATE UNIQUE INDEX "reimbursements_reimbursementNo_key" ON "reimbursements"("reimbursementNo");

-- CreateIndex
CREATE INDEX "reimbursements_applicantId_status_idx" ON "reimbursements"("applicantId", "status");

-- CreateIndex
CREATE INDEX "reimbursements_status_idx" ON "reimbursements"("status");

-- CreateIndex
CREATE INDEX "reimbursements_createdAt_idx" ON "reimbursements"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "profit_calculations_calculationNo_key" ON "profit_calculations"("calculationNo");

-- CreateIndex
CREATE INDEX "profit_calculations_periodType_period_idx" ON "profit_calculations"("periodType", "period");

-- CreateIndex
CREATE INDEX "profit_calculations_status_idx" ON "profit_calculations"("status");

-- CreateIndex
CREATE INDEX "profit_calculations_startDate_endDate_idx" ON "profit_calculations"("startDate", "endDate");

-- CreateIndex
CREATE INDEX "profit_calculations_createdAt_idx" ON "profit_calculations"("createdAt");

-- CreateIndex
CREATE INDEX "profit_details_calculationId_idx" ON "profit_details"("calculationId");

-- CreateIndex
CREATE INDEX "profit_details_orderId_idx" ON "profit_details"("orderId");

-- CreateIndex
CREATE INDEX "profit_details_platformOrderId_idx" ON "profit_details"("platformOrderId");

-- CreateIndex
CREATE INDEX "profit_details_productId_idx" ON "profit_details"("productId");

-- CreateIndex
CREATE INDEX "profit_details_salesRepId_idx" ON "profit_details"("salesRepId");

-- CreateIndex
CREATE INDEX "profit_details_platformType_idx" ON "profit_details"("platformType");

-- CreateIndex
CREATE UNIQUE INDEX "performance_rules_code_key" ON "performance_rules"("code");

-- CreateIndex
CREATE INDEX "performance_rules_type_isActive_idx" ON "performance_rules"("type", "isActive");

-- CreateIndex
CREATE INDEX "performance_rules_effectiveFrom_effectiveTo_idx" ON "performance_rules"("effectiveFrom", "effectiveTo");

-- CreateIndex
CREATE INDEX "performance_metrics_userId_period_idx" ON "performance_metrics"("userId", "period");

-- CreateIndex
CREATE INDEX "performance_metrics_ruleId_idx" ON "performance_metrics"("ruleId");

-- CreateIndex
CREATE INDEX "performance_metrics_periodStart_periodEnd_idx" ON "performance_metrics"("periodStart", "periodEnd");

-- CreateIndex
CREATE UNIQUE INDEX "performance_metrics_ruleId_userId_period_key" ON "performance_metrics"("ruleId", "userId", "period");

-- CreateIndex
CREATE UNIQUE INDEX "commissions_commissionNo_key" ON "commissions"("commissionNo");

-- CreateIndex
CREATE INDEX "commissions_userId_period_idx" ON "commissions"("userId", "period");

-- CreateIndex
CREATE INDEX "commissions_status_idx" ON "commissions"("status");

-- CreateIndex
CREATE INDEX "commissions_period_idx" ON "commissions"("period");

-- CreateIndex
CREATE INDEX "commissions_createdAt_idx" ON "commissions"("createdAt");

-- CreateIndex
CREATE INDEX "_ReimbursementExpenses_B_index" ON "_ReimbursementExpenses"("B");

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_contacts" ADD CONSTRAINT "customer_contacts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "follow_ups" ADD CONSTRAINT "follow_ups_inquiryId_fkey" FOREIGN KEY ("inquiryId") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "production_records" ADD CONSTRAINT "production_records_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_checks" ADD CONSTRAINT "quality_checks_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quality_check_items" ADD CONSTRAINT "quality_check_items_qualityCheckId_fkey" FOREIGN KEY ("qualityCheckId") REFERENCES "quality_checks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaserId_fkey" FOREIGN KEY ("purchaserId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_salesOrderId_fkey" FOREIGN KEY ("salesOrderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_items" ADD CONSTRAINT "inventory_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_orders" ADD CONSTRAINT "inbound_orders_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "purchase_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_orders" ADD CONSTRAINT "inbound_orders_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_order_items" ADD CONSTRAINT "inbound_order_items_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "inbound_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbound_order_items" ADD CONSTRAINT "inbound_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_inboundOrderId_fkey" FOREIGN KEY ("inboundOrderId") REFERENCES "inbound_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_logs" ADD CONSTRAINT "inventory_logs_productId_warehouseId_fkey" FOREIGN KEY ("productId", "warehouseId") REFERENCES "inventory_items"("productId", "warehouse") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attribute_templates" ADD CONSTRAINT "attribute_templates_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_research" ADD CONSTRAINT "product_research_researchTaskId_fkey" FOREIGN KEY ("researchTaskId") REFERENCES "research_tasks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_attributeId_fkey" FOREIGN KEY ("attributeId") REFERENCES "attribute_templates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_attribute_values" ADD CONSTRAINT "product_attribute_values_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_comparisons" ADD CONSTRAINT "product_comparisons_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_comparisons" ADD CONSTRAINT "product_comparisons_productResearchId_fkey" FOREIGN KEY ("productResearchId") REFERENCES "product_research"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_comparison_items" ADD CONSTRAINT "product_comparison_items_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "product_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_comparison_items" ADD CONSTRAINT "product_comparison_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_research"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_tasks" ADD CONSTRAINT "research_tasks_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "market_researches" ADD CONSTRAINT "market_researches_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_attachments" ADD CONSTRAINT "research_attachments_comparisonId_fkey" FOREIGN KEY ("comparisonId") REFERENCES "product_comparisons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_attachments" ADD CONSTRAINT "research_attachments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "product_research"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "research_attachments" ADD CONSTRAINT "research_attachments_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "research_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_orders" ADD CONSTRAINT "outbound_orders_shipmentId_fkey" FOREIGN KEY ("shipmentId") REFERENCES "shipments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_orders" ADD CONSTRAINT "outbound_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_order_items" ADD CONSTRAINT "outbound_order_items_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outbound_order_items" ADD CONSTRAINT "outbound_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_data" ADD CONSTRAINT "report_data_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_subscriptions" ADD CONSTRAINT "report_subscriptions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_export_logs" ADD CONSTRAINT "report_export_logs_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "report_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_registrations" ADD CONSTRAINT "user_registrations_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_accounts" ADD CONSTRAINT "platform_accounts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_orders" ADD CONSTRAINT "platform_orders_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overseas_inventory" ADD CONSTRAINT "overseas_inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "overseas_warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "overseas_inventory" ADD CONSTRAINT "overseas_inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "approval_flows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_initiatorId_fkey" FOREIGN KEY ("initiatorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_records" ADD CONSTRAINT "approval_records_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "approval_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "approval_history" ADD CONSTRAINT "approval_history_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_applicantId_fkey" FOREIGN KEY ("applicantId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reimbursements" ADD CONSTRAINT "reimbursements_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_calculations" ADD CONSTRAINT "profit_calculations_calculatedBy_fkey" FOREIGN KEY ("calculatedBy") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_calculationId_fkey" FOREIGN KEY ("calculationId") REFERENCES "profit_calculations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_platformOrderId_fkey" FOREIGN KEY ("platformOrderId") REFERENCES "platform_orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_salesRepId_fkey" FOREIGN KEY ("salesRepId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_platformAccountId_fkey" FOREIGN KEY ("platformAccountId") REFERENCES "platform_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profit_details" ADD CONSTRAINT "profit_details_commissionId_fkey" FOREIGN KEY ("commissionId") REFERENCES "commissions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "performance_rules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "performance_metrics" ADD CONSTRAINT "performance_metrics_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "performance_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReimbursementExpenses" ADD CONSTRAINT "_ReimbursementExpenses_A_fkey" FOREIGN KEY ("A") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_ReimbursementExpenses" ADD CONSTRAINT "_ReimbursementExpenses_B_fkey" FOREIGN KEY ("B") REFERENCES "reimbursements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
