// CCTV直播/回看获取脚本 - 代理模式
// 功能：获取播放地址 -> 下载M3U8 -> 处理M3U8 -> 返回给酷9播放

var channelMap = {
    'cctv1': ['2024078201', '600001859', 'shd'],
    'cctv2': ['2024075401', '600001800', 'fhd'],
    'cctv3': ['2024068501', '600001801', 'fhd'],
    'cctv4': ['2029797101', '600001814', 'fhd'],
    'cctv5': ['2024078401', '600001818', 'fhd'],
    'cctv5p': ['2024078001', '600001817', 'fhd'],
    'cctv6': ['2013693901', '600108442', 'fhd'],
    'cctv7': ['2024072001', '600004092', 'fhd'],
    'cctv8': ['2029793001', '600001803', 'fhd'],
    'cctv9': ['2024078601', '600004078', 'fhd'],
    'cctv10': ['2024078701', '600001805', 'fhd'],
    'cctv11': ['2027248701', '600001806', 'fhd'],
    'cctv12': ['2027248801', '600001807', 'fhd'],
    'cctv13': ['2029797201', '600001811', 'fhd'],
    'cctv14': ['2027248901', '600001809', 'fhd'],
    'cctv15': ['2027249001', '600001815', 'fhd'],
    'cctv16': ['2027249101', '600098637', 'fhd'],
    'cctv164k': ['2027249301', '600099502', 'fhd'],
    'cctv17': ['2027249401', '600001810', 'fhd'],
    'cctv4k': ['2029810301', '600002264', 'fhd'],
    'cctv8k': ['2026774101', '600156816', 'fhd'],
    'cgtn': ['2024181701', '600014550', 'fhd'],
    'cgtnfy': ['2024181801', '600084704', 'fhd'],
    'cgtney': ['2024181901', '600084758', 'fhd'],
    'cgtnalby': ['2024182001', '600084782', 'fhd'],
    'cgtnxby': ['2024182101', '600084744', 'fhd'],
    'cgtnwyjl': ['2024182301', '600084781', 'fhd'],
    'cctvfyjc': ['2025637103', '600099658', 'shd'],
    'cctvdyjc': ['2026874203', '600099655', 'shd'],
    'cctvhjjc': ['2026874303', '600099620', 'shd'],
    'cctvsjdl': ['2026874403', '600099637', 'shd'],
    'cctvfyyy': ['2026874503', '600099660', 'shd'],
    'cctvbqkj': ['2026874603', '600099649', 'shd'],
    'cctvfyzq': ['2026966203', '600099636', 'shd'],
    'cctvgeqwq': ['2026874703', '600099659', 'shd'],
    'cctvnxss': ['2026874803', '600099650', 'shd'],
    'cctvyswhjp': ['2026874903', '600099653', 'shd'],
    'cctvystq': ['2026875003', '600099652', 'shd'],
    'cctvdszn': ['2026875103', '600099656', 'shd'],
    'cctvwsjk': ['2025637003', '600099651', 'shd'],
    'bjws': ['2024052703', '600002309', 'fhd'],
    'jsws': ['2024171103', '600002521', 'fhd'],
    'dfws': ['2024054503', '600002483', 'fhd'],
    'zjws': ['2024054703', '600002520', 'fhd'],
    'hnws': ['2024054803', '600002475', 'fhd'],
    'hbws': ['2024171203', '600002508', 'fhd'],
    'gdws': ['2024060903', '600002485', 'fhd'],
    'gxws': ['2024060703', '600002509', 'fhd'],
    'hljws': ['2029797003', '600002498', 'fhd'],
    'hnws2': ['2024055603', '600002506', 'fhd'],
    'cqws': ['2024061103', '600002531', 'fhd'],
    'szws': ['2024061303', '600002481', 'fhd'],
    'scws': ['2024061403', '600002516', 'fhd'],
    'henanws': ['2029797303', '600002525', 'fhd'],
    'fjdnhz': ['2024061503', '600002484', 'fhd'],
    'gzhws': ['2024061603', '600002490', 'fhd'],
    'jxws': ['2024061703', '600002503', 'fhd'],
    'lnws': ['2024171303', '600002505', 'fhd'],
    'ahws': ['2024171403', '600002532', 'fhd'],
    'hbws2': ['2024171503', '600002493', 'fhd'],
    'sdws': ['2029787903', '600002513', 'fhd'],
    'tjws': ['2019927003', '600152137', 'fhd'],
    'jlws': ['2025561503', '600190405', 'fhd'],
    'shanxiws': ['2029795103', '600190400', 'fhd'],
    'nxws': ['2025608503', '600190737', 'fhd'],
    'nmgws': ['2025561203', '600190401', 'fhd'],
    'ynws': ['2025561303', '600190402', 'fhd'],
    'shanxiws2': ['2025560803', '600190407', 'fhd'],
    'qhws': ['2025559103', '600190406', 'fhd'],
    'xzws': ['2025558003', '600190403', 'fhd'],
    'cetv1': ['2022823801', '600171827', 'fhd'],
    'gxpd': ['2029360403', '600213139', 'fhd'],
    'btws': ['2025990501', '600193252', 'fhd'],
    'xjws': ['2019927403', '600152138', 'fhd']
};

// ==================== 工具函数 ====================

function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function generateGuid() {
    var guid = '';
    for (var i = 0; i < 32; i++) {
        guid += Math.floor(Math.random() * 16).toString(16);
    }
    return guid;
}

function buildQueryString(params) {
    var parts = [];
    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    }
    return parts.join('&');
}

// ==================== 核心：获取播放地址 ====================

function getPlayUrl(cnlid, livepid, defn, playseek) {
    // 生成GUID
    var guid = generateGuid();
    var timestamp = Math.floor(Date.now() / 1000);
    
    // 构建请求参数（使用固定的cKey，因为JS无法实现TEA加密）
    // 注意：这是简化版本，实际可能需要动态cKey
    var params = {
        "atime": "120",
        "livepid": livepid,
        "cnlid": cnlid,
        "appVer": "V8.22.1035.3031",
        "app_version": "300090",
        "caplv": "1",
        "cmd": "2",
        "defn": defn,
        "device": "iPhone",
        "encryptVer": "4.2",
        "getpreviewinfo": "0",
        "hevclv": "33",
        "lang": "zh-Hans_JP",
        "livequeue": "0",
        "logintype": "1",
        "nettype": "1",
        "newnettype": "1",
        "newplatform": "4330403",
        "platform": "4330403",
        "sdtfrom": "v3021",
        "spacode": "23",
        "spaudio": "1",
        "spdemuxer": "6",
        "spdrm": "2",
        "spdynamicrange": "7",
        "spflv": "1",
        "spflvaudio": "1",
        "sphdrfps": "60",
        "sphttps": "0",
        "spvcode": "MSgzMDoyMTYwLDYwOjIxNjB8MzA6MjE2MCw2MDoyMTYwKTsyKDMwOjIxNjAsNjA6MjE2MHwzMDoyMTYwLDYwOjIxNjAp",
        "spvideo": "4",
        "stream": "1",
        "system": "1",
        "sysver": "ios18.2.1",
        "uhd_flag": "4",
        "cKey": "--01A-B-C-D-E-F-G-H-I-J-K-L-M-N-O-P-Q-R-S-T-U-V-W-X-Y-Z-",
        "guid": guid,
        "fntick": timestamp,
        "flowid": generateUUID() + '_4330403'
    };
    
    // 回看模式
    if (playseek && playseek.length > 0) {
        var parts = playseek.split('-');
        if (parts.length === 2) {
            var startStr = parts[0];
            var year = parseInt(startStr.substr(0, 4));
            var month = parseInt(startStr.substr(4, 2)) - 1;
            var day = parseInt(startStr.substr(6, 2));
            var hour = parseInt(startStr.substr(8, 2));
            var minute = parseInt(startStr.substr(10, 2));
            var second = parseInt(startStr.substr(12, 2));
            params.playbacktime = Math.floor(new Date(year, month, day, hour, minute, second).getTime() / 1000);
        }
    } else {
        params.playbacktime = "0";
    }
    
    // 发送请求
    var url = "https://bkliveinfo.ysp.cctv.cn?" + buildQueryString(params);
    
    try {
        var response = ku9.get(url, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
            'Accept': 'application/json'
        });
        
        if (!response) return null;
        
        var data = JSON.parse(response);
        if (data.iretcode === 0 && data.playurl) {
            return data.playurl;
        }
    } catch (e) {
        console.log('[CCTV] 请求异常: ' + e.message);
    }
    
    return null;
}

// ==================== 主函数 ====================

function main(item) {
    var url = item.url || '';
    var id = ku9.getQuery(url, 'id') || 'cctv1';
    var playseek = ku9.getQuery(url, 'playseek') || null;
    
    // 检查频道
    if (!channelMap[id]) {
        return { url: 'error: 未知频道 ' + id };
    }
    
    var channel = channelMap[id];
    var cnlid = channel[0];
    var livepid = channel[1];
    var defn = channel[2];
    var isLive = !playseek || playseek === '';
    
    // 缓存Key
    var cacheKey = 'cctv_' + id + '_' + defn + (isLive ? '' : '_' + playseek);
    
    // 检查缓存（仅直播）
    if (isLive) {
        var cached = ku9.getCache(cacheKey);
        if (cached) {
            try {
                var cacheData = JSON.parse(cached);
                var now = Math.floor(Date.now() / 1000);
                if ((now - cacheData.time) <= 80) {
                    // 验证缓存地址是否有效
                    try {
                        var test = ku9.get(cacheData.url, { 'Range': 'bytes=0-100' });
                        if (test && test.length > 10) {
                            // 直播模式：需要返回M3U8内容
                            var m3u8Content = ku9.get(cacheData.url);
                            if (m3u8Content && m3u8Content.indexOf('#EXTM3U') !== -1) {
                                // 处理M3U8
                                var baseUrl = cacheData.url.substring(0, cacheData.url.lastIndexOf('/') + 1);
                                m3u8Content = m3u8Content.replace(/([^#][^:\n]*\.ts)/gm, function(m) {
                                    if (m.indexOf('http://') === 0 || m.indexOf('https://') === 0) return m;
                                    if (m.indexOf('/') === 0) {
                                        var u = ku9.uri(cacheData.url);
                                        return u.Scheme + '://' + u.Host + m;
                                    }
                                    return baseUrl + m;
                                });
                                // 插入刷新标签
                                if (m3u8Content.indexOf('#EXTM3U') === 0) {
                                    m3u8Content = '#EXTM3U\n#EXT-X-REFRESH:40\n' + m3u8Content.substring(7);
                                }
                                return { m3u8: m3u8Content };
                            }
                        }
                    } catch (e) {}
                }
            } catch (e) {}
        }
    }
    
    // 获取播放地址
    var playUrl = getPlayUrl(cnlid, livepid, defn, playseek);
    if (!playUrl) {
        return { url: 'error: 获取播放地址失败，请稍后重试' };
    }
    
    // 回看模式：直接返回地址
    if (!isLive) {
        return { url: playUrl };
    }
    
    // 直播模式：下载并处理M3U8
    try {
        var m3u8Content = ku9.get(playUrl, {
            'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_2_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
        });
        
        if (!m3u8Content || m3u8Content.indexOf('#EXTM3U') === -1) {
            // 如果无法获取M3U8，直接返回地址让播放器尝试
            return { url: playUrl };
        }
        
        // 处理TS路径
        var baseUrl = playUrl.substring(0, playUrl.lastIndexOf('/') + 1);
        m3u8Content = m3u8Content.replace(/([^#][^:\n]*\.ts)/gm, function(match) {
            if (match.indexOf('http://') === 0 || match.indexOf('https://') === 0) {
                return match;
            }
            if (match.indexOf('/') === 0) {
                var urlObj = ku9.uri(playUrl);
                return urlObj.Scheme + '://' + urlObj.Host + match;
            }
            return baseUrl + match;
        });
        
        // 插入刷新标签（与PHP一致）
        var refreshTag = "#EXT-X-REFRESH:40\n";
        if (m3u8Content.indexOf('#EXTM3U') === 0) {
            m3u8Content = '#EXTM3U\n' + refreshTag + m3u8Content.substring('#EXTM3U\n'.length);
        } else {
            m3u8Content = '#EXTM3U\n' + refreshTag + m3u8Content;
        }
        
        // 限制分片时长（与PHP一致）
        m3u8Content = m3u8Content.replace(/#EXTINF:(\d+\.?\d*),/g, function(match, duration) {
            var t = parseFloat(duration);
            return t > 30 ? '#EXTINF:30.000,' : match;
        });
        
        // 缓存播放地址
        ku9.setCache(cacheKey, JSON.stringify({ url: playUrl, time: Math.floor(Date.now() / 1000) }), 3600000);
        
        return { m3u8: m3u8Content };
        
    } catch (e) {
        console.log('[CCTV] M3U8处理异常: ' + e.message);
        // 如果处理失败，直接返回地址
        return { url: playUrl };
    }
}