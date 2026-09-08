/**
 * 江苏电视台直播解析 - 酷9 JS版
 * 支持大部分江苏地方频道，id 可参考下方 channels 字典
 */
function main(item) {
    // 获取输入链接，解析 id 参数
    var inputUrl = item.url || '';
    var id = ku9.getQuery(inputUrl, 'id') || 'jsws';

    // 频道配置 (与 PHP 版本完全一致)
    var channels = {
        'jsws4k': { key: 'jsws4kpro' },
        'jsys':   { key: 'jsys_live' },
        'jsws':   { key: 'jsws_live' },
        'jscs':   { key: 'jscs_live' },
        'jszy':   { key: 'jszy_live' },
        'jsxw':   { key: 'jsxw_live' },
        'jskt':   { key: 'ymkt_live' },
        'jsty':   { key: 'jsxx_live' },
        'jsgj':   { key: 'jsgj_live' },
        'jsjy':   { key: 'jsjy_live' },
        'njxwzh': { key: 'nanjing' },
        'lsxwzh': { key: 'lsxwzh', domain: 'lishui' },
        'jlzh':   { key: 'jnxwzh', domain: 'jiangning' },
        'wxxwzh': { key: 'wuxi' },
        'jyxwzh': { key: 'jiangyin' },
        'snzh':   { key: 'suiningzh', domain: 'suining' },
        'pzzh':   { key: 'pizhou' },
        'xyxwzh': { key: 'xinyi' },
        'jwxw':   { key: 'jiawang' },
        'ts1':    { key: 'tongshan' },
        'czxwzh': { key: 'changzhou' },
        'pxxwzh': { key: 'pxzh', domain: 'peixian' },
        'wjxwzh': { key: 'wujin' },
        'szxwzh': { key: 'suzhou' },
        'wjxw':   { key: 'wujiang' },
        'cszh':   { key: 'changshu' },
        'ntxwzh': { key: 'nantong' },
        'rd1':    { key: 'rdxwzh', domain: 'rudong' },
        'hmxwzh': { key: 'haimenxwzh', domain: 'haimen' },
        'lygxw':  { key: 'lianyungang' },
        'gyzh':   { key: 'ganyutv', domain: 'ganyu' },
        'dhzh':   { key: 'donghai' },
        'haxw':   { key: 'huaian' },
        'lszh':   { key: 'lsxw', domain: 'lianshui' },
        'xyzh':   { key: 'xuyi' },
        'hz1':    { key: 'hongze' },
        'jhxwzh': { key: 'jinhuzh', domain: 'jinhu' },
        'yc1':    { key: 'yancheng' },
        'xszh':   { key: 'xiangshui' },
        'dt1':    { key: 'dongtaizonghe', domain: 'dongtai' },
        'bhxwzh': { key: 'news', domain: 'binhai' },
        'yzxw':   { key: 'yangzhou' },
        'gy1':    { key: 'gaoyouxw', domain: 'gaoyou' },
        'dyxw':   { key: 'danyang', domain: 'danyang' },
        'zjxwzh': { key: 'zhenjiang' },
        'tz1':    { key: 'taizhou' },
        'xhxwzh': { key: 'xinghua' },
        'txzh':   { key: 'taixing' },
        'sqzh':   { key: 'suqian' },
        'jjxw':   { key: 'jingjiang' },
        'syxw':   { key: 'siyang' },
        'syzh':   { key: 'shuyangzh', domain: 'shuyang' },
        'df1':    { key: 'dafengyt', domain: 'dafeng' },
        'hjt':    { key: 'hanjiang' },
        'xz1':    { key: 'xuzhou' },
        'lhxwzh': { key: 'luhe' },
        'shzh':   { key: 'sihongxinwenzonghe', fullUrl: 'http://sihong-tv-replay.cm.jstv.com/sihong-tv/sihongxinwenzonghe.m3u8' },
        'syxwzh': { key: 'syzhpd', fullUrl: 'http://suyu-tv-replay.cm.jstv.com/suyu-tv/syzhpd.m3u8' },
        'hyzh':   { key: 'huaiyinf', fullUrl: 'http://huaiyin-tv-replay.cm.jstv.com/huaiyin-tv/huaiyinf.m3u8' },
        'jtzh':   { key: 'jintan_xw', fullUrl: 'http://jintan-tv-ori-hls.jstv.com/jintan-tv-ori/jintan_xw.m3u8' },
        'yxxwzh': { key: 'yixing_xw', fullUrl: 'http://yixing-tv-ori-hls.jstv.com/yixing-tv-ori/yixing_xw.m3u8' }
    };

    // 检查频道是否存在
    if (!channels[id]) {
        return { url: '', msg: 'Channel not found' };
    }

    var cfg = channels[id];
    var playUrl = '';

    // 如果是完整 m3u8 地址直接使用
    if (cfg.fullUrl) {
        playUrl = cfg.fullUrl;
    }
    // 如果指定了 domain，则拼接地址 (无签名)
    else if (cfg.domain) {
        playUrl = 'http://' + cfg.domain + '-tv-hls.cm.jstv.com/' + cfg.domain + '-tv/' + cfg.key + '.m3u8';
    }
    // 默认：荔枝加密站点需要签名
    else {
        var pathName = cfg.key;
        var timestamp = Math.floor(Date.now() / 1000) + 180;
        var hex = timestamp.toString(16);
        var rawStr = 'tJanAHkyGtaifaQG4dWe' + pathName + hex;
        var token = ku9.md5(rawStr);
        playUrl = 'https://litchi-play-encrypted-site.jstv.com/live/' + pathName + '.m3u8?txSecret=' + token + '&txTime=' + hex;
    }

    // 请求所需的通用头部
    var headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://live.jstv.com/'
    };

    // 返回播放地址和必要头部，播放器会自行请求 TS 分片
    return {
        url: playUrl,
        headers: headers
    };
}