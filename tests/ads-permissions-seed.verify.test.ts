/**
 * 临时验证脚本（跑完即删）：广告域权限种子接线真实落库验证
 * 依据：docs/advertising-domain-m1-be-design.md §8.2/§8.3
 */
import { initDefaultPermissions, seedAdsRolePermissions } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

describe('ads 权限种子', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('三权限点创建 + admin/sales 角色接线（幂等）', async () => {
    const r1 = await initDefaultPermissions();
    console.log('initDefaultPermissions →', JSON.stringify(r1.adsRolePermissions));

    const perms = await prisma.permission.findMany({
      where: { code: { in: ['ads:view', 'ads:edit', 'ads:admin'] } },
      select: { code: true, module: true, displayName: true },
      orderBy: { code: 'asc' },
    });
    console.log('权限点 →', JSON.stringify(perms));
    expect(perms).toHaveLength(3);

    // 幂等重跑
    const r2 = await seedAdsRolePermissions();
    console.log('seedAdsRolePermissions 重跑 →', JSON.stringify(r2.wired));

    const wiring = await prisma.rolePermission.findMany({
      where: { permission: { code: { in: ['ads:view', 'ads:edit', 'ads:admin'] } } },
      select: { role: { select: { name: true } }, permission: { select: { code: true } } },
    });
    const summary: Record<string, string[]> = {};
    for (const w of wiring) {
      summary[w.role.name] = [...(summary[w.role.name] || []), w.permission.code].sort();
    }
    console.log('RolePermission 落库 →', JSON.stringify(summary));
    expect(summary['admin']).toEqual(['ads:admin', 'ads:edit', 'ads:view']);
    expect(summary['sales']).toEqual(['ads:edit', 'ads:view']);
  });
});
