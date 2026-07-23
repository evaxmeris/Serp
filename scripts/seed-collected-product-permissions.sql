-- 采集产品模块权限种子数据
-- module: collected_product

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('collected_product_view', 'collected_product:view', '查看采集产品', 'collected_product', '查看采集产品列表和详情', true, 'collected_product:view', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('collected_product_create', 'collected_product:create', '采集产品', 'collected_product', '通过插件采集产品到系统', true, 'collected_product:create', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('collected_product_edit', 'collected_product:edit', '编辑采集产品', 'collected_product', '编辑/梳理采集产品信息', true, 'collected_product:edit', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('collected_product_publish', 'collected_product:publish', '发布采集产品', 'collected_product', '发布采集产品到WooCommerce', true, 'collected_product:publish', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('collected_product_delete', 'collected_product:delete', '删除采集产品', 'collected_product', '删除采集产品及关联数据', true, 'collected_product:delete', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;

INSERT INTO permissions (id, name, "displayName", module, description, "isActive", code, "createdAt", "updatedAt")
VALUES ('woocommerce_config_manage', 'woocommerce_config:manage', '管理WooCommerce配置', 'collected_product', '配置WooCommerce API凭证', true, 'woocommerce_config:manage', NOW(), NOW())
ON CONFLICT (code) DO UPDATE SET "displayName" = EXCLUDED."displayName", module = EXCLUDED.module, description = EXCLUDED.description;
