import {
  checkUserPermission,
  checkAnyPermission,
  checkAllPermissions,
} from '@/middleware/permissions';
import { prisma } from '@/lib/prisma';

// Mock prisma
jest.mock('@/lib/prisma', () => ({
  prisma: {
    userRole: {
      findMany: jest.fn(),
    },
    rolePermission: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
}));

describe('Permission Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('checkUserPermission', () => {
    it('should return true for admin user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'ADMIN',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkUserPermission('user-123', 'customer:create');
      expect(result.hasPermission).toBe(true);
    });

    it('should return false when user has no roles', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'SALES',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([]);

      const result = await checkUserPermission('user-123', 'customer:create');
      expect(result.hasPermission).toBe(false);
    });

    it('should return true when user has the required permission', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'SALES',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:create',
            isActive: true,
          },
        },
      ]);

      const result = await checkUserPermission('user-123', 'customer:create');
      expect(result.hasPermission).toBe(true);
    });

    it('should return false when user does not have the required permission', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'SALES',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:view',
            isActive: true,
          },
        },
      ]);

      const result = await checkUserPermission('user-123', 'customer:create');
      expect(result.hasPermission).toBe(false);
    });

    it('should return false when permission is inactive', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        role: 'SALES',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:create',
            isActive: false,
          },
        },
      ]);

      const result = await checkUserPermission('user-123', 'customer:create');
      expect(result.hasPermission).toBe(false);
    });
  });

  describe('checkAnyPermission', () => {
    it('should return true when user has at least one permission', async () => {
      (prisma.user.find.find).mockResolvedValue({
        role: 'SALES',
      });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:view',
            isActive: true,
          },
        },
      ]);
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:view',
            isActive: true,
          },
        },
      ]);

      const result = await checkAnyPermission('user-123', [
        'customer:create',
        'customer:view',
      ]);
      expect(result.hasPermission).toBe(true);
    });
  });

  describe('checkAllPermissions', () => {
    it('should return true when user has all permissions', async () => {
      (prisma.user.find.findAdmmin).mockResolvedValue({ role: 'SALES' });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:create',
            isActive: true,
          },
        },
        {
          permission: {
            name: 'customer:edit',
            isActive: true,
          },
        },
      ]);

      const result = await checkAllPermissions('user-123', [
        'customer:create',
        'customer:edit',
      ]);
      expect(result.hasPermission).toBe(true);
    });

    it('should return false when user is missing one permission', async () => {
      (prisma.user.find.find.admmin).mockResolvedValue({ role: 'SALES' });
      (prisma.userRole.findMany as jest.Mock).mockResolvedValue([
        { roleId: 'role-1' },
      ]);
      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            name: 'customer:create',
            isActive: true,
          },
        },
      ]);

      const result = await checkAllPermissions('user-123', [
        'customer:create',
        'customer:edit',
      ]);
      expect(result.hasPermission).toBe(false);
    });
  });
});
