function main(item) {

    const url = item.url;
    var id = ku9.getQuery(url, "id") || "cpd";
    var t = ku9.getQuery(url, "t") || "hls";

    var channelMap = {
        "cpd": 578,   // 茶频道
        "hnds": 346,  // 都市
        "hndsj": 484, // 电视剧
        "hngg": 261,  // 公共
        "hngj": 229,  // 国际
        "hnjs": 280,  // 经视
        "hnyl": 344,  // 娱乐
        "hndy": 221,  // 电影
        "jyjs": 316,  // 金鹰纪实
        "jykt": 287,  // 金鹰卡通
        "klcd": 218,  // 快乐垂钓
        "klg": 267,   // 快乐购
        "xfpy": 329,  // 先锋乒羽
        "csxw": 269,  // 长沙新闻
        "csnx": 230,  // 长沙女性
        "cszf": 254   // 长沙政法
    };

    var channelId = channelMap[id] || 578;
    var apiUrl = "";

    if (t === "flv") {
        apiUrl = "http://pwlp.bz.mgtv.com/v1/epg/turnplay/getLivePlayUrlMPP?version=PCweb_1.0&platform=4&buss_id=2000001&channel_id=" + channelId;
    } else {
        apiUrl = "http://pwlp.bz.mgtv.com/v1/epg/turnplay/getLivePlayUrlMPP?version=PCweb_1.0&platform=4&buss_id=2000001&channel_id=" + channelId;
    }

    // 发送网络请求获取播放地址
    let res = ku9.request(apiUrl, "GET", null, "", false);
    
    if (res.code === 200 && res.body) {
        try {
            let data = JSON.parse(res.body);
            if (data && data.data && data.data.url) {
                let playUrl = data.data.url;
                // 返回播放地址
                return { url: playUrl };
            } else {
                // 如果解析失败，返回错误信息
                return { error: "无法获取播放地址" };
            }
        } catch (e) {
            return { error: "JSON解析失败: " + e.message };
        }
    } else {
        return { error: "请求失败，状态码: " + res.code };
    }
}