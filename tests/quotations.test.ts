/**
 * 报价管理 API 简化测试
 */

import { prisma } from '@/lib/prisma';

describe('Quotations Module', () => {
  let testQuotationId = '';
  let testCustomerId = '';

  beforeAll(async () => {
    // 获取测试客户
    const customers = await prisma.customer.findMany({ take: 1 });
    if (customers.length > 0) {
      testCustomerId = customers[0].id;
    }
  });

  describe('Database Operations', () => {
    it('应该成功创建报价单', async () => {
      const quotation = await prisma.quotation.create({
        data: {
          quotationNo: `TEST-QUO-${Date.now()}`,
          customerId: testCustomerId,
          currency: 'USD',
          paymentTerms: 'T/T',
          deliveryTerms: 'FOB',
          validityDays: 30,
          totalAmount: 1000,
          status: 'DRAFT',
          items: {
            create: {
              productName: '测试产品',
              quantity: 100,
              unitPrice: 10.00,
              amount: 1000,
            },
          },
        },
        include: {
          items: true,
          customer: true,
        },
      });

      expect(quotation).toHaveProperty('id');
      expect(quotation.quotationNo).toContain('TEST-QUO');
      expect(quotation.items.length).toBe(1);

      testQuotationId = quotation.id;
    });

    it('应该获取报价单列表', async () => {
      const quotations = await prisma.quotation.findMany({
        where: {
          quotationNo: {
            contains: 'TEST-QUO',
          },
        },
        include: {
          items: true,
        },
      });

      expect(Array.isArray(quotations)).toBe(true);
      expect(quotations.length).toBeGreaterThan(0);
    });

    it('应该获取报价单详情', async () => {
      if (!testQuotationId) return;

      const quotation = await prisma.quotation.findUnique({
        where: { id: testQuotationId },
        include: {
          items: true,
          customer: true,
        },
      });

      expect(quotation).toBeTruthy();
      expect(quotation?.id).toBe(testQuotationId);
      expect(quotation?.customer).toHaveProperty('companyName');
    });

    it('应该支持状态筛选', async () => {
      const quotations = await prisma.quotation.findMany({
        where: {
          status: 'DRAFT',
          quotationNo: {
            contains: 'TEST-QUO',
          },
        },
      });

      expect(Array.isArray(quotations)).toBe(true);
    });

    it('应该更新报价单', async () => {
      if (!testQuotationId) return;

      const updated = await prisma.quotation.update({
        where: { id: testQuotationId },
        data: {
          status: 'SENT',
          notes: '已发送',
        },
      });

      expect(updated.status).toBe('SENT');
      expect(updated.notes).toBe('已发送');
    });

    it('应该删除报价单', async () => {
      if (!testQuotationId) return;

      await prisma.quotation.delete({
        where: { id: testQuotationId },
      });

      const deleted = await prisma.quotation.findUnique({
        where: { id: testQuotationId },
      });

      expect(deleted).toBeNull();
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });
});
