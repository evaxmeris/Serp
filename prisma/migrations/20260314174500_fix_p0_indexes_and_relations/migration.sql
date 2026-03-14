-- CreateIndex (P0 Issue #2: Add missing indexes for performance)
CREATE INDEX "inbound_order_items_inboundOrderId_idx" ON "inbound_order_items"("inboundOrderId");
CREATE INDEX "inbound_order_items_productId_idx" ON "inbound_order_items"("productId");
CREATE INDEX "inventory_logs_productId_idx" ON "inventory_logs"("productId");
CREATE INDEX "inventory_logs_warehouseId_idx" ON "inventory_logs"("warehouseId");
CREATE INDEX "inventory_logs_inboundOrderId_idx" ON "inventory_logs"("inboundOrderId");
CREATE INDEX "inventory_logs_type_idx" ON "inventory_logs"("type");
CREATE INDEX "inventory_logs_createdAt_idx" ON "inventory_logs"("createdAt");
CREATE INDEX "inbound_orders_status_idx" ON "inbound_orders"("status");
