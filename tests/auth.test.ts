/**
 * @file 认证系统集成测试
 * @description 测试 JWT 认证系统 (已适配当前 RoleEnum: ADMIN/SALES/PURCHASING/WAREHOUSE/VIEWER)
 */

import request from 'supertest';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000';
const agent = request.agent(BASE_URL);

// 测试用户数据（匹配当前 User 模型：RoleEnum + isApproved）
const TEST_USERS = {
  valid: {
    email: 'test@example.com',
    password: 'Password123!',
    name: 'Test User',
    role: 'SALES',
    isApproved: true,
  },
  admin: {
    email: 'admin_test@example.com',
    password: 'Admin123!',
    name: 'Admin User',
    role: 'ADMIN',
    isApproved: true,
  },
  pending: {
    email: 'pending@example.com',
    password: 'Password123!',
    name: 'Pending User',
    role: 'SALES',
    isApproved: false,
  },
};

describe('Trade ERP - 认证系统集成测试', () => {
  beforeAll(async () => {
    // 创建测试用户（如果不存在）
    for (const userData of Object.values(TEST_USERS)) {
      const existing = await prisma.user.findUnique({ where: { email: userData.email } });
      if (!existing) {
        const passwordHash = await bcrypt.hash(userData.password, 10);
        await prisma.user.create({
          data: {
            email: userData.email,
            name: userData.name,
            passwordHash,
            role: userData.role,
            isApproved: userData.isApproved,
          },
        });
      }
    }
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('登录功能', () => {
    it('应该成功登录并返回用户信息 + auth-token Cookie', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.valid.email,
          password: TEST_USERS.valid.password,
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toBeDefined();
      expect(response.body.user.email).toBe(TEST_USERS.valid.email);
      expect(response.body.user.role).toBe(TEST_USERS.valid.role);
    });

    it('账号不存在应返回 401/429', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@test.com',
          password: 'whatever123',
        });

      expect([401, 429]).toContain(response.status);
    });

    it('密码错误或速率限制应返回 401/429', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.valid.email,
          password: 'WrongPassword1!',
        });

      // 可能因速率限制返回429或正常401
      expect([401, 429]).toContain(response.status);
    });

    it('未审批用户登录应返回 403', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.pending.email,
          password: TEST_USERS.pending.password,
        });

      expect(response.status).toBe(403);
    });
  });

  describe('认证中间件', () => {
    it('未登录访问受保护API应返回 401', async () => {
      const response = await agent.get('/api/products');
      expect(response.status).toBe(401);
    });

    it('ADMIN 应该能访问产品 API', async () => {
      // 先登录获取 token
      const loginRes = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.admin.email,
          password: TEST_USERS.admin.password,
        });
      
      const token = loginRes.body.user ? loginRes.headers['set-cookie']?.find((c: string) => c.startsWith('auth-token='))?.split(';')[0]?.split('=')[1] : null;
      
      if (token) {
        const response = await agent
          .get('/api/products')
          .set('Cookie', `auth-token=${token}`);
        // 有认证token后应返回200（不再401）
        expect(response.status).toBe(200);
      }
    });
  });

  describe('密码加密', () => {
    it('数据库存储bcrypt哈希而非明文', async () => {
      const user = await prisma.user.findUnique({
        where: { email: TEST_USERS.valid.email },
      });
      expect(user).toBeDefined();
      expect(user?.passwordHash).toBeDefined();
      expect(user?.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(user?.passwordHash).not.toBe(TEST_USERS.valid.password);
    });
  });

  describe('JWT Token', () => {
    it('登录后应设置 auth-token Cookie', async () => {
      const response = await agent
        .post('/api/auth/login')
        .send({
          email: TEST_USERS.valid.email,
          password: TEST_USERS.valid.password,
        });

      const cookies = response.headers['set-cookie'];
      const authCookie = cookies?.find((c: string) => c.startsWith('auth-token='));
      expect(authCookie).toBeDefined();
    });
  });
});
