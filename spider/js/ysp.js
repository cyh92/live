// ==================== 央视直播解析（酷9版 · 修订） ====================
// 入口：main(item)
//   item.url 参数：id=<频道名|9位pid>  playseek=<起-止>  https=<0|1>  detail=<0|1>
//   输出 { url } 保持酷9原有契约不变；detail=1 时附带 pid / cnlid / defn / decrypt 等扩展字段。
//
// ---- 与 OneTV（TVBridge）央视频解码解密链路的关系 ----
// 本脚本只负责解析，不做解密；但返回的 playurl 是 CMG/H5E 加密的 TS，裸流交给 ExoPlayer 会花屏。
//  1) OneTV 由 HlsProxyServer.transformFor(url) 判定解密模式：
//       host 为 yangshipin.cn / *.yangshipin.cn / ysp.cctv.cn / *.ysp.cctv.cn -> cmg  (NativeCmgDecryptor)
//       path 含 cdrmld / cctvwbcd                                            -> h5e  (NativeH5eDecryptor)
//       其余                                                               -> plain (不解密，会花屏)
//     下方 decryptMode() 是该规则的等价镜像，detail=1 可直接查看返回流会落到哪条。
//  2) cmg 解密依赖频道上下文：OneTV 开播前先 configureChannel(pid) ->
//     NativeCmgDecryptor.configureLocationForProbe("https://www.yangshipin.cn/tv/home?pid=<pid>")。
//     若要把本脚本结果接入 OneTV，必须把 pid 一并传过去（detail=1 已返回），
//     或改让脚本输出 one-plugin://live/<pid>，走 OneTV 自带的 JNI 签名取流 + 本地代理解密链路。
//  3) 压缩代码内的 cKey 算法（TEA-CBC + 自定义 base64）与项目的
//     YangshipinApiPayload.createCKey()（hash31 + AES/CBC）互不兼容，两处签名不要混用。
// =====================================================================

// ---------- 1. HTTP 桥接：兼容 headers 形态与响应字段差异 ----------
// 原实现把 headers 直接透传、且只认 resp.code === 200 / resp.body，误判率较高。
// 酷9多数实现第三参数要 JSON 字符串；若你的引擎要对象，把下面开关改成 true。
var KU9_HEADERS_AS_OBJECT = false;

var HttpBridge = {
    normalizeHeaders: function (headers) {
        if (!headers) return headers;
        try {
            if (typeof headers === 'string') {
                if (!KU9_HEADERS_AS_OBJECT) return headers;
                return JSON.parse(headers);
            }
            if (!KU9_HEADERS_AS_OBJECT) return JSON.stringify(headers);
            return headers;
        } catch (e) {
            return headers;
        }
    },
    fetchWithHeaders: function (url, headers) {
        try {
            var resp = ku9.request(url, 'GET', this.normalizeHeaders(headers), null, true);
            if (!resp) return null;
            if (typeof resp === 'string') return resp;
            var code = resp.code !== undefined ? resp.code
                : (resp.status !== undefined ? resp.status : resp.statusCode);
            if (code !== undefined && code !== null && String(code) !== '200') return null;
            var body = resp.body !== undefined ? resp.body
                : (resp.content !== undefined ? resp.content : resp.data);
            if (body === null || body === undefined) return null;
            return typeof body === 'string' ? body : JSON.stringify(body);
        } catch (e) {
            return null;
        }
    }
};

// ---------- 2. 原压缩代码（只把 eval 换成显式接收源码，算法一字未改） ----------
var __YSP_SOURCE__ = function(p,a,c,k,e,r){e=function(c){return(c<a?'':e(parseInt(c/a)))+((c=c%a)>35?String.fromCharCode(c+29):c.toString(36))};if(!''.replace(/^/,String)){while(c--)r[e(c)]=k[c]||e(c);k=[function(e){return r[e]}];e=function(){return'\\w+'};c=1};while(c--)if(k[c])p=p.replace(new RegExp('\\b'+e(c)+'\\b','g'),k[c]);return p}('V 25(q){R r=(q||"1w").1x(/\\/$/,"");R t={\'1w\':[\'26\',\'27\',\'S\'],\'28\':[\'29\',\'2a\',\'S\'],\'2b\':[\'2c\',\'2d\',\'S\'],\'2e\':[\'2f\',\'2g\',\'S\'],\'2h\':[\'2i\',\'2j\',\'S\'],\'2k\':[\'2l\',\'2m\',\'S\'],\'2n\':[\'2o\',\'2p\',\'S\'],\'2q\':[\'2r\',\'2s\',\'S\'],\'2t\':[\'2u\',\'2v\',\'S\'],\'2w\':[\'2x\',\'2y\',\'S\'],\'2z\':[\'2A\',\'2B\',\'S\'],\'2C\':[\'2D\',\'2E\',\'S\'],\'2F\':[\'2G\',\'2H\',\'S\'],\'2I\':[\'2J\',\'2K\',\'S\'],\'2L\':[\'2M\',\'2N\',\'S\'],\'2O\':[\'2P\',\'2Q\',\'S\'],\'2R\':[\'2S\',\'2T\',\'S\'],\'2U\':[\'2V\',\'2W\',\'S\'],\'2X\':[\'2Y\',\'2Z\',\'S\'],\'30\':[\'31\',\'34\',\'S\'],\'35\':[\'36\',\'37\',\'S\'],\'38\':[\'39\',\'3a\',\'S\'],\'3b\':[\'3c\',\'3d\',\'S\'],\'3e\':[\'3f\',\'3g\',\'S\'],\'3h\':[\'3i\',\'3j\',\'S\'],\'3k\':[\'3l\',\'3m\',\'S\'],\'3n\':[\'3o\',\'3p\',\'S\'],\'3q\':[\'3r\',\'3s\',\'17\'],\'3t\':[\'3u\',\'3v\',\'17\'],\'3w\':[\'3x\',\'3y\',\'17\'],\'3z\':[\'3A\',\'3B\',\'17\'],\'3C\':[\'3D\',\'3E\',\'17\'],\'3F\':[\'3G\',\'3H\',\'17\'],\'3I\':[\'3J\',\'3K\',\'17\'],\'3L\':[\'3M\',\'3N\',\'17\'],\'3O\':[\'3P\',\'3Q\',\'17\'],\'3R\':[\'3S\',\'3T\',\'17\'],\'3U\':[\'3V\',\'3W\',\'17\'],\'3X\':[\'3Y\',\'3Z\',\'17\'],\'40\':[\'41\',\'42\',\'17\'],\'43\':[\'44\',\'45\',\'S\'],\'46\':[\'47\',\'48\',\'S\'],\'49\':[\'4a\',\'4b\',\'S\'],\'4c\':[\'4d\',\'4e\',\'S\'],\'4f\':[\'4g\',\'4h\',\'S\'],\'4i\':[\'4j\',\'4k\',\'S\'],\'4l\':[\'4m\',\'4n\',\'S\'],\'4o\':[\'4p\',\'4q\',\'S\'],\'4r\':[\'4s\',\'4t\',\'S\'],\'4u\':[\'4v\',\'4w\',\'S\'],\'4x\':[\'4y\',\'4z\',\'S\'],\'4A\':[\'4B\',\'4C\',\'S\'],\'4D\':[\'4E\',\'4F\',\'S\'],\'4G\':[\'4H\',\'4I\',\'S\'],\'4J\':[\'4K\',\'4L\',\'S\'],\'4M\':[\'4N\',\'4O\',\'S\'],\'4P\':[\'4Q\',\'4R\',\'S\'],\'4S\':[\'4T\',\'4U\',\'S\'],\'4V\':[\'4W\',\'4X\',\'S\'],\'4Y\':[\'4Z\',\'50\',\'S\'],\'51\':[\'52\',\'53\',\'S\'],\'54\':[\'55\',\'56\',\'S\'],\'57\':[\'58\',\'59\',\'S\'],\'5a\':[\'5b\',\'5c\',\'S\'],\'5d\':[\'5e\',\'5f\',\'S\'],\'5g\':[\'5h\',\'5i\',\'S\'],\'5j\':[\'5k\',\'5l\',\'S\'],\'5m\':[\'5n\',\'5o\',\'S\'],\'5p\':[\'5q\',\'5r\',\'S\'],\'5s\':[\'5t\',\'5u\',\'S\'],\'5v\':[\'5w\',\'5x\',\'S\'],\'5y\':[\'5z\',\'5A\',\'S\'],\'5B\':[\'5C\',\'5D\',\'S\']};Y(!t[r])W"";R u=t[r][0];R w=t[r][1];R x=t[r][2];V 1l(a){R b=[];X(R i=0;i<a.U;i+=2)b.1m(5E(a.5F(i,2),16));W b}V 1y(a){R b="";X(R i=0;i<a.U;i++){R v=a[i]&T;b+=(v<16?"0":"")+v.1g(16)}W b}V 1n(a){R b=0;X(R i=0;i<a.U;i++){b=(5G*b+(a[i]&T))&5H}W b}V 1z(a,b){R y=((a[0]&T)<<24)|((a[1]&T)<<16)|((a[2]&T)<<8)|(a[3]&T);R z=((a[4]&T)<<24)|((a[5]&T)<<16)|((a[6]&T)<<8)|(a[7]&T);R k=[((b[0]&T)<<24)|((b[1]&T)<<16)|((b[2]&T)<<8)|(b[3]&T),((b[4]&T)<<24)|((b[5]&T)<<16)|((b[6]&T)<<8)|(b[7]&T),((b[8]&T)<<24)|((b[9]&T)<<16)|((b[10]&T)<<8)|(b[11]&T),((b[12]&T)<<24)|((b[13]&T)<<16)|((b[14]&T)<<8)|(b[15]&T)];R c=0;R d=5I;X(R i=0;i<16;i++){c=(c+d)|0;y=(y+((((z<<4)+k[0])^(z+c)^((z>>>5)+k[1]))|0))|0;z=(z+((((y<<4)+k[2])^(y+c)^((y>>>5)+k[3]))|0))|0}W[(y>>>24)&T,(y>>>16)&T,(y>>>8)&T,y&T,(z>>>24)&T,(z>>>16)&T,(z>>>8)&T,z&T]}V 1r(b,c){R d=b.U;R e=d+1+2+7;R f=e%8;Y(f)f=8-f;R g=[];R h=[0,0,0,0,0,0,0,0];h[0]=(1b.1d(1b.1h()*1s)&5J)|f;R k=1;1i(f>0){h[k]=1b.1d(1b.1h()*1s);k++;f--}R l=[0,0,0,0,0,0,0,0];R m=[0,0,0,0,0,0,0,0];V 1j(){X(R j=0;j<8;j++)h[j]^=m[j];R a=1z(h,c);X(R j=0;j<8;j++)a[j]^=l[j];l=h.1A();m=a.1A();X(R j=0;j<8;j++)g.1m(a[j]);k=0}R i=0;1i(i<2){Y(k<8){h[k]=1b.1d(1b.1h()*1s);k++;i++}Y(k==8)1j()}R n=0;R o=d;1i(o>0){Y(k<8){h[k]=b[n];n++;k++;o--}Y(k==8)1j()}i=0;1i(i<7){Y(k<8){h[k]=0;k++;i++}Y(k==8)1j()}Y(k>0){X(R j=k;j<8;j++)h[j]=0;1j()}W g}V 1c(a){W[(a>>>24)&T,(a>>>16)&T,(a>>>8)&T,a&T]}V 1e(a){W[(a>>>8)&T,a&T]}V 1o(s){R b=[];X(R i=0;i<s.U;i++)b.1m(s.5K(i)&T);W b}V 1B(a,c,d,e,f){Y(!d)d=\'-1\';Y(!e)e=\'1C\';Y(!f)f=\'1C\';V 1p(s){s=s.1g();W s.U>=5?s.1D(s.U-5):\'\'}R g=1c(a);R h=[1p(c),1p(e),1p(f),d];X(R i=0;i<h.U;i++){R b=1o(h[i]);g=g.1a(1e(b.U),b)}R j=1e(g.U).1a(g);R k=1n(j);R l=1l("5L");R m=1r(j,l);m=m.1a(1c(k));R n=[5M,5N,5O,5P,5Q,5R,5S,5T];X(R i=0;i<m.U;i++)m[i]^=n[i&7];W 1y(m).5U()}V 1E(a){R c=[];c=c.1a(1l(\'5V\'));c=c.1a(1c(a.1F));c=c.1a(1c(0));c=c.1a(1c(a.1G));R d=[a.1H,a.1I,a.1t,a.1J,a.1u];X(R i=0;i<d.U;i++){R b=1o(d[i]);c=c.1a(1e(b.U),b)}c=c.1a(1c(1));c=c.1a(1c(1));d=["5W","1K",a.1L,"1K","5X.1.5Y","5Z.1M.61.62.65","1k","66","67",a.1N];X(R i=0;i<d.U;i++){R b=1o(d[i]);c=c.1a(1e(b.U),b)}R e=1e(c.U).1a(c);R f=1n(e);R g=1c(f);e[18]=g[0];e[19]=g[1];e[20]=g[2];e[21]=g[3];W e}V 1O(a){R b="68+/=";R c="";R i=0;1i(i<a.U){R d=a[i++]&T;R e=i<a.U?a[i++]&T:1P;R f=i<a.U?a[i++]&T:1P;R g=d>>2;R h=((d&3)<<4)|(1q(e)?0:(e>>4));R k=1q(e)?64:(((e&15)<<2)|(1q(f)?0:(f>>6)));R l=1q(f)?64:(f&63);c+=b.1f(g)+b.1f(h)+b.1f(k)+b.1f(l)}R m="69-=";R n="";X(R j=0;j<c.U;j++){R o=c.1f(j);R p=b.6a(o);n+=m.1f(p)}W n.1x(/=+$/,\'\')}V 1Q(a){R b=1l("6b");R c=1n(a);R d=1r(a,b);d=d.1a(1c(c));R e=[6c,6d,1R,6e,6f,6g,6h,6i,6j,6k,6l,6m,6n,1R,6o,6p];R f=[];X(R i=0;i<d.U;i++)f.1m(d[i]^e[i&6q]);R g=1O(f);W"--6r"+g}V 1S(){V Z(){W 1b.1d(1b.1h()*6s).1g(16).6t(4,\'0\')}R a=Z()+Z()+Z()+Z()+Z()+Z()+Z()+Z();Y(a.U!==32)a=(a+"6u").1D(0,32);W a}V 1v(){V Z(a){R s="";X(R i=0;i<a;i++)s+=1b.1d(1b.1h()*16).1g(16);W s}W Z(8)+"-"+Z(4)+"-4"+Z(3)+"-a"+Z(3)+"-"+Z(12)}R A=1S();R B=1b.1d(6v.6w()/6x);R C=\'6y==\';R D=1v();R E=1B(B,A);R F={1F:1k,1G:B,1H:\'6z\',1J:u,1u:A,1t:\'1T.22.1U.1V\',1I:C,1L:D,1N:E};R G=1E(F);R H=1Q(G);V 1W(){W 1v()+"6A"+1k}R I=1W();R J={"6B":"6C","6D":w,"6E":u,"1t":"1T.22.1U.1V","6F":"6G","6H":"1","6I":"2","6J":x,"6K":"6L","6M":"4.2","6N":"0","6O":"33","6P":"6Q-6R","6S":"0","6T":"1","6U":"1","6V":"1","6W":"1k","6X":"1k","6Y":"6Z","70":"23","71":"1","72":"6","73":"2","74":"7","75":"1","76":"1","77":"60","78":"0","79":"7a","7b":"4","7c":"1","7d":"1","7e":"7f.2.1","7g":"4","7h":H,"1u":A,"7i":B.1g(),"7j":I,"7k":"0"};R K="";X(R k 7l J){Y(K.U>0)K+="&";K+=1X(k)+"="+1X(J[k])}R L="7m://7n.7o.1M.7p?"+K;R M={"7q-7r":"7s","7t":"7u-7v","7w":"7x/7y"};R N=1Y.7z(M);R O="";R P=7A.7B(L,N);Y(P){7C{R Q=1Y.7D(P);Y(Q.1Z){O=Q.1Z}}7E(e){}}W O}',62,475,'|||||||||||||||||||||||||||||||||||||||||||||||||||||var|fhd|0xFF|length|function|return|for|if|rh||||||||shd|||concat|Math|packN|floor|packn|charAt|toString|random|while|processBlock|4330403|hexToBytes|push|calcSignature|strToBytes|guardLastFive|isNaN|oiSymmetryEncrypt2|256|appVer|guid|generateUUID|cctv1|replace|bytesToHex|teaEncryptECB|slice|generateCkGuardTime|null|substring|buildPacket|Platform|Timestamp|Sdtfrom|randFlag|vid|nil|uuid4|cctv|ck_guard_time|customEncode|NaN|encryptDataToCKey|0xED|generateGuid|V8|1035|3031|generateFlowid|encodeURIComponent|JSON|playurl||||||getPlayUrl|2024078201|600001859|cctv2|2024075401|600001800|cctv3|2024068501|600001801|cctv4|2029797101|600001814|cctv5|2024078401|600001818|cctv5p|2024078001|600001817|cctv6|2013693901|600108442|cctv7|2024072001|600004092|cctv8|2029793001|600001803|cctv9|2024078601|600004078|cctv10|2024078701|600001805|cctv11|2027248701|600001806|cctv12|2027248801|600001807|cctv13|2029797201|600001811|cctv14|2027248901|600001809|cctv15|2027249001|600001815|cctv16|2027249101|600098637|cctv164k|2027249301|600099502|cctv17|2027249401|600001810|cctv4k|2029810301|||600002264|cctv8k|2026774101|600156816|cgtn|2024181701|600014550|cgtnfy|2024181801|600084704|cgtney|2024181901|600084758|cgtnalby|2024182001|600084782|cgtnxby|2024182101|600084744|cgtnwyjl|2024182301|600084781|cctvfyjc|2025637103|600099658|cctvdyjc|2026874203|600099655|cctvhjjc|2026874303|600099620|cctvsjdl|2026874403|600099637|cctvfyyy|2026874503|600099660|cctvbqkj|2026874603|600099649|cctvfyzq|2026966203|600099636|cctvgeqwq|2026874703|600099659|cctvnxss|2026874803|600099650|cctvyswhjp|2026874903|600099653|cctvystq|2026875003|600099652|cctvdszn|2026875103|600099656|cctvwsjk|2025637003|600099651|bjws|2024052703|600002309|jsws|2024171103|600002521|dfws|2024054503|600002483|zjws|2024054703|600002520|hnws|2024054803|600002475|hbws|2024171203|600002508|gdws|2024060903|600002485|gxws|2024060703|600002509|hljws|2029797003|600002498|hnws2|2024055603|600002506|cqws|2024061103|600002531|szws|2024061303|600002481|scws|2024061403|600002516|henanws|2029797303|600002525|fjdnhz|2024061503|600002484|gzhws|2024061603|600002490|jxws|2024061703|600002503|lnws|2024171303|600002505|ahws|2024171403|600002532|hbws2|2024171503|600002493|sdws|2029787903|600002513|tjws|2019927003|600152137|jlws|2025561503|600190405|shanxiws|2029795103|600190400|nxws|2025608503|600190737|nmgws|2025561203|600190401|ynws|2025561303|600190402|shanxiws2|2025560803|600190407|qhws|2025559103|600190406|xzws|2025558003|600190403|cetv1|2022823801|600171827|gxpd|2029360403|600213139|xjws|2019927403|600152138|parseInt|substr|0x83|0x7FFFFFFF|0x9e3779b9|0xF8|charCodeAt|110DBEC10C23E7D2E56A1CAD6914EF1B|0xB3|0xC9|0x53|0xA0|0x69|0x13|0xAD|0x4D|toUpperCase|0000004200000004000004d2|2622783A|v0|000|com||yangshipin|app|||iphone|ex_json_bus|ex_json_vs|ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789|ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_|indexOf|59b2f7cf725ef43c34fdd7c123411ed3|0x84|0x2E|0x08|0xF0|0x66|0xE6|0xEA|0x48|0xB4|0xCA|0xA9|0x91|0x6F|0xF3|0xF|01|65536|padStart|00000000000000000000000000000000|Date|now|1000|_zj1A5Gh6QYcxWjIUGos2w|dcgh|_|atime|120|livepid|cnlid|app_version|300090|caplv|cmd|defn|device|iPhone|encryptVer|getpreviewinfo|hevclv|lang|zh|Hans_JP|livequeue|logintype|nettype|newnettype|newplatform|platform|sdtfrom|v3021|spacode|spaudio|spdemuxer|spdrm|spdynamicrange|spflv|spflvaudio|sphdrfps|sphttps|spvcode|MSgzMDoyMTYwLDYwOjIxNjB8MzA6MjE2MCw2MDoyMTYwKTsyKDMwOjIxNjAsNjA6MjE2MHwzMDoyMTYwLDYwOjIxNjAp|spvideo|stream|system|sysver|ios18|uhd_flag|cKey|fntick|flowid|playbacktime|in|https|bkliveinfo|ysp|cn|User|Agent|qqlive|Connection|Keep|Alive|Accept|application|json|stringify|HttpBridge|fetchWithHeaders|try|parse|catch'.split('|'),0,{});

// 老引擎可能没有 String.prototype.padStart（generateGuid 依赖它）；仅在此作用域补齐。
var __YSP_PRELUDE__ = 'if (!String.prototype.padStart) {' +
    'String.prototype.padStart = function (n, c) {' +
    'var s = String(this); c = (c === undefined || c === null) ? " " : String(c);' +
    'while (s.length < n) { s = c + s; } return s; }; }\n';

function __buildYspResolver() {
    var source = __YSP_SOURCE__;
    // 首选 new Function：显式拿到函数，避免 eval 在间接调用/严格模式下作用域丢失，
    // 也避免原 main() 里 getPlayUrl / eval("getPlayUrl") / playUrl 三重猜测。
    try {
        var fn = new Function('HttpBridge',
            __YSP_PRELUDE__ + source + '\nreturn (typeof getPlayUrl === "function") ? getPlayUrl : null;')(HttpBridge);
        if (fn) return fn;
    } catch (e) {}
    // 兜底：老引擎禁用 new Function 时用 eval，注意 eval 体内不能出现 return 语句
    try {
        var fn2 = eval(__YSP_PRELUDE__ + source + '\ngetPlayUrl;');
        if (typeof fn2 === 'function') return fn2;
    } catch (e2) {}
    return null;
}

var getPlayUrl = __buildYspResolver();

// ---------- 3. 频道表镜像（与压缩代码内 t 表一致，供 id 归一与 detail 使用） ----------
// 频道表对齐说明（对照 YangshipinApiPayload.PID_TO_STREAM_ID）：
//   - 项目独有 pid：600000492, 600190408（600000492 已在下方归一到 600004092）
//   - 本脚本独有 pid（12 个）：600099636, 600099637, 600099649, 600099650, 600099651, 600099652, 600099653, 600099656, 600099658, 600099659, 600099660, 600213139
//   - streamId 冲突：600084781 proj=2024182201 js=2024182301
//   - 项目 YangshipinStreamResolver.canonicalPid() 把 600000492 -> 600004092，下方 PID_NORMALIZE 保持一致
var CHANNELS = {"cctv1":["2024078201","600001859","fhd"],"cctv2":["2024075401","600001800","fhd"],"cctv3":["2024068501","600001801","fhd"],"cctv4":["2029797101","600001814","fhd"],"cctv5":["2024078401","600001818","fhd"],"cctv5p":["2024078001","600001817","fhd"],"cctv6":["2013693901","600108442","fhd"],"cctv7":["2024072001","600004092","fhd"],"cctv8":["2029793001","600001803","fhd"],"cctv9":["2024078601","600004078","fhd"],"cctv10":["2024078701","600001805","fhd"],"cctv11":["2027248701","600001806","fhd"],"cctv12":["2027248801","600001807","fhd"],"cctv13":["2029797201","600001811","fhd"],"cctv14":["2027248901","600001809","fhd"],"cctv15":["2027249001","600001815","fhd"],"cctv16":["2027249101","600098637","fhd"],"cctv164k":["2027249301","600099502","fhd"],"cctv17":["2027249401","600001810","fhd"],"cctv4k":["2029810301","600002264","fhd"],"cctv8k":["2026774101","600156816","fhd"],"cgtn":["2024181701","600014550","fhd"],"cgtnfy":["2024181801","600084704","fhd"],"cgtney":["2024181901","600084758","fhd"],"cgtnalby":["2024182001","600084782","fhd"],"cgtnxby":["2024182101","600084744","fhd"],"cgtnwyjl":["2024182301","600084781","fhd"],"cctvfyjc":["2025637103","600099658","shd"],"cctvdyjc":["2026874203","600099655","shd"],"cctvhjjc":["2026874303","600099620","shd"],"cctvsjdl":["2026874403","600099637","shd"],"cctvfyyy":["2026874503","600099660","shd"],"cctvbqkj":["2026874603","600099649","shd"],"cctvfyzq":["2026966203","600099636","shd"],"cctvgeqwq":["2026874703","600099659","shd"],"cctvnxss":["2026874803","600099650","shd"],"cctvyswhjp":["2026874903","600099653","shd"],"cctvystq":["2026875003","600099652","shd"],"cctvdszn":["2026875103","600099656","shd"],"cctvwsjk":["2025637003","600099651","shd"],"bjws":["2024052703","600002309","fhd"],"jsws":["2024171103","600002521","fhd"],"dfws":["2024054503","600002483","fhd"],"zjws":["2024054703","600002520","fhd"],"hnws":["2024054803","600002475","fhd"],"hbws":["2024171203","600002508","fhd"],"gdws":["2024060903","600002485","fhd"],"gxws":["2024060703","600002509","fhd"],"hljws":["2029797003","600002498","fhd"],"hnws2":["2024055603","600002506","fhd"],"cqws":["2024061103","600002531","fhd"],"szws":["2024061303","600002481","fhd"],"scws":["2024061403","600002516","fhd"],"henanws":["2029797303","600002525","fhd"],"fjdnhz":["2024061503","600002484","fhd"],"gzhws":["2024061603","600002490","fhd"],"jxws":["2024061703","600002503","fhd"],"lnws":["2024171303","600002505","fhd"],"ahws":["2024171403","600002532","fhd"],"hbws2":["2024171503","600002493","fhd"],"sdws":["2029787903","600002513","fhd"],"tjws":["2019927003","600152137","fhd"],"jlws":["2025561503","600190405","fhd"],"shanxiws":["2029795103","600190400","fhd"],"nxws":["2025608503","600190737","fhd"],"nmgws":["2025561203","600190401","fhd"],"ynws":["2025561303","600190402","fhd"],"shanxiws2":["2025560803","600190407","fhd"],"qhws":["2025559103","600190406","fhd"],"xzws":["2025558003","600190403","fhd"],"cetv1":["2022823801","600171827","fhd"],"gxpd":["2029360403","600213139","fhd"],"xjws":["2019927403","600152138","fhd"]};
var PID_TO_ID = {"600001800":"cctv2","600001801":"cctv3","600001803":"cctv8","600001805":"cctv10","600001806":"cctv11","600001807":"cctv12","600001809":"cctv14","600001810":"cctv17","600001811":"cctv13","600001814":"cctv4","600001815":"cctv15","600001817":"cctv5p","600001818":"cctv5","600001859":"cctv1","600002264":"cctv4k","600002309":"bjws","600002475":"hnws","600002481":"szws","600002483":"dfws","600002484":"fjdnhz","600002485":"gdws","600002490":"gzhws","600002493":"hbws2","600002498":"hljws","600002503":"jxws","600002505":"lnws","600002506":"hnws2","600002508":"hbws","600002509":"gxws","600002513":"sdws","600002516":"scws","600002520":"zjws","600002521":"jsws","600002525":"henanws","600002531":"cqws","600002532":"ahws","600004078":"cctv9","600004092":"cctv7","600014550":"cgtn","600084704":"cgtnfy","600084744":"cgtnxby","600084758":"cgtney","600084781":"cgtnwyjl","600084782":"cgtnalby","600098637":"cctv16","600099502":"cctv164k","600099620":"cctvhjjc","600099636":"cctvfyzq","600099637":"cctvsjdl","600099649":"cctvbqkj","600099650":"cctvnxss","600099651":"cctvwsjk","600099652":"cctvystq","600099653":"cctvyswhjp","600099655":"cctvdyjc","600099656":"cctvdszn","600099658":"cctvfyjc","600099659":"cctvgeqwq","600099660":"cctvfyyy","600108442":"cctv6","600152137":"tjws","600152138":"xjws","600156816":"cctv8k","600171827":"cetv1","600190400":"shanxiws","600190401":"nmgws","600190402":"ynws","600190403":"xzws","600190405":"jlws","600190406":"qhws","600190407":"shanxiws2","600190737":"nxws","600213139":"gxpd"};

// 项目 YangshipinStreamResolver.canonicalPid() 的同款归一
var PID_NORMALIZE = { '600000492': '600004092' };

// 项目 PID_TO_CCTV_SLUG 里的命名 / 常见别名 -> 本表 key
var ID_ALIASES = {
    'cctv5+': 'cctv5p', 'cctv5plus': 'cctv5p', 'cctv5jia': 'cctv5p',
    'cctvjilu': 'cctv9', 'cctvchild': 'cctv14',
    'cctv9documentary': 'cctv9', 'cctvshaoer': 'cctv14'
};

// ---------- 4. 工具函数 ----------
function getParam(url, key) {
    if (typeof ku9 !== 'undefined' && ku9 && typeof ku9.getQuery === 'function') {
        try {
            var v = ku9.getQuery(url, key);
            if (v !== null && v !== undefined && v !== '') return String(v);
        } catch (e) {}
    }
    var m = new RegExp('[?&]' + key + '=([^&#]*)', 'i').exec(String(url));
    if (!m) return '';
    try { return decodeURIComponent(m[1].replace(/\+/g, ' ')); } catch (e) { return m[1]; }
}

function normalizeId(raw) {
    var id = String(raw === null || raw === undefined ? '' : raw)
        .replace(/^\s+|\s+$/g, '').toLowerCase().replace(/\/+$/, '');
    var m = /one-plugin:\/\/live\/([0-9]+)/i.exec(id);
    if (m) id = m[1];
    if (/^[0-9]+$/.test(id)) {
        id = PID_NORMALIZE[id] || id;   // 600000492 -> 600004092
        id = PID_TO_ID[id] || id;       // 支持直接传 9 位 pid
    }
    return ID_ALIASES[id] || id;
}

// HlsProxyServer.transformFor() 的等价镜像：判断 OneTV 会按哪种模式处理该流
function decryptMode(url) {
    var m = /^https?:\/\/([^\/:?#]+)([^?#]*)/i.exec(String(url).replace(/^\s+/, ''));
    if (!m) return 'plain';
    var host = m[1].toLowerCase();
    var path = (m[2] || '').toLowerCase();
    if (/(^|\.)yangshipin\.cn$/.test(host) || /(^|\.)ysp\.cctv\.cn$/.test(host)) return 'cmg';
    if (path.indexOf('cdrmld') >= 0 || path.indexOf('cctvwbcd') >= 0) return 'h5e';
    return 'plain';
}

// 去 BOM/空白、补全协议相对 URL、可选强制升级 https
// 压缩代码里 sphttps=0，返回的 http:// 明文在 Android 9+ 会被直接拦截
function normalizeUrl(raw, forceHttps) {
    var url = String(raw === null || raw === undefined ? '' : raw)
        .replace(/^[\s\uFEFF]+|[\s\uFEFF]+$/g, '');
    if (!url) return '';
    if (url.indexOf('//') === 0) url = 'https:' + url;
    if (forceHttps && /^http:\/\//i.test(url)) url = 'https://' + url.slice(7);
    return url;
}

function appendPlayseek(url, playseek) {
    if (!playseek) return url;
    var parts = String(playseek).split('-');
    if (parts.length !== 2) return url;
    var begin = parts[0].replace(/^\s+|\s+$/g, '');
    var end = parts[1].replace(/^\s+|\s+$/g, '');
    if (!begin || !end || /[?&]playbackbegin=/i.test(url)) return url;
    var hash = '';
    var hi = url.indexOf('#');
    if (hi >= 0) { hash = url.slice(hi); url = url.slice(0, hi); }
    var sep = url.indexOf('?') >= 0 ? '&' : '?';
    return url + sep + 'playbackbegin=' + encodeURIComponent(begin) +
        '&playbackend=' + encodeURIComponent(end) + hash;
}

// ---------- 5. 酷9主入口 ----------
function main(item) {
    if (!item || !item.url) return { url: '' };
    var rawUrl = String(item.url);
    var id = normalizeId(getParam(rawUrl, 'id'));
    if (!id || !CHANNELS[id] || !getPlayUrl) return { url: '' };

    var playUrl = '';
    try { playUrl = getPlayUrl(id); } catch (e) { playUrl = ''; }
    playUrl = normalizeUrl(playUrl, getParam(rawUrl, 'https') !== '0');
    if (!/^https?:\/\//i.test(playUrl)) return { url: '' };
    playUrl = appendPlayseek(playUrl, getParam(rawUrl, 'playseek'));

    if (getParam(rawUrl, 'detail') === '1') {
        var info = CHANNELS[id];
        var mode = decryptMode(playUrl);
        return {
            url: playUrl,
            id: id,
            pid: info[1],                 // OneTV configureChannel(pid) 需要的值
            cnlid: info[0],               // 对应 YangshipinApiPayload.PID_TO_STREAM_ID
            defn: info[2],
            decrypt: mode,
            warning: mode === 'plain'
                ? 'OneTV 会按 plain 透传，CMG 加密流将花屏；需接入 one-plugin://live/' + info[1]
                : ''
        };
    }
    return { url: playUrl };
}
