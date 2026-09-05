// 酷9 JS脚本：生成CzTV直播鉴权URL
// 频道地址格式：http://your-server/ku9/js/cztv.js?id=channel_id

const DOMAIN = 'zwebl02.cztv.com';
const SECRET_KEY = 'CHWr9VybUeBZE1VB';
const CHANNEL_SUFFIX = '1080Pnew.m3u8'; // 清晰度，可按需修改

function generateUUIDHex32() {
    const chars = [];
    for (let i = 0; i < 32; i++) {
        chars.push(Math.floor(Math.random() * 16).toString(16));
    }
    chars[12] = '4';
    chars[16] = 'a';
    return chars.join('');
}

function main(item) {
    // 获取频道ID，优先从item.id获取，若没有则从URL参数解析
    let channelId = item.id;
    if (!channelId) {
        // 从item.url中解析id参数
        channelId = ku9.getQuery(item.url, 'id');
    }
    if (!channelId) {
        // 无ID返回错误
        return { url: 'https://error.com/missing_id' };
    }

    const channelPath = `/live/channel${channelId}${CHANNEL_SUFFIX}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const uuid = generateUUIDHex32();
    const zeroParam = 0;

    const signRaw = `${channelPath}-${timestamp}-${uuid}-${zeroParam}-${SECRET_KEY}`;
    // 使用酷9内置md5函数
    const md5Sign = ku9.md5(signRaw);

    const finalUrl = `https://${DOMAIN}${channelPath}?auth_key=${timestamp}-${uuid}-${zeroParam}-${md5Sign}`;

    return { url: finalUrl };
}