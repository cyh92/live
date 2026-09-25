// 酷9 JS脚本：陕西广电（SNRTV）直播流
// 频道地址格式：http://127.0.0.1:9978/ku9/js/snrtv.js?id=star

const STREAM_JS = 'http://toutiao.cnwest.com/static/v1/stream.js';
const UA = 'Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
const REFERER = 'http://m.snrtv.com/';

// 频道 ID → 官网 hash 映射
const VIDEO_HASH_MAP = {
    'star': 8,   // 陕西卫视
    '1':    1,   // 陕西新闻资讯
    '2':    2,   // 陕西都市青春
    '3':    3,   // 陕西影视
    '5':    5,   // 陕西体育休闲
    '7':    7,   // 陕西公共
    'nl':   9,   // 农林卫视
    '11':   11   // 陕西乐家
};

function main(item) {
    // 1. 获取频道 ID
    let chId = item.id || ku9.getQuery(item.url, 'id') || 'star';
    try { chId = decodeURIComponent(chId); } catch (e) {}

    const targetNum = VIDEO_HASH_MAP[chId] || 8;

    // 2. 获取 stream.js
    let jsContent;
    try {
        jsContent = ku9.get(STREAM_JS, {
            'User-Agent': UA,
            'Referer': REFERER
        });
    } catch (e) {
        return { url: 'http://error.fetch_failed' };
    }
    if (!jsContent || jsContent.length < 100) {
        return { url: 'http://error.empty_content' };
    }

    // 3. 提取 sTV / sRadio（兼容 var/let/const 及单双引号）
    const tvMatch = jsContent.match(/sTV\s*=\s*["']([^"']+)["']/);
    const radioMatch = jsContent.match(/sRadio\s*=\s*["']([^"']+)["']/);
    if (!tvMatch || !radioMatch) {
        return { url: 'http://error.no_stv_sradio' };
    }

    const sTV = tvMatch[1];
    const sRadio = radioMatch[1];

    const key = sTV.substring(0, 16);
    const iv = sRadio.substring(0, 16);
    const cipherBase64 = sTV.substring(16);

    // 4. AES-128-CBC 解密（输入 Base64）
    let decrypted;
    try {
        decrypted = ku9.opensslDecrypt(cipherBase64, 'AES-128-CBC', key, 0, iv);
    } catch (e) {
        return { url: 'http://error.aes_decrypt_failed' };
    }

    // 去除尾部零填充
    decrypted = decrypted.replace(/\0+$/, '');

    // 5. 截取 JSON 部分
    const start = decrypted.indexOf('{');
    const end = decrypted.lastIndexOf('}');
    if (start === -1 || end === -1) {
        return { url: 'http://error.not_json' };
    }
    const jsonStr = decrypted.substring(start, end + 1);

    // 6. 解析 JSON
    let tvList;
    try {
        tvList = JSON.parse(jsonStr);
    } catch (e) {
        return { url: 'http://error.json_parse_failed' };
    }

    // 7. 查找频道
    let found = null;
    if (Array.isArray(tvList)) {
        for (let i = 0; i < tvList.length; i++) {
            const it = tvList[i];
            if (String(it.num || it.id || it.channel) === String(targetNum)) {
                found = it;
                break;
            }
        }
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

    // 8. 返回播放地址
    return {
        url: m3u8,
        headers: { 'User-Agent': 'okhttp/3.12.11' }
    };
}