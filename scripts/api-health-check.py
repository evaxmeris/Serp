#!/usr/bin/env python3
"""
API 健康检查脚本
测试所有核心 API 端点的可用性
"""

import requests
import json
import time
from datetime import datetime

BASE_URL = "http://localhost:3001"

# 核心 API 端点列表
API_ENDPOINTS = [
    # 产品管理
    {"method": "GET", "path": "/api/products", "name": "产品列表"},
    {"method": "GET", "path": "/api/product-research/categories", "name": "品类列表"},
    {"method": "GET", "path": "/api/product-research/templates", "name": "属性模板列表"},
    {"method": "GET", "path": "/api/product-research/products", "name": "调研产品列表"},
    
    # 订单管理
    {"method": "GET", "path": "/api/orders", "name": "销售订单列表"},
    {"method": "GET", "path": "/api/outbound-orders", "name": "出库单列表"},
    
    # 采购管理
    {"method": "GET", "path": "/api/purchase-orders", "name": "采购订单列表"},
    {"method": "GET", "path": "/api/suppliers", "name": "供应商列表"},
    
    # 报表
    {"method": "GET", "path": "/api/reports/sales", "name": "销售报表"},
    {"method": "GET", "path": "/api/reports/inventory", "name": "库存报表"},
    {"method": "GET", "path": "/api/reports/profit", "name": "利润报表"},
    
    # 系统
    {"method": "GET", "path": "/api/users", "name": "用户列表"},
    {"method": "GET", "path": "/api/roles", "name": "角色列表"},
]

def check_api_health():
    """检查所有 API 端点"""
    results = []
    
    print(f"\n{'='*60}")
    print(f"API 健康检查 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*60}\n")
    
    for endpoint in API_ENDPOINTS:
        url = f"{BASE_URL}{endpoint['path']}"
        start_time = time.time()
        
        try:
            if endpoint['method'] == 'GET':
                response = requests.get(url, timeout=5)
            
            elapsed = time.time() - start_time
            
            result = {
                "name": endpoint["name"],
                "url": url,
                "status": response.status_code,
                "time": elapsed,
                "success": response.status_code in [200, 307, 401]  # 401 表示需要登录，也算正常
            }
            
            status_icon = "✅" if result["success"] else "❌"
            print(f"{status_icon} {endpoint['name']:20s} - {response.status_code} ({elapsed*1000:.0f}ms)")
            
            results.append(result)
            
        except requests.exceptions.ConnectionError as e:
            result = {
                "name": endpoint["name"],
                "url": url,
                "status": "CONNECTION_ERROR",
                "time": 0,
                "success": False,
                "error": str(e)
            }
            print(f"❌ {endpoint['name']:20s} - 连接失败")
            results.append(result)
            
        except Exception as e:
            result = {
                "name": endpoint["name"],
                "url": url,
                "status": "ERROR",
                "time": 0,
                "success": False,
                "error": str(e)
            }
            print(f"❌ {endpoint['name']:20s} - {str(e)}")
            results.append(result)
    
    # 统计结果
    total = len(results)
    success = sum(1 for r in results if r["success"])
    failed = total - success
    avg_time = sum(r["time"] for r in results if r["time"] > 0) / max(success, 1)
    
    print(f"\n{'='*60}")
    print(f"总计：{total} 个 API")
    print(f"成功：{success} 个 ({success/total*100:.1f}%)")
    print(f"失败：{failed} 个 ({failed/total*100:.1f}%)")
    print(f"平均响应时间：{avg_time*1000:.0f}ms")
    print(f"{'='*60}\n")
    
    # 生成报告
    report = {
        "timestamp": datetime.now().isoformat(),
        "total": total,
        "success": success,
        "failed": failed,
        "avg_response_time_ms": round(avg_time * 1000, 2),
        "results": results
    }
    
    # 保存报告
    report_file = f"/Users/apple/clawd/trade-erp/logs/api-health-check-{datetime.now().strftime('%Y%m%d-%H%M%S')}.json"
    with open(report_file, 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print(f"报告已保存到：{report_file}\n")
    
    return report

if __name__ == "__main__":
    check_api_health()
