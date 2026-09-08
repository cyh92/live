// 酷9 JS 脚本 - 郑州电视台频道代理
// 使用方式：在频道地址中填入 http://your-domain/xxx.js?id=zzxwzh 等
function main(item) {
    // 1. 获取 id 参数，默认为 'zzdssh'
    var url = item.url;
    var id = ku9.getQuery(url, "id") || "zzdssh";

    // 2. 频道映射（与 PHP 一致）
    var channelMap = {
        'zzxwzh': 103,   // 郑州新闻综合
        'zzsd': 104,     // 郑州商都频道
        'zzwtly': 105,   // 郑州文体旅游
        'zzyj': 106,     // 郑州豫剧频道
        'zzfnet': 107,   // 郑州妇女儿童
        'zzdssh': 108    // 郑州都市生活
    };

    var channelId = channelMap[id];
    if (!channelId) {
        // 无效 id 时使用默认
        channelId = 108;
    }

    // 3. 请求频道 API，获取主 m3u8 地址
    var apiUrl = "http://mapi-new.zztv.tv/api/v1/channel.php?channel_id=" + channelId;
    var headers = {
        'Referer': 'https://live3-new.zztv.tv/'
    };

    try {
        var resp = ku9.get(apiUrl, headers);
        var data = JSON.parse(resp);
        if (!data || data.length === 0) {
            return JSON.stringify({ url: "" });
        }

        var m3u8Url = data[0]['m3u8'];
        if (!m3u8Url) {
            return JSON.stringify({ url: "" });
        }

        // 4. 获取主 m3u8 的目录前缀
        var baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

        // 5. 请求主 m3u8 内容
        var m3u8Content = ku9.get(m3u8Url, headers);

        // 6. 查找包含 "sd" 的码率文件（模仿 PHP 的 strstr 逻辑，但更精确地提取文件名）
        //    匹配类似 "xxx_sd.m3u8" 或 "http://...sd.m3u8" 的字符串
        var match = m3u8Content.match(/[^,\s]*sd[^,\s]*\.m3u8[^\s]*/);
        var finalUrl = m3u8Url; // 备用

        if (match) {
            var segment = match[0];
            // 如果是相对路径，拼接 baseUrl
            if (!/^https?:\/\//i.test(segment)) {
                finalUrl = baseUrl + segment;
            } else {
                finalUrl = segment;
            }
        } else {
            // 若未找到，则回退到主 m3u8（或按原 strstr 逻辑尝试）
            // 这里简单回退
            finalUrl = m3u8Url;
        }

        // 7. 返回最终播放地址，附带必要的 headers（Referer）
        return JSON.stringify({
            url: finalUrl,
            headers: {
                'Referer': 'https://live3-new.zztv.tv/'
            }
        });

    } catch (e) {
        // 出错时返回空地址
        return JSON.stringify({ url: "" });
    }
}