"""
亚马逊广告 API 认证模块 (LWA OAuth2)
负责：用 Refresh Token 换取 Access Token，自动续期
"""
from __future__ import annotations

import json
import time
import urllib.request
import urllib.parse
from pathlib import Path

# ─── 配置（从 config.json 读取，审批通过后填入真实值） ───
CONFIG_PATH = Path(__file__).parent.parent / "config.json"

# LWA 令牌端点（官方固定）
LWA_TOKEN_URL = "https://api.amazon.com/auth/o2/token"

# 广告 API 端点（美区）
ADVERTISING_API_BASE = "https://advertising-api.amazon.com"


class AuthError(Exception):
    pass


class AmazonAdsAuth:
    def __init__(self, config: dict | None = None):
        cfg = config or self._load_config()
        self.client_id = cfg["client_id"]
        self.client_secret = cfg["client_secret"]
        self.refresh_token = cfg["refresh_token"]
        self.marketplace = cfg.get("marketplace", "US")
        self._access_token: str | None = None
        self._token_expires_at: float = 0.0

    @staticmethod
    def _load_config() -> dict:
        if not CONFIG_PATH.exists():
            raise AuthError(
                f"缺少配置文件 {CONFIG_PATH}。请先复制 config.example.json 为 config.json "
                "并填入申请到的 client_id / client_secret / refresh_token。"
            )
        return json.loads(CONFIG_PATH.read_text(encoding="utf-8"))

    def get_access_token(self, force_refresh: bool = False) -> str:
        """返回有效 access token，过期或强制时用 refresh token 换新"""
        now = time.time()
        if self._access_token and now < self._token_expires_at - 60 and not force_refresh:
            return self._access_token

        data = urllib.parse.urlencode({
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token,
            "client_id": self.client_id,
            "client_secret": self.client_secret,
        }).encode()

        req = urllib.request.Request(LWA_TOKEN_URL, data=data, method="POST")
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                payload = json.loads(resp.read())
        except Exception as e:
            raise AuthError(f"LWA 换 token 失败: {e}")

        self._access_token = payload.get("access_token")
        expires_in = int(payload.get("expires_in", 3600))
        self._token_expires_at = time.time() + expires_in
        if not self._access_token:
            raise AuthError(f"响应中无 access_token: {payload}")
        return self._access_token

    @property
    def profile_id(self) -> str:
        """广告 Profile ID（可后续从 API 获取，此处预留）"""
        return self._profile_id if hasattr(self, "_profile_id") else ""

    def set_profile_id(self, pid: str):
        self._profile_id = pid

    def headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.get_access_token()}",
            "Amazon-Advertising-API-ClientId": self.client_id,
            "Amazon-Advertising-API-Scope": self.profile_id,
            "Content-Type": "application/json",
        }


if __name__ == "__main__":
    # 自测：无配置文件时应给出清晰报错
    try:
        auth = AmazonAdsAuth()
        print("配置文件存在，token 就绪")
    except AuthError as e:
        print(f"[预期报错] {e}")
