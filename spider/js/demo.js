function main(item) {
    // 目标播放地址
    var playUrl = "https://hls.liveshow.bdstatic.com/live/stream_bduid_138424090_11576777139-L1.m3u8";

    // 请求头（部分 CDN 会校验 Referer 或 User-Agent，防止盗链）
    var headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
        "Referer": "https://live.baidu.com/"
    };

    // 返回酷9标准格式
    return {
        url: playUrl,
        headers: headers
    };
}