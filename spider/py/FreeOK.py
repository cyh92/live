# -*- coding: utf-8 -*-
"""
FreeOK TVBox 爬虫脚本（v7 · 集数显示精简）
站点: https://freeok-tv.com/

本次修改：
  幽心草。

修复保留：
  智能分组（线路不再错乱）、组内剧集用 # 分隔、空名/纯数字补号、
  三层剧集提取、详情页兜底抓播放页、TTL 缓存、预编译正则、
  6s 超时、区间切片、星落播放器 iframe 补丁
"""

import json
import re
import sys
import os
import time
import datetime
from urllib.parse import quote, urljoin

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from base.spider import Spider as BaseSpider
except ImportError:
    class BaseSpider:
        def __init__(self, query_params=None, t4_api=None):
            self.query_params = query_params or {}
            self.t4_api = t4_api or ''
            self.extend = ''
            self.ENV = 'T3'
            self._cache = {}

        def fetch(self, url, params=None, headers=None, cookies=None, timeout=8, **kwargs):
            import requests
            try:
                import urllib3
                urllib3.disable_warnings()
            except Exception:
                pass
            return requests.get(url, params=params, headers=headers,
                                cookies=cookies, timeout=timeout, verify=False)


class Spider(BaseSpider):
    SITE_URL = "https://freeok-tv.com"

    HTTP_TIMEOUT = 6
    CACHE_MAX = 30
    TTL_HOME = 600
    TTL_CATEGORY = 180
    TTL_DETAIL = 300
    TTL_PLAY = 120

    CATEGORY_MAP = {
        "电影": "1", "电视剧": "2", "综艺": "3", "动漫": "4", "短剧": "20",
    }

    HEADERS = {
        "User-Agent": (
            "Mozilla/5.0 (Linux; Android 12; Pixel 5) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Mobile Safari/537.36"
        ),
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": SITE_URL + "/",
    }

    SHORT_SNIPPET_PATTERN = re.compile(
        r'(\b15s\b|/preview[-_/]|/trial[-_/]|[?&](?:preview|trial)=1)', re.I)

    # 列表页
    RE_CARD_ANCHOR = re.compile(r'<a\s+href="(/freeok-detail/(\d+)\.html)"')
    RE_CARD_TITLE = re.compile(r'<div[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([^<]+)</div>')
    RE_CARD_IMG = re.compile(r'<img[^>]+?(?:data-original|data-src|src)="([^"]+)"')
    RE_CARD_ROLE = re.compile(r'<div[^>]*class="[^"]*\brole\b[^"]*"[^>]*>([^<]*)</div>')
    RE_PAGE_TOTAL = re.compile(r'共\s*(\d+)\s*页')
    RE_PAGE_NUM = re.compile(r'/freeok-show/[^/]+/page/(\d+)\.html')

    # 详情页
    RE_DETAIL_TITLE = re.compile(r'<h1[^>]*class="[^"]*\btitle\b[^"]*"[^>]*>([^<]+)</h1>', re.I)
    RE_DETAIL_TITLE_FB = re.compile(r'<h1[^>]*>([^<]+)</h1>')
    RE_DETAIL_PIC = re.compile(
        r'<img[^>]*class="[^"]*lazyload[^"]*"[^>]*?(?:data-original|data-src|src)="([^"]+)"', re.I)
    RE_DETAIL_PIC_FB = re.compile(r'<img[^>]*\bsrc="([^"]+)"')
    RE_DETAIL_YEAR = re.compile(r'<a[^>]*class="[^"]*tag[^"]*"[^>]*href="[^"]*/year/(\d+)\.html"')
    RE_DETAIL_INFO = re.compile(
        r'<div[^>]*class="[^"]*director[^"]*"[^>]*>\s*'
        r'<div[^>]*class="[^"]*name[^"]*"[^>]*>\s*'
        r'(导演|主演|更新)[:：]?\s*</div>\s*([^<]+)</div>')
    RE_DETAIL_DESC = re.compile(
        r'<div[^>]*class="[^"]*wrapper_more_text[^"]*"[^>]*>.*?<div>(.*?)</div>', re.S)
    RE_STRIP_TAGS = re.compile(r'<[^>]+>')

    # 剧集提取
    RE_VOD_PLAY_URLS = [
        re.compile(r'"vod_play_url"\s*:\s*"((?:[^"\\]|\\.)*)"'),
        re.compile(r'vod_play_url\s*[=:]\s*"((?:[^"\\]|\\.)*)"'),
        re.compile(r"'vod_play_url'\s*:\s*'((?:[^'\\]|\\.)*)'"),
        re.compile(r'vod_play_url\s*[=:]\s*\'((?:[^\'\\]|\\.)*)\''),
    ]
    RE_ANY_A_LINK = re.compile(
        r'<a\b[^>]*?(?:href|data-href|data-url|data-src)="([^"]+)"[^>]*>(.*?)</a>', re.S)
    RE_JS_PLAY_URLS = re.compile(
        r'["\']((?:\\?/)?(?:https?:)?(?://[^"\'/]+)?(?:\\?/)?'
        r'(?:freeok-play|play|vodplay|v_play|playlist)/[^"\']+?\.html[^"\']*)["\']')

    # URL 尾号
    RE_PLAY_TAIL = re.compile(
        r'/(?:freeok-play|play|vodplay|v_play|playlist)/([^/?#]+?)(?:\.html)?(?:[?#].*)?$')

    # 源名
    RE_SRC_PLAYER_NAME = re.compile(
        r'<li[^>]*class="[^"]*player_name[^"]*"[^>]*>\s*<a[^>]*href="#playlist[_\d]*"[^>]*>([^<]+)')
    RE_SRC_ANCHOR = re.compile(r'<a[^>]*href="#playlist[_\d]*"[^>]*>([^<]+)</a>')
    RE_SRC_MID = re.compile(r'<a[^>]*data-mid="(\d+)"[^>]*>([^<]+)</a>')

    # 播放页
    RE_DIRECT_LINK = re.compile(r'["\'](https?://[^"\']+\.(?:m3u8|mp4)[^"\']*)["\']')
    RE_IFRAME_SRC = re.compile(r'<iframe[^>]+src="([^"]+)"')

    _cache = {}

    def init(self, extend=""):
        self.extend = extend
        self._cache = {}
        return {"status": 0}

    def getName(self):
        return "🅿️FreeOK"

    # ============ 缓存 ============
    def _get_html(self, url, ttl=300):
        now = time.time()
        cached = self._cache.get(url)
        if cached and (now - cached[0]) < ttl:
            return cached[1]
        rsp = self.fetch(url, headers=self.HEADERS, timeout=self.HTTP_TIMEOUT)
        rsp.encoding = "utf-8"
        text = rsp.text
        if len(self._cache) >= self.CACHE_MAX:
            try:
                oldest = min(self._cache, key=lambda k: self._cache[k][0])
                self._cache.pop(oldest, None)
            except Exception:
                pass
        self._cache[url] = (now, text)
        return text

    # ============ 首页 / 分类 / 搜索 ============
    def homeContent(self, filter):
        classes = [{"type_id": t, "type_name": n} for n, t in self.CATEGORY_MAP.items()]
        filters = {}
        if filter:
            for n, t in self.CATEGORY_MAP.items():
                filters[t] = self._build_filters(n)
        return {"class": classes, "filters": filters}

    def _build_filters(self, name):
        areas = [("全部", ""), ("大陆", "大陆"), ("香港", "香港"), ("台湾", "台湾"),
                 ("美国", "美国"), ("法国", "法国"), ("英国", "英国"),
                 ("日本", "日本"), ("韩国", "韩国"), ("泰国", "泰国")]
        cur_year = datetime.datetime.now().year
        years = [("全部", "")] + [(str(y), str(y)) for y in range(cur_year + 1, 2018, -1)]
        return [
            {"key": "area", "name": "地区",
             "value": [{"n": n, "v": v} for n, v in areas]},
            {"key": "year", "name": "年份",
             "value": [{"n": n, "v": v} for n, v in years]},
        ]

    def homeVideoContent(self):
        try:
            html = self._get_html(self.SITE_URL + "/", ttl=self.TTL_HOME)
            return {"list": self._parse_video_list(html)}
        except Exception as e:
            print(f"[FreeOK] homeVideoContent: {e}")
            return {"list": []}

    def categoryContent(self, tid, pg, filter, extend):
        try:
            pg = int(pg) if pg else 1
            if extend and isinstance(extend, dict) and any(str(v).strip() for v in extend.values()):
                url = self._build_filter_url(tid, pg, extend)
            elif pg > 1:
                url = f"{self.SITE_URL}/freeok-show/{tid}/page/{pg}.html"
            else:
                url = f"{self.SITE_URL}/freeok-show/{tid}.html"
            print(f"[FreeOK] categoryContent url: {url}")
            html = self._get_html(url, ttl=self.TTL_CATEGORY)
        except Exception as e:
            print(f"[FreeOK] categoryContent: {e}")
            return {"list": [], "page": pg, "pagecount": 1, "limit": 20, "total": 0}
        videos = self._parse_video_list(html)
        pagecount = self._parse_pagecount(html, pg)
        return {"list": videos, "page": pg, "pagecount": pagecount,
                "limit": 20, "total": pagecount * 20}

    def _build_filter_url(self, tid, pg, extend):
        parts = [str(tid)]
        area = extend.get("area", "")
        year = extend.get("year", "")
        if area:
            parts += ["area", quote(area, safe="")]
        if year:
            parts += ["year", year]
        path = "/".join(parts)
        if pg and int(pg) > 1:
            return f"{self.SITE_URL}/freeok-show/{path}/page/{pg}.html"
        return f"{self.SITE_URL}/freeok-show/{path}.html"

    def searchContent(self, key, quick, pg=1):
        try:
            url = f"{self.SITE_URL}/freeok-search.html"
            rsp = self.fetch(url, params={"wd": key},
                             headers=self.HEADERS, timeout=self.HTTP_TIMEOUT)
            rsp.encoding = "utf-8"
            return {"list": self._parse_video_list(rsp.text)}
        except Exception as e:
            print(f"[FreeOK] searchContent: {e}")
            return {"list": []}

    # ============ 详情 ============
    def detailContent(self, ids):
        if isinstance(ids, list):
            if not ids:
                return {"list": []}
            vod_id = ids[0]
        else:
            vod_id = ids
        if not vod_id:
            return {"list": []}
        if isinstance(vod_id, str) and vod_id.startswith("/"):
            url = self.SITE_URL + vod_id
        elif isinstance(vod_id, str) and vod_id.startswith("http"):
            url = vod_id
        else:
            url = f"{self.SITE_URL}/freeok-detail/{vod_id}.html"
        try:
            html = self._get_html(url, ttl=self.TTL_DETAIL)
            return self._parse_detail(html, vod_id, url)
        except Exception as e:
            print(f"[FreeOK] detailContent: {e}")
            return {"list": []}

    def _parse_detail(self, html, vod_id, detail_url=None):
        detail = {
            "vod_id": str(vod_id), "vod_name": "", "vod_pic": "",
            "vod_content": "", "vod_actor": "", "vod_director": "",
            "vod_year": "", "vod_area": "", "vod_remarks": "",
            "vod_play_from": "", "vod_play_url": "",
        }
        m = self.RE_DETAIL_TITLE.search(html) or self.RE_DETAIL_TITLE_FB.search(html)
        if m:
            detail["vod_name"] = m.group(1).strip()
        m = self.RE_DETAIL_PIC.search(html) or self.RE_DETAIL_PIC_FB.search(html)
        if m:
            detail["vod_pic"] = m.group(1).strip()
        m = self.RE_DETAIL_YEAR.search(html)
        if m:
            detail["vod_year"] = m.group(1)
        for key, val in self.RE_DETAIL_INFO.findall(html):
            v = val.strip()
            if key == "导演":
                detail["vod_director"] = v
            elif key == "主演":
                detail["vod_actor"] = v
            elif key == "更新":
                detail["vod_remarks"] = v
        m = self.RE_DETAIL_DESC.search(html)
        if m:
            detail["vod_content"] = self.RE_STRIP_TAGS.sub('', m.group(1)).strip()

        play_from, play_url = self._parse_playlist(html, detail_url=detail_url)
        detail["vod_play_from"] = play_from
        detail["vod_play_url"] = play_url

        src_count = play_from.count('$$$') + 1 if play_from else 0
        ep_count = (play_url.count('$') - play_url.count('$$$') * 2) if play_url else 0
        print(f"[FreeOK] detail: name={detail['vod_name']} "
              f"from={play_from!r} sources={src_count} total_eps={ep_count}")
        return {"list": [detail]}

    # ============ 播放列表解析 ============
    def _parse_playlist(self, html, detail_url=None):
        result = self._extract_from_script(html)
        if result and self._has_multi_episodes(result):
            return result

        result2 = self._extract_all_episodes(html)
        if result2 and self._has_multi_episodes(result2):
            return result2

        best = result2 or result
        if detail_url and not self._has_multi_episodes(best or ("", "")):
            play_url = self._get_any_play_url(html)
            if play_url:
                try:
                    abs_url = play_url if play_url.startswith("http") \
                        else urljoin(self.SITE_URL, play_url)
                    print(f"[FreeOK] playlist too short, try play page: {abs_url}")
                    play_html = self._get_html(abs_url, ttl=self.TTL_PLAY)
                    result3 = self._extract_all_episodes(play_html)
                    if result3 and self._has_multi_episodes(result3):
                        print(f"[FreeOK] play page OK: sources="
                              f"{result3[0].count('$$$') + 1} eps={self._count_eps(result3)}")
                        return result3
                except Exception as e:
                    print(f"[FreeOK] play page fallback: {e}")

        if best and best[1]:
            return best
        return "FreeOK", ""

    def _count_eps(self, result):
        if not result or not result[1]:
            return 0
        return result[1].count('$') - result[1].count('$$$') * 2

    def _has_multi_episodes(self, result):
        if not result or not result[1] or not result[0]:
            return False
        n_src = result[0].count('$$$') + 1
        return self._count_eps(result) > n_src

    def _extract_from_script(self, html):
        for pat in self.RE_VOD_PLAY_URLS:
            m = pat.search(html)
            if not m:
                continue
            raw = m.group(1)
            try:
                raw = raw.encode('utf-8').decode('unicode_escape')
            except Exception:
                pass
            raw = raw.replace('\\/', '/').replace('\\"', '"')
            if '$' not in raw or len(raw) < 10:
                continue
            names = self._parse_source_names(html)
            n_src = raw.count('$$$') + 1
            if len(names) != n_src:
                names = [f"线路{i + 1}" for i in range(n_src)]
            print(f"[FreeOK] playlist via script: sources={n_src} "
                  f"eps={self._count_eps(('', raw))}")
            return "$$$".join(names), raw
        return None

    def _extract_all_episodes(self, html):
        candidates = []
        seen = set()
        for m in self.RE_ANY_A_LINK.finditer(html):
            href = m.group(1).strip()
            if not self._looks_like_play_link(href):
                continue
            href = self._normalize_href(href)
            if not href or href in seen:
                continue
            seen.add(href)
            candidates.append((href, m.group(2)))
        for m in self.RE_JS_PLAY_URLS.finditer(html):
            href = self._normalize_href(m.group(1))
            if not href or href in seen:
                continue
            seen.add(href)
            candidates.append((href, ''))

        if not candidates:
            return None
        print(f"[FreeOK] playlist candidates={len(candidates)}")
        return self._group_episodes(candidates, html)

    def _normalize_href(self, href):
        if not href:
            return ''
        href = href.replace('\\/', '/').replace('\\"', '"')
        if href.startswith('//'):
            href = 'https:' + href
        if href.startswith('http'):
            m = re.match(r'https?://[^/]+(/.*)', href)
            if m:
                href = m.group(1)
        return href

    def _looks_like_play_link(self, href):
        if not href:
            return False
        h = href.lower()
        return any(k in h for k in (
            '/freeok-play/', '/play/', '/vodplay/', '/v_play/', '/playlist/'))

    # ============ 智能分组 ============
    def _group_episodes(self, eps, html):
        parsed = []
        seen = set()
        for href, raw_name in eps:
            href = (href or "").strip()
            if not href or href in seen:
                continue
            seen.add(href)
            a, b = self._tail_numbers(href)
            parsed.append((href, raw_name, a, b))
        if not parsed:
            return "FreeOK", ""

        g_by_a = self._bucket(parsed, key_index=0)
        g_by_b = self._bucket(parsed, key_index=1)

        n = len(parsed)
        avg_a = n / max(len(g_by_a), 1)
        avg_b = n / max(len(g_by_b), 1)

        if len(g_by_a) < len(g_by_b):
            groups, chosen = g_by_a, 'a'
        elif len(g_by_b) < len(g_by_a):
            groups, chosen = g_by_b, 'b'
        else:
            groups, chosen = (g_by_a, 'a') if avg_a >= avg_b else (g_by_b, 'b')

        print(f"[FreeOK] smart-group chosen={chosen} "
              f"g_a={len(g_by_a)} avg_a={avg_a:.1f} "
              f"g_b={len(g_by_b)} avg_b={avg_b:.1f}")

        def key_sort(k):
            try:
                return (0, int(k))
            except (ValueError, TypeError):
                return (1, str(k))

        episodes_by_source = []
        group_sizes = []
        for key in sorted(groups.keys(), key=key_sort):
            items = sorted(groups[key], key=lambda x: x[0])
            ep_list = []
            for idx, (_, raw_name, href) in enumerate(items, 1):
                display = self._clean_ep_name(raw_name, idx)
                ep_list.append(f"{display}${href}")
            episodes_by_source.append("#".join(ep_list))
            group_sizes.append(len(items))

        source_names = self._parse_source_names(html)
        if len(source_names) != len(episodes_by_source):
            source_names = [f"线路{i + 1}" for i in range(len(episodes_by_source))]

        print(f"[FreeOK] grouped: sources={len(episodes_by_source)} "
              f"total_eps={len(parsed)} group_sizes={group_sizes}")
        return "$$$".join(source_names), "$$$".join(episodes_by_source)

    def _bucket(self, parsed, key_index):
        if key_index == 1:
            group_idx, sort_idx = 2, 1
        else:
            group_idx, sort_idx = 1, 2
        groups = {}
        for href, raw_name, a, b in parsed:
            nums = (a, b)
            gkey = nums[group_idx - 1]
            skey = nums[sort_idx - 1]
            if gkey is None:
                gkey = '_'
            if skey is None:
                skey = 0
            groups.setdefault(gkey, []).append((skey, raw_name, href))
        return groups

    @staticmethod
    def _tail_numbers(href):
        path = href.split('?')[0].split('#')[0]
        m = Spider.RE_PLAY_TAIL.search(path)
        if not m:
            return (None, None)
        parts = m.group(1).split('-')
        nums = [p for p in parts if p.isdigit()]
        if len(nums) >= 2:
            return (int(nums[-2]), int(nums[-1]))
        if len(nums) == 1:
            return (None, int(nums[-1]))
        return (None, None)

    # ============ ★ 剧集名精简（去掉"第"字） ============
    @staticmethod
    def _clean_ep_name(raw, idx):
        """
        生成安全的剧集名：
          - 无 → 01集
          - 纯数字 → 01集（去"第"）
          - 含"第N集"→ 提取数字，输出 "N集"
          - 其它名 → 去标签/实体/分隔符后使用
          - 超 12 字截断
        """
        # 1) 优先抽取明显的「第N集/第N话/EP·N/E·N」里的数字
        if raw:
            m = re.search(r'第\s*(\d{1,4})\s*(?:集|话|期|回)', raw)
            if not m:
                m = re.search(r'\b(?:EP|E|Ep|ep)[\s._-]*(\d{1,4})\b', raw)
            if m:
                return f"{int(m.group(1)):02d}集"

        # 2) 常规清理
        if not raw:
            return f"{idx:02d}集"
        t = re.sub(r'<[^>]+>', '', raw)
        for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'),
                     ('&gt;', '>'), ('&quot;', '"'), ('&#39;', "'"),
                     ('&#160;', ' ')):
            t = t.replace(a, b)
        # TVBox 分隔符必须干掉
        t = t.replace('$', '').replace('#', '')
        t = re.sub(r'[\x00-\x1f\x7f]', '', t)
        t = re.sub(r'\s+', ' ', t).strip()

        if not t:
            return f"{idx:02d}集"
        # 纯数字 → 直接显示 "N集"（去掉"第"）
        if re.fullmatch(r'\d{1,4}', t):
            return f"{int(t):02d}集"
        # 去掉开头的"第"字，避免"第..."截断
        t = re.sub(r'^第\s*', '', t)
        if not t:
            return f"{idx:02d}集"
        if len(t) > 12:
            t = t[:12]
        return t

    def _get_any_play_url(self, html):
        for m in self.RE_ANY_A_LINK.finditer(html):
            href = m.group(1)
            if self._looks_like_play_link(href):
                return self._normalize_href(href)
        m = self.RE_JS_PLAY_URLS.search(html)
        if m:
            return self._normalize_href(m.group(1))
        return None

    def _parse_source_names(self, html):
        names = []
        for n in self.RE_SRC_PLAYER_NAME.findall(html):
            n = n.strip()
            if n and n not in names:
                names.append(n)
        if names:
            return names
        for n in self.RE_SRC_ANCHOR.findall(html):
            n = n.strip()
            if n and n not in names:
                names.append(n)
        if names:
            return names
        mid = self.RE_SRC_MID.findall(html)
        if mid:
            for _, n in sorted(mid, key=lambda x: int(x[0])):
                n = n.strip()
                if n and n not in names:
                    names.append(n)
        return names

    @staticmethod
    def _clean_text(raw):
        if not raw:
            return ""
        t = re.sub(r'<[^>]+>', '', raw)
        for a, b in (('&nbsp;', ' '), ('&amp;', '&'), ('&lt;', '<'),
                     ('&gt;', '>'), ('&quot;', '"'), ('&#39;', "'"),
                     ('&#160;', ' ')):
            t = t.replace(a, b)
        return re.sub(r'\s+', ' ', t).strip()

    # ============ 播放 ============
    def playerContent(self, flag, vid, vip_flags):
        result = {"parse": 0, "playUrl": "", "url": "",
                  "header": json.dumps(self.HEADERS)}
        if isinstance(vid, str) and vid.startswith("/"):
            play_page = self.SITE_URL + vid
        elif isinstance(vid, str) and vid.startswith("http"):
            play_page = vid
        else:
            play_page = f"{self.SITE_URL}/freeok-play/{vid}.html"
        try:
            rsp = self.fetch(play_page, headers=self.HEADERS, timeout=self.HTTP_TIMEOUT)
            rsp.encoding = "utf-8"
            html = rsp.text

            json_str = self._extract_balanced_json(html, "player_aaaa")
            if json_str:
                try:
                    pd = json.loads(json_str)
                    raw_url = pd.get("url", "")
                    if raw_url and not self.SHORT_SNIPPET_PATTERN.search(raw_url):
                        result["url"] = raw_url
                        return result
                except json.JSONDecodeError:
                    pass

            for link in self.RE_DIRECT_LINK.findall(html):
                if not self.SHORT_SNIPPET_PATTERN.search(link):
                    result["url"] = link
                    return result

            m = self.RE_IFRAME_SRC.search(html)
            if m:
                result["parse"] = 1
                result["url"] = urljoin(play_page, m.group(1))
                return result

            print(f"[FreeOK] playerContent fallback parse url={play_page}")
            result["parse"] = 1
            result["url"] = play_page
            return result
        except Exception as e:
            print(f"[FreeOK] playerContent error: {e}")
        result["parse"] = 1
        result["url"] = play_page
        return result

    @staticmethod
    def _extract_balanced_json(html, var_name, max_len=20000):
        m = re.search(r'\b' + re.escape(var_name) + r'\s*=\s*', html)
        if not m:
            return ""
        start = html.find('{', m.end())
        if start == -1:
            return ""
        limit = min(start + max_len, len(html))
        depth, i, in_str, quote_char = 0, start, False, ''
        while i < limit:
            ch = html[i]
            if in_str:
                if ch == '\\':
                    i += 2
                    continue
                if ch == quote_char:
                    in_str = False
            else:
                if ch == '"' or ch == "'":
                    in_str = True
                    quote_char = ch
                elif ch == '{':
                    depth += 1
                elif ch == '}':
                    depth -= 1
                    if depth == 0:
                        return html[start:i + 1]
            i += 1
        return ""

    # ============ 列表解析 ============
    def _parse_video_list(self, html):
        videos, seen = [], set()
        matches = list(self.RE_CARD_ANCHOR.finditer(html))
        n = len(matches)
        if n == 0:
            return videos
        for i, m in enumerate(matches):
            vod_id = m.group(2)
            if vod_id in seen:
                continue
            start = m.start()
            if i + 1 < n:
                end = matches[i + 1].start()
                if end - start > 4500:
                    end = start + 4500
            else:
                end = min(start + 4500, len(html))
            chunk = html[start:end]
            title_m = self.RE_CARD_TITLE.search(chunk)
            if not title_m:
                continue
            img_m = self.RE_CARD_IMG.search(chunk)
            role_m = self.RE_CARD_ROLE.search(chunk)
            seen.add(vod_id)
            videos.append({
                "vod_id": vod_id,
                "vod_name": title_m.group(1).strip(),
                "vod_pic": img_m.group(1).strip() if img_m else "",
                "vod_remarks": role_m.group(1).strip() if role_m else "",
            })
        return videos

    def _parse_pagecount(self, html, current_pg):
        m = self.RE_PAGE_TOTAL.search(html)
        if m:
            return int(m.group(1))
        pages = self.RE_PAGE_NUM.findall(html)
        if pages:
            return max(int(p) for p in pages)
        return int(current_pg)


def main():
    pass


if __name__ == "__main__":
    main()