/**
 * 江苏荔枝网 直播源（酷9 JS 版 · 内置本地订阅）
 *
 * 用法：
 *   js文件先要重命名为江苏.js    直播源地址填  http://127.0.0.1:9978/ku9/js/江苏.js
 * 强制刷新列表：URL 加 &fresh=1
 */

var CACHE_KEY = "jiangsu_list_v1";
var SECRET = "7cSrbhisZe2tF3N3ZGPN"; 
var CH = {
    // ---------- 省级 ✔ 全部可播 ----------
    "jsws":   { n: "jswspro",     c: "江苏", t: "江苏卫视" },
    "jsws4k": { n: "jsws4kpro",   c: "江苏", t: "江苏卫视4K超高清", d: "4klive" },
    "jscs":   { n: "jscspro",     c: "江苏", t: "江苏城市" },
    "jszy":   { n: "jszypro",     c: "江苏", t: "江苏综艺" },
    "jsys":   { n: "jsyspro",     c: "江苏", t: "江苏影视" },
    "jsxw":   { n: "jsxwpro",     c: "江苏", t: "江苏新闻" },
    "jsjy":   { n: "jsjypro",     c: "江苏", t: "江苏教育" },
    "jsty":   { n: "jsxxpro",     c: "江苏", t: "江苏体育休闲" },
    "jsgj":   { n: "jsgjpro",     c: "江苏", t: "江苏国际" },
    "ymkt":   { n: "ymktpro",     c: "江苏", t: "优漫卡通" },

    // ---------- 南京 ----------
    "nj1":    { n: "nanjing",     c: "南京", t: "南京新闻综合" },
    "njlh":   { n: "liuhe",       c: "南京", t: "六合新闻综合" },

    // ---------- 无锡 ----------
    "wx1":    { n: "wuxi",        c: "无锡", t: "无锡新闻综合" },
    "wxjy":   { n: "jiangyin",    c: "无锡", t: "江阴新闻综合" },

    // ---------- 徐州 ✔ 全组可播 ----------
    "xz1":    { n: "xuzhou",      c: "徐州", t: "徐州新闻综合" },
    "xzpz":   { n: "pizhou",      c: "徐州", t: "邳州综合" },
    "xzxy":   { n: "xinyi",       c: "徐州", t: "新沂新闻综合" },
    "xzjw":   { n: "jiawang",     c: "徐州", t: "贾汪新闻综合" },
    "xzts":   { n: "tongshan",    c: "徐州", t: "铜山新闻综合" },
    "xzsn":   { n: "suiningzh",   c: "徐州", t: "睢宁综合" },

    // ---------- 常州 ----------
    "cz1":    { n: "changzhou",   c: "常州", t: "常州新闻综合" },

    // ---------- 南通 ----------
    "nt1":    { n: "nantong",     c: "南通", t: "南通新闻综合" },

    // ---------- 连云港 ----------
    "lyg1":   { n: "lianyungang", c: "连云港", t: "连云港新闻综合" },
    "lygdh":  { n: "donghai",     c: "连云港", t: "东海新闻综合" },

    // ---------- 淮安 ✔ 全组可播 ----------
    "ha1":    { n: "huaian",      c: "淮安", t: "淮安综合" },
    "haxy":   { n: "xuyi",        c: "淮安", t: "盱眙综合" },
    "hahz":   { n: "hongze",      c: "淮安", t: "洪泽综合" },
    "hajh":   { n: "jinhuzh",     c: "淮安", t: "金湖综合" },

    // ---------- 盐城 ----------
    "yc1":    { n: "yancheng",       c: "盐城", t: "盐城1套" },
    "ycxs":   { n: "xiangshuizh",    c: "盐城", t: "响水综合" },
    "ycdt":   { n: "dongtaizonghe",  c: "盐城", t: "东台综合" },

    // ---------- 扬州 ----------
    "yz1":    { n: "yzxw",        c: "扬州", t: "扬州新闻" },
    "yzhj":   { n: "hanjiang",    c: "扬州", t: "邗江综合" },
    "yzgy":   { n: "gaoyouxw",    c: "扬州", t: "高邮新闻" },

    // ---------- 镇江 ----------
    "zj1":    { n: "zhenjiang",   c: "镇江", t: "镇江新闻综合" },
    "zjjr":   { n: "jurong",      c: "镇江", t: "句容新闻综合" },
    "zjdy":   { n: "danyangtv",   c: "镇江", t: "丹阳综合" },

    // ---------- 泰州 ----------
    "tz1":    { n: "taizhou",     c: "泰州", t: "泰州新闻" },
    "tzjj":   { n: "jingjiang",   c: "泰州", t: "靖江新闻" },
    "tztx":   { n: "taixing",     c: "泰州", t: "泰兴新闻综合" },
    "tzxh":   { n: "xinghua",     c: "泰州", t: "兴化新闻综合" },

    // ---------- 宿迁 ----------
    "sq1":    { n: "suqian",      c: "宿迁", t: "宿迁综合" },
    "sqsy":   { n: "siyangzh",    c: "宿迁", t: "泗阳综合" },
    "sqsh":   { n: "shuyangzh",   c: "宿迁", t: "沭阳综合" }
};

/* ================= 入口 ================= */
function main(item) {
    var url = (item && item.url) ? item.url : "";
    var id = qs(url, "id");

    if (!id || id === "list" || id === "live") {
        return buildList(url.split("?")[0], url);
    }
    return resolveOne(url, id);
}

/* ============ 1. 频道列表（M3U / #genre#） ============ */
function buildList(scriptBase, reqUrl) {
    // 列表缓存 30 分钟，&fresh=1 强制刷新
    if (qs(reqUrl, "fresh") !== "1") {
        var hit = ku9.getCache(CACHE_KEY);
        if (hit) return hit;
    }

    var out = "江苏荔枝网,#genre#\n";
    var cats = {};

    for (var id in CH) {
        if (!CH.hasOwnProperty(id)) continue;
        var conf = CH[id];
        var cat = conf.c || "其他";
        if (!cats[cat]) cats[cat] = [];
        cats[cat].push({ id: id, t: conf.t || id });
    }

    for (var catName in cats) {
        if (!cats.hasOwnProperty(catName)) continue;
        out += catName + ",#genre#\n";
        var arr = cats[catName];
        for (var i = 0; i < arr.length; i++) {
            out += arr[i].t + "," + scriptBase + "?id=" + arr[i].id + "\n";
        }
    }

    ku9.setCache(CACHE_KEY, out, 30 * 60 * 1000);
    return out;
}

/* ============ 2. 播放时解析单个频道 ============ */
function resolveOne(reqUrl, id) {
    var conf = CH[id];
    if (!conf) {
        // 兼容：id 不在表里时，按"流名"处理，走默认目录
        conf = { n: id, d: "applive" };
    }

    var name = conf.n;
    var dir = conf.d || "applive";

    // ---- 签名：md5(secret + 流名 + txTimeHex) ----
    var txTime = Math.floor(Date.now() / 1000 + 180).toString(16);
    var txSecret = ku9.md5(SECRET + name + txTime);

    var finalUrl = "https://litchi-play-encrypted-site.jstv.com/" + dir + "/" + name
        + ".m3u8?txSecret=" + txSecret + "&txTime=" + txTime;

    var header_4 = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Referer": "https://live.jstv.com/",
        "Accept": "*/*",
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate, br",
        "Connection": "keep-alive"
    };

    return JSON.stringify({
        url: finalUrl,
        headers: JSON.stringify(header_4)
    });
}

/* ================= 工具 ================= */
/* 容错取 query：兼容 ku9.getQuery 返回 null/空串 */
function qs(url, key) {
    try {
        var v = ku9.getQuery(url, key);
        if (v === null || v === undefined) return "";
        return String(v).trim();
    } catch (e) {
        // 兜底：自己解析
        var m = new RegExp("[?&]" + key + "=([^&]*)").exec(url || "");
        return m ? decodeURIComponent(m[1]).trim() : "";
    }
}