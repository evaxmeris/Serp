# 角色权限管理系统测试用例

## 目录

- [1. 功能测试用例](#1-功能测试用例)
  - [1.1 角色管理](#11-角色管理)
  - [1.2 权限配置](#12-权限配置)
  - [1.3 用户角色分配](#13-用户角色分配)
  - [1.4 权限验证](#14-权限验证)
- [2. 边界测试用例](#2-边界测试用例)
- [3. 异常场景测试](#3-异常场景测试)
- [4. 集成测试用例](#4-集成测试用例)
- [5. 回归测试用例](#5-回归测试用例)
- [6. 安全测试用例](#6-安全测试用例)

---

## 1. 功能测试用例

### 1.1 角色管理

```gherkin
Feature: 角色 CRUD 管理

  Background:
    Given 我以管理员身份登录系统
    And 我进入角色管理页面

  Scenario: 创建新角色
    When 我点击"新建角色"按钮
    And 我填写角色信息：
      | 字段 | 值 |
      | 角色名称 | 销售主管 |
      | 描述 | 销售团队主管，拥有销售模块全部权限 |
    And 我点击"保存"按钮
    Then 系统应该成功创建新角色
    And 新角色"销售主管"应该显示在角色列表中
    And 数据库中 roles 表应该有对应记录

  Scenario: 查看角色详情
    Given 系统中已经存在角色"销售主管"
    When 我点击角色"销售主管"的"查看"按钮
    Then 系统应该显示角色详情
    And 详情中包含正确的角色名称和描述

  Scenario: 更新角色信息
    Given 系统中已经存在角色"销售主管"
    When 我点击角色"销售主管"的"编辑"按钮
    And 我修改描述为"销售团队主管，负责销售团队管理"
    And 我点击"保存"按钮
    Then 系统应该成功更新角色信息
    And 角色列表中显示更新后的描述

  Scenario: 删除未关联用户的角色
    Given 系统中已经存在角色"测试角色"
    And 该角色没有关联任何用户
    When 我点击角色"测试角色"的"删除"按钮
    And 我确认删除操作
    Then 系统应该成功删除该角色
    And 角色列表中不再显示该角色
    And 数据库中该角色记录已被删除

  Scenario: 删除系统内置角色
    Given 系统中存在内置角色"ADMIN"
    And 该角色标记为 isSystem = true
    When 我尝试删除该角色
    Then 系统应该拒绝删除
    And 显示错误提示"系统内置角色无法删除"

  Scenario: 搜索角色
    Given 系统中存在多个角色："销售主管"、"普通销售"、"采购主管"
    When 我在搜索框输入"销售"
    And 我点击搜索按钮
    Then 列表中应该只显示包含"销售"的角色
    And 显示"销售主管"和"普通销售"
    And 不显示"采购主管"

  Scenario: 分页加载角色列表
    Given 系统中有超过每页数量的角色
    When 我切换到第 2 页
    Then 应该显示第 2 页的角色数据
    And 分页指示器显示当前页码正确
```

### 1.2 权限配置

```gherkin
Feature: 角色权限配置

  Background:
    Given 我以管理员身份登录系统
    And 我进入角色管理页面
    And 我点击编辑角色"销售主管"
    And 我进入权限配置标签页

  Scenario: 为角色分配单个权限
    When 我在权限树中勾选"产品查看"权限
    And 我点击"保存权限"按钮
    Then 系统应该成功保存权限配置
    And 角色权限关联表中应该有对应的记录

  Scenario: 为角色分配模块全部权限
    When 我勾选模块"产品"的父节点
    Then 权限树应该自动勾选该模块下所有子权限
    When 我点击"保存权限"按钮
    Then 系统应该成功保存所有勾选的权限

  Scenario: 取消模块全部权限
    Given 角色"销售主管"已勾选产品模块全部权限
    When 我取消勾选模块"产品"的父节点
    Then 权限树应该自动取消勾选该模块下所有子权限
    When 我点击"保存权限"按钮
    Then 该模块下所有权限都应该从角色中移除

  Scenario: 预览角色权限
    When 我完成权限勾选
    And 我点击"预览权限"按钮
    Then 系统应该显示当前勾选的所有权限列表
    And 显示权限总数统计

  Scenario: 清空所有权限
    Given 角色"销售主管"已有 5 个权限
    When 我点击"清空全部"按钮
    And 我确认清空操作
    Then 所有权限勾选都应该被取消
    When 我保存
    Then 该角色在角色权限关联表中没有任何记录
```

### 1.3 用户角色分配

```gherkin
Feature: 用户角色分配

  Background:
    Given 我以管理员身份登录系统
    And 系统中已存在用户"张三"
    And 系统中已存在角色"销售主管"和"普通销售"

  Scenario: 为单个用户分配单个角色
    When 我进入用户"张三"的角色分配页面
    And 我勾选角色"销售主管"
    And 我点击"保存"按钮
    Then 系统应该成功保存分配
    And 用户角色关联表中应该有对应记录

  Scenario: 为单个用户分配多个角色
    When 我进入用户"张三"的角色分配页面
    And 我同时勾选"销售主管"和"普通销售"
    And 我点击"保存"按钮
    Then 系统应该成功保存两个角色分配
    And 用户拥有两个角色的所有权限

  Scenario: 移除用户的角色
    Given 用户"张三"已分配角色"销售主管"
    When 我进入用户"张三"的角色分配页面
    And 我取消勾选"销售主管"
    And 我点击"保存"按钮
    Then 系统应该移除此角色分配
    And 用户角色关联表中删除对应记录

  Scenario: 批量分配角色给多个用户
    When 我在用户列表勾选多个用户："张三"、"李四"
    And 我点击"批量分配角色"
    And 我选择角色"普通销售"
    And 我确认分配
    Then 所有选中的用户都应该被分配该角色
    And 显示成功分配提示

  Scenario: 查看用户拥有的角色
    Given 用户"张三"已分配角色"销售主管"
    When 我查看用户"张三"详情
    Then 详情中应该显示用户拥有的角色列表
    And 包含"销售主管"
```

### 1.4 权限验证

```gherkin
Feature: 权限验证

  Background:
    Given 系统已配置角色"普通销售"
    And 角色拥有"products:read"权限
    And 角色没有"products:delete"权限
    And 存在用户"sales@test.com"已分配该角色
    And 我以"sales@test.com"身份登录

  Scenario: 用户拥有权限可以访问功能
    When 我访问产品列表页面
    Then 系统应该允许访问
    And 产品列表正常显示

  Scenario: 用户没有权限不能访问功能
    When 我尝试访问删除产品 API
    Then 系统应该拒绝访问
    And 返回 403 权限不足错误
    And 显示错误提示"权限不足，无法执行此操作"

  Scenario: 菜单权限控制
    Given 用户只有产品查看权限没有订单权限
    When 用户进入系统主页
    Then 侧边栏应该显示"产品"菜单
    And 不应该显示"订单"菜单

  Scenario: 按钮权限控制
    Given 用户只有查看权限没有删除权限
    When 用户进入产品列表页面
    Then 页面显示查看按钮
    And 不显示删除按钮

  Scenario: 多角色权限合并
    Given 用户同时拥有角色 A（产品查看）和角色 B（产品删除）
    When 用户访问产品列表
    Then 用户可以查看产品
    And 用户可以删除产品
```

---

## 2. 边界测试用例

```gherkin
Feature: 边界测试

  Scenario: 角色名称最小长度
    When 创建角色，名称长度为 1 个字符
    Then 系统应该接受并创建成功

  Scenario: 角色名称达到最大长度
    When 创建角色，名称长度为 100 个字符
    Then 系统应该接受并创建成功

  Scenario: 角色名称超过最大长度
    When 创建角色，名称长度为 101 个字符
    Then 系统应该拒绝创建
    And 显示错误提示"角色名称长度不能超过 100 个字符"

  Scenario: 空权限角色
    When 创建角色不勾选任何权限
    And 保存角色
    Then 系统应该允许创建
    And 角色没有任何权限
    And 用户分配此角色后无法访问任何需要权限的功能

  Scenario: 全权限角色
    When 创建角色勾选所有权限
    And 保存角色
    Then 系统应该允许创建
    And 所有权限都正确关联

  Scenario: 单个用户分配所有角色
    When 单个用户分配系统中所有角色
    Then 系统应该保存成功
    And 权限验证正确合并所有角色的权限

  Scenario: 角色名称完全重复
    Given 已存在角色"销售主管"
    When 创建另一个同名角色"销售主管"
    Then 系统应该拒绝创建
    And 显示错误提示"角色名称已存在"

  Scenario: 禁用角色
    Given 角色"销售主管"已启用
    When 我禁用该角色
    And 用户已分配该角色
    Then 用户登录后不再拥有该角色的权限
```

---

## 3. 异常场景测试

```gherkin
Feature: 异常场景测试

  Scenario: 删除有用户关联的角色
    Given 存在一个角色"销售主管"
    And 该角色已分配给至少一个用户
    When 我尝试删除该角色
    Then 系统应该拒绝删除
    And 显示错误提示"该角色有用户关联，无法删除，请先移除所有用户关联"

  Scenario: 删除不存在的角色
    When 通过 API 请求删除一个不存在的角色 ID
    Then 系统返回 404 错误
    And 提示"角色不存在"

  Scenario: 更新不存在的角色
    When 通过 API 请求更新一个不存在的角色 ID
    Then 系统返回 404 错误
    And 提示"角色不存在"

  Scenario: 分配不存在的权限给角色
    When 尝试分配一个不存在的权限 ID 给角色
    Then 系统应该拒绝保存
    And 提示"权限不存在"

  Scenario: 分配不存在的角色给用户
    When 尝试分配一个不存在的角色给用户
    Then 系统应该拒绝保存
    And 提示"角色不存在"

  Scenario: 并发创建同名角色
    Given 两个请求同时创建同名角色
    Then 其中一个成功，一个失败
    And 不会出现两条同名记录

  Scenario: 事务回滚 - 创建角色权限分配失败
    When 创建角色时，部分权限分配失败
    Then 整个事务应该回滚
    And 不创建不完整的角色

  Scenario: 角色名称为空
    When 创建角色，角色名称为空字符串
    Then 系统拒绝创建
    And 提示"角色名称不能为空"
```

---

## 4. 集成测试用例

```gherkin
Feature: 集成测试

  Scenario: 前端创建角色流程集成
    Given 管理员在前端填写角色信息
    When 点击保存
    Then 前端发送 POST 请求到后端 API
    And 后端验证通过
    And 后端插入数据到 roles 表
    And 后端返回成功响应
    And 前端显示成功提示
    And 角色列表刷新显示新角色

  Scenario: 数据库外键约束测试 - 删除权限
    Given 权限已分配给某个角色
    When 尝试删除该权限
    Then 外键约束阻止删除
    Or 级联删除角色权限关联

  Scenario: 数据库唯一约束测试
    Given 已存在角色名称"销售主管"
    When 尝试插入另一个同名角色
    Then 数据库唯一约束阻止插入
    And 后端返回友好错误提示

  Scenario: API 权限拦截集成
    Given 未登录用户
    When 请求角色列表 API
    Then API 返回 401 未认证

  Scenario: 已登录但无权限用户访问角色管理 API
    Given 已登录用户但没有角色管理权限
    When 请求角色列表 API
    Then API 返回 403 权限不足

  Scenario: 软删除一致性
    When 软删除一个角色
    Then 角色列表不再显示
    And 关联关系保持完整性
```

---

## 5. 回归测试用例

```gherkin
Feature: 回归测试 - 确保现有核心角色不受影响

  Scenario: 验证 ADMIN 角色存在
    Given 系统原有 ADMIN 核心角色
    When 查询数据库
    Then ADMIN 角色存在
    And isSystem = true
    And 拥有全部权限

  Scenario: 验证 SALES 角色存在
    Given 系统原有 SALES 核心角色
    When 查询数据库
    Then SALES 角色存在
    And 拥有销售模块相应权限

  Scenario: 验证 PURCHASING 角色存在
    Given 系统原有 PURCHASING 核心角色
    When 查询数据库
    Then PURCHASING 角色存在
    And 拥有采购模块相应权限

  Scenario: 验证 WAREHOUSE 角色存在
    Given 系统原有 WAREHOUSE 核心角色
    When 查询数据库
    Then WAREHOUSE 角色存在
    And 拥有仓库模块相应权限

  Scenario: 验证 VIEWER 角色存在
    Given 系统原有 VIEWER 核心角色
    When 查询数据库
    Then VIEWER 角色存在
    And 只有只读权限

  Scenario: 验证现有用户角色分配关系不变
    Given 部署前用户 A 拥有角色 X
    When 部署完成后查询
    Then 用户 A 仍然拥有角色 X
    And 关系不变

  Scenario: 验证登录权限验证正常工作
    Given 原有用户使用角色权限登录
    When 用户登录系统
    Then 登录成功
    And 用户获得相应权限

  Scenario: 验证现有 API 兼容性
    Given 原有 API 接口路径不变
    When 调用原有 API
    Then 返回格式与之前兼容
    And 功能正常工作

  Scenario: 不破坏原有枚举定义
    Given RoleEnum 原有 5 个枚举值
    When 检查代码
    Then 原有枚举值仍然存在
    And 没有删除
```

---

## 6. 安全测试用例

```gherkin
Feature: 安全测试

  Scenario: 未认证用户访问角色管理页面
    When 未登录状态直接访问 /settings/roles
    Then 系统重定向到登录页
    And 不显示任何角色信息

  Scenario: 普通用户尝试访问角色管理
    Given 我以普通销售用户登录
    When 我尝试访问 /settings/roles
    Then 系统显示 403 权限不足
    And 不允许访问

  Scenario: 水平越权 - 普通用户尝试修改其他用户角色
    Given 用户 A（普通销售）已登录
    When 用户 A 尝试修改用户 B 的角色分配
    Then 系统拒绝操作
    And 返回 403

  Scenario: 垂直越权 - 低权限用户尝试创建角色
    Given 只有查看权限的用户登录
    When 尝试调用创建角色 API
    Then 系统拒绝操作
    And 返回 403

  Scenario: SQL 注入测试 - 角色名称输入 SQL 语句
    When 创建角色，名称输入 "'; DROP TABLE roles;--"
    Then 系统正确转义参数
    And 不会执行注入的 SQL
    And 创建失败（名称过长或特殊字符处理正确）

  Scenario: XSS 测试 - 角色名称输入脚本
    When 创建角色，名称输入 "<script>alert('xss')</script>"
    Then 系统正确转义输出
    And 脚本不会在前端执行

  Scenario: 越权查看 - 用户尝试获取其他角色详情
    Given 普通用户只有自身信息查看权限
    When 尝试请求其他角色的详情 API
    Then 返回 403 拒绝访问

  Scenario: 权限继承测试 - 禁用父权限不影响子权限
    # 根据实际权限模型验证安全性
    Then 权限控制正确，不会绕过检查
```

---

## 测试用例统计

| 分类 | 用例数量 |
|------|---------|
| 功能测试 | 18 |
| 边界测试 | 8 |
| 异常测试 | 8 |
| 集成测试 | 6 |
| 回归测试 | 9 |
| 安全测试 | 8 |
| **总计** | **57** |

---

*文档创建时间：2026-04-11*
