#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
M3U直播源解析工具
功能：输入IP:端口或域名，自动解析playlist.m3u，提取频道列表
      支持一键验证频道有效性，智能#genre#分组
      支持复制和导出
用法：python m3u_parser.py --web
"""
import os
import sys
import json
import re
import time
import argparse
import ipaddress
import threading
import webbrowser
from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import Dict, List, Optional, Tuple
from urllib.parse import urljoin, urlparse, unquote
try:
    import requests
except ImportError:
    print("⚠️ 请先安装 requests: pip install requests")
    sys.exit(1)
try:
    from flask import Flask, request, jsonify, render_template_string
except ImportError:
    print("⚠️ 请先安装 Flask: pip install flask")
    sys.exit(1)
# ============================================================
# 配置
# ============================================================
DEFAULT_TIMEOUT = 10
DEFAULT_CONCURRENT = 15
DEFAULT_WEB_PORT = 5042
DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
# ============================================================
# M3U解析
# ============================================================
def parse_m3u(content: str, base_url: str) -> List[Dict]:
    """解析M3U内容，提取频道列表
    自动补全相对URL为完整URL
    """
    channels = []
    lines = content.splitlines()
    current_info = {}
    
    for line in lines:
        line = line.strip()
        if not line:
            continue
        
        # 解析#EXTINF行
        if line.startswith('#EXTINF'):
            current_info = parse_extinf(line)
            continue
        
        # 跳过其他注释行
        if line.startswith('#'):
            continue
        
        # 这是播放地址
        if current_info:
            # 补全相对URL
            play_url = line
            if not play_url.startswith('http'):
                play_url = urljoin(base_url.rstrip('/') + '/', play_url.lstrip('/'))
            
            # 将URL中的内网IP替换为输入的IP:端口
            play_url = replace_internal_ip(play_url, base_url)
            
            # 解码URL中的中文编码（%XX -> 中文）
            play_url_decoded = decode_url(play_url)
            
            channel = {
                'name': current_info.get('name', '未知频道'),
                'url': play_url,
                'url_decoded': play_url_decoded,
                'tvg_name': current_info.get('tvg-name', ''),
                'tvg_logo': current_info.get('tvg-logo', ''),
                'group_title': current_info.get('group-title', '未分类'),
                'duration': current_info.get('duration', '-1'),
                'valid': None,  # None=未验证, True=有效, False=无效
                'valid_msg': ''
            }
            channels.append(channel)
            current_info = {}
    
    return channels
def decode_url(url: str) -> str:
    """解码URL中的百分号编码（%XX -> 中文）
    例如：%E5%A4%AE%E8%A7%86 -> 央视
    """
    try:
        return unquote(url)
    except:
        return url
def parse_extinf(line: str) -> Dict:
    """解析#EXTINF行
    格式：#EXTINF:-1 tvg-name="CCTV1" tvg-logo="..." group-title="IPTV央视",CCTV-1 综合
    """
    info = {}
    
    # 分离属性和频道名（最后一个逗号后面是频道名）
    if ',' in line:
        idx = line.rfind(',')
        attrs_part = line[:idx]
        info['name'] = line[idx+1:].strip()
    else:
        attrs_part = line
        info['name'] = '未知频道'
    
    # 解析时长 #EXTINF:-1
    duration_match = re.match(r'#EXTINF:([-\d]+)', attrs_part)
    if duration_match:
        info['duration'] = duration_match.group(1)
    
    # 解析属性 tvg-name="..." tvg-logo="..." group-title="..."
    attrs = re.findall(r'(\w[\w-]*)\s*=\s*"([^"]*)"', attrs_part)
    for key, value in attrs:
        info[key.lower()] = value
    
    return info
def replace_internal_ip(url: str, base_url: str) -> str:
    """将URL中的内网IP替换为输入的IP:端口
    例如：http://192.168.10.1:4000/xxx -> http://114.223.123.88:4000/xxx
    """
    try:
        parsed = urlparse(url)
        base_parsed = urlparse(base_url)
        
        # 检查是否是内网IP
        if parsed.hostname:
            try:
                ip_obj = ipaddress.ip_address(parsed.hostname)
                if ip_obj.is_private or ip_obj.is_loopback or ip_obj.is_link_local:
                    # 替换为输入的IP:端口
                    new_netloc = base_parsed.netloc
                    url = parsed._replace(netloc=new_netloc).geturl()
            except ValueError:
                # 不是IP，可能是域名，不替换
                pass
    except:
        pass
    
    return url
# ============================================================
# 频道有效性验证
# ============================================================
def validate_channel(channel: Dict, timeout: int = 5) -> Dict:
    """验证单个频道是否可播放"""
    url = channel['url']
    
    try:
        headers = {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': '*/*',
            'Range': 'bytes=0-1023'  # 只请求前1KB，加快验证速度
        }
        resp = requests.get(url, headers=headers, timeout=timeout, stream=True, allow_redirects=True)
        
        # 检查状态码
        if resp.status_code == 200 or resp.status_code == 206:
            # 检查内容类型
            content_type = resp.headers.get('Content-Type', '').lower()
            
            # 检查是否是视频流或M3U8
            is_valid = False
            if any(ct in content_type for ct in ['video', 'mpeg', 'mp2t', 'mp4', 'm3u8', 'octet-stream', 'application/vnd.apple.mpegurl']):
                is_valid = True
            elif 'text' in content_type:
                # 可能是M3U8文件，检查内容
                try:
                    chunk = next(resp.iter_content(1024)).decode('utf-8', errors='ignore')
                    if '#EXTM3U' in chunk or '#EXTINF' in chunk:
                        is_valid = True
                except:
                    pass
            elif resp.content and len(resp.content) > 0:
                # 有内容返回，认为有效
                is_valid = True
            
            if is_valid:
                channel['valid'] = True
                channel['valid_msg'] = f'HTTP {resp.status_code}'
            else:
                channel['valid'] = False
                channel['valid_msg'] = f'非视频流 ({content_type})'
        else:
            channel['valid'] = False
            channel['valid_msg'] = f'HTTP {resp.status_code}'
        
        resp.close()
        
    except requests.exceptions.Timeout:
        channel['valid'] = False
        channel['valid_msg'] = '连接超时'
    except requests.exceptions.ConnectionError:
        channel['valid'] = False
        channel['valid_msg'] = '连接失败'
    except Exception as e:
        channel['valid'] = False
        channel['valid_msg'] = str(e)[:30]
    
    return channel
def validate_channels_batch(channels: List[Dict], timeout: int = 5, 
                           concurrent: int = 15, progress_callback=None) -> List[Dict]:
    """批量验证频道有效性"""
    total = len(channels)
    valid_count = 0
    
    with ThreadPoolExecutor(max_workers=concurrent) as executor:
        futures = {executor.submit(validate_channel, ch, timeout): ch for ch in channels}
        
        for i, future in enumerate(as_completed(futures), 1):
            channel = future.result()
            if channel['valid']:
                valid_count += 1
            
            if progress_callback:
                try:
                    progress_callback(i, total, channel)
                except:
                    pass
    
    print(f"✅ 验证完成：{valid_count}/{total} 个频道有效")
    return channels
# ============================================================
# 智能分组
# ============================================================
def smart_group_title(group_title: str, channel_name: str) -> str:
    """智能分类频道组别"""
    name = channel_name.lower()
    group = group_title or ''
    
    # 如果已有分组，直接使用
    if group and group != '未分类':
        return group
    
    # 根据频道名智能分类
    cctv_patterns = ['cctv', '央视', '中央']
    satellite_patterns = ['卫视', 'satellite']
    local_patterns = ['市', '县', '区', '本地', '城市']
    movie_patterns = ['电影', 'movie', '影院']
    series_patterns = ['电视剧', '剧集', 'series']
    sports_patterns = ['体育', 'sport', '足球', '篮球']
    news_patterns = ['新闻', 'news']
    kids_patterns = ['少儿', '动画', '卡通', 'kids', 'baby']
    music_patterns = ['音乐', 'music', '演唱会']
    documentary_patterns = ['纪实', '纪录片', 'documentary']
    education_patterns = ['教育', '科教', 'education']
    entertainment_patterns = ['综艺', '娱乐', 'entertainment']
    
    if any(p in name for p in cctv_patterns):
        return '央视频道'
    elif any(p in name for p in satellite_patterns):
        return '卫视频道'
    elif any(p in name for p in sports_patterns):
        return '体育频道'
    elif any(p in name for p in movie_patterns):
        return '电影频道'
    elif any(p in name for p in news_patterns):
        return '新闻频道'
    elif any(p in name for p in kids_patterns):
        return '少儿频道'
    elif any(p in name for p in music_patterns):
        return '音乐频道'
    elif any(p in name for p in documentary_patterns):
        return '纪实频道'
    elif any(p in name for p in series_patterns):
        return '电视剧频道'
    elif any(p in name for p in entertainment_patterns):
        return '综艺频道'
    elif any(p in name for p in education_patterns):
        return '教育频道'
    elif any(p in name for p in local_patterns):
        return '地方频道'
    else:
        return '其他频道'
def group_channels_by_genre(channels: List[Dict]) -> Dict[str, List[Dict]]:
    """按#genre#分组频道"""
    groups = {}
    
    for ch in channels:
        group = smart_group_title(ch.get('group_title', ''), ch.get('name', ''))
        if group not in groups:
            groups[group] = []
        groups[group].append(ch)
    
    return groups
def generate_genre_output(channels: List[Dict], only_valid: bool = True) -> str:
    """生成带#genre#分组的输出"""
    if only_valid:
        channels = [ch for ch in channels if ch.get('valid')]
    
    groups = group_channels_by_genre(channels)
    lines = []
    
    # 按频道数量排序分组
    sorted_groups = sorted(groups.items(), key=lambda x: len(x[1]), reverse=True)
    
    for group_name, group_channels in sorted_groups:
        lines.append(f'{group_name},#genre#')
        for ch in group_channels:
            url = ch.get('url_decoded') or ch.get('url', '')
            lines.append(f"{ch['name']},{url}")
        lines.append('')  # 空行分隔
    
    return '\n'.join(lines)
# ============================================================
# 获取M3U内容
# ============================================================
def fetch_m3u(server_addr: str, timeout: int = DEFAULT_TIMEOUT) -> Tuple[bool, str, str]:
    """获取M3U文件内容
    返回：(是否成功, 内容, 基础URL)
    """
    server = server_addr.strip()
    if not server:
        return False, '请输入服务器地址', ''
    
    # 补全http前缀
    if not server.startswith('http'):
        server = 'http://' + server
    
    # 构建M3U URL
    parsed = urlparse(server)
    base_url = f'{parsed.scheme}://{parsed.netloc}'
    m3u_url = f'{base_url}/playlist.m3u'
    
    try:
        headers = {
            'User-Agent': DEFAULT_USER_AGENT,
            'Accept': '*/*'
        }
        resp = requests.get(m3u_url, headers=headers, timeout=timeout, allow_redirects=True)
        
        if resp.status_code != 200:
            return False, f'HTTP {resp.status_code}', base_url
        
        # 自动检测编码
        if resp.encoding and resp.encoding.lower() == 'iso-8859-1':
            resp.encoding = resp.apparent_encoding or 'utf-8'
        
        content = resp.text
        return True, content, base_url
        
    except requests.exceptions.Timeout:
        return False, '连接超时', base_url
    except requests.exceptions.ConnectionError:
        return False, '连接失败', base_url
    except Exception as e:
        return False, str(e)[:50], base_url
# ============================================================
# Web界面
# ============================================================
def start_web_server(port: int = DEFAULT_WEB_PORT):
    """启动Web界面"""
    app = Flask(__name__)
    
    PAGE = """
<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>M3U直播源解析工具</title>
<style>
* { margin: 0; padding: 0; box-sizing: border-box; }
body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 50%, #4facfe 100%);
    min-height: 100vh;
    padding: 30px 16px;
    color: #333;
}
.container { max-width: 1200px; margin: 0 auto; }
.header {
    text-align: center;
    margin-bottom: 28px;
    color: #fff;
}
.header h1 {
    font-size: 36px;
    font-weight: 700;
    margin-bottom: 10px;
    text-shadow: 0 2px 10px rgba(0,0,0,0.15);
}
.header p {
    font-size: 15px;
    opacity: 0.92;
}
.card {
    background: rgba(255, 255, 255, 0.98);
    border-radius: 20px;
    padding: 28px 26px;
    margin-bottom: 22px;
    box-shadow: 0 10px 40px rgba(0,0,0,0.12);
}
.form-group { margin-bottom: 20px; }
.form-label {
    display: block;
    font-size: 15px;
    color: #333;
    margin-bottom: 10px;
    font-weight: 600;
}
.form-input {
    width: 100%;
    padding: 14px 18px;
    border: 2px solid #e0e4ef;
    border-radius: 12px;
    font-size: 16px;
    outline: none;
    transition: all 0.25s ease;
    background: #fafbff;
    color: #333;
}
.form-input:focus {
    border-color: #667eea;
    background: #fff;
    box-shadow: 0 0 0 4px rgba(102, 126, 234, 0.1);
}
.form-tip {
    font-size: 13px;
    color: #999;
    margin-top: 8px;
    line-height: 1.5;
}
.options-row {
    display: flex;
    gap: 20px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}
.option-group {
    flex: 1;
    min-width: 150px;
}
.option-label {
    display: block;
    font-size: 14px;
    color: #555;
    margin-bottom: 8px;
    font-weight: 500;
}
.btn {
    padding: 14px 28px;
    border: none;
    border-radius: 12px;
    font-size: 16px;
    cursor: pointer;
    transition: all 0.25s ease;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    gap: 8px;
}
.btn-primary {
    background: linear-gradient(135deg, #667eea 0%, #4facfe 100%);
    color: #fff;
    box-shadow: 0 4px 15px rgba(102, 126, 234, 0.35);
}
.btn-primary:hover {
    transform: translateY(-2px);
    box-shadow: 0 6px 20px rgba(102, 126, 234, 0.5);
}
.btn-primary:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
}
.btn-success {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
    color: #fff;
}
.btn-warning {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
    color: #fff;
}
.btn-secondary {
    background: #f0f2f8;
    color: #555;
}
.btn-group {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 10px;
}
.stats-bar {
    display: flex;
    gap: 16px;
    margin-bottom: 20px;
    flex-wrap: wrap;
}
.stat-item {
    flex: 1;
    min-width: 100px;
    background: linear-gradient(135deg, #f5f7fa 0%, #e8ecf3 100%);
    border-radius: 12px;
    padding: 16px;
    text-align: center;
}
.stat-value {
    font-size: 28px;
    font-weight: 700;
    color: #667eea;
}
.stat-label {
    font-size: 13px;
    color: #888;
    margin-top: 4px;
}
.progress-bar {
    width: 100%;
    height: 28px;
    background: #e8ecf4;
    border-radius: 14px;
    overflow: hidden;
    margin: 16px 0;
    display: none;
    position: relative;
}
.progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #667eea, #4facfe);
    border-radius: 14px;
    transition: width 0.3s ease;
    width: 0%;
}
.progress-text {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    font-size: 13px;
    font-weight: 600;
    color: #333;
    z-index: 1;
}
.filter-tabs {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
    flex-wrap: wrap;
}
.filter-tab {
    padding: 8px 16px;
    border-radius: 20px;
    font-size: 13px;
    cursor: pointer;
    background: #f0f2f8;
    color: #666;
    transition: all 0.2s;
    border: none;
    font-weight: 500;
}
.filter-tab.active {
    background: linear-gradient(135deg, #667eea 0%, #4facfe 100%);
    color: #fff;
}
.channel-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
}
.channel-item {
    background: #fafbff;
    border: 1px solid #e8ecf4;
    border-radius: 12px;
    padding: 16px 18px;
    transition: all 0.2s;
}
.channel-item:hover {
    border-color: #667eea;
    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.1);
}
.channel-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    gap: 10px;
}
.channel-name {
    font-size: 16px;
    font-weight: 600;
    color: #333;
    flex: 1;
}
.channel-badges {
    display: flex;
    gap: 6px;
    flex-shrink: 0;
    flex-wrap: wrap;
}
.badge {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
}
.badge-group {
    background: linear-gradient(135deg, #a1c4fd 0%, #c2e9fb 100%);
    color: #1a4d8b;
}
.badge-valid {
    background: linear-gradient(135deg, #d4fc79 0%, #96e6a1 100%);
    color: #2d5016;
}
.badge-invalid {
    background: linear-gradient(135deg, #ffdde1 0%, #ee9ca7 100%);
    color: #8b1a2a;
}
.badge-unknown {
    background: #e8ecf4;
    color: #888;
}
.channel-url-row {
    display: flex;
    align-items: center;
    gap: 10px;
}
.channel-url {
    flex: 1;
    font-size: 13px;
    color: #667eea;
    font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
    word-break: break-all;
    background: #fff;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid #e8ecf4;
}
.copy-url-btn {
    padding: 6px 12px;
    background: #f0f2f8;
    border: none;
    border-radius: 8px;
    font-size: 12px;
    cursor: pointer;
    color: #666;
    flex-shrink: 0;
    transition: all 0.2s;
}
.copy-url-btn:hover {
    background: #667eea;
    color: #fff;
}
.error-tip {
    padding: 20px;
    text-align: center;
    color: #ef4444;
    background: #fef2f2;
    border-radius: 10px;
}
.empty-state {
    text-align: center;
    padding: 40px 20px;
    color: #999;
}
.empty-state-icon {
    font-size: 48px;
    margin-bottom: 16px;
}
.loading {
    display: inline-block;
    width: 18px;
    height: 18px;
    border: 2px solid #ffffff40;
    border-top-color: #fff;
    border-radius: 50%;
    animation: spin 0.8s linear infinite;
}
@keyframes spin { to { transform: rotate(360deg); } }
.modal-overlay {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.6);
    z-index: 10000;
    justify-content: center;
    align-items: center;
    padding: 20px;
}
.modal-overlay.active { display: flex; }
.modal-box {
    background: #fff;
    border-radius: 16px;
    width: 100%;
    max-width: 900px;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    overflow: hidden;
}
.modal-header {
    background: linear-gradient(135deg, #667eea 0%, #4facfe 100%);
    color: #fff;
    padding: 16px 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
}
.modal-title {
    font-size: 18px;
    font-weight: 600;
}
.modal-close {
    background: rgba(255,255,255,0.2);
    border: none;
    color: #fff;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    cursor: pointer;
    font-size: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
    margin-left: 10px;
    flex-shrink: 0;
}
.modal-body {
    padding: 20px;
    overflow-y: auto;
    flex: 1;
}
.genre-output {
    background: #fafbff;
    border: 1px solid #e8ecf4;
    border-radius: 10px;
    padding: 16px;
    font-size: 14px;
    line-height: 2;
    color: #333;
    white-space: pre-wrap;
    word-break: break-all;
    max-height: 500px;
    overflow-y: auto;
    font-family: "SF Mono", "Monaco", "Inconsolata", monospace;
}
@media (max-width: 768px) {
    .header h1 { font-size: 26px; }
    .card { padding: 20px 16px; }
    .btn { width: 100%; justify-content: center; }
    .btn-group { flex-direction: column; }
    .channel-header { flex-direction: column; align-items: flex-start; }
    .channel-url-row { flex-direction: column; align-items: stretch; }
    .copy-url-btn { width: 100%; }
}
</style>
</head>
<body>
<div class="container">
    <div class="header">
        <h1>📺 M3U直播源解析工具</h1>
        <p>输入IP:端口或域名，自动解析playlist.m3u，支持一键验证和智能分组</p>
    </div>
    <div class="card">
        <div class="form-group">
            <label class="form-label">服务器地址（IP:端口 或 域名）</label>
            <input class="form-input" id="serverInput" placeholder="例如：114.223.123.88:4000 或 example.com:8080">
            <div class="form-tip">支持IP和域名，自动解析 http://地址/playlist.m3u</div>
        </div>
        <div class="options-row">
            <div class="option-group">
                <label class="option-label">解析超时（秒）</label>
                <input type="number" class="form-input" id="timeoutInput" value="10" min="1" max="30">
            </div>
            <div class="option-group">
                <label class="option-label">验证并发数</label>
                <input type="number" class="form-input" id="concurrentInput" value="15" min="1" max="50">
            </div>
        </div>
        <button class="btn btn-primary" id="parseBtn" onclick="startParse()">
            <span>🔍 开始解析</span>
        </button>
        <div class="progress-bar" id="progressBar">
            <div class="progress-fill" id="progressFill"></div>
            <div class="progress-text" id="progressText">0%</div>
        </div>
    </div>
    <div id="resultCard" class="card" style="display:none;">
        <div class="stats-bar" id="statsBar"></div>
        <div class="filter-tabs">
            <button class="filter-tab active" onclick="filterChannels('all', this)">全部</button>
            <button class="filter-tab" onclick="filterChannels('valid', this)">有效</button>
            <button class="filter-tab" onclick="filterChannels('invalid', this)">无效</button>
            <button class="filter-tab" onclick="filterChannels('unverified', this)">未验证</button>
        </div>
        <div class="btn-group" style="margin-bottom:20px;">
            <button class="btn btn-success" onclick="startValidate()">✅ 一键验证</button>
            <button class="btn btn-warning" onclick="showGenreOutput()">📋 分组结果</button>
            <button class="btn btn-secondary" onclick="copyAllUrls()">📋 复制全部URL</button>
            <button class="btn btn-secondary" onclick="exportResults()">💾 导出TXT</button>
            <button class="btn btn-secondary" onclick="clearResults()">🗑️ 清空</button>
        </div>
        <div class="channel-list" id="channelList"></div>
    </div>
</div>
<div class="modal-overlay" id="genreModal" onclick="closeGenreModal(event)">
    <div class="modal-box" onclick="event.stopPropagation()">
        <div class="modal-header">
            <div class="modal-title">📋 分组结果（#genre#格式）</div>
            <button class="modal-close" onclick="closeGenreModal()">✕</button>
        </div>
        <div class="modal-body">
            <div class="btn-group" style="margin-bottom:16px;">
                <button class="btn btn-success" onclick="copyGenreOutput()">📋 复制分组结果</button>
                <button class="btn btn-warning" onclick="exportGenreOutput()">💾 导出分组结果</button>
            </div>
            <div class="genre-output" id="genreOutput"></div>
        </div>
    </div>
</div>
<script>
let allChannels = [];
let currentFilter = 'all';
let isVerifying = false;
async function startParse() {
    const server = document.getElementById('serverInput').value.trim();
    const timeout = parseInt(document.getElementById('timeoutInput').value) || 10;
    
    if (!server) {
        alert('请输入服务器地址');
        return;
    }
    
    const btn = document.getElementById('parseBtn');
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span><span>解析中...</span>';
    
    try {
        const resp = await fetch('/api/parse', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({server: server, timeout: timeout})
        });
        
        const data = await resp.json();
        
        if (!data.success) {
            alert('解析失败: ' + data.error);
            return;
        }
        
        allChannels = data.channels;
        currentFilter = 'all';
        renderChannels();
        document.getElementById('resultCard').style.display = 'block';
        document.getElementById('resultCard').scrollIntoView({ behavior: 'smooth' });
        
    } catch(e) {
        alert('请求失败: ' + e.message);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<span>🔍 开始解析</span>';
    }
}
async function startValidate() {
    if (allChannels.length === 0) {
        alert('请先解析频道列表');
        return;
    }
    
    if (isVerifying) {
        alert('正在验证中，请稍候...');
        return;
    }
    
    isVerifying = true;
    const concurrent = parseInt(document.getElementById('concurrentInput').value) || 15;
    const timeout = parseInt(document.getElementById('timeoutInput').value) || 10;
    
    const progressBar = document.getElementById('progressBar');
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    progressBar.style.display = 'block';
    progressFill.style.width = '0%';
    progressText.textContent = '0% (0/' + allChannels.length + ')';
    
    try {
        const resp = await fetch('/api/validate', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                channels: allChannels,
                timeout: Math.min(timeout, 8),
                concurrent: concurrent
            })
        });
        
        const reader = resp.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        
        while (true) {
            const {done, value} = await reader.read();
            if (done) break;
            
            buffer += decoder.decode(value, {stream: true});
            const lines = buffer.split('\\n');
            buffer = lines.pop();
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const dataStr = line.substring(6);
                    try {
                        const data = JSON.parse(dataStr);
                        
                        if (data.type === 'progress') {
                            const percent = data.percent;
                            progressFill.style.width = percent + '%';
                            progressText.textContent = percent + '% (' + data.current + '/' + data.total + ')';
                            
                            const idx = allChannels.findIndex(c => c.url === data.channel.url);
                            if (idx !== -1) {
                                allChannels[idx] = data.channel;
                            }
                            renderChannels();
                            
                        } else if (data.type === 'complete') {
                            allChannels = data.channels;
                            progressFill.style.width = '100%';
                            progressText.textContent = '100% (' + data.total + '/' + data.total + ')';
                            renderChannels();
                            
                            setTimeout(() => {
                                progressBar.style.display = 'none';
                            }, 1000);
                        }
                    } catch(e) {
                        console.error('解析SSE数据失败:', e);
                    }
                }
            }
        }
        
    } catch(e) {
        alert('验证失败: ' + e.message);
        progressBar.style.display = 'none';
    } finally {
        isVerifying = false;
    }
}
function renderChannels() {
    const filtered = filterData(allChannels, currentFilter);
    const list = document.getElementById('channelList');
    
    const total = allChannels.length;
    const validCount = allChannels.filter(c => c.valid === true).length;
    const invalidCount = allChannels.filter(c => c.valid === false).length;
    const unverifiedCount = allChannels.filter(c => c.valid === null || c.valid === undefined).length;
    
    document.getElementById('statsBar').innerHTML = `
        <div class="stat-item">
            <div class="stat-value">${total}</div>
            <div class="stat-label">总频道</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color:#11998e;">${validCount}</div>
            <div class="stat-label">有效</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color:#f5576c;">${invalidCount}</div>
            <div class="stat-label">无效</div>
        </div>
        <div class="stat-item">
            <div class="stat-value" style="color:#999;">${unverifiedCount}</div>
            <div class="stat-label">未验证</div>
        </div>
    `;
    
    if (filtered.length === 0) {
        list.innerHTML = '<div class="empty-state"><div class="empty-state-icon">📭</div>暂无数据</div>';
        return;
    }
    
    list.innerHTML = filtered.map((ch, idx) => {
        let validBadge = '';
        if (ch.valid === true) {
            validBadge = '<span class="badge badge-valid">✅ 有效</span>';
        } else if (ch.valid === false) {
            validBadge = '<span class="badge badge-invalid">❌ ' + (ch.valid_msg || '无效') + '</span>';
        } else {
            validBadge = '<span class="badge badge-unknown">⏳ 未验证</span>';
        }
        
        return `
        <div class="channel-item">
            <div class="channel-header">
                <div class="channel-name">${idx + 1}. ${escapeHtml(ch.name)}</div>
                <div class="channel-badges">
                    <span class="badge badge-group">${escapeHtml(ch.group_title || '未分类')}</span>
                    ${validBadge}
                </div>
            </div>
            <div class="channel-url-row">
                <div class="channel-url">${escapeHtml(ch.url_decoded || ch.url)}</div>
                <button class="copy-url-btn" onclick="copyUrl('${(ch.url_decoded || ch.url).replace(/'/g, "\\\\'")}')">📋 复制</button>
            </div>
        </div>
        `;
    }).join('');
}
function filterData(channels, filter) {
    switch(filter) {
        case 'valid':
            return channels.filter(c => c.valid === true);
        case 'invalid':
            return channels.filter(c => c.valid === false);
        case 'unverified':
            return channels.filter(c => c.valid === null || c.valid === undefined);
        default:
            return channels;
    }
}
function filterChannels(filter, el) {
    currentFilter = filter;
    document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
    renderChannels();
}
function copyUrl(url) {
    navigator.clipboard.writeText(url).then(() => {
        showToast('✅ 已复制URL');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = url;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✅ 已复制URL');
    });
}
function copyAllUrls() {
    if (allChannels.length === 0) {
        alert('没有可复制的频道');
        return;
    }
    
    const text = allChannels.map(c => c.url_decoded || c.url).join('\\n');
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ 已复制全部URL');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✅ 已复制全部URL');
    });
}
function exportResults() {
    if (allChannels.length === 0) {
        alert('没有可导出的频道');
        return;
    }
    
    let text = '';
    allChannels.forEach(ch => {
        text += `${ch.name},${ch.url_decoded || ch.url}\\n`;
    });
    
    const blob = new Blob(['\\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'm3u频道列表_' + new Date().toISOString().slice(0,10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ 已导出频道列表');
}
function showGenreOutput() {
    const validOnly = allChannels.some(c => c.valid === true);
    const onlyValid = validOnly ? confirm('是否只导出来源有效的频道？\\n点击"确定"只导出来源有效的，点击"取消"导出全部') : false;
    
    const channels = onlyValid ? allChannels.filter(c => c.valid === true) : allChannels;
    
    if (channels.length === 0) {
        alert('没有可导出的频道');
        return;
    }
    
    const groups = {};
    channels.forEach(ch => {
        const group = smartGroup(ch.group_title, ch.name);
        if (!groups[group]) groups[group] = [];
        groups[group].push(ch);
    });
    
    let output = '';
    const sortedGroups = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
    sortedGroups.forEach(([groupName, groupChannels]) => {
        output += `${groupName},#genre#\\n`;
        groupChannels.forEach(ch => {
            output += `${ch.name},${ch.url_decoded || ch.url}\\n`;
        });
        output += '\\n';
    });
    
    document.getElementById('genreOutput').textContent = output;
    document.getElementById('genreModal').classList.add('active');
}
function smartGroup(groupTitle, channelName) {
    const name = channelName.toLowerCase();
    
    if (groupTitle && groupTitle !== '未分类') return groupTitle;
    
    if (name.includes('cctv') || name.includes('央视') || name.includes('中央')) return '央视频道';
    if (name.includes('卫视')) return '卫视频道';
    if (name.includes('体育') || name.includes('sport') || name.includes('足球') || name.includes('篮球')) return '体育频道';
    if (name.includes('电影') || name.includes('movie')) return '电影频道';
    if (name.includes('新闻') || name.includes('news')) return '新闻频道';
    if (name.includes('少儿') || name.includes('动画') || name.includes('卡通') || name.includes('kids')) return '少儿频道';
    if (name.includes('音乐') || name.includes('music')) return '音乐频道';
    if (name.includes('纪实') || name.includes('纪录片')) return '纪实频道';
    if (name.includes('综艺') || name.includes('娱乐')) return '综艺频道';
    if (name.includes('教育') || name.includes('科教')) return '教育频道';
    
    return '其他频道';
}
function copyGenreOutput() {
    const text = document.getElementById('genreOutput').textContent;
    navigator.clipboard.writeText(text).then(() => {
        showToast('✅ 已复制分组结果');
    }).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        showToast('✅ 已复制分组结果');
    });
}
function exportGenreOutput() {
    const text = document.getElementById('genreOutput').textContent;
    const blob = new Blob(['\\ufeff' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(url);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'm3u分组结果_' + new Date().toISOString().slice(0,10) + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    showToast('✅ 已导出分组结果');
}
function closeGenreModal(event) {
    if (event && event.target !== event.currentTarget) return;
    document.getElementById('genreModal').classList.remove('active');
}
function clearResults() {
    if (confirm('确定要清空结果吗？')) {
        allChannels = [];
        document.getElementById('resultCard').style.display = 'none';
        showToast('🗑️ 已清空结果');
    }
}
function showToast(msg) {
    const toast = document.createElement('div');
    toast.style.cssText = 'position:fixed;top:30px;left:50%;transform:translateX(-50%);background:linear-gradient(135deg,#667eea 0%,#4facfe 100%);color:#fff;padding:14px 28px;border-radius:12px;font-size:15px;font-weight:500;box-shadow:0 8px 30px rgba(102,126,234,0.4);z-index:9999;animation:fadeIn 0.3s ease;';
    toast.textContent = msg;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
</script>
</body>
</html>
    """
    
    @app.route('/')
    def index():
        return render_template_string(PAGE)
    
    @app.route('/api/parse', methods=['POST'])
    def api_parse():
        """解析M3U文件"""
        params = request.get_json()
        server = params.get('server', '').strip()
        timeout = params.get('timeout', DEFAULT_TIMEOUT)
        
        if not server:
            return jsonify({'success': False, 'error': '请输入服务器地址'})
        
        print(f"\n🔍 开始解析: {server}")
        
        success, content, base_url = fetch_m3u(server, timeout)
        
        if not success:
            return jsonify({'success': False, 'error': content})
        
        channels = parse_m3u(content, base_url)
        
        if not channels:
            return jsonify({'success': False, 'error': '未解析到频道，请检查地址是否正确'})
        
        print(f"✅ 解析完成，共 {len(channels)} 个频道")
        
        return jsonify({
            'success': True,
            'count': len(channels),
            'base_url': base_url,
            'channels': channels
        })
    
    @app.route('/api/validate', methods=['POST'])
    def api_validate():
        """SSE批量验证频道有效性"""
        import queue
        
        params = request.get_json()
        channels = params.get('channels', [])
        timeout = params.get('timeout', 5)
        concurrent = params.get('concurrent', DEFAULT_CONCURRENT)
        
        if not channels:
            return jsonify({'success': False, 'error': '没有可验证的频道'})
        
        def generate():
            progress_queue = queue.Queue()
            total = len(channels)
            done = False
            
            def progress_callback(current, total_count, channel):
                progress_queue.put({
                    'type': 'progress',
                    'current': current,
                    'total': total_count,
                    'percent': int(current / total_count * 100),
                    'channel': channel
                })
            
            def run_validate():
                nonlocal done
                try:
                    validate_channels_batch(channels, timeout=timeout, 
                                           concurrent=concurrent,
                                           progress_callback=progress_callback)
                except Exception as e:
                    print(f"验证出错: {e}")
                finally:
                    done = True
            
            validate_thread = threading.Thread(target=run_validate)
            validate_thread.daemon = True
            validate_thread.start()
            
            while not done or not progress_queue.empty():
                try:
                    progress_data = progress_queue.get(timeout=0.1)
                    yield f"data: {json.dumps(progress_data, ensure_ascii=False)}\n\n"
                except queue.Empty:
                    pass
            
            validate_thread.join(timeout=10)
            
            complete_data = {
                'type': 'complete',
                'total': len(channels),
                'channels': channels
            }
            yield f"data: {json.dumps(complete_data, ensure_ascii=False)}\n\n"
        
        return app.response_class(
            generate(),
            mimetype='text/event-stream',
            headers={
                'Cache-Control': 'no-cache',
                'X-Accel-Buffering': 'no',
                'Access-Control-Allow-Origin': '*'
            }
        )
    
    print(f"\n🌐 M3U直播源解析工具已启动: http://127.0.0.1:{port}")
    print(f"   按 Ctrl+C 停止服务\n")
    app.run(host='0.0.0.0', port=port, debug=False)
# ============================================================
# 命令行模式
# ============================================================
def main():
    parser = argparse.ArgumentParser(description='M3U直播源解析工具')
    parser.add_argument('--web', action='store_true', help='启动Web界面')
    parser.add_argument('--port', type=int, default=DEFAULT_WEB_PORT, help=f'Web界面端口 (默认: {DEFAULT_WEB_PORT})')
    parser.add_argument('--server', type=str, help='服务器地址')
    parser.add_argument('--timeout', type=int, default=DEFAULT_TIMEOUT, help=f'超时时间 (默认: {DEFAULT_TIMEOUT}秒)')
    parser.add_argument('--validate', action='store_true', help='验证频道有效性')
    parser.add_argument('--output', type=str, help='输出文件路径')
    
    args = parser.parse_args()
    
    if args.web:
        start_web_server(args.port)
        return
    
    if not args.server:
        print("请使用 --web 启动Web界面，或使用 --server 指定服务器地址")
        parser.print_help()
        return
    
    print(f"🔍 开始解析: {args.server}")
    success, content, base_url = fetch_m3u(args.server, args.timeout)
    
    if not success:
        print(f"❌ 解析失败: {content}")
        sys.exit(1)
    
    channels = parse_m3u(content, base_url)
    print(f"✅ 解析完成，共 {len(channels)} 个频道")
    
    if args.validate:
        print(f"\n🔄 开始验证频道有效性...")
        channels = validate_channels_batch(channels, timeout=min(args.timeout, 8))
    
    print("\n" + "=" * 80)
    print("📊 频道列表")
    print("=" * 80)
    
    for i, ch in enumerate(channels, 1):
        valid_str = ''
        if ch['valid'] is True:
            valid_str = ' ✅'
        elif ch['valid'] is False:
            valid_str = f' ❌({ch["valid_msg"]})'
        
        print(f"{i}. {ch['name']}{valid_str}")
        print(f"   {ch.get('url_decoded') or ch['url']}")
        print()
    
    if args.output:
        output_text = generate_genre_output(channels, only_valid=False)
        try:
            with open(args.output, 'w', encoding='utf-8') as f:
                f.write(output_text)
            print(f"💾 结果已保存到: {args.output}")
        except Exception as e:
            print(f"⚠️ 保存失败: {e}")


if __name__ == '__main__':
    # 双击无参运行自动开启web，并且自动打开浏览器
    def open_browser():
        time.sleep(1.2)
        webbrowser.open("http://127.0.0.1:5042")

    if len(sys.argv) <= 1:
        sys.argv.append("--web")
        threading.Thread(target=open_browser, daemon=True).start()
    main()
