function main(item) {
    var usid = "6b79f49eae0d11e79869421735925e22";  // 固定 usid
    var uri = item.url;
    var pid = ku9.getQuery(uri, "id");
    var r = {
        'url': '',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.btime.com/',
            'Origin': 'https://www.btime.com',
        },
        'player': 3
    };

    var cacheKey = 'btime_' + pid;
    var cachePlayUrl = ku9.getCache(cacheKey);
    if (cachePlayUrl !== null) {
        r.url = cachePlayUrl;
        return JSON.stringify(r);
    }

    try {
        var t = Math.round(new Date().getTime() / 1000).toString();
        var t2 = Math.round(new Date().getTime()).toString();
        // 使用字符串拼接替代模板字符串
        var sign = ku9.md5(pid + "151" + t + "TtJSg@2g*$K4PjUH").slice(0, 8);
        var url = "https://pc.api.btime.com/video/play?from=pc&id=" + pid + "&type_id=151&timestamp=" + t + "&sign=" + sign + "&_=" + t2;

        var headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
            'Referer': 'https://www.btime.com/',
            'Origin': 'https://www.btime.com',
            "Cookie": "usid=" + usid + "; lf=1"
        };

        var res = ku9.get(url, headers);
        var jsonData = JSON.parse(res);
        if (!jsonData || !jsonData.data || !jsonData.data.video_stream || !jsonData.data.video_stream[0]) {
            throw new Error("Invalid response structure");
        }
        var stream_url = jsonData.data.video_stream[0].stream_url;
        if (!stream_url.startsWith('http')) {
            // 反转字符串并两次 base64 解码
            stream_url = ku9.decodeBase64(ku9.decodeBase64(stream_url.split('').reverse().join('')));
        }
        // 缓存30分钟（毫秒）
        ku9.setCache(cacheKey, stream_url, 1800000);
        r.url = stream_url;
    } catch (e) {
        // 出错时返回空地址，避免影响整体
        r.url = "";
    }
    return JSON.stringify(r);
}