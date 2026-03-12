# Trade ERP - 代码注释指南

> 📝 所有源代码必须包含清晰的中文注释，方便人类阅读理解

**生效日期：** 2026-03-12  
**适用范围：** 所有新增和修改的代码文件

---

## 📋 注释层级

### Level 1: 文件头注释（必须）

每个源代码文件的开头必须包含文件说明：

```typescript
/**
 * @文件说明 订单管理 API 路由
 * @主要功能 处理订单的 CRUD 操作
 * @作者 应亮
 * @创建日期 2026-03-12
 * @最后更新 2026-03-12
 * @依赖 Prisma, Next.js API Routes
 */
```

---

### Level 2: 函数/组件注释（必须）

每个公开函数和组件必须有文档注释：

```typescript
/**
 * 创建新订单
 * 
 * @description 接收订单数据，验证后创建订单记录，同时更新库存
 * @param request Next.js 请求对象，包含订单数据
 * @returns Promise<Response> 创建成功返回 201 和订单数据，失败返回错误信息
 * 
 * @throws {ValidationError} 当输入数据验证失败时
 * @throws {DatabaseError} 当数据库操作失败时
 * @throws {InventoryError} 当库存不足时
 * 
 * @example
 * // POST /api/orders
 * // Body: { customerId, items: [{ productId, quantity }] }
 * // Response: { id, status, total, createdAt }
 * 
 * @business_rule 订单创建后状态为"pending"，需要管理员确认
 * @business_rule 库存检查在事务中进行，确保数据一致性
 */
export async function POST(request: Request) {
  // ...
}
```

---

### Level 3: 关键逻辑注释（必须）

复杂业务逻辑需要行内注释说明：

```typescript
export async function createOrder(orderData: OrderData) {
  // 使用事务确保订单创建和库存更新要么都成功，要么都回滚
  // 避免出现订单创建了但库存没扣减的数据不一致问题
  return await prisma.$transaction(async (tx) => {
    
    // 1. 检查库存是否充足
    for (const item of orderData.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      
      // 库存不足时抛出异常，事务会自动回滚
      if (!product || product.stock < item.quantity) {
        throw new InventoryError(`产品 ${item.productId} 库存不足`);
      }
    }
    
    // 2. 创建订单记录
    const order = await tx.order.create({
      data: {
        ...orderData,
        status: 'pending', // 新订单默认为待确认状态
      },
    });
    
    // 3. 扣减库存
    for (const item of orderData.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: {
            decrement: item.quantity, // 使用原子操作避免并发问题
          },
        },
      });
    }
    
    return order;
  });
}
```

---

### Level 4: 类型定义注释（推荐）

```typescript
/**
 * 订单状态枚举
 * @value pending - 待确认：订单已创建，等待管理员确认
 * @value confirmed - 已确认：订单已确认，准备发货
 * @value shipped - 已发货：订单已发货，等待客户收货
 * @value completed - 已完成：客户已收货，订单完成
 * @value cancelled - 已取消：订单被取消
 */
type OrderStatus = 
  | 'pending'
  | 'confirmed'
  | 'shipped'
  | 'completed'
  | 'cancelled';

/**
 * 订单项数据结构
 * @property productId 产品唯一标识
 * @property quantity 订购数量
 * @property unitPrice 单价（下单时的价格，快照）
 * @property total 小计金额（quantity * unitPrice）
 */
interface OrderItem {
  productId: string;
  quantity: number;
  unitPrice: number;
  total: number;
}
```

---

## ✅ 注释检查清单

**提交代码前自我检查：**

```
□ 文件头注释 - 是否包含文件说明、作者、日期？
□ 函数注释 - 是否说明功能、参数、返回值？
□ 业务逻辑 - 是否解释了"为什么"而不仅是"做什么"？
□ 边界条件 - 是否说明了异常情况和错误处理？
□ 中文注释 - 是否使用清晰的中文（专业术语可用英文）？
□ 同步更新 - 修改代码时是否同步更新了注释？
```

---

## 📖 示例对比

### ❌ 糟糕的注释

```typescript
// 创建订单
function createOrder(data) {
  // 循环检查
  for (let i = 0; i < data.items.length; i++) {
    // 检查库存
    if (stock < data.items[i].qty) {
      // 抛出错误
      throw new Error('错误');
    }
  }
  // 创建
  return db.order.create(data);
}
```

**问题：**
- 注释只是重复代码
- 没有说明业务规则
- 错误信息不清晰
- 没有说明为什么这样做

---

### ✅ 优秀的注释

```typescript
/**
 * 创建新订单
 * 
 * 业务规则：
 * 1. 必须检查所有商品的库存是否充足
 * 2. 库存不足时立即拒绝，不创建部分订单
 * 3. 使用事务保证数据一致性
 * 
 * @param data 订单数据，包含客户 ID 和商品列表
 * @returns 创建的订单对象
 * @throws InventoryError 当任何商品库存不足时
 */
async function createOrder(data: OrderData) {
  // 开启数据库事务，确保订单创建和库存更新原子性
  return await prisma.$transaction(async (tx) => {
    // 1. 预检查所有商品库存
    // 目的：避免创建订单后发现库存不足，导致数据不一致
    for (const item of data.items) {
      const product = await tx.product.findUnique({
        where: { id: item.productId },
      });
      
      // 库存不足时抛出明确错误，前端可以友好提示用户
      if (!product || product.stock < item.quantity) {
        throw new InventoryError(
          `商品 "${product?.name || item.productId}" 库存不足，` +
          `当前库存：${product?.stock || 0}, 需求：${item.quantity}`
        );
      }
    }
    
    // 2. 所有检查通过，创建订单
    // 状态设为"pending"，需要管理员确认后才会发货
    const order = await tx.order.create({
      data: {
        customerId: data.customerId,
        items: data.items,
        status: 'pending',
        createdAt: new Date(),
      },
    });
    
    // 3. 扣减库存
    // 使用原子操作 decrement，避免并发下单导致的超卖问题
    for (const item of data.items) {
      await tx.product.update({
        where: { id: item.productId },
        data: {
          stock: { decrement: item.quantity },
        },
      });
    }
    
    return order;
  });
}
```

**优点：**
- 清晰说明业务规则
- 解释技术决策的原因
- 错误信息详细，便于调试
- 说明了并发处理方案

---

## 🛠️ 工具辅助

### ESLint 配置（推荐）

```javascript
// .eslintrc.js
module.exports = {
  rules: {
    // 要求所有函数有文档注释
    'jsdoc/require-jsdoc': ['error', {
      require: {
        FunctionDeclaration: true,
        MethodDefinition: true,
        ClassDeclaration: true,
      },
    }],
    // 要求注释使用中文
    // 可以通过自定义规则实现
  },
};
```

### 代码审查要点

**Review 时重点关注：**
1. 新增文件是否有文件头注释？
2. 新增函数是否有功能说明？
3. 复杂逻辑是否有解释？
4. 注释是否清晰、准确？

---

## 📚 参考资源

- [JSDoc 文档](https://jsdoc.app/)
- [TypeScript 文档注释](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html)
- [Google 代码风格指南](https://google.github.io/styleguide/jsguide.html)

---

**记住：** 好的注释让代码自己说话，让团队成员（包括未来的你）能快速理解业务逻辑和技术决策。

*最后更新：2026-03-12*
