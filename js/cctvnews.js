// 酷9 JS 脚本 - 频道代理（从混淆代码还原）
function main(item) {
    // 频道ID映射（从混淆代码中提取）
    var CHANNEL_ARTICLE_IDS = {
        'zzxwzh': 103,
        'zzsd': 104,
        'zzwtly': 105,
        'zzyj': 106,
        'zzfnet': 107,
        'zzdssh': 108
    };

    var result = {
        'url': '',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://live3-new.zztv.tv/'
        }
    };

    try {
        // 获取频道ID
        var uri = item.url;
        var id = ku9.getQuery(uri, "id") || "zzdssh";
        var channelId = CHANNEL_ARTICLE_IDS[id];
        
        if (!channelId) {
            return JSON.stringify({ url: "", error: "无效的频道ID: " + id });
        }

        // 构建请求URL
        var apiUrl = "http://mapi-new.zztv.tv/api/v1/channel.php?channel_id=" + channelId;
        
        // 获取频道数据
        var resp = ku9.get(apiUrl, {
            'Referer': 'https://live3-new.zztv.tv/'
        });
        
        var data = JSON.parse(resp);
        if (!data || data.length === 0) {
            return JSON.stringify({ url: "", error: "获取频道数据失败" });
        }

        // 获取m3u8地址
        var m3u8Url = data[0]['m3u8'];
        if (!m3u8Url) {
            return JSON.stringify({ url: "", error: "未找到m3u8地址" });
        }

        // 获取基础路径
        var baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf('/') + 1);

        // 请求主m3u8
        var m3u8Content = ku9.get(m3u8Url, {
            'Referer': 'https://live3-new.zztv.tv/'
        });

        // 查找包含 "sd" 的码率
        var match = m3u8Content.match(/[^,\s]*sd[^,\s]*\.m3u8[^\s]*/);
        var finalUrl = m3u8Url;

        if (match) {
            var segment = match[0];
            if (!/^https?:\/\//i.test(segment)) {
                finalUrl = baseUrl + segment;
            } else {
                finalUrl = segment;
            }
        }

        result.url = finalUrl;
        result.headers = {
            'Referer': 'https://live3-new.zztv.tv/'
        };

    } catch (e) {
        return JSON.stringify({ url: "", error: e.message || "未知错误" });
    }

    return JSON.stringify(result);
}

// 辅助函数（如果原代码中没有，则添加）
function jsonResult(data) {
    return JSON.stringify(data);
}