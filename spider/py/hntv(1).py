# -*- coding: utf-8 -*-
"""
功能说明：
  - 本地生成签名 sign = sha256(固定盐 + 当前时间戳)
  - 以 HTTP 头 timestamp / sign 请求官方频道列表接口
  - 官方返回已带 wsSecret / tokenhash 鉴权的 m3u8，直接取出使用
  - 支持主源/备源切换、频道列表输出、按id/cid/name查找

API接口：
  - 频道列表：https://pubmod.hntv.tv/program/getAuth/live/class/program/11
  - 签名：sign = sha256("6ca114a836ac7d73" + timestamp)
  - HTTP头：timestamp: {ts}, sign: {sign}

使用示例：
  http://服务器/ku9/py/hntv_live.py?id=hnxw              新闻频道（主源）
  http://服务器/ku9/py/hntv_live.py?id=hnxw&src=backup   新闻频道（备源）
  http://服务器/ku9/py/hntv_live.py?cid=145               按数字cid
  http://服务器/ku9/py/hntv_live.py?name=河南卫视          按频道名
  http://服务器/ku9/py/hntv_live.py?list=1                 输出频道列表(JSON)
  带临时代理：
  http://服务器/ku9/py/hntv_live.py?id=hnws&socks5=127.0.0.1:1080

频道别名（兼容 tv1288.xyz 原版命名）：
  hnws=河南卫视 hnxw=新闻频道 hnds=都市频道 hnms=民生频道
  hngg=公共频道 hnxc=乡村频道 hndsj=电视剧频道
  本版新增：hnfz=法治频道 hngx=国学频道 hnht=欢腾购物
  hnly=梨园频道 hnwwbk=文物宝库 hnwu=武术频道 hnjczy=睛彩中原

注意：签名有效期由官方下发，实测约为 4 小时（wsTime = 请求时刻 + 14400）。
"""
import os
import re
import json
import time
import hashlib
import socket
import urllib.parse
import ipaddress
from typing import Dict, Any, Tuple, Union, Iterable, List, Optional

# ===================== 酷9基类兼容层 =====================
try:
    from base.parser import Parser as _BaseParser
except ImportError:
    # 本地测试无酷9框架时占位父类
    class _BaseParser:
        def __init__(self, *args, **kwargs):
            self.address = kwargs.get('address', '') or (args[0] if args else '')

# ===================== 依赖兼容：requests / urllib 双适配 =====================
try:
    import requests
    from requests.adapters import HTTPAdapter
    from urllib3.util.retry import Retry
    _HAS_REQUESTS = True
except ImportError:
    _HAS_REQUESTS = False
    import urllib.request
    import urllib.error

# ===================== 全局常量配置区 =====================
# 通用UA
COMMON_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36'

# 网站基础地址
WEB_BASE = 'https://www.hntv.tv'
WEB_REFERER = 'https://www.hntv.tv/'

# API配置（从PHP原版移植）
API_SECRET = '6ca114a836ac7d73'   # 官方前端固定盐值
API_BASE = 'https://pubmod.hntv.tv/program/getAuth'
CLASS_ID = 11                        # 电视直播分类 ID

# 缓存配置
CACHE_TTL = 60  # 频道列表本地缓存秒数（与PHP原版一致）
CACHE_DIR_NAME = "ku9_cache"

# 代理全局规则列表 格式：(匹配域名通配符/CIDR网段, 代理地址, 代理类型socks5/http)
PROXY_RULES: List[Tuple[str, str, str]] = [
    # 示例：匹配所有*.hndt.com自动走socks5代理
    # ("*.hndt.com", "127.0.0.1:1080", "socks5"),
]

# 频道别名 -> 官方数字 cid（从PHP原版 CHANNEL_ALIAS 移植）
CHANNEL_ALIAS: Dict[str, int] = {
    'hnws':   145,  # 河南卫视
    'hnxw':   149,  # 新闻频道
    'hnds':   141,  # 都市频道
    'hnms':   146,  # 民生频道
    'hnfz':   147,  # 法治频道
    'hngg':   151,  # 公共频道
    'hnxc':   152,  # 河南乡村频道
    'hndsj':  148,  # 电视剧频道
    'hnht':   150,  # 欢腾购物
    'hngx':   194,  # 国学频道
    'hnly':   154,  # 梨园频道（腾讯 dxtx 源）
    'hnwwbk': 155,  # 文物宝库（腾讯 dxtx 源）
    'hnwu':   156,  # 武术频道（腾讯 dxtx 源）
    'hnjczy': 157,  # 睛彩中原（腾讯 dxtx 源）
}

DEFAULT_ID = 'hnws'

# ===================== 签名工具 =====================
def generate_sign() -> Tuple[str, str]:
    """
    生成API签名
    返回：(timestamp, sign)
    sign = sha256(API_SECRET + timestamp)
    """
    ts = str(int(time.time()))
    sign = hashlib.sha256((API_SECRET + ts).encode('utf-8')).hexdigest()
    return ts, sign

# ===================== 通用HTTP工具函数 =====================
def _http_get(url, headers=None, timeout=15, proxies=None):
    headers = headers or {}
    headers.setdefault("User-Agent", COMMON_UA)
    if _HAS_REQUESTS:
        try:
            r = requests.get(url, headers=headers, timeout=timeout, proxies=proxies, verify=False)
            return r.status_code, dict(r.headers), r.content
        except Exception as e:
            return -1, {}, str(e).encode("utf-8")
    # urllib降级方案
    req = urllib.request.Request(url, headers=headers)
    if proxies:
        proxy_handler = None
        if proxies.get("http"):
            proxy_url = proxies["http"].replace("socks5h://", "socks5://")
            proxy_handler = urllib.request.ProxyHandler({"http": proxy_url, "https": proxy_url})
        opener = urllib.request.build_opener(proxy_handler) if proxy_handler else urllib.request.build_opener()
        urllib.request.install_opener(opener)
    try:
        resp = urllib.request.urlopen(req, timeout=timeout)
        return resp.getcode(), dict(resp.info()), resp.read()
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()
    except Exception as e:
        return -1, {}, str(e).encode("utf-8")

# ===================== 带签名的API请求 =====================
def api_get_signed(url: str, timeout: int = 15, proxies: Dict = None) -> Optional[str]:
    """
    带签名请求官方接口
    自动生成 timestamp / sign HTTP头
    返回：响应文本，失败返回None
    """
    ts, sign = generate_sign()
    headers = {
        "User-Agent": COMMON_UA,
        "timestamp": ts,
        "sign": sign,
        "Accept": "application/json",
        "Referer": WEB_REFERER,
    }
    status, _, content = _http_get(url, headers=headers, timeout=timeout, proxies=proxies)
    if status == 200:
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return None
    return None

# ===================== 代理匹配核心工具 =====================
# 强制IPv4解析补丁
original_getaddrinfo = socket.getaddrinfo
def getaddrinfo_ipv4_only(*args):
    try:
        res = original_getaddrinfo(*args)
        ipv4_list = [item for item in res if item[0] == socket.AF_INET]
        return ipv4_list if ipv4_list else res
    except Exception:
        return original_getaddrinfo(*args)

def match_proxy_rule(host: str) -> Tuple[Optional[str], Optional[str]]:
    """根据域名匹配全局代理规则，返回(代理地址,代理类型)"""
    for rule, proxy_addr, ptype in PROXY_RULES:
        if not proxy_addr:
            continue
        if "/" in rule:
            try:
                ip_obj = ipaddress.ip_address(host)
                net = ipaddress.ip_network(rule, strict=False)
                if ip_obj in net:
                    return proxy_addr, ptype
            except ValueError:
                pass
        elif "*" in rule:
            reg = "^" + re.escape(rule).replace(r"\*", ".*") + "$"
            if re.match(reg, host, re.IGNORECASE):
                return proxy_addr, ptype
        else:
            if host.lower() == rule.lower():
                return proxy_addr, ptype
    return None, None

def build_proxy_dict(proxy_addr: str, proxy_type: str) -> Dict[str, str]:
    """构造requests兼容代理字典"""
    if not proxy_addr:
        return {}
    if proxy_type == "socks5":
        return {"http": f"socks5h://{proxy_addr}", "https": f"socks5h://{proxy_addr}"}
    elif proxy_type == "http":
        return {"http": f"http://{proxy_addr}", "https": f"http://{proxy_addr}"}
    return {}

def resolve_request_proxy(target_url: str, param_socks5: str, param_http: str) -> Tuple[Dict[str, str], str, str]:
    """代理优先级：URL传参 > 全局规则"""
    if param_socks5.strip():
        return build_proxy_dict(param_socks5, "socks5"), param_socks5, "socks5"
    if param_http.strip():
        return build_proxy_dict(param_http, "http"), param_http, "http"
    try:
        parsed = urllib.parse.urlparse(urllib.parse.unquote(target_url))
        host = parsed.hostname
        if host:
            addr, ptype = match_proxy_rule(host)
            if addr:
                return build_proxy_dict(addr, ptype), addr, ptype
    except Exception:
        pass
    return {}, "", ""

# ===================== M3U8重写工具 =====================
def rewrite_m3u8_content(m3u8_text: str, base_m3u8_url: str, proxy_addr: str, proxy_type: str, self_proxy_addr: str, extra_params: Dict = None) -> str:
    """重写m3u8内TS/KEY链接，全部中转到当前脚本proxy接口"""
    if not m3u8_text.strip():
        return m3u8_text
    extra_params = extra_params or {}
    parsed_base = urllib.parse.urlparse(base_m3u8_url)
    root_host = f"{parsed_base.scheme}://{parsed_base.netloc}"
    base_dir = base_m3u8_url.rsplit("/", 1)[0] + "/"

    def to_abs_url(uri: str) -> str:
        if uri.startswith(("http://", "https://")):
            return uri
        if uri.startswith("/"):
            return root_host + uri
        return urllib.parse.urljoin(base_dir, uri)

    def wrap_to_self_proxy(target: str) -> str:
        query_parts = []
        if proxy_type == "socks5" and proxy_addr:
            query_parts.append(f"socks5={urllib.parse.quote(proxy_addr)}")
        elif proxy_type == "http" and proxy_addr:
            query_parts.append(f"http={urllib.parse.quote(proxy_addr)}")
        query_parts.append(f"u={urllib.parse.quote(target, safe='')}")
        for k, v in extra_params.items():
            query_parts.append(f"{k}={urllib.parse.quote_plus(str(v))}")
        return f"{self_proxy_addr}?{'&'.join(query_parts)}"

    output_lines = []
    for line in m3u8_text.splitlines():
        strip_line = line.strip()
        if not strip_line:
            output_lines.append(line)
            continue
        if strip_line.startswith("#") and 'URI="' in strip_line:
            def uri_replace(match):
                raw_uri = match.group(1)
                abs_u = to_abs_url(raw_uri)
                return f'URI="{wrap_to_self_proxy(abs_u)}"'
            new_line = re.sub(r'URI="([^"]+)"', uri_replace, strip_line)
            output_lines.append(new_line)
            continue
        if strip_line.startswith("#"):
            output_lines.append(strip_line)
            continue
        abs_target = to_abs_url(strip_line)
        output_lines.append(wrap_to_self_proxy(abs_target))
    return "\n".join(output_lines)

# ===================== 缓存工具 =====================
def get_cache_path(script_dir: str, cache_key: str) -> str:
    cache_root = os.path.join(script_dir, CACHE_DIR_NAME)
    os.makedirs(cache_root, exist_ok=True, mode=0o755)
    md5_name = hashlib.md5(cache_key.encode("utf-8")).hexdigest() + ".cache"
    return os.path.join(cache_root, md5_name)

def read_cache(cache_file: str) -> Optional[Any]:
    if not os.path.exists(cache_file):
        return None
    try:
        stat_info = os.stat(cache_file)
        if time.time() - stat_info.st_mtime > CACHE_TTL:
            os.remove(cache_file)
            return None
        with open(cache_file, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        try:
            os.remove(cache_file)
        except:
            pass
        return None

def write_cache(cache_file: str, data: Any):
    try:
        tmp = cache_file + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False)
        os.replace(tmp, cache_file)
    except Exception:
        pass

# ===================== 河南广电业务解析函数 =====================
def fetch_channels(proxies: Dict = None) -> List[Dict]:
    """
    获取频道列表（带本地缓存）
    返回：统一结构的频道列表
    每项：{cid, name, logo, program, time, url, url_bak}
    """
    url = f"{API_BASE}/live/class/program/{CLASS_ID}"
    raw = api_get_signed(url, timeout=15, proxies=proxies)
    if not raw:
        return []

    try:
        data = json.loads(raw)
    except Exception:
        return []

    if not isinstance(data, list) or not data:
        return []

    # 统一结构（与PHP原版 get_channels 一致）
    out = []
    for ch in data:
        main = ch.get('video_streams', [''])[0] if ch.get('video_streams') else ''
        backup = ch.get('streams', [''])[0] if ch.get('streams') else ''
        if not main and not backup:
            continue
        out.append({
            'cid': int(ch.get('cid', 0)),
            'name': str(ch.get('name', '')),
            'logo': str(ch.get('logo', '')),
            'program': str(ch.get('live', '')),
            'time': str(ch.get('time', '')),
            'url': main,
            'url_bak': backup,
        })
    return out

def find_channel(channels: List[Dict], id_key: str = '', cid: str = '', name: str = '') -> Optional[Dict]:
    """
    按 id / cid / name 三个维度查找频道（与PHP原版 find_channel 一致）
    """
    key = (id_key or DEFAULT_ID).lower().strip()

    # 1. 按数字cid查找
    if cid:
        for c in channels:
            if str(c['cid']) == str(cid):
                return c

    # 2. 按频道名查找（精确或包含）
    if name:
        for c in channels:
            if c['name'] == name or name in c['name']:
                return c

    # 3. 按别名查找
    if key in CHANNEL_ALIAS:
        want = str(CHANNEL_ALIAS[key])
        for c in channels:
            if str(c['cid']) == want:
                return c

    # 4. 兜底：别名直接是数字cid
    for c in channels:
        if str(c['cid']) == key:
            return c

    return None

def pick_url(channel: Dict, use_backup: bool = False) -> str:
    """取最终播放地址（主源/备源）"""
    if use_backup:
        return channel.get('url_bak', '') or channel.get('url', '')
    return channel.get('url', '') or channel.get('url_bak', '')

# ===================== 酷9标准Parser主类 =====================
class Parser(_BaseParser):
    """
    酷9标准解析器 - 河南广电（大象网）电视直播解析
    """
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.script_path = os.path.abspath(__file__)
        self.script_dir = os.path.dirname(self.script_path)
        self.token_cache = {}
        self.session = None
        if _HAS_REQUESTS:
            self._init_request_session()

    def _init_request_session(self):
        """创建带重试的requests会话"""
        self.session = requests.Session()
        retry_rule = Retry(total=2, backoff_factor=0.2, status_forcelist=[408,500,502,503,504])
        adapter = HTTPAdapter(pool_connections=5, pool_maxsize=10, max_retries=retry_rule)
        self.session.mount("http://", adapter)
        self.session.mount("https://", adapter)
        self.session.headers.update({"User-Agent": COMMON_UA})

    def parse(self, params: Dict[str, str]) -> Dict[str, Any]:
        """
        酷9核心入口方法
        成功：{"url":"播放地址","headers":{请求头}}
        失败：{"error":"错误描述"}
        """
        # 1. 读取URL参数（兼容PHP原版参数名）
        req_id = params.get("id", "").strip()
        req_cid = params.get("cid", "").strip()
        req_name = params.get("name", "").strip()
        use_backup = params.get("src", "").strip().lower() == "backup"
        want_list = params.get("list", "").strip() != ""
        param_socks5 = params.get("socks5", "").strip()
        param_http = params.get("http", "").strip()

        # 2. 解析代理
        proxies, proxy_addr, proxy_type = resolve_request_proxy(API_BASE, param_socks5, param_http)

        # 3. 获取频道列表（带缓存）
        cache_key = f"hntv_channels_{CLASS_ID}"
        cache_file = get_cache_path(self.script_dir, cache_key)
        cache_data = read_cache(cache_file)

        if cache_data and "channels" in cache_data:
            channels = cache_data["channels"]
        else:
            channels = fetch_channels(proxies=proxies)
            if not channels:
                return {"error": "上游接口不可用（获取频道列表失败）"}
            write_cache(cache_file, {"channels": channels})

        # 4. 列表模式：返回所有频道信息
        if want_list:
            channel_list = []
            for c in channels:
                channel_list.append({
                    "cid": c["cid"],
                    "name": c["name"],
                    "program": c["program"],
                    "alias": self._find_alias_by_cid(c["cid"]),
                    "url": pick_url(c, use_backup),
                    "url_bak": c["url_bak"],
                    "logo": c["logo"],
                })
            return {
                "code": 0,
                "count": len(channel_list),
                "channels": channel_list,
            }

        # 5. 单频道模式：查找目标频道
        ch = find_channel(channels, req_id, req_cid, req_name)
        if ch is None:
            available = ", ".join(CHANNEL_ALIAS.keys())
            return {"error": f"频道不存在，可用别名：{available}"}

        # 6. 取播放地址
        url = pick_url(ch, use_backup)
        if not url:
            return {"error": f"该频道（{ch['name']}）暂无可用流"}

        # 7. 构造返回头
        headers_out = {
            "User-Agent": COMMON_UA,
            "Referer": WEB_REFERER,
            "Origin": "https://www.hntv.tv",
        }

        # 8. 返回结果
        return {
            "url": url,
            "headers": headers_out,
            # 附加信息（便于调试）
            "cid": ch["cid"],
            "name": ch["name"],
            "program": ch["program"],
            "source": "backup" if use_backup else "main",
        }

    def _find_alias_by_cid(self, cid: int) -> str:
        """根据cid查找别名"""
        for alias, c in CHANNEL_ALIAS.items():
            if c == cid:
                return alias
        return ""

    def proxy(self, url: str, headers: Dict[str, Any]) -> Tuple[Union[bytes, Iterable[bytes]], Dict[str, str]]:
        """
        流媒体中转代理接口（酷9标准）
        作用：重写m3u8、跨域中转TS分片
        """
        socket.getaddrinfo = getaddrinfo_ipv4_only
        try:
            parsed = urllib.parse.urlparse(url)
            query = urllib.parse.parse_qs(parsed.query, keep_blank_values=True)
            param_socks5 = query.get("socks5", [""])[0]
            param_http = query.get("http", [""])[0]
            target_raw = query.get("u", [""])[0]
            target_url = urllib.parse.unquote(target_raw)

            if not target_url:
                return self._proxy_error("缺少参数u=目标流地址", 400)

            proxies, proxy_addr, proxy_type = resolve_request_proxy(target_url, param_socks5, param_http)

            req_headers = dict(headers) if headers else {}
            req_headers.setdefault("User-Agent", COMMON_UA)
            req_headers.setdefault("Referer", WEB_REFERER)

            status, resp_headers, content = _http_get(target_url, headers=req_headers, proxies=proxies, timeout=20)
            if status >= 400 or status == -1:
                return self._proxy_error(f"源请求失败 HTTP{status}", status if status != -1 else 500)

            content_type = resp_headers.get("Content-Type", "").lower()
            is_m3u8 = ".m3u8" in target_url.lower() or "mpegurl" in content_type

            if is_m3u8:
                m3u8_text = content.decode("utf-8", errors="ignore")
                new_m3u8 = rewrite_m3u8_content(
                    m3u8_text, target_url,
                    proxy_addr, proxy_type,
                    self.address, extra_params=query
                )
                out_bytes = new_m3u8.encode("utf-8")
                out_header = {
                    "Content-Type": "application/vnd.apple.mpegurl",
                    "Content-Length": str(len(out_bytes)),
                    "Access-Control-Allow-Origin": "*"
                }
                return out_bytes, out_header

            out_header = {
                "Content-Type": resp_headers.get("Content-Type", "video/MP2T"),
                "Access-Control-Allow-Origin": "*",
                "Cache-Control": "public, max-age=7200"
            }
            return iter([content]), out_header

        except Exception as e:
            return self._proxy_error(f"代理异常：{str(e)}", 500)
        finally:
            socket.getaddrinfo = original_getaddrinfo

    def _proxy_error(self, msg: str, code: int = 500) -> Tuple[bytes, Dict[str, str]]:
        """proxy接口统一错误返回封装"""
        err_bytes = f"[ProxyError] {msg}".encode("utf-8")
        header = {
            "Content-Type": "text/plain; charset=utf-8",
            "Content-Length": str(len(err_bytes)),
            "Access-Control-Allow-Origin": "*",
            "X-Proxy-Status": str(code)
        }
        return err_bytes, header

    def stop(self):
        """酷9换台/销毁时资源释放钩子"""
        if self.session:
            self.session.close()
            self.session = None
        self.token_cache.clear()

# ===================== 本地测试入口（if __name__） =====================
if __name__ == "__main__":
    print("=" * 70)
    print("酷9PY解析器 - 河南广电（大象网 hndt.com / hntv.tv）电视直播解析 本地测试")
    print("=" * 70)

    print("\n【频道别名映射】")
    for alias, cid in CHANNEL_ALIAS.items():
        print(f"  {alias:8s} -> cid={cid}")

    print("\n" + "=" * 70)
    print("【测试1：生成签名】")
    ts, sign = generate_sign()
    print(f"  timestamp = {ts}")
    print(f"  sign      = {sign}")
    print(f"  (sha256('{API_SECRET}' + '{ts}'))")

    print("\n" + "=" * 70)
    print("【测试2：获取频道列表（带签名请求官方API）】")
    channels = fetch_channels()
    if channels:
        print(f"  成功获取 {len(channels)} 个频道：")
        print()
        for ch in channels:
            alias = ""
            for a, c in CHANNEL_ALIAS.items():
                if c == ch["cid"]:
                    alias = a
                    break
            src_type = "腾讯源" if "dxtx.hntv.tv" in ch["url"] else "大象源"
            print(f"  cid={ch['cid']:3d} [{alias:8s}] {ch['name']:12s} 当前:{ch['program'][:15]:15s} ({src_type})")
    else:
        print("  获取频道列表失败！")

    print("\n" + "=" * 70)
    print("【测试3：解析河南卫视（hnws，主源）】")
    test_parser = Parser()
    test_result = test_parser.parse({"id": "hnws"})
    print("  parse返回：")
    print(json.dumps(test_result, ensure_ascii=False, indent=2))

    print("\n" + "=" * 70)
    print("【测试4：解析新闻频道（hnxw，备源）】")
    test_result2 = test_parser.parse({"id": "hnxw", "src": "backup"})
    print("  parse返回：")
    print(json.dumps(test_result2, ensure_ascii=False, indent=2))

    print("\n" + "=" * 70)
    print("【测试5：按数字cid解析（cid=141 都市频道）】")
    test_result3 = test_parser.parse({"cid": "141"})
    print("  parse返回：")
    print(json.dumps(test_result3, ensure_ascii=False, indent=2))

    print("\n" + "=" * 70)
    print("【测试6：输出频道列表（list=1）】")
    test_result4 = test_parser.parse({"list": "1"})
    if "channels" in test_result4:
        print(f"  共 {test_result4['count']} 个频道：")
        for ch in test_result4["channels"]:
            print(f"    {ch['alias']:8s} {ch['name']:12s} cid={ch['cid']}")
    else:
        print(json.dumps(test_result4, ensure_ascii=False, indent=2))

    print("\n" + "=" * 70)
    print("测试完成！")