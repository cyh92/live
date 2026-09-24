// 酷9 JS脚本：江苏电视台直播流（JSTV）
// 频道地址格式示例：http://127.0.0.1:9978/ku9/js/jstv.js?id=jsws

// ========== 配置常量 ==========
const SECRET_KEY = 'tJanAHkyGtaifaQG4dWe';
const REFERER = 'https://live.jstv.com/';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// 频道 ID 映射表（简写 → 实际频道标识）
const CHANNEL_MAP = {
    'jsws':   'jswspro',    // 江苏卫视
    'jscs':   'jscspro',    // 江苏城市
    'jszy':   'jszypro',    // 江苏综艺
    'jsys':   'jsyspro',    // 江苏影视
    'jsxw':   'jsxwpro',    // 江苏新闻
    'jsjy':   'jsjypro',    // 江苏教育
    'jsty':   'jsxxpro',    // 江苏体育（休闲）
    'jsgj':   'jsgjpro',    // 江苏国际
    'ymkt':   'ymktpro',    // 优漫卡通
    'jsws4k': 'jsws4kpro'   // 江苏卫视4K
};

/**
 * 构建带签名的 m3u8 播放地址
 * @param {string} chId - 频道简写 ID
 * @returns {Object} { channelKey, url }
 */
function buildUrl(chId) {
    const channelKey = CHANNEL_MAP[chId] || CHANNEL_MAP['jsws'];

    // 签名时间：当前时间 + 180 秒（有效期 3 分钟）
    const txTime = Math.floor(Date.now() / 1000) + 180;
    const txTimeHex = txTime.toString(16);

    // 使用酷9内置 MD5 计算签名
    const txSecret = ku9.md5(SECRET_KEY + channelKey + txTimeHex);

    return {
        channelKey: channelKey,
        url: 'https://litchi-play-encrypted-site.jstv.com/applive/' +
             channelKey + '.m3u8?txSecret=' + txSecret + '&txTime=' + txTimeHex
    };
}

/**
 * 酷9主函数
 * @param {Object} item - 包含频道信息，如 item.id、item.url
 * @returns {Object} 返回播放地址对象 { url: '...', headers: {...} }
 */
function main(item) {
    // 1. 获取频道 ID
    //    优先顺序：item.id → URL 参数 id → URL 参数 url → 默认 jsws
    let chId = item.id;
    if (!chId) {
        chId = ku9.getQuery(item.url, 'id');
    }
    if (!chId) {
        chId = ku9.getQuery(item.url, 'url');
    }
    if (!chId) {
        chId = 'jsws';
    }
    // URL 解码（防止传入时被编码）
    try {
        chId = decodeURIComponent(chId);
    } catch (e) {}

    // 2. 生成带签名的播放地址
    const result = buildUrl(chId);
    const m3u8Url = result.url;

    // 3. 设置请求头（JSTV 必须带 Referer 才能播放）
    const headers = {
        'Referer': REFERER,
        'User-Agent': UA
    };

    // 4. 返回给酷9播放器
    //    player: 0 表示系统解码（如播放异常可改为 1=ijk 或 3=exo）
    return {
        url: m3u8Url,
        headers: headers,
        player: 0
    };
}