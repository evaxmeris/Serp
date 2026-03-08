-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "supplier_no" TEXT NOT NULL,
    "company_name" TEXT NOT NULL,
    "company_en" TEXT,
    "contact_name" TEXT,
    "contact_title" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "fax" TEXT,
    "address" TEXT,
    "city" TEXT,
    "province" TEXT,
    "country" TEXT DEFAULT 'CN',
    "postal_code" TEXT,
    "website" TEXT,
    "tax_id" TEXT,
    "business_license" TEXT,
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_code" TEXT,
    "products" TEXT,
    "categories" TEXT[],
    "status" "SupplierStatus" NOT NULL DEFAULT 'ACTIVE',
    "type" "SupplierType" NOT NULL DEFAULT 'DOMESTIC',
    "level" "SupplierLevel" NOT NULL DEFAULT 'NORMAL',
    "score" DECIMAL(3,2),
    "credit_terms" TEXT,
    "payment_methods" TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "min_order_amount" DECIMAL(12,2),
    "total_orders" INTEGER NOT NULL DEFAULT 0,
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "last_order_date" TIMESTAMP(3),
    "owner_id" TEXT,
    "notes" TEXT,
    "attachments" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_contacts" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT,
    "department" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "mobile" TEXT,
    "wechat" TEXT,
    "qq" TEXT,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_evaluations" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "evaluation_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluator_id" TEXT,
    "period" TEXT NOT NULL,
    "quality_score" DECIMAL(2,1) NOT NULL,
    "delivery_score" DECIMAL(2,1) NOT NULL,
    "price_score" DECIMAL(2,1) NOT NULL,
    "service_score" DECIMAL(2,1) NOT NULL,
    "total_score" DECIMAL(3,2) NOT NULL,
    "level" "SupplierLevel" NOT NULL,
    "comments" TEXT,
    "improvement_plan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "po_no" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "sales_order_id" TEXT,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'PENDING',
    "approval_status" "ApprovalStatus" NOT NULL DEFAULT 'NOT_REQUIRED',
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "exchange_rate" DECIMAL(10,6) NOT NULL DEFAULT 1,
    "total_amount" DECIMAL(12,2) NOT NULL,
    "paid_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "delivery_date" TIMESTAMP(3),
    "delivery_deadline" TIMESTAMP(3),
    "delivery_address" TEXT,
    "shipping_method" TEXT,
    "payment_terms" TEXT,
    "payment_deadline" TIMESTAMP(3),
    "purchaser_id" TEXT,
    "notes" TEXT,
    "internal_notes" TEXT,
    "attachments" TEXT[],
    "confirmed_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "cancelled_at" TIMESTAMP(3),
    "cancel_reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_items" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "product_id" TEXT,
    "product_name" TEXT NOT NULL,
    "product_sku" TEXT,
    "specification" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'PCS',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unit_price" DECIMAL(10,2) NOT NULL,
    "discount_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "amount" DECIMAL(12,2) NOT NULL,
    "tax_rate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "tax_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "received_qty" INTEGER NOT NULL DEFAULT 0,
    "rejected_qty" INTEGER NOT NULL DEFAULT 0,
    "pending_qty" INTEGER NOT NULL DEFAULT 0,
    "expected_delivery_date" TIMESTAMP(3),
    "actual_delivery_date" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipts" (
    "id" TEXT NOT NULL,
    "receipt_no" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "receipt_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "receipt_by" TEXT,
    "status" "ReceiptStatus" NOT NULL DEFAULT 'PENDING',
    "quality_check_id" TEXT,
    "quality_status" "QualityCheckStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_receipt_items" (
    "id" TEXT NOT NULL,
    "receipt_id" TEXT NOT NULL,
    "purchase_order_item_id" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "accepted_qty" INTEGER NOT NULL DEFAULT 0,
    "rejected_qty" INTEGER NOT NULL DEFAULT 0,
    "warehouse" TEXT NOT NULL DEFAULT 'MAIN',
    "location" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_receipt_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "payment_no" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'CNY',
    "payment_method" TEXT,
    "payment_date" TIMESTAMP(3),
    "bank_name" TEXT,
    "bank_account" TEXT,
    "bank_reference" TEXT,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "notes" TEXT,
    "attachments" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "suppliers_supplier_no_key" ON "suppliers"("supplier_no");

-- CreateIndex
CREATE INDEX "suppliers_status_idx" ON "suppliers"("status");

-- CreateIndex
CREATE INDEX "suppliers_company_name_idx" ON "suppliers"("company_name");

-- CreateIndex
CREATE INDEX "suppliers_owner_id_idx" ON "suppliers"("owner_id");

-- CreateIndex
CREATE INDEX "supplier_contacts_supplier_id_idx" ON "supplier_contacts"("supplier_id");

-- CreateIndex
CREATE INDEX "supplier_evaluations_supplier_id_period_idx" ON "supplier_evaluations"("supplier_id", "period");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_orders_po_no_key" ON "purchase_orders"("po_no");

-- CreateIndex
CREATE INDEX "purchase_orders_supplier_id_status_idx" ON "purchase_orders"("supplier_id", "status");

-- CreateIndex
CREATE INDEX "purchase_orders_sales_order_id_idx" ON "purchase_orders"("sales_order_id");

-- CreateIndex
CREATE INDEX "purchase_orders_status_delivery_date_idx" ON "purchase_orders"("status", "delivery_date");

-- CreateIndex
CREATE INDEX "purchase_orders_created_at_idx" ON "purchase_orders"("createdAt");

-- CreateIndex
CREATE INDEX "purchase_order_items_purchase_order_id_idx" ON "purchase_order_items"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_order_items_product_id_idx" ON "purchase_order_items"("product_id");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_receipts_receipt_no_key" ON "purchase_receipts"("receipt_no");

-- CreateIndex
CREATE INDEX "purchase_receipts_purchase_order_id_idx" ON "purchase_receipts"("purchase_order_id");

-- CreateIndex
CREATE INDEX "purchase_receipts_warehouse_idx" ON "purchase_receipts"("warehouse");

-- CreateIndex
CREATE INDEX "purchase_receipts_receipt_date_idx" ON "purchase_receipts"("receipt_date");

-- CreateIndex
CREATE INDEX "purchase_receipt_items_receipt_id_idx" ON "purchase_receipt_items"("receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_payment_no_key" ON "supplier_payments"("payment_no");

-- CreateIndex
CREATE INDEX "supplier_payments_purchase_order_id_idx" ON "supplier_payments"("purchase_order_id");

-- CreateIndex
CREATE INDEX "supplier_payments_payment_date_idx" ON "supplier_payments"("payment_date");

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_evaluations" ADD CONSTRAINT "supplier_evaluations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_sales_order_id_fkey" FOREIGN KEY ("sales_order_id") REFERENCES "orders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_purchaser_id_fkey" FOREIGN KEY ("purchaser_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipts" ADD CONSTRAINT "purchase_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_receipt_id_fkey" FOREIGN KEY ("receipt_id") REFERENCES "purchase_receipts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_receipt_items" ADD CONSTRAINT "purchase_receipt_items_purchase_order_item_id_fkey" FOREIGN KEY ("purchase_order_item_id") REFERENCES "purchase_order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
