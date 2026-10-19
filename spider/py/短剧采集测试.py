# -*- coding: utf-8 -*-
# ============================================================
#  ZIP0 聚合影视源  (OK影视 / FongMi TV Python Spider)
# ------------------------------------------------------------
# 数据源：采集.json导出普通苹果CMS采集源，已移除 /at/json 后缀，删除【电影｜天堂】线路
# 功能:
#    · 只采集 短剧(t=46) / AI漫剧(t=52) 两类, 其他分类屏蔽不采集
#      (首页/分类/搜索均限定量子线路这两库; 详情同名聚合亦做分类类型拦截)
#    · 短剧/AI漫剧双库搜索: 两库并发查询后合并去重
#      (实测逗号形式 t=46,52 无效; 不带 t 会混入电影/解说等全库内容)
#    · 多线路详情: 仅5条实测最快线路内匹配同名片源, 一键切换线路
#    · 直链播放: lzm3u8/mp4 直连, 无需解析
#  分类浏览基于【量子】线路
#  筛选仅提供实测生效的 年份(year) / 更新时间(h, 按小时: 24/72/168/720);
#  area / lang / by / class 经 macapi1 代理不透传, 实测无效故不提供
#  首页推荐使用短剧库(t=46)数据
#
#  OK影视配置示例(sites 内):
#    {"key":"zip0","name":"ZIP0_聚合全量","type":3,
#     "api":"https://你的托管地址/ZIP0.py",
#     "searchable":2,"quickSearch":0,"filterable":0}
#  或将本文件放到手机后用本地路径(file://)引用。
# ============================================================
import json
import re
import time
import warnings
import threading
import requests
try:
    warnings.filterwarnings('ignore')
    requests.packages.urllib3.disable_warnings()
except Exception:
    pass
from base.spider import Spider
UA = ('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
      '(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36')

# ---------------- 线路配置：5条实测最快线路 (2026-10-03 全量测速) ----------------
# 卫士0.51s / 暴风0.80s / 索尼0.81s / 最大0.91s 为最快4条; 量子1.56s 是短剧/AI漫剧主力源, 必须保留
# 剔除原因: 其余线路响应 >1.1s; 独播/猫眼/天堂/非凡/卧龙/蜜桃/高清 接口实测失效;
# 无尽 t=52 为写真热舞类内容, 禁止接入
SOURCES = [
    {"key": "量子资源", "name": "量子", "api": "https://cj.lziapi.com/api.php/provide/vod/from/lzm3u8"},
    {"key": "卫士资源", "name": "卫士｜资源", "api": "https://360zy.com/api.php/provide/vod"},
    {"key": "暴风影院", "name": "暴风｜资源", "api": "http://bf.xoxowin86cisyap.com/api.php/provide/vod"},
    {"key": "索尼影视", "name": "索尼｜资源", "api": "https://suoniapi.com/api.php/provide/vod"},
    {"key": "最大资源", "name": "最大｜资源", "api": "http://zuidazy.me/api.php/provide/vod"},
]

MAIN_KEY = '量子资源'          # 主力线路（必须和上面key完全一致）: 首页/分类/搜索均走此源
TIMEOUT = 6                # 单请求超时6秒, 快线路快速失败, 减少等待
MAX_WORKERS = 8            # 并发线程数, 仅5条线路够用
FAIL_THRESHOLD = 3         # 连续失败多少次触发屏蔽
BLOCK_COOLDOWN = 120       # 屏蔽冷却时间，单位秒

# ---------------- 分类(量子线路叶子分类) ----------------
CATEGORIES = [
    ('量子资源:46', '短剧'),
    ('量子资源:52', 'AI漫剧'),
]

# ---------------- 筛选配置(全部经 API 逐一实测) ----------------
# 生效: year(年份) / h(更新时间, 单位小时);  无效: area/lang/by/class(macapi1 代理不透传), 故不提供
YEARS = [str(y) for y in range(2026, 1999, -1)]           # 2026 ~ 2000
H_OPTIONS = [('最近一天', '24'), ('最近三天', '72'),
             ('最近一周', '168'), ('最近一月', '720')]

def _build_filters():
    """OK影视/FongMi 分类筛选定义"""
    return [
        {'key': 'year', 'name': '年份',
         'value': [{'n': y, 'v': y} for y in YEARS]},
        {'key': 'h', 'name': '更新时间',
         'value': [{'n': n, 'v': v} for n, v in H_OPTIONS]},
    ]

# ---------------- 分类采集限定: 仅 短剧(t=46) / AI漫剧(t=52), 其他分类屏蔽不采集 ----------------
SCOPED_TIDS = ('46', '52')
# 详情同名聚合时, 命中以下分类类型直接拒绝(防止混入电影/综艺/预告片/写真等非短剧内容)
REJECT_TYPES = ('电影', '综艺', '预告', '写真', '动漫', '海外', '泰剧', '日剧',
                '韩剧', '欧美', '港剧', '台剧', '纪录', '伦理', '音乐', '少儿',
                '新闻', '体育', '戏曲', '科教', '脱口秀', '游戏')

def _is_short_drama_type(type_name):
    """分类类型白名单校验: 明显非短剧类型返回 False 拒绝采集"""
    t = _clean(type_name)
    if not t:
        return True        # 无分类信息不额外拦截(仍受片名+年份双重校验)
    return not any(w in t for w in REJECT_TYPES)

_TAG = re.compile(r'<[^>]+>')
_LOCK = threading.Lock()

def _clean(text):
    """去除HTML标签与多余空白"""
    if not text:
        return ''
    text = _TAG.sub('', str(text))
    text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
    text = text.replace('&quot;', '"').replace('&lt;', '<').replace('&gt;', '>')
    return re.sub(r'\s+', ' ', text).strip()

def _is_direct(url):
    """判断是否为可直连播放的音视频地址"""
    if not url:
        return False
    u = url.split('?')[0].lower()
    return u.endswith('.m3u8') or u.endswith('.mp4')

class Spider(Spider):
    def getName(self):
        return 'ZIP0_聚合全量'
    def init(self, extend=''):
        self.header = {'User-Agent': UA}
        self.timeout = TIMEOUT
        self.session = requests.Session()
        self.session.headers.update(self.header)
        # ext 可传 JSON 自定义线路, 例: {"enabled":["量子资源","暴风影院"]}
        self.sources = SOURCES
        try:
            if extend:
                cfg = json.loads(extend) if isinstance(extend, str) else extend
                enabled = cfg.get('enabled')
                if isinstance(enabled, list) and enabled:
                    keep = [s for s in SOURCES if s['key'] in enabled]
                    if keep:
                        self.sources = keep
        except Exception:
            pass
        self.by_key = {s['key']: s for s in self.sources}
        # 失败统计: key -> {"fail_cnt": int, "block_until": timestamp}
        self.fail_stat = {}
        for s in self.sources:
            self.fail_stat[s['key']] = {"fail_cnt":0, "block_until":0}

    def _is_blocked(self, key):
        """判断线路是否处于屏蔽状态"""
        st = self.fail_stat.get(key, {"fail_cnt":0, "block_until":0})
        now = time.time()
        if st["block_until"] > now:
            return True
        # 冷却到期，重置计数
        if st["block_until"] != 0:
            st["fail_cnt"] = 0
            st["block_until"] = 0
        return False

    def _mark_success(self, key):
        """请求成功，清空失败计数"""
        with _LOCK:
            if key in self.fail_stat:
                self.fail_stat[key]["fail_cnt"] = 0
                self.fail_stat[key]["block_until"] = 0

    def _mark_fail(self, key):
        """标记失败，达到阈值设置屏蔽"""
        with _LOCK:
            if key not in self.fail_stat:
                return
            st = self.fail_stat[key]
            st["fail_cnt"] += 1
            if st["fail_cnt"] >= FAIL_THRESHOLD:
                st["block_until"] = time.time() + BLOCK_COOLDOWN

    # ---------------- 基础请求 ----------------
    def _fetch(self, source, **params):
        """请求某条线路, 返回 dict 或 None，自带失败统计"""
        key = source["key"]
        if self._is_blocked(key):
            return None
        try:
            r = self.session.get(source['api'], params=params,
                                 timeout=self.timeout, verify=False)
            j = r.json()
            if isinstance(j, dict):
                self._mark_success(key)
                return j
            else:
                self._mark_fail(key)
                return None
        except Exception:
            self._mark_fail(key)
            return None

    def _fetch_by_key(self, key, **params):
        src = self.by_key.get(key)
        if not src:
            return None
        return self._fetch(src,** params)

    def _parallel(self, jobs):
        """并发执行 [(key, callable)] -> {key: result}"""
        out = {}
        if not jobs:
            return out
        threads = []
        def run(k, fn):
            try:
                res = fn()
            except Exception:
                res = None
            with _LOCK:
                out[k] = res
        for k, fn in jobs:
            t = threading.Thread(target=run, args=(k, fn))
            t.daemon = True
            threads.append(t)
            if len(threads) >= MAX_WORKERS:
                for t in threads:
                    t.start()
                for t in threads:
                    t.join()
                threads = []
        for t in threads:
            t.start()
        for t in threads:
            t.join()
        return out

    # ---------------- 条目转换 ----------------
    def _item(self, vod, src_key):
        """CMS vod -> OK影视列表条目"""
        return {
            'vod_id': '%s:%s' % (src_key, vod.get('vod_id', '')),
            'vod_name': _clean(vod.get('vod_name', '')) or '未知影片',
            'vod_pic': vod.get('vod_pic', '') or '',
            'vod_remarks': _clean(vod.get('vod_remarks', '')) or '',
        }

    # ---------------- 首页 ----------------
    def homeContent(self, filter):
        result = {'class': [{'type_id': tid, 'type_name': name,
                             'filters': _build_filters()}
                            for tid, name in CATEGORIES],
                  'list': []}
        try:
            result['list'] = self._home_list()
        except Exception:
            pass
        return result

    def homeVideoContent(self):
        try:
            return {'list': self._home_list()}
        except Exception:
            return {}

    def _home_list(self):
        """首页推荐: 短剧库(t=46)最新数据"""
        src = self.by_key.get(MAIN_KEY)
        if not src or self._is_blocked(MAIN_KEY):
            return []
        j = self._fetch(src, ac='detail', t=46, pg=1)
        if not j or not j.get('list'):
            return []
        return [self._item(v, MAIN_KEY) for v in j['list'][:30]]

    # ---------------- 分类 ----------------
    def categoryContent(self, tid, pg, filter, extend):
        try:
            tid = str(tid or '')
            key, _, real_tid = tid.partition(':')
            if key not in self.by_key or not real_tid or self._is_blocked(key):
                key, real_tid = MAIN_KEY, tid
            # 只采集 短剧(46)/AI漫剧(52), 其他分类一律屏蔽
            if real_tid not in SCOPED_TIDS:
                return {'list': [], 'page': 1, 'pagecount': 0,
                        'limit': 20, 'total': 0}
            page = int(pg) if str(pg).isdigit() else 1
            params = {'ac': 'detail', 't': real_tid, 'pg': page}
            # 筛选: 仅透传实测生效的 year / h, 其余参数经代理不透传故不提供
            flt = filter or {}
            if isinstance(flt, str):
                try:
                    flt = json.loads(flt)
                except Exception:
                    flt = {}
            if isinstance(flt, dict):
                for k in ('year', 'h'):
                    v = flt.get(k)
                    if v not in (None, ''):
                        params[k] = str(v)
            j = self._fetch_by_key(key, **params)
            if not j or not j.get('list'):
                return {'list': [], 'page': page, 'pagecount': 0,
                        'limit': 20, 'total': 0}
            try:
                pagecount = int(j.get('pagecount', 0) or 0)
                total = int(j.get('total', 0) or 0)
            except Exception:
                pagecount, total = 0, 0
            return {
                'list': [self._item(v, key) for v in j['list']],
                'page': page,
                'pagecount': pagecount,
                'limit': 20,
                'total': total,
            }
        except Exception:
            return {'list': [], 'page': 1, 'pagecount': 0,
                    'limit': 20, 'total': 0}

    # ---------------- 聚合搜索 ----------------
    def searchContent(self, key, quick, pg='1'):
        """搜索限定 短剧(t=46) + AI漫剧(t=52) 两库, 分别查询后合并去重"""
        try:
            page = int(pg) if str(pg).isdigit() else 1
            if page > 1:
                return {'list': [], 'page': page}
            src = self.by_key.get(MAIN_KEY)
            wd = (key or '').strip()
            if not src or self._is_blocked(MAIN_KEY) or not wd:
                return {'list': [], 'page': page}
            # 两库并发查询加速; 实测: 逗号形式 t=46,52 无效; 不带 t 会混入电影/解说等全库内容
            data = self._parallel([
                (tid, lambda tid=tid: self._fetch(src, ac='detail', wd=wd, t=tid))
                for tid in SCOPED_TIDS])
            groups = {}
            order = []
            for tid in SCOPED_TIDS:
                j = data.get(tid)
                if not j or not j.get('list'):
                    continue
                for v in j['list']:
                    name = _clean(v.get('vod_name', ''))
                    if not name:
                        continue
                    year = str(v.get('vod_year', '') or '')
                    gk = (name, year)
                    if gk not in groups:
                        groups[gk] = v
                        order.append(gk)
            return {'list': [self._item(groups[gk], MAIN_KEY) for gk in order],
                    'page': page}
        except Exception:
            return {'list': [], 'page': 1}

    # ---------------- 详情(多线路聚合) ----------------
    def detailContent(self, ids):
        try:
            if isinstance(ids, str):
                vid = ids
            else:
                vid = str(ids[0]) if ids else ''
            key, _, real_id = vid.partition(':')
            if key not in self.by_key or self._is_blocked(key):
                key, real_id = MAIN_KEY, vid
            main_src = self.by_key[key]
            j = self._fetch_by_key(key, ac='detail', ids=real_id)
            if not j or not j.get('list'):
                return {'list': []}
            vod = j['list'][0]
            name = _clean(vod.get('vod_name', ''))
            year = str(vod.get('vod_year', '') or '')
            # 主线路播放列表(仅保留直链线路)
            play_froms = []
            play_urls = []
            self._collect_lines(key, vod, play_froms, play_urls)
            if not play_urls:
                return {'list': []}
            # 并发去其他线路搜同名影片(仅5条快线路); 分类限定: 明显非短剧类型直接跳过, 不采集
            others = [s for s in self.sources if s['key'] != key and not self._is_blocked(s['key'])]
            jobs = [(s['key'], lambda s=s: self._fetch(
                s, ac='detail', wd=name)) for s in others]
            data = self._parallel(jobs)
            for s in others:
                j2 = data.get(s['key'])
                if not j2 or not j2.get('list'):
                    continue
                for v2 in j2['list']:
                    n2 = _clean(v2.get('vod_name', ''))
                    y2 = str(v2.get('vod_year', '') or '')
                    if n2 != name:
                        continue
                    # 分类屏蔽: 其他线路分类五花八门, 非短剧类(电影/综艺/预告片等)不采集
                    if not _is_short_drama_type(v2.get('type_name', '')):
                        continue
                    # 年份校验: 一方为空视为匹配, 否则需相等(允许差1年)
                    if year and y2:
                        try:
                            if abs(int(year) - int(y2)) > 1:
                                continue
                        except Exception:
                            pass
                    f2, u2 = [], []
                    self._collect_lines(s['key'], v2, f2, u2)
                    if u2:
                        play_froms.extend(f2)
                        play_urls.extend(u2)
                    break   # 每条线路只取一个匹配
            pic = vod.get('vod_pic', '') or ''
            try:
                score = str(float(vod.get('vod_score', 0) or 0))
                if score.endswith('.0'):
                    score = score[:-2]
            except Exception:
                score = ''
            d = {
                'vod_id': vid,
                'vod_name': name,
                'vod_pic': pic,
                'type_name': _clean(vod.get('type_name', '')),
                'vod_year': year,
                'vod_area': _clean(vod.get('vod_area', '')),
                'vod_actor': _clean(vod.get('vod_actor', '')),
                'vod_director': _clean(vod.get('vod_director', '')),
                'vod_content': _clean(vod.get('vod_content', '')),
                'vod_remarks': _clean(vod.get('vod_remarks', '')),
                'vod_play_from': '$$$'.join(play_froms),
                'vod_play_url': '$$$'.join(play_urls),
            }
            if score and score != '0':
                d['vod_score'] = score
            return {'list': [d]}
        except Exception:
            return {'list': []}

    def _collect_lines(self, src_key, vod, play_froms, play_urls):
        """解析 CMS vod 的播放线路, 仅保留直链线路"""
        src = self.by_key.get(src_key) or {}
        src_name = src.get('name', src_key)
        froms = str(vod.get('vod_play_from', '') or '').split(',')
        urls = str(vod.get('vod_play_url', '') or '').split('$$$')
        added = 0
        for i, url_group in enumerate(urls):
            fname = froms[i] if i < len(froms) else 'line%d' % (i + 1)
            url_group = url_group.strip()
            if not url_group:
                continue
            first_url = url_group.split('#')[0].split('$')[-1]
            if not _is_direct(first_url):
                continue          # 跳过分享页/网页线路
            line_name = src_name if added == 0 else '%s%s' % (src_name, fname)
            play_froms.append(line_name)
            play_urls.append(url_group)
            added += 1
            if added >= 2:        # 单线路最多取2条, 防止详情页过长
                break

    # ---------------- 播放 ----------------
    def playerContent(self, flag, id, vipFlags):
        try:
            url = str(id or '').strip()
            if url.startswith('//'):
                url = 'https:' + url
            header = {'User-Agent': UA}
            if _is_direct(url):
                return {'parse': 0, 'playUrl': '', 'url': url, 'header': header}
            return {'parse': 1, 'playUrl': '', 'url': url, 'header': header}
        except Exception:
            return {'parse': 0, 'playUrl': '', 'url': id, 'header': {'User-Agent': UA}}

    # ---------------- 生命周期 ----------------
    def isVideoFormat(self, url):
        pass
    def manualVideoCheck(self):
        return False
    def destroy(self):
        pass
    def localProxy(self, param):
        return None