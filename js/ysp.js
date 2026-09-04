/*
 * 中央电视台直播源解析
 * 适配:FongMi / CatVod / OK‑TV (drpy JS爬虫环境)
 * 说明: 通过央视官方接口获取直播流，支持大部分央视频道
 */

// 频道标识与显示名称映射（用于匹配接口返回的标题）
var CHANNEL_MAP = {
    cctv1:   '综合频道',
    cctv2:   '财经频道',
    cctv3:   '综艺频道',
    cctv4:   '中文国际频道',
    cctv5:   '体育频道',
    cctv5p:  '体育赛事频道',   // 对应 cctv5+
    cctv6:   '电影频道',
    cctv7:   '国防军事频道',
    cctv8:   '电视剧频道',
    cctv9:   '纪录频道',
    cctv10:  '科教频道',
    cctv11:  '戏曲频道',
    cctv12:  '社会与法频道',
    cctv13:  '新闻频道',
    cctv14:  '少儿频道',
    cctv15:  '音乐频道',
    cctv16:  '奥林匹克频道',
    cctv17:  '农业农村频道'
};

// 主入口函数
function getPlayUrl(cid, flag, sourceUrl) {
    // 从 sourceUrl 中提取 id 参数（如 ?id=cctv1）
    var idMatch = sourceUrl.match(/[?&]id=([^&#]+)/i);
    var id = idMatch ? decodeURIComponent(idMatch[1]) : 'cctv1';

    // 根据 id 获取目标频道名称
    var targetTitle = CHANNEL_MAP[id];
    if (!targetTitle) {
        throw new Error('未知频道标识：' + id);
    }

    // 请求央视直播列表接口（返回所有频道信息）
    var apiUrl = 'https://api.cntv.cn/live/getLiveList?serviceId=publish&t=' + Date.now();
    var headers = {
        'Origin': 'https://tv.cctv.com',
        'Referer': 'https://tv.cctv.com/live/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/116.0.0.0 Safari/537.36'
    };

    var responseText = req(apiUrl, {
        method: 'get',
        headers: headers
    });

    if (!responseText) {
        throw new Error('央视接口没有返回数据');
    }

    // 解析 JSON
    var json;
    try {
        json = JSON.parse(responseText);
    } catch (error) {
        throw new Error('央视接口数据格式错误');
    }

    // 检查返回码
    if (json.code !== undefined && Number(json.code) !== 0) {
        throw new Error(json.message || json.msg || '央视接口请求失败');
    }

    // 获取频道列表
    var list = json.data || [];
    if (!(list instanceof Array)) {
        throw new Error('央视接口没有返回频道列表');
    }

    // 遍历列表，匹配频道名称
    var playUrl = '';
    for (var index = 0; index < list.length; index++) {
        var item = list[index] || {};
        var title = item.title || item.name || '';
        // 模糊匹配（包含目标名称即可）
        if (title.indexOf(targetTitle) !== -1) {
            var tempUrl = item.liveUrl || item.streamUrl || item.playUrl || item.url || '';
            tempUrl = String(tempUrl).replace(/^\s+|\s+$/g, '');
            if (/^https?:\/\//i.test(tempUrl)) {
                playUrl = tempUrl;
                break;
            }
        }
    }

    if (!playUrl) {
        throw new Error('没有找到频道：' + targetTitle);
    }

    // Fongmi/TVBox标准返回结构 parse=0 表示直链
    return {
        parse: 0,
        url: playUrl
    };
}