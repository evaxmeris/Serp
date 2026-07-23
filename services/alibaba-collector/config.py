"""
Alibaba 后台批量采集服务 - 配置
"""
import os

# ERP 地址（从 Trade ERP 读取）
ERP_URL = os.environ.get("ERP_URL", "http://localhost:3001")
API_TOKEN = os.environ.get("COLLECT_API_TOKEN", "")

# Playwright 配置
HEADLESS = True
VIEWPORT = {"width": 1920, "height": 1080}
USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# 搜索配置
MAX_PAGES = 5           # 每个关键词最多翻页数
MAX_PRODUCTS = 50       # 最多采集产品数
CONCURRENCY = 3         # 并发浏览器实例数
TIMEOUT = 180_000       # 页面加载超时（ms）

# 图片下载
IMAGE_MAX_WIDTH = 1200
IMAGE_QUALITY = 85
MAX_IMAGES_PER_PRODUCT = 10

# 输出
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")
os.makedirs(OUTPUT_DIR, exist_ok=True)
