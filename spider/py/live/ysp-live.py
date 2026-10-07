#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ysp-live (FongMi/TV Python Spider 版)

央视频全频道直播取流, 双协议:
- JCE PidTimeShift (jacc.ysp.cctv.cn): 主协议, 时移转直播
- bkliveinfo (bkliveinfo.ysp.cctv.cn + cKey): 备用, JCE 返回坏域名时自动切换

在 FongMi/TV (Python 版 APK) 中作为爬虫加载, 只提供直播分类与直链。
不需要 HTTP 服务、后台刷新线程或 4K 后端二进制。

FongMi 配置示例:
    {
      "sites": [
        { "key":"ysp", "name":"央视频直播", "type":3, "api":"./ysp-live.py",
          "searchable":0, "quickSearch":0, "filterable":0 }
      ],
      "lives": [
        { "name":"央视频", "url":"./ysp-live.py", "type":3 }
      ]
    }

本地调试: python ysp-live.py cctv1
"""

import base64
import gzip
import json
import os
import random
import re
import struct
import sys
import time
import urllib.parse
import urllib.request
import urllib.error
import uuid

# ================================================================ JCE 协议

class W:
    def __init__(self): self.b = bytearray()
    def head(self, typ, tag):
        if tag < 15: self.b.append(((tag & 0xf) << 4) | (typ & 0xf))
        else: self.b.append(0xf0 | (typ & 0xf)); self.b.append(tag)
    def byte(self, v, tag):
        v = int(v)
        if v == 0: self.head(12, tag)
        else: self.head(0, tag); self.b += struct.pack('>b', v)
    def short(self, v, tag):
        v = int(v)
        if -128 <= v <= 127: self.byte(v, tag)
        else: self.head(1, tag); self.b += struct.pack('>h', v)
    def int(self, v, tag):
        v = int(v)
        if -32768 <= v <= 32767: self.short(v, tag)
        else: self.head(2, tag); self.b += struct.pack('>i', v)
    def long(self, v, tag):
        v = int(v)
        if -2147483648 <= v <= 2147483647: self.int(v, tag)
        else: self.head(3, tag); self.b += struct.pack('>q', v)
    def float(self, v, tag): self.head(4, tag); self.b += struct.pack('>f', float(v))
    def double(self, v, tag): self.head(5, tag); self.b += struct.pack('>d', float(v))
    def string(self, s, tag):
        if s is None: return
        data = str(s).encode('utf-8')
        if len(data) > 255: self.head(7, tag); self.b += struct.pack('>i', len(data)); self.b += data
        else: self.head(6, tag); self.b.append(len(data)); self.b += data
    def bytes(self, data, tag):
        data = bytes(data); self.head(13, tag); self.head(0, 0); self.int(len(data), 0); self.b += data
    def struct(self, fn, tag): self.head(10, tag); fn(self); self.head(11, 0)
    def list(self, items, tag, wf): self.head(9, tag); self.int(len(items), 0)
    def out(self): return bytes(self.b)


class R:
    def __init__(self, data): self.d = memoryview(data); self.p = 0
    def rem(self): return len(self.d) - self.p
    def get(self, n):
        if self.p + n > len(self.d): raise EOFError
        b = self.d[self.p:self.p + n].tobytes(); self.p += n; return b
    def u8(self): return self.get(1)[0]
    def head(self):
        b = self.u8(); typ = b & 0xf; tag = (b & 0xf0) >> 4
        if tag == 15: tag = self.u8()
        return typ, tag
    def value(self, typ):
        if typ == 0: return struct.unpack('>b', self.get(1))[0]
        if typ == 1: return struct.unpack('>h', self.get(2))[0]
        if typ == 2: return struct.unpack('>i', self.get(4))[0]
        if typ == 3: return struct.unpack('>q', self.get(8))[0]
        if typ == 4: return struct.unpack('>f', self.get(4))[0]
        if typ == 5: return struct.unpack('>d', self.get(8))[0]
        if typ == 6: n = self.u8(); return self.get(n).decode('utf-8', 'replace')
        if typ == 7: n = struct.unpack('>i', self.get(4))[0]; return self.get(n).decode('utf-8', 'replace')
        if typ == 8: n = self._int(); return {self._fv(): self._fv() for _ in range(n)}
        if typ == 9: n = self._int(); return [self._fv() for _ in range(n)]
        if typ == 10: return self.struct()
        if typ == 11: return None
        if typ == 12: return 0
        if typ == 13: t, _ = self.head(); n = self._int(); return self.get(n)
        raise ValueError('type %d' % typ)
    def _fv(self): t, _ = self.head(); return self.value(t)
    def _int(self): t, _ = self.head(); return int(self.value(t))
    def struct(self):
        m = {}
        while self.rem() > 0:
            t, tag = self.head()
            if t == 11: break
            m[tag] = self.value(t)
        return m


VER_NAME, VER_CODE = '3.2.7.26212', '302070'
APP_ID, QMF_APP_ID, QMF_PLATFORM, BIZ_ID = '1200013', 10012, 1, 0
CHAN_ID = '10070'
GUID = ''.join(random.choice('0123456789abcdef') for _ in range(32))


def _qua(w):
    w.string(VER_NAME, 0); w.string(VER_CODE, 1)
    w.int(1080, 2); w.int(2400, 3); w.int(3, 4); w.string('12', 5)
    w.int(1, 6); w.int(1, 7); w.int(420, 8); w.string(CHAN_ID, 9)
    for i in range(10, 15): w.string('', i)
    w.struct(lambda ww: (ww.int(0, 0), ww.byte(0, 1), ww.string('', 2)), 15)
    w.string('', 16); w.string('', 17); w.string('', 18)
    w.struct(lambda ww: (ww.int(0, 0), ww.float(0, 1), ww.float(0, 2), ww.double(0, 3)), 19)
    w.string(GUID[:16], 20); w.string('Pixel 6', 21)
    w.int(1, 22)
    for i in range(23, 27): w.int(0, i)
    w.string('', 27); w.string('', 28); w.string(GUID, 29)


def _head(w, cmd, reqid):
    w.int(reqid, 0); w.int(cmd, 1)
    w.struct(lambda ww: _qua(ww), 2)
    w.string(APP_ID, 3); w.string(GUID, 4)
    w.list([], 5, None); w.struct(lambda ww: None, 6)
    w.list([], 7, None)
    w.int(0, 8); w.int(0, 9); w.int(0, 10)


def _wrap(cmd, body, reqid):
    w = W()
    w.struct(lambda ww: _head(ww, cmd, reqid), 0)
    w.bytes(body, 1)
    reqcmd = w.out()
    inner = bytearray([38]) + struct.pack('>i', len(reqcmd) + 17) + bytes([1]) + b'\x00' * 10 + reqcmd + bytes([40])
    comp = gzip.compress(bytes(inner))
    out = bytearray([19]) + struct.pack('>i', 0) + struct.pack('>H', 2) + struct.pack('>H', 65281)
    out += struct.pack('>H', cmd) + struct.pack('>H', 0) + struct.pack('>q', reqid)
    out += struct.pack('>i', 531) + struct.pack('>i', QMF_APP_ID) + struct.pack('>q', BIZ_ID)
    g = GUID.encode()[:32]; out += g + b'\x00' * (32 - len(g))
    out += struct.pack('>b', QMF_PLATFORM) + struct.pack('>i', int(VER_CODE)) + b'\x00' * 6
    out += bytes([0]) + struct.pack('>H', 0) + struct.pack('>H', 0)
    out += struct.pack('>i', len(inner)) + comp + bytes([3])
    struct.pack_into('>i', out, 1, len(out))
    return bytes(out)


def _unwrap(data):
    if data[:1] != b'\x13' or len(data) < 90: return None
    flags = struct.unpack('>i', data[21:25])[0]
    payload = data[89:-1]
    if flags & 2: payload = gzip.decompress(payload)
    if payload[:1] != b'&' or payload[-1:] != b'(': return None
    rc = R(payload[16:-1]).struct()
    return rc.get(1) or b''


class DeadHostError(RuntimeError):
    pass


def jce_timeshift_url(pid, sid, start, end, stream='fhd'):
    w = W()
    w.string(pid, 0); w.string(sid, 1); w.long(start, 2); w.long(end, 3); w.string(stream, 4)
    body = w.out()
    CMD = 25312
    reqid = int(time.time() * 1000) & 0x7fffffff
    packet = _wrap(CMD, body, reqid)
    req = urllib.request.Request('https://jacc.ysp.cctv.cn', data=packet, method='POST')
    req.add_header('Content-Type', 'application/octet-stream')
    with urllib.request.urlopen(req, timeout=15) as resp:
        raw = resp.read()
    resp_body = _unwrap(raw)
    if not resp_body: raise RuntimeError('bad response')
    m = R(resp_body).struct()
    err = m.get(0, 0)
    if err != 0: raise RuntimeError(m.get(1, 'errCode=%s' % err))
    url = m.get(2, '')
    if not url: raise RuntimeError('empty m3u8')
    if 'liverecord.video.cloud.cctv.com' in url:
        raise DeadHostError('dead cdn host')
    return url


# ================================================================ cKey + bkliveinfo
# 移植自 akiralereal/iptv extractors/yangshipin/ckey.js

_CK_PLATFORM = 4330403
_CK_APPVER = 'V8.22.1035.3031'
_CK_TEA = bytes.fromhex('59b2f7cf725ef43c34fdd7c123411ed3')
_CK_GTEA = bytes.fromhex('110DBEC10C23E7D2E56A1CAD6914EF1B')
_CK_XOR = bytes([0x84, 0x2e, 0xed, 0x08, 0xf0, 0x66, 0xe6, 0xea, 0x48, 0xb4, 0xca, 0xa9, 0x91, 0xed, 0x6f, 0xf3])
_CK_GXOR = bytes([0xb3, 0xc9, 0x53, 0xa0, 0x69, 0x13, 0xad, 0x4d])


def _u32(v): return v & 0xFFFFFFFF


def _tea_blk(blk, key):
    y, z = struct.unpack('>2I', blk)
    k = struct.unpack('>4I', key)
    s = 0
    for _ in range(16):
        s = _u32(s + 0x9e3779b9)
        y = _u32(y + _u32(_u32(_u32(z << 4) + k[0]) ^ _u32(z + s) ^ _u32((z >> 5) + k[1])))
        z = _u32(z + _u32(_u32(_u32(y << 4) + k[2]) ^ _u32(y + s) ^ _u32((y >> 5) + k[3])))
    return struct.pack('>2I', y, z)


def _cksum(buf):
    v = 0
    for b in buf: v = (0x83 * v + b) & 0x7fffffff
    return v


def _tea_pkt(data, key):
    pad = (8 - ((len(data) + 10) % 8)) % 8
    plain = bytes([(os.urandom(1)[0] & 0xf8) | pad]) + os.urandom(pad) + os.urandom(2) + data + bytes(7)
    out, pp, pc = b'', bytes(8), bytes(8)
    for off in range(0, len(plain), 8):
        mixed = bytes(a ^ b for a, b in zip(plain[off:off + 8], pc))
        enc = _tea_blk(mixed, key)
        cipher = bytes(a ^ b for a, b in zip(enc, pp))
        out += cipher
        pp, pc = mixed, cipher
    return out


def _lp(s):
    d = s.encode() if isinstance(s, str) else s
    return struct.pack('>H', len(d)) + d


def _ck_guard(ts, guid):
    def tail(v):
        t = str(v); return t[-5:] if len(t) >= 5 else ''
    body = struct.pack('>I', ts) + _lp(tail(guid)) + _lp(tail('null')) + _lp(tail('null')) + _lp('-1')
    plain = _lp(body)
    enc = _tea_pkt(plain, _CK_GTEA) + struct.pack('>I', _cksum(plain))
    enc = bytes(a ^ _CK_GXOR[i & 7] for i, a in enumerate(enc))
    return enc.hex().upper()


def _ckey(channel_id):
    ts = int(time.time())
    guid = os.urandom(16).hex()
    guard = _ck_guard(ts, guid)
    uid = os.urandom(4).hex().upper()
    body = (bytes.fromhex('0000004200000004000004d2') + struct.pack('>I', _CK_PLATFORM)
            + struct.pack('>I', 0) + struct.pack('>I', ts) + _lp('dcgh')
            + _lp('_zj1A5Gh6QYcxWjIUGos2w==') + _lp(_CK_APPVER) + _lp(str(channel_id))
            + _lp(guid) + struct.pack('>I', 1) + struct.pack('>I', 1) + _lp(uid) + _lp('nil')
            + _lp('57eab0c4-2c58-44c6-8ae9-dd2757525dc5') + _lp('nil') + _lp('v0.1.000')
            + _lp('com.cctv.yangshipin.app.iphone') + _lp(str(_CK_PLATFORM))
            + _lp('ex_json_bus') + _lp('ex_json_vs') + _lp(guard))
    pkt = bytearray(struct.pack('>H', len(body)) + body)
    pkt[18:22] = struct.pack('>I', _cksum(bytes(pkt)))
    pkt = bytes(pkt)
    enc = _tea_pkt(pkt, _CK_TEA) + struct.pack('>I', _cksum(pkt))
    enc = bytes(a ^ _CK_XOR[i & 15] for i, a in enumerate(enc))
    b64 = base64.b64encode(enc).decode().replace('+', '_').replace('/', '-').rstrip('=')
    return {'cKey': '--01' + b64, 'guid': guid, 'ts': ts,
            'flowId': '%s_%d' % (uuid.uuid4().hex.upper(), _CK_PLATFORM)}


_BK_H264 = base64.b64encode(b'H(30:1080,60:1080|30:1080,60:1080)').decode()


def bk_playurls(channel_id, live_pid, defn='fhd'):
    t = _ckey(channel_id)
    q = urllib.parse.urlencode({
        'atime': '120', 'livepid': live_pid, 'cnlid': channel_id,
        'appVer': _CK_APPVER, 'app_version': '300090', 'caplv': '1', 'cmd': '2',
        'defn': defn, 'device': 'iPhone', 'encryptVer': '4.2', 'getpreviewinfo': '0',
        'hevclv': '0', 'lang': 'zh-Hans_CN', 'livequeue': '0', 'logintype': '1',
        'nettype': '1', 'newnettype': '1', 'newplatform': str(_CK_PLATFORM),
        'platform': str(_CK_PLATFORM), 'sdtfrom': 'v3021', 'spacode': '23',
        'spaudio': '1', 'spdemuxer': '6', 'spdrm': '2', 'spdynamicrange': '1',
        'spflv': '1', 'spflvaudio': '1', 'sphdrfps': '60', 'sphttps': '1',
        'spvcode': _BK_H264, 'spvideo': '4', 'stream': '1', 'system': '1',
        'sysver': 'ios18.2.1', 'uhd_flag': '0', 'cKey': t['cKey'], 'guid': t['guid'],
        'fntick': str(t['ts']), 'flowid': t['flowId'], 'playbacktime': '0',
    })
    req = urllib.request.Request('https://bkliveinfo.ysp.cctv.cn/?' + q,
                                 headers={'User-Agent': 'qqlive', 'Accept': 'application/json'})
    with urllib.request.urlopen(req, timeout=15) as r:
        p = json.loads(r.read().decode())
    if int(p.get('iretcode', -1)) != 0:
        raise RuntimeError('iretcode=%s %s' % (p.get('iretcode'), p.get('errinfo', '')))
    urls = []
    if p.get('playurl'): urls.append(p['playurl'])
    bu = p.get('backurl_list') or p.get('backurlList') or p.get('backurl')
    if isinstance(bu, list):
        for it in bu:
            urls.append(it if isinstance(it, str) else (it.get('url') or it.get('playurl') or ''))
    elif isinstance(bu, str):
        urls += [x for x in re.split(r'[;,]', bu) if x.strip()]
    urls = [u for u in dict.fromkeys(urls) if u and '.cctv.' in u]
    if not urls: raise RuntimeError('no playurl')
    # bklive- 备用 CDN 更稳定, 优先用
    urls.sort(key=lambda u: (0 if 'bklive-' in u else 1, u))
    return urls


# ================================================================ 频道表

CHANNELS = [
    ('cctv1', 'CCTV-1 综合', '2024078201', '600001859', 'fhd'),
    ('cctv2', 'CCTV-2 财经', '2024075401', '600001800', 'fhd'),
    ('cctv3', 'CCTV-3 综艺', '2024068501', '600001801', 'fhd'),
    ('cctv4', 'CCTV-4 中文国际', '2029797101', '600001814', 'fhd'),
    ('cctv5', 'CCTV-5 体育', '2024078401', '600001818', 'fhd'),
    ('cctv5p', 'CCTV-5+ 体育赛事', '2024078001', '600001817', 'fhd'),
    ('cctv6', 'CCTV-6 电影', '2013693901', '600108442', 'fhd'),
    ('cctv7', 'CCTV-7 国防军事', '2024072001', '600004092', 'fhd'),
    ('cctv8', 'CCTV-8 电视剧', '2029793001', '600001803', 'fhd'),
    ('cctv9', 'CCTV-9 纪录', '2024078601', '600004078', 'fhd'),
    ('cctv10', 'CCTV-10 科教', '2024078701', '600001805', 'fhd'),
    ('cctv11', 'CCTV-11 戏曲', '2027248701', '600001806', 'fhd'),
    ('cctv12', 'CCTV-12 社会与法', '2027248801', '600001807', 'fhd'),
    ('cctv13', 'CCTV-13 新闻', '2029797201', '600001811', 'fhd'),
    ('cctv14', 'CCTV-14 少儿', '2027248901', '600001809', 'fhd'),
    ('cctv15', 'CCTV-15 音乐', '2027249001', '600001815', 'fhd'),
    ('cctv16', 'CCTV-16 奥林匹克', '2027249101', '600098637', 'fhd'),
    ('cctv164k', 'CCTV-16 4K', '2027249301', '600099502', 'fhd'),
    ('cctv17', 'CCTV-17 农业农村', '2027249401', '600001810', 'fhd'),
    ('cctv4k', 'CCTV-4K 超高清', '2029810301', '600002264', 'fhd'),
    ('cctv8k', 'CCTV-8K 超高清', '2026774101', '600156816', 'fhd'),
    ('cgtn', 'CGTN', '2024181701', '600014550', 'fhd'),
    ('cgtnfr', 'CGTN 法语', '2024181801', '600084704', 'fhd'),
    ('cgtnru', 'CGTN 俄语', '2024181901', '600084758', 'fhd'),
    ('cgtnar', 'CGTN 阿拉伯语', '2024182001', '600084782', 'fhd'),
    ('cgtnes', 'CGTN 西班牙语', '2024182101', '600084744', 'fhd'),
    ('cgtndoc', 'CGTN 纪录', '2024182301', '600084781', 'fhd'),
    ('cctvfyjc', 'CCTV 风云剧场', '2025637103', '600099658', 'shd'),
    ('cctvdyjc', 'CCTV 第一剧场', '2026874203', '600099655', 'shd'),
    ('cctvhjjc', 'CCTV 怀旧剧场', '2026874303', '600099620', 'shd'),
    ('bjws', '北京卫视', '2024052703', '600002309', 'fhd'),
    ('jsws', '江苏卫视', '2024171103', '600002521', 'fhd'),
    ('dfws', '东方卫视', '2024054503', '600002483', 'fhd'),
    ('zjws', '浙江卫视', '2024054703', '600002520', 'fhd'),
    ('hnws', '湖南卫视', '2024054803', '600002475', 'fhd'),
    ('hbws', '湖北卫视', '2024171203', '600002508', 'fhd'),
    ('gdws', '广东卫视', '2024060903', '600002485', 'fhd'),
    ('gxws', '广西卫视', '2024060703', '600002509', 'fhd'),
    ('hljws', '黑龙江卫视', '2029797003', '600002498', 'fhd'),
    ('hainanws', '海南卫视', '2024055603', '600002506', 'fhd'),
    ('cqws', '重庆卫视', '2024061103', '600002531', 'fhd'),
    ('szws', '深圳卫视', '2024061303', '600002481', 'fhd'),
    ('scws', '四川卫视', '2024061403', '600002516', 'fhd'),
    ('henanws', '河南卫视', '2029797303', '600002525', 'fhd'),
    ('dnws', '东南卫视', '2024061503', '600002484', 'fhd'),
    ('gzws', '贵州卫视', '2024061603', '600002490', 'fhd'),
    ('jxws', '江西卫视', '2024061703', '600002503', 'fhd'),
    ('lnws', '辽宁卫视', '2024171303', '600002505', 'fhd'),
    ('ahws', '安徽卫视', '2024171403', '600002532', 'fhd'),
    ('hebws', '河北卫视', '2024171503', '600002493', 'fhd'),
    ('sdws', '山东卫视', '2029787903', '600002513', 'fhd'),
    ('tjws', '天津卫视', '2019927003', '600152137', 'fhd'),
    ('jlws', '吉林卫视', '2025561503', '600190405', 'fhd'),
    ('saxws', '陕西卫视', '2029795103', '600190400', 'fhd'),
    ('nxws', '宁夏卫视', '2025608503', '600190737', 'fhd'),
    ('nmgws', '内蒙古卫视', '2025561203', '600190401', 'fhd'),
    ('ynws', '云南卫视', '2025561303', '600190402', 'fhd'),
    ('shanxiws', '山西卫视', '2025560803', '600190407', 'fhd'),
    ('qhws', '青海卫视', '2025559103', '600190406', 'fhd'),
    ('xizangws', '西藏卫视', '2025558003', '600190403', 'fhd'),
    ('xjws', '新疆卫视', '2019927403', '600152138', 'fhd'),
    ('cetv1', 'CETV-1', '2022823801', '600171827', 'fhd'),
    ('guoxue', '国学频道', '2029360403', '600213139', 'fhd'),
]

CHANNEL_MAP = {c[0]: {'slug': c[0], 'name': c[1], 'sid': c[2], 'pid': c[3], 'defn': c[4]}
               for c in CHANNELS}

# 已知 JCE 返回坏域名的频道, 直接走 bkliveinfo
FORCE_BK = {'cctv11', 'cctv12', 'cctv14', 'cctv15', 'cctv16', 'cctv164k',
            'cctv17', 'cctv4k', 'cctvfyjc', 'cctvdyjc', 'cctvhjjc'}

# 运行时模式记录: slug -> 'jce' | 'bk'
_CHANNEL_MODE = {}

WINDOW = 300  # JCE 时移窗口秒数
UA = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
      'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')


def resolve_url(slug):
    """取一路频道的 m3u8 直链, 优先 JCE, 坏域名自动切 bkliveinfo。"""
    ch = CHANNEL_MAP[slug]
    mode = _CHANNEL_MODE.get(slug) or ('bk' if slug in FORCE_BK else 'jce')
    now = int(time.time())
    if mode == 'jce':
        try:
            return jce_timeshift_url(ch['pid'], ch['sid'], now - WINDOW, now, ch['defn'])
        except DeadHostError:
            _CHANNEL_MODE[slug] = 'bk'
    urls = bk_playurls(ch['sid'], ch['pid'], ch['defn'])
    if not urls:
        raise RuntimeError('no urls from bkliveinfo')
    return urls[0]


# ================================================================ FongMi Spider

try:
    from base.spider import Spider as BaseSpider  # type: ignore
except ImportError:
    class BaseSpider:  # 本地调试兜底
        pass


_GROUPS = [
    ('cctv',  '央视'),
    ('cgtn',  'CGTN'),
    ('local', '地方卫视'),
    ('pay',   '数字付费'),
]

_PAY_SLUGS = {'cctvfyjc', 'cctvdyjc', 'cctvhjjc'}

# 播放时附带 header, 有些播放器拉 CCTV CDN 需要 Referer
_PLAY_HEADER = json.dumps({
    'User-Agent': UA,
    'Referer': 'https://live.cctv.cn/',
})


def _in_group(tid, slug):
    if tid == 'cctv':
        return slug.startswith('cctv') and slug not in _PAY_SLUGS
    if tid == 'cgtn':
        return slug.startswith('cgtn')
    if tid == 'pay':
        return slug in _PAY_SLUGS
    if tid == 'local':
        return not slug.startswith(('cctv', 'cgtn'))
    return False


class Spider(BaseSpider):

    def init(self, extend=''):
        """extend 可传 JSON 字符串, 本实现不使用。"""
        pass

    def homeContent(self, filter):
        """返回直播分组, FongMi 用来渲染左侧分类栏。"""
        return {
            'class': [{'type_id': tid, 'type_name': name} for tid, name in _GROUPS]
        }

    def homeVideoContent(self):
        return {'list': []}

    def categoryContent(self, tid, pg, filter, extend):
        """按分组返回频道列表, 播放地址写在 vod_play_url 里。"""
        items = []
        for slug, name, _sid, _pid, _defn in CHANNELS:
            if not _in_group(tid, slug):
                continue
            try:
                url = resolve_url(slug)
            except Exception:
                url = ''          # 取流失败就留空, 播放时再重试
            items.append({
                'vod_id': slug,
                'vod_name': name,
                'vod_pic': '',
                'vod_content': name,
                'vod_play_from': '央视频',
                'vod_play_url': '%s$%s' % (name, url),
            })
        return {'list': items, 'page': 1, 'pagecount': 1,
                'limit': len(items), 'total': len(items)}

    def detailContent(self, ids):
        return {'list': []}

    def searchContent(self, key, quick, pg='1'):
        # 直播不需要搜索, 但仍实现以便部分版本不报错
        return {'list': []}

    def playerContent(self, flag, id, vipFlags):
        """id 为 slug; 播放时再取一次地址, 保证新鲜。"""
        slug = id
        try:
            url = resolve_url(slug)
        except Exception as e:
            return {'parse': 0, 'url': '', 'header': '',
                    'msg': 'resolve failed: %s' % e}
        return {
            'parse': 0,
            'playUrl': '',
            'url': url,
            'header': _PLAY_HEADER,
        }

    def localProxy(self, param):
        # 不实现本地代理, 直接让播放器拉央视 CDN
        return None


# ================================================================ 本地调试入口

if __name__ == '__main__':
    if len(sys.argv) > 1:
        slug = sys.argv[1]
        if slug == '--list':
            for tid, name in _GROUPS:
                print('== %s (%s) ==' % (name, tid))
                for s, n, _a, _b, _c in CHANNELS:
                    if _in_group(tid, s):
                        print('  %-12s %s' % (s, n))
        else:
            print(resolve_url(slug))
    else:
        print(__doc__)