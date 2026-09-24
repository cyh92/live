// 酷9 JS 脚本 - 陕西网络广播电视台（snrtv）直播代理
// 使用方式：http://your-server/ku9/js/snrtv.js?id=star
// 支持频道：star / 1 / 2 / 3 / 5 / 7 / nl / 11

function main(item) {
    var uri = item.url;

    // 从 URL 中提取频道 ID，默认为 "star"
    var chId = 'star';
    if (uri) {
        var q = ku9.getQuery(uri, "id");
        if (q) {
            chId = q;
        } else {
            // 兼容路径形式 /snrtv/star
            var segs = uri.split('/');
            var last = segs[segs.length - 1];
            if (last && last.indexOf('.') === -1) {
                chId = last;
            }
        }
    }

    // 频道号映射（与官网 programGuides.js 一致）
    var videoHashMap = {
        'star': 8,
        '1':    1,
        '2':    2,
        '3':    3,
        '5':    5,
        '7':    7,
        'nl':   9,
        '11':   11
    };
    var targetNum = videoHashMap[chId] || 8;

    // 获取频道列表（带缓存）
    var tvList = loadTvList();
    if (!tvList) {
        return JSON.stringify({ url: '', error: '获取频道列表失败' });
    }

    // 查找目标频道
    var found = null;
    if (Array.isArray(tvList)) {
        for (var i = 0; i < tvList.length; i++) {
            var it = tvList[i];
            if (String(it.num || it.id || it.channel) === String(targetNum)) {
                found = it;
                break;
            }
        }
    } else if (typeof tvList === 'object') {
        found = tvList[String(targetNum)] || tvList[chId];
    }

    if (!found) {
        return JSON.stringify({ url: '', error: '未找到频道: ' + chId });
    }

    var m3u8 = found.m3u8 || found.url || found.src;
    if (!m3u8) {
        return JSON.stringify({ url: '', error: '未找到播放地址' });
    }

    return JSON.stringify({
        url: m3u8,
        headers: {
            'User-Agent': 'okhttp/3.12.11',
            'Referer': 'http://m.snrtv.com/'
        }
    });
}

// ===== 获取并解密频道列表 =====
function loadTvList() {
    var CACHE_KEY = 'snrtv_tvlist';
    var STREAM_JS = 'http://toutiao.cnwest.com/static/v1/stream.js';

    // 1. 尝试从缓存读取
    var cached = ku9.getCache(CACHE_KEY);
    if (cached) {
        try {
            return JSON.parse(cached);
        } catch (e) {
            // 缓存损坏，继续重新获取
        }
    }

    // 2. 请求 stream.js
    var js = ku9.get(STREAM_JS, {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36',
        'Referer': 'http://m.snrtv.com/'
    });

    if (!js) return null;

    // 3. 提取 sTV / sRadio
    var tvMatch = js.match(/var\s+sTV\s*=\s*"([^"]+)"/);
    var radioMatch = js.match(/var\s+sRadio\s*=\s*"([^"]+)"/);
    if (!tvMatch || !radioMatch) return null;

    var sTV = tvMatch[1];
    var sRadio = radioMatch[1];

    // 4. 解密：key = sTV 前16字符，iv = sRadio 前16字符，密文 = sTV 第16字符起
    var key = sTV.substring(0, 16);
    var iv = sRadio.substring(0, 16);
    var cipher = sTV.substring(16);

    var jsonStr;
    try {
        // ku9.opensslDecrypt(key, iv, type, data)
        // 官网使用 ZeroPadding，这里解密后需去除尾部 \0
        jsonStr = ku9.opensslDecrypt(key, iv, 'AES-128-CBC', cipher);
        // 去除尾部空字节（ZeroPadding 残留）
        jsonStr = jsonStr.replace(/\0+$/, '');
    } catch (e) {
        return null;
    }

    // 5. 提取 JSON 部分
    var start = jsonStr.indexOf('{');
    var end = jsonStr.lastIndexOf('}');
    if (start === -1 || end === -1) return null;

    var data;
    try {
        data = JSON.parse(jsonStr.substring(start, end + 1));
    } catch (e) {
        return null;
    }

    // 6. 写入缓存（30 分钟）
    ku9.setCache(CACHE_KEY, JSON.stringify(data), 1800000);

    return data;
}