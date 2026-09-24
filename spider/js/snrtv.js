// 酷9 JS脚本：陕西广电（SNRTV）直播流
// 频道地址格式示例：http://127.0.0.1:9978/ku9/js/snrtv.js?id=star

// ========== 配置常量 ==========
const STREAM_JS = 'http://toutiao.cnwest.com/static/v1/stream.js';
const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const REFERER = 'http://m.snrtv.com/';

// 频道 ID → hash 映射（从原 programGuides.js 提取）
const VIDEO_HASH_MAP = {
    'star': 8,   // 陕西卫视
    '1':    1,
    '2':    2,
    '3':    3,
    '5':    5,
    '7':    7,
    'nl':   9,   // 农林卫视
    '11':   11
};

/**
 * 从 stream.js 中提取 sTV/sRadio 并解密出 JSON
 * 官网算法：key = sTV 前16字符, iv = sRadio 前16字符, 密文 = sTV 第16字符起
 * @param {string} js - stream.js 文件内容
 * @returns {Object} 解密后的频道列表 JSON
 */
function decryptStreamJs(js) {
    const tvMatch = js.match(/var\s+sTV\s*=\s*"([^"]+)"/);
    const radioMatch = js.match(/var\s+sRadio\s*=\s*"([^"]+)"/);
    if (!tvMatch || !radioMatch) {
        throw new Error('未找到 sTV/sRadio');
    }

    const sTV = tvMatch[1];
    const sRadio = radioMatch[1];

    // key = sTV 前16字符, iv = sRadio 前16字符, 密文 = sTV 第16字符起
    const key = sTV.substring(0, 16);
    const iv = sRadio.substring(0, 16);
    const cipherBase64 = sTV.substring(16);

    // 使用酷9内置 AES 解密（ZeroPadding）
    // 参数：密文(Base64), 算法, 密钥, 输入类型(0=Base64), IV
    let decrypted = ku9.opensslDecrypt(cipherBase64, 'AES-128-CBC', key, 0, iv);

    // 去除尾部空字节（ZeroPadding 手动处理）
    decrypted = decrypted.replace(/\0+$/, '');

    // 截取 JSON 部分
    const start = decrypted.indexOf('{');
    const end = decrypted.lastIndexOf('}');
    if (start === -1 || end === -1) {
        throw new Error('解密结果非 JSON');
    }

    return JSON.parse(decrypted.substring(start, end + 1));
}

/**
 * 酷9主函数
 * @param {Object} item - 包含频道信息，如 item.id、item.url
 * @returns {Object} 返回播放地址对象 { url, headers }
 */
function main(item) {
    // 1. 获取频道 ID（优先 item.id，其次 URL 参数 id）
    let chId = item.id;
    if (!chId) {
        chId = ku9.getQuery(item.url, 'id');
    }
    if (!chId) {
        chId = 'star';
    }
    try {
        chId = decodeURIComponent(chId);
    } catch (e) {}

    // 2. 映射到目标 hash 值
    const targetNum = VIDEO_HASH_MAP[chId] || 8;

    // 3. 获取 stream.js 内容
    let jsContent;
    try {
        jsContent = ku9.get(STREAM_JS, {
            'User-Agent': UA,
            'Referer': REFERER
        });
    } catch (e) {
        return { url: 'http://error.fetch_stream_js_failed' };
    }

    // 4. 解密并解析频道列表
    let tvList;
    try {
        tvList = decryptStreamJs(jsContent);
    } catch (e) {
        return { url: 'http://error.decrypt_failed' };
    }

    // 5. 根据 targetNum 查找对应的流地址
    let found = null;
    if (Array.isArray(tvList)) {
        found = tvList.find(function(it) {
            return String(it.num || it.id || it.channel) === String(targetNum);
        });
    } else if (typeof tvList === 'object') {
        found = tvList[String(targetNum)] || tvList[chId];
    }

    if (!found) {
        return { url: 'http://error.channel_not_found' };
    }

    const m3u8 = found.m3u8 || found.url || found.src;
    if (!m3u8) {
        return { url: 'http://error.no_stream_url' };
    }

    // 6. 返回播放地址（带请求头）
    return {
        url: m3u8,
        headers: { 'User-Agent': 'okhttp/3.12.11' }
    };
}