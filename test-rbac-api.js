const axios = require('axios');
const tough = require('tough-cookie');
const { CookieJar } = tough;
const axiosCookieJarSupport = require('axios-cookiejar-support').wrapper;

const BASE_URL = 'http://localhost:3000';

async function testRBAC() {
  console.log('=== RBAC API 功能验证 ===\n');
  
  // 使用 cookie jar 自动管理 cookies
  const jar = new CookieJar();
  const client = axiosCookieJarSupport(axios.create({ jar }));
  
  // 1. 登录获取 token (存储在 cookie 中)
  console.log('1. 测试登录');
  try {
    const loginResponse = await client.post(`${BASE_URL}/api/auth/login`, {
      email: 'admin@trade-erp.com',
      password: 'Admin1234!'
    });
    
    if (loginResponse.status === 200 && loginResponse.data.success) {
      console.log('✅ 登录成功');
      console.log('   用户:', loginResponse.data.user.name);
      console.log('   邮箱:', loginResponse.data.user.email);
    } else {
      console.log('❌ 登录失败', loginResponse.data);
      return;
    }
  } catch (error) {
    console.log('❌ 登录请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
    return;
  }
  
  console.log('');
  
  // 2. 测试 GET /api/roles - 获取角色列表
  console.log('2. 测试 GET /api/roles - 获取角色列表');
  let roles = [];
  try {
    const response = await client.get(`${BASE_URL}/api/roles`);
    let rolesData = [];
    if (response.status === 200) {
      if (response.data.data && Array.isArray(response.data.data)) {
        rolesData = response.data.data;
      } else if (Array.isArray(response.data)) {
        rolesData = response.data;
      }
      roles = rolesData;
      console.log(`✅ 请求成功，获取到 ${roles.length} 个角色`);
      roles.forEach((role, index) => {
        const permCount = role.permissions ? role.permissions.length : 0;
        console.log(`   ${index + 1}. ${role.name} - ${role.displayName} (权限数: ${permCount})`);
      });
      if (roles.length !== 7) {
        console.log(`⚠️  期望 7 个角色，实际得到 ${roles.length} 个`);
      } else {
        console.log('✅ 角色数量正确（7 个）');
      }
    } else {
      console.log('❌ 请求失败', response.data);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  
  // 3. 测试 GET /api/permissions - 获取权限列表
  console.log('3. 测试 GET /api/permissions - 获取权限列表');
  let permissions = [];
  try {
    const response = await client.get(`${BASE_URL}/api/permissions`);
    let permissionsData = [];
    if (response.status === 200) {
      if (response.data.data && Array.isArray(response.data.data)) {
        permissionsData = response.data.data;
      } else if (Array.isArray(response.data)) {
        permissionsData = response.data;
      } else if (response.data.grouped) {
        // 该API返回 {data: permissions, grouped: {...}}
        permissionsData = response.data.data;
      }
      permissions = permissionsData;
      console.log(`✅ 请求成功，获取到 ${permissions.length} 个权限`);
      const modules = [...new Set(permissions.map(p => p.module))];
      modules.forEach(module => {
        const count = permissions.filter(p => p.module === module).length;
        console.log(`   模块 ${module}: ${count} 个权限`);
      });
      if (permissions.length !== 12) {
        console.log(`⚠️  期望 12 个权限，实际得到 ${permissions.length} 个`);
      } else {
        console.log('✅ 权限数量正确（12 个）');
      }
    } else {
      console.log('❌ 请求失败', response.data);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  
  // 4. 测试 POST /api/roles/create - 创建新角色
  console.log('4. 测试 POST /api/roles/create - 创建新角色');
  let testRoleId = null;
  try {
    const newRole = {
      name: 'test-manager',
      displayName: '测试经理',
      description: '用于测试的经理角色',
      permissions: []
    };
    
    const response = await client.post(`${BASE_URL}/api/roles/create`, newRole);
    if (response.status === 200 || response.status === 201) {
      testRoleId = response.data.data ? response.data.data.id : response.data.id;
      console.log('✅ 创建角色成功');
      console.log('   角色 ID:', testRoleId);
      console.log('   角色名称:', response.data.data ? response.data.data.name : response.data.name);
    } else {
      console.log('❌ 创建角色失败', response.data);
    }
  } catch (error) {
    console.log('❌ 创建角色请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  
  // 5. 测试 POST /api/roles/:id/permissions - 分配角色权限
  console.log('5. 测试 POST /api/roles/:id/permissions - 分配角色权限');
  try {
    if (!testRoleId) {
      // 重新获取角色列表找到新创建的测试角色
      const rolesResponse = await client.get(`${BASE_URL}/api/roles`);
      let rolesData = [];
      if (rolesResponse.data.data && Array.isArray(rolesResponse.data.data)) {
        rolesData = rolesResponse.data.data;
      } else if (Array.isArray(rolesResponse.data)) {
        rolesData = rolesResponse.data;
      }
      const testRole = rolesData.find(r => r.name === 'test-manager');
      if (testRole) {
        testRoleId = testRole.id;
      }
    }
    
    if (testRoleId) {
      console.log(`✅ 找到测试角色，ID: ${testRoleId}`);
      
      // 选择一些权限分配
      const selectedPermissions = permissions
        .filter(p => p.module === 'customer' || p.module === 'order')
        .map(p => p.id);
      
      console.log(`   分配 ${selectedPermissions.length} 个权限给测试角色`);
      
      const assignResponse = await client.post(
        `${BASE_URL}/api/roles/${testRoleId}/permissions`,
        { permissionIds: selectedPermissions }
      );
      
      if (assignResponse.status === 200) {
        console.log('✅ 权限分配成功');
        if (assignResponse.data.data) {
          console.log(`   返回了 ${assignResponse.data.data.length} 个权限`);
        }
      } else {
        console.log('❌ 权限分配失败', assignResponse.data);
      }
    } else {
      console.log('❌ 未找到测试角色');
    }
  } catch (error) {
    console.log('❌ 权限分配请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  
  // 6. 测试 GET /api/users - 获取用户列表
  console.log('6. 测试 GET /api/users - 获取用户列表');
  let users = [];
  try {
    const response = await client.get(`${BASE_URL}/api/users`);
    let usersData = [];
    if (response.status === 200) {
      if (response.data.data && Array.isArray(response.data.data)) {
        usersData = response.data.data;
      } else if (Array.isArray(response.data)) {
        usersData = response.data;
      }
      users = usersData;
      console.log(`✅ 请求成功，获取到 ${users.length} 个用户`);
      users.forEach((user, index) => {
        console.log(`   ${index + 1}. ${user.name} (${user.email})`);
      });
    } else {
      console.log('❌ 请求失败', response.data);
    }
  } catch (error) {
    console.log('❌ 请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  
  // 7. 测试 POST /api/users/:id/roles - 给用户分配角色
  console.log('7. 测试 POST /api/users/:id/roles - 给用户分配角色');
  try {
    const firstUser = users[0];
    if (firstUser) {
      console.log(`   选择用户: ${firstUser.name} (${firstUser.id})`);
      
      // 找到 sales 角色
      const salesRole = roles.find(r => r.name === 'sales');
      
      if (salesRole) {
        console.log(`   选择角色: ${salesRole.displayName} (${salesRole.id})`);
        
        // 获取用户当前角色（需要单独获取）
        let currentRoleIds = [];
        try {
          const getRolesResponse = await client.get(`${BASE_URL}/api/users/${firstUser.id}/roles`);
          if (getRolesResponse.status === 200 && getRolesResponse.data.data) {
            currentRoleIds = getRolesResponse.data.data.map(r => r.id);
          }
        } catch (e) {
          currentRoleIds = [];
        }
        
        if (!currentRoleIds.includes(salesRole.id)) {
          currentRoleIds.push(salesRole.id);
        }
        
        const assignResponse = await client.post(
          `${BASE_URL}/api/users/${firstUser.id}/roles`,
          { roleIds: currentRoleIds }
        );
        
        if (assignResponse.status === 200) {
          console.log('✅ 用户角色分配成功');
          if (assignResponse.data.data) {
            console.log(`   用户现在有 ${assignResponse.data.data.length} 个角色`);
          }
        } else {
          console.log('❌ 用户角色分配失败', assignResponse.data);
        }
      } else {
        console.log('❌ 未找到 sales 角色');
      }
    } else {
      console.log('❌ 未找到任何用户');
    }
  } catch (error) {
    console.log('❌ 用户角色分配请求失败:', error.message);
    if (error.response) {
      console.log('   状态码:', error.response.status);
      console.log('   错误信息:', error.response.data);
    }
  }
  
  console.log('');
  console.log('=== API 测试完成 ===');
}

testRBAC();
