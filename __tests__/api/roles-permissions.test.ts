import { createMocks } from 'node-mocks-http';
import { GET as getRolePermissions, POST as assignRolePermissions } from '@/app/api/roles/[id]/permissions/route';
import { prisma } from '@/lib/prisma';

jest.mock('@/lib/prisma', () => ({
  prisma: {
    role: {
      findUnique: jest.fn(),
    },
    rolePermission: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
      findMany: jest.fn(),
    },
    permission: {
      findMany: jest.fn(),
    },
  },
}));

describe('Role Permissions API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/roles/[id]/permissions', () => {
    it('should return 404 when role not found', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      const { req } = createMocks();
      const params = { id: 'non-existent-id' };
      const response = await getRolePermissions(req, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Role not found');
    });

    it('should return permissions for existing role', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue({
        id: 'role-1',
        name: 'sales',
        displayName: 'Sales',
      });

      (prisma.rolePermission.findMany as jest.Mock).mockResolvedValue([
        {
          permission: {
            id: 'perm-1',
            name: 'customer:view',
            displayName: 'View Customers',
            module: 'customer',
            isActive: true,
          },
        },
      ]);

      const { req } = createMocks();
      const params = { id: 'role-1' };
      const response = await getRolePermissions(req, { params });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Array.isArray(data.data)).toBe(true);
      expect(data.data.length).toBe(1);
    });
  });

  describe('POST /api/roles/[id]/permissions', () => {
    it('should return 400 when permissionIds not provided', async () => {
      const { req } = createMocks({
        body: {},
      });
      const params = { id: 'role-1' };
      const response = await assignRolePermissions(req, { params });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('permissionIds');
    });

    it('should return 404 when role not found', async () => {
      (prisma.role.findUnique as jest.Mock).mockResolvedValue(null);

      const { req } = createMocks({
        body: {
          permissionIds: ['perm-1', 'perm-2'],
        },
      });
      const params = { id: 'non-existent-id' };
      const response = await assignRolePermissions(req, { params });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('Role not found');
    });
  });
});
