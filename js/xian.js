// 识别名称main
function main(item) {
    // 获取地址
    const url = item.url;
    
    // 获取参数id，如果不存在则默认使用'xazh'
    var id = ku9.getQuery(url, "id") || "xazh";
    
    // 定义频道映射
    var n = {
        "xazh": 1, // 西安新闻综合
        "xads": 2, // 西安都市
        "xasw": 3, // 西安商务资讯
        "xays": 4, // 西安影视
        "xasl": 5, // 西安丝路
        "xagw": 6, // 西安乐购购物
        "xayd": 7  // 西安移动电视
    };
    
    // 获取频道编号，如果id不在映射中则使用默认值
    var channelNum = n[id] || 1;
    
    // 构建m3u8地址
    var m3u8Url = "https://stream.xiancity.cn/live/" + channelNum + "/index.m3u8";
    var baseUrl = "https://stream.xiancity.cn/live/" + channelNum + "/";
    
    // 设置请求头
    var headers = {
        "Referer": "https://v.xiancity.cn/"
    };
    
    // 获取m3u8内容
    var response = ku9.request(m3u8Url, "GET", headers, null, false);
    
    if (response.code === 200) {
        var m3u8Content = response.body;
        
        // 替换TS切片地址为完整地址
        var regex = /(.*?.ts)/gi;
        var replacedContent = m3u8Content.replace(regex, baseUrl + "$1");
        
        // 返回m3u8内容
        return { m3u8: replacedContent };
    } else {
        // 如果请求失败，返回错误信息
        return { m3u8: "#EXTM3U\n#EXT-X-VERSION:3\n#EXTINF:10,\nerror.m3u8" };
    }
}

// 如果脚本需要直接执行测试，可以添加以下代码（可选）
// main({url: "http://example.com/play?id=xazh", id: "xazh"});