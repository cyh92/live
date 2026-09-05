// 深圳电视台直播解析函数
function main(item) {
    // 获取频道ID，默认为'szds'
    var id = item.id || "szds";
    
    // 频道ID与密钥的映射关系
    var n = {
        'szws': 'AxeFRth',
        'szws4k': 'R77mK1v',
        'szyl': '1q4iPng',
        'szse': '1SIQj6s',
        'szgg': '2q76Sw2',
        'szcjsh': '3vlcoxP',
        'szdsj': '4azbkoY',
        'szds': 'ZwxzUXr',
        'szgj': 'sztvgjpd',
        'szyd': 'wDF6KJ3',
        'szdvsh': 'xO1xQFv',
        'yhgw': 'BJ5u5k2',
        'sztyjk': 'sztvtyjk'
    };
    
    // 验证频道ID是否有效
    if (!n.hasOwnProperty(id)) {
        return { error: "Invalid id: " + id };
    }
    
    // 当前时间戳（秒）
    var t = Math.floor(Date.now() / 1000);
    
    // 计算token = md5(t + 密钥 + 'cutvLiveStream|Dream2017')
    var tokenStr = t + n[id] + 'cutvLiveStream|Dream2017';
    var token = ku9.md5(tokenStr);
    
    // 构建获取pname的请求地址
    var bstrURL = "http://hls-api.sztv.com.cn/getCutvHlsLiveKey?t=" + t + "&token=" + token + "&id=" + n[id];
    
    // 定义请求头
    var headers = {
        'Referer': 'https://www.sztv.com.cn/'
    };
    
    // 发送GET请求获取pname
    try {
        var pname = ku9.get(bstrURL, headers);
        if (!pname || pname.trim() === "") {
            pname = "defaultPname";
        }
    } catch (e) {
        return { error: "请求失败: " + e.message, url: bstrURL, headers: headers };
    }
    
    // 计算sign = md5("bf9b2cab35a9c38857b82aabf99874aa96b9ffbb/" + id密钥 + "/500/" + pname + ".m3u8" + (t+36000).toHex())
    var tPlus = t + 36000;
    var tHex = tPlus.toString(16);
    var signStr = "bf9b2cab35a9c38857b82aabf99874aa96b9ffbb/" + n[id] + "/500/" + pname + ".m3u8" + tHex;
    var sign = ku9.md5(signStr);
    
    // 构造m3u8地址
    var m3u8Url = "https://sztv-hls.sztv.com.cn/" + n[id] + "/500/" + pname + ".m3u8?sign=" + sign + "&t=" + tHex;
    
    // 返回播放地址和请求头
    return {
        url: m3u8Url,
        headers: headers
    };
}