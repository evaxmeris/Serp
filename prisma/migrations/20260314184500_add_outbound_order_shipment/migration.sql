-- CreateTable: OutboundOrder
CREATE TABLE "outbound_orders" (
    "id" TEXT NOT NULL,
    "outboundNo" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "totalAmount" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable: OutboundOrderItem
CREATE TABLE "outbound_order_items" (
    "id" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "shippedQuantity" INTEGER NOT NULL DEFAULT 0,
    "unitPrice" DECIMAL(65,30),

    CONSTRAINT "outbound_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable: Shipment (replaces old shipments table)
CREATE TABLE "shipments" (
    "id" TEXT NOT NULL,
    "outboundOrderId" TEXT NOT NULL,
    "logisticsCompany" TEXT,
    "trackingNo" TEXT,
    "shippedAt" TIMESTAMP(3),

    CONSTRAINT "shipments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "outbound_orders_outboundNo_key" ON "outbound_orders"("outboundNo");
CREATE INDEX "outbound_orders_orderId_idx" ON "outbound_orders"("orderId");
CREATE INDEX "outbound_orders_status_idx" ON "outbound_orders"("status");
CREATE INDEX "outbound_orders_createdAt_idx" ON "outbound_orders"("createdAt");
CREATE INDEX "outbound_order_items_outboundOrderId_idx" ON "outbound_order_items"("outboundOrderId");
CREATE INDEX "outbound_order_items_productId_idx" ON "outbound_order_items"("productId");
CREATE UNIQUE INDEX "shipments_outboundOrderId_key" ON "shipments"("outboundOrderId");
CREATE INDEX "shipments_outboundOrderId_idx" ON "shipments"("outboundOrderId");

-- AddForeignKey
ALTER TABLE "outbound_orders" ADD CONSTRAINT "outbound_orders_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "outbound_order_items" ADD CONSTRAINT "outbound_order_items_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
ALTER TABLE "outbound_order_items" ADD CONSTRAINT "outbound_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE NO ACTION ON UPDATE NO ACTION;
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_outboundOrderId_fkey" FOREIGN KEY ("outboundOrderId") REFERENCES "outbound_orders"("id") ON DELETE CASCADE ON UPDATE NO ACTION;
