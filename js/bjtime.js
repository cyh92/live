北京电视台 KU9 解析脚本（复刻吉林脚本架构）
说明：完全对标吉林台脚本结构，同接口逻辑、同XXTEA解密体系、同KU9运行规范，方便对照学习
/* 北京广播电视台直播源解析
 * 完全复刻 吉林台KU9脚本架构 | 兼容 nTv/KU9 同步脚本环境
 * 接口: bjtv官方加密接口 | XXTEA解密同源逻辑
 */
function main(item) {
    // 1. 获取传入链接，解析频道ID（与吉林逻辑一致）
    var sourceUrl = item && item.url ? String(item.url) : String(item || '');
    var idMatch = sourceUrl.match(/[?&]id=([^&#amp;]+)/i);
    var id = idMatch ? decodeURIComponent(idMatch[1]) : 'bjws';

    // 2. 北京频道别名映射（对标吉林channelMap结构）
    var channelMap = {
        bjws: ['北京卫视', '北京卫视频道'],
        bjxc: ['北京新闻', '新闻频道'],
        bjds: ['北京都市', '都市频道'],
        bjsh: ['北京生活', '生活频道'],
        bjjy: ['北京科教', '科教频道'],
        bjse: ['北京文艺', '文艺频道'],
        bjgt: ['北京体育', '体育频道']
    };
    var aliases = channelMap[id] || [id];

    // 3. 北京台官方加密直播列表接口
    var apiUrl = 'https://tvapi.btv.cn/broadcast/liveList';
    var headers = {
        'Origin': 'https://tv.btv.cn',
        'Referer': 'https://tv.btv.cn/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    };

    // 4. KU9同步请求（和吉林完全一致）
    var responseText = ku9.get(apiUrl, headers);
    if (!responseText) {
        throw new Error('北京电视台接口没有返回数据');
    }

    // 5. 兼容双层加密包裹（对标吉林容错逻辑）
    var encrypted = responseText;
    try {
        var envelope = JSON.parse(responseText);
        if (typeof envelope === 'string') {
            encrypted = envelope;
        } else if (envelope && typeof envelope.data === 'string') {
            encrypted = envelope.data;
        }
    } catch (ignored) {}

    // 6. 北京台专属XXTEA密钥（官方固定密钥）
    var plainText = xxteaDecryptBase64(String(encrypted), '8d2f4c71e9b30a65');
    if (!plainText) {
        throw new Error('北京电视台接口数据解密失败');
    }

    // 7. 解析明文JSON、状态校验
    var response;
    try {
        response = JSON.parse(plainText);
    } catch (error) {
        throw new Error('北京电视台接口数据格式错误');
    }
    if (response && response.code !== undefined && Number(response.code) !== 0) {
        throw new Error(response.message || response.msg || '北京电视台接口请求失败');
    }

    // 8. 适配接口列表嵌套结构（和吉林一致）
    var list = response && response.data;
    if (list && list.list instanceof Array) {
        list = list.list;
    }
    if (!(list instanceof Array)) {
        throw new Error('北京电视台接口没有返回频道列表');
    }

    // 9. 遍历匹配频道、提取播放地址
    for (var index = 0; index < list.length; index++) {
        var channel = list[index] || {};
        if (!matchesAlias(channel.title || channel.name || '', aliases)) {
            continue;
        }
        var detail = channel.data || {};
        var playUrl = detail.streamUrl || channel.streamUrl || detail.playUrl
                || channel.playUrl || detail.url || channel.url || '';
        playUrl = String(playUrl).replace(/^\s+|\s+$/g, '');
        if (/^https?:\/\//i.test(playUrl)) {
            return {url: playUrl};
        }
    }

    throw new Error('没有找到频道：' + aliases[0]);
}

// ==================== 工具函数【100%复刻吉林脚本】====================
// 名称别名匹配
function matchesAlias(name, aliases) {
    var normalized = normalizeChannelName(name);
    for (var index = 0; index < aliases.length; index++) {
        if (normalized === normalizeChannelName(aliases[index])) {
            return true;
        }
    }
    return false;
}

// 频道名标准化清洗
function normalizeChannelName(value) {
    return String(value || '').replace(/\s+/g, '').replace(/[·•]/g, '');
}

// Base64+XXTEA 解密总入口
function xxteaDecryptBase64(value, key) {
    var binary;
    try {
        binary = atob(String(value || '').replace(/\s+/g, ''));
    } catch (error) {
        return '';
    }
    var encryptedBytes = [];
    for (var index = 0; index < binary.length; index++) {
        encryptedBytes[index] = binary.charCodeAt(index) & 255;
    }
    var values = bytesToUint32(encryptedBytes);
    var keyBytes = utf8Encode(key);
    var keyValues = bytesToUint32(keyBytes);
    while (keyValues.length < 4) {
        keyValues.push(0);
    }
    values = xxteaDecrypt(values, keyValues);
    var clearBytes = uint32ToBytes(values, true);
    return clearBytes ? utf8Decode(clearBytes) : '';
}

// XXTEA 核心解密算法（原版标准）
function xxteaDecrypt(values, key) {
    var last = values.length - 1;
    if (last < 1) {
        return values;
    }
    var delta = 0x9E3779B9;
    var rounds = Math.floor(6 + 52 / (last + 1));
    var sum = (rounds * delta) >>> 0;
    var y = values[0];
    var z;
    while (sum !== 0) {
        var e = (sum >>> 2) & 3;
        for (var position = last; position > 0; position--) {
            z = values[position - 1];
            y = values[position] = (values[position]
                    - xxteaMix(sum, y, z, position, e, key)) >>> 0;
        }
        z = values[last];
        y = values[0] = (values[0]
                - xxteaMix(sum, y, z, 0, e, key)) >>> 0;
        sum = (sum - delta) >>> 0;
    }
    return values;
}

// XXTEA 混合函数
function xxteaMix(sum, y, z, position, e, key) {
    return (((z >>> 5 ^ y << 2) + (y >>> 3 ^ z << 4))
            ^ ((sum ^ y) + (key[(position & 3) ^ e] ^ z))) >>> 0;
}

// 字节转Uint32数组
function bytesToUint32(bytes) {
    var values = new Array(Math.ceil(bytes.length / 4));
    for (var position = 0; position < values.length; position++) {
        values[position] = 0;
    }
    for (var index = 0; index < bytes.length; index++) {
        values[index >>> 2] = (values[index >>> 2]
                | bytes[index] << ((index & 3) << 3)) >>> 0;
    }
    return values;
}

// Uint32数组转字节
function uint32ToBytes(values, includeLength) {
    var byteLength = values.length << 2;
    if (includeLength) {
        var dataLength = values[values.length - 1] >>> 0;
        if (dataLength < byteLength - 7 || dataLength > byteLength - 4) {
            return null;
        }
        byteLength = dataLength;
    }
    var bytes = new Array(byteLength);
    for (var index = 0; index < byteLength; index++) {
        bytes[index] = values[index >>> 2] >>> ((index & 3) << 3) & 255;
    }
    return bytes;
}

// UTF8编码
function utf8Encode(value) {
    var text = unescape(encodeURIComponent(String(value || '')));
    var bytes = new Array(text.length);
    for (var index = 0; index < text.length; index++) {
        bytes[index] = text.charCodeAt(index) & 255;
    }
    return bytes;
}

// UTF8解码
function utf8Decode(bytes) {
    var text = '';
    for (var index = 0; index < bytes.length; index++) {
        text += String.fromCharCode(bytes[index]);
    }
    try {
        return decodeURIComponent(escape(text));
    } catch (error) {
        return text;
    }
}
