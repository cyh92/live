// 酷9 JS 脚本 - 江苏电视台直播代理
// 使用方式：http://your-server/ku9/js/jstv.js?id=jsws
// 支持频道：jsws / jscs / jszy / jsys / jsxw / jsjy / jsty / jsgj / ymkt / jsws4k

function main(item) {
    var SECRET_KEY = 'tJanAHkyGtaifaQG4dWe';
    var REFERER = 'https://live.jstv.com/';
    var UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

    var CHANNEL_MAP = {
        'jsws': 'jswspro',
        'jscs': 'jscspro',
        'jszy': 'jszypro',
        'jsys': 'jsyspro',
        'jsxw': 'jsxwpro',
        'jsjy': 'jsjypro',
        'jsty': 'jsxxpro',
        'jsgj': 'jsgjpro',
        'ymkt': 'ymktpro',
        'jsws4k': 'jsws4kpro'
    };

    // 解析频道 ID
    var chId = 'jsws';
    var uri = item.url;
    if (uri) {
        // 优先从 ?id= 获取
        var idParam = ku9.getQuery(uri, "id");
        if (idParam) {
            chId = idParam;
        } else {
            // 兼容 ?url= 参数
            var urlParam = ku9.getQuery(uri, "url");
            if (urlParam) {
                chId = urlParam;
            } else {
                // 兼容路径最后一段，如 /jstv.js/jsws
                var segs = uri.split('/');
                var last = segs[segs.length - 1];
                if (last && last.indexOf('.') === -1) {
                    chId = last;
                }
            }
        }
    }

    // 获取 channelKey
    var channelKey = CHANNEL_MAP[chId] || CHANNEL_MAP['jsws'];

    // 生成签名
    var txTime = Math.floor(new Date().getTime() / 1000) + 180;
    var txTimeHex = txTime.toString(16);
    var signStr = SECRET_KEY + channelKey + txTimeHex;
    var txSecret = ku9.md5(signStr);

    // 拼接最终 m3u8 地址
    var m3u8Url = 'https://litchi-play-encrypted-site.jstv.com/applive/' + channelKey + '.m3u8?txSecret=' + txSecret + '&txTime=' + txTimeHex;

    // 返回酷9标准格式
    return JSON.stringify({
        url: m3u8Url,
        headers: {
            'Referer': REFERER,
            'User-Agent': UA
        }
    });
}