// 酷9 JS 脚本 - 贵州电视台直播代理
function main(item) {
    var result = {
        'url': '',
        'headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.gzstv.com/'
        }
    };

    try {
        // 从URL参数中获取id
        var uri = item.url;
        var id = ku9.getQuery(uri, "id");
        
        if (!id) {
            return JSON.stringify({ url: "", error: "缺少id参数" });
        }

        // 构建API请求地址
        var apiUrl = "https://api.gzstv.com/v1/tv/" + id;
        
        // 请求API获取直播地址
        var resp = ku9.get(apiUrl, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.gzstv.com/'
        });
        
        var data = JSON.parse(resp);
        var streamUrl = data['stream_url'];
        
        if (!streamUrl) {
            return JSON.stringify({ url: "", error: "未获取到直播地址" });
        }

        result.url = streamUrl;
        result.headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Referer': 'https://www.gzstv.com/'
        };

    } catch (e) {
        return JSON.stringify({ url: "", error: e.message || "请求失败" });
    }

    return JSON.stringify(result);
}