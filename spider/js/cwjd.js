/*
 * cwjd.js - 重温经典 5G电视直播源解析（酷9版）
 * 基于原PHP逻辑转换，仅作播放器功能测试，不得用于商业或非法用途，下载后24小时内删除。
 */
function main(item) {
    const cacheKey = "cwjdHD";
    const CACHE_TTL = 600000;    // 缓存10分钟（毫秒）
    const EXPIRE_GAP = 300;      // 距过期不足5分钟则提前刷新

    // ========== 工具：从播放 URL 提取 term 剩余秒数 ==========
    function getUrlRemainingSeconds(url) {
        const match = url.match(/[?&]term=(\d+)/);
        if (!match) return -1;
        const expireMs = parseInt(match[1], 10);
        return Math.floor(expireMs / 1000) - Math.floor(Date.now() / 1000);
    }

    // ========== 工具：判断缓存 URL 是否仍然有效 ==========
    function isCacheUrlValid(url) {
        if (!url || url.indexOf('http') !== 0) return false;
        const remaining = getUrlRemainingSeconds(url);
        if (remaining < 0) return true;   // 无法提取 term，退化为信任缓存
        return remaining > EXPIRE_GAP;
    }

    // ========== 1. 检查有效缓存 ==========
    const cachedUrl = ku9.getCache(cacheKey);
    if (cachedUrl && isCacheUrlValid(cachedUrl)) {
        return { url: cachedUrl };
    }

    // ========== 2. 通用请求头 ==========
    function getCommonHeaders() {
        const deviceId = ku9.md5(Date.now().toString() + Math.random().toString());
        return {
            'charset': 'UTF-8',
            'channelId': 'cbn',
            'deviceType': '2048',
            'releaseVersion': '3.0.1',
            'releaseVersionCode': '301',
            'uId': '',
            'os': 'Android',
            'deviceId': deviceId,
            'API-VERSION': '3',
            'orgCode': '',
            'token': '',
            'isGd': '',
            'User-Agent': 'okhttp/4.9.1',
            'Accept': '*/*',
            'Connection': 'keep-alive'
        };
    }

    // ========== 3. 签名生成（真正随机 randStr，长度 4-7） ==========
    function generateSign(input, flag) {
        const ts = Math.floor(Date.now() / 1000);
        const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
        const charsetLen = charset.length;
        const randLen = Math.floor(Math.random() * 4) + 4;   // 4~7
        let randStr = '';
        for (let i = 0; i < randLen; i++) {
            randStr += charset.charAt(Math.floor(Math.random() * charsetLen));
        }
        const suffix = flag ? '01234ibcp9' : '0123456789';
        const s1 = `${input}-${ts}-${randStr}-${suffix}`;
        const hexMd5 = ku9.md5(s1);
        return `${ts}-${randStr}-${hexMd5}`;
    }

    // ========== 4. 写入缓存 ==========
    function writeCache(url) {
        ku9.setCache(cacheKey, url, CACHE_TTL);
    }

    // ========== 5. 异常回退 ==========
    function fallbackCache() {
        const url = ku9.getCache(cacheKey);
        if (url && isCacheUrlValid(url)) {
            return { url: url };
        }
        return null;
    }

    // ========== 6. 主流程 ==========
    try {
        // --- 第一步：获取授权 URL ---
        const firstSign = generateSign('/v1/resourceProductRightsAuth', true);
        const headers1 = Object.assign({}, getCommonHeaders(), {
            'sign': firstSign,
            'Host': 'saleservice.5gtv.com.cn',
            'Content-Type': 'application/json'
        });

        const postData = JSON.stringify({
            resId: '30167',
            resourceStreamId: '30167'
        });

        const res1 = ku9.request(
            'https://saleservice.5gtv.com.cn/v1/resourceProductRightsAuth',
            'POST',
            headers1,
            postData
        );

        if (!res1 || !res1.body) {
            throw new Error('授权请求失败（网络错误）');
        }

        let json1;
        try {
            json1 = JSON.parse(res1.body);
        } catch (e) {
            throw new Error('授权响应 JSON 解析失败');
        }

        if (!json1.data || !json1.data.url) {
            throw new Error('授权响应异常: ' + (json1.msg || res1.body));
        }

        const firstUrl = json1.data.url + '&t=1&v=301';

        // 解析 URI 路径和 Host
        let uri, dispHost = 'live-dispatcher.5gtv.com.cn';
        try {
            const urlObj = new URL(firstUrl);
            uri = urlObj.pathname + urlObj.search;
            if (urlObj.host) dispHost = urlObj.host;
        } catch (e) {
            // 兼容无 URL 构造器的情况
            const afterProto = firstUrl.split('//')[1] || '';
            const slashIdx = afterProto.indexOf('/');
            if (slashIdx > -1) {
                dispHost = afterProto.substring(0, slashIdx);
                uri = afterProto.substring(slashIdx);
            } else {
                throw new Error('授权 URL 解析失败');
            }
        }

        // --- 第二步：请求调度地址获取最终 M3U8 ---
        const secondSign = generateSign(uri, true);
        const headers2 = Object.assign({}, getCommonHeaders(), {
            'sign': secondSign,
            'Host': dispHost
        });

        const res2 = ku9.request(firstUrl, 'GET', headers2);

        if (!res2 || !res2.body) {
            throw new Error('调度请求失败（网络错误）');
        }

        let json2;
        try {
            json2 = JSON.parse(res2.body);
        } catch (e) {
            throw new Error('调度响应 JSON 解析失败');
        }

        const playUrl = json2.data && json2.data.url ? json2.data.url : '';

        if (!playUrl || playUrl.indexOf('http') !== 0) {
            throw new Error('播放地址无效: ' + res2.body);
        }

        // --- 写入缓存并返回 ---
        writeCache(playUrl);
        return { url: playUrl };

    } catch (error) {
        // --- 异常回退：尝试使用缓存中未过期的地址 ---
        const fb = fallbackCache();
        if (fb) return fb;
        return { error: error.message };
    }
}