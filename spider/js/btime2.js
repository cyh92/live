function main(item) {
    // 原始链接（t 参数会被动态替换）
    var baseUrl = "https://www.9kds.com/cn/cn_play.php?p=bj&c=1&s=0";

    // 其他固定参数（如果将来需要动态变化，可在此处修改）
    var sign = "4c2a3f568246bdf4a3a438de6a46c3f7";

    // 获取当前时间戳（秒级）
    var t = Math.round(new Date().getTime() / 1000).toString();

    // 拼接新的完整链接
    var newUrl = baseUrl + "&t=" + t + "&sign=" + sign;

    // 返回酷9要求的标准 JSON 格式
    return JSON.stringify({
        url: newUrl,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36",
            "Referer": "https://www.9kds.com/"
        }
    });
}