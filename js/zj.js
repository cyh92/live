// 混淆数组 - 存储所有字符串常量
const STRINGS = [
    'apply',
    '^([^\x20]+(\x20+[^\x20]+)+)+[^\x20]}',
    'test',
    'split',
    'forEach',
    'floor',
    'join',
    'zwebl02.cztv.com',
    'MD5',
    '?auth_key=',
    'stringify'
];

// 字符串索引访问函数
function getString(index) {
    return STRINGS[index];
}

// 反调试/反混淆保护函数（原代码中的自执行函数）
function antiDebug() {
    // 这是一个反调试保护，检测函数上下文
    const check = function() {
        const fn = check.constructor('return /" + this + "/')();
        fn.compile(getString(1));
        return !fn.test(antiDebug);
    };
    return check();
}
antiDebug();

/**
 * 解析URL查询字符串
 * @param {string} query - URL查询字符串
 * @returns {Object} 解析后的键值对
 */
function parseQueryString(query) {
    const params = {};
    if (!query) return params;
    
    query.split('&').forEach(pair => {
        const [key, value] = pair.split('=');
        if (key) {
            params[key] = value;
        }
    });
    return params;
}

/**
 * 生成32位十六进制UUID（部分固定位）
 * @returns {string} 32位十六进制字符串
 */
function generateUUIDHex32() {
    const chars = [];
    for (let i = 0; i < 32; i++) {
        chars.push(Math.floor(Math.random() * 16).toString(16));
    }
    // 固定第12位为'4'（UUID v4标识）
    chars[12] = '4';
    // 固定第16位为'a'
    chars[16] = 'a';
    return chars.join('');
}

/**
 * 主函数 - 生成带签名的直播流URL
 * @param {string} queryString - URL查询字符串（包含id参数）
 * @returns {string} JSON格式的URL结果
 */
function generateLiveUrl(queryString) {
    // 1. 解析参数获取频道ID
    const { id } = parseQueryString(queryString);
    
    // 2. 配置常量
    const DOMAIN = 'zwebl02.cztv.com';
    const CHANNEL_PATH = '/live/channel' + id + '1080Pnew.m3u8';
    
    // 3. 生成时间戳（秒）
    const timestamp = Math.floor(Date.now() / 1000);
    
    // 4. 固定参数
    const zeroParam = 0;
    const uuid = generateUUIDHex32();
    const SECRET_KEY = 'CHWr9VybUeBZE1VB';
    
    // 5. 构造签名原文: 路径-时间戳-UUID-0-密钥
    const signRaw = CHANNEL_PATH + '-' + timestamp + '-' + uuid + '-' + zeroParam + '-' + SECRET_KEY;
    
    // 6. 计算MD5签名
    const md5Sign = CryptoJS.MD5(signRaw).toString();
    
    // 7. 构造完整URL
    const fullUrl = 'https://' + DOMAIN + CHANNEL_PATH + '?auth_key=' + timestamp + '-' + uuid + '-' + zeroParam + '-' + md5Sign;
    
    // 8. 返回JSON格式结果
    return JSON.stringify({ url: fullUrl });
}