/* 北京广播电视台(btime)直播源解析。兼容 nTv/KU9 的同步脚本执行环境。
 * 无外部依赖、不使用CryptoJS，内置纯JS MD5；代码格式完全对标吉林台脚本
 */
function main(item) {
    var sourceUrl = item && item.url ? String(item.url) : String(item || '');
    var idMatch = sourceUrl.match(/[?&]id=([^&#]+)/i);
    var id = idMatch ? decodeURIComponent(idMatch[1]) : 'bjws';

    var channelMap = {
        bjws: ['北京卫视'],
        bjws4k: ['北京卫视4K'],
        bjwy: ['北京文艺'],
        bjjs: ['北京纪实'],
        bjys: ['北京影视'],
        bjcj: ['北京财经'],
        bjty: ['北京体育'],
        bjsh: ['北京生活'],
        bjxw: ['北京新闻'],
        bjkk: ['北京科教']
    };
    var aliases = channelMap[id] || [id];

    var channelIdTable = {
        bjws: "573ib1kp5nk92irinpumbo9krlb",
        bjws4k: "5481pu3mib99s696hvtkq65c25n",
        bjwy: "54db6gi5vfj8r8q1e6r89imd64s",
        bjjs: "53bn9rlalq08lmb8nf8iadoph0b",
        bjys: "50mqo8t4n4e8gtarqr3orj9l93v",
        bjcj: "50e335k9dq488lb7jo44olp71f5",
        bjty: "54hv0f3pq079d4oiil2k12dkvsc",
        bjsh: "50j015rjrei9vmp3h8upblr41jf",
        bjxw: "53gpt1ephlp86eor6ahtkg5b2hf",
        bjkk: "55skfjq618b9kcq9tfjr5qllb7r"
    };

    if (!channelIdTable[id]) {
        throw new Error('北京电视台不存在该频道：' + aliases[0]);
    }
    var channelId = channelIdTable[id];
    var signSalt = "shi!@#$%^&*[xian!@#]*";

    var timestamp = Math.floor(Date.now() / 1000);
    var md5Str1 = timestamp + channelId;
    var token = md5(md5Str1);

    var params = {
        browse_mode: "1",
        channel: "ali",
        id: channelId,
        net: "WIFI",
        os: "Android",
        os_type: "NOX666999",
        os_ver: "33",
        push_id: token,
        timestamp: timestamp,
        token: token,
        ver: "100600"
    };

    var keys = Object.keys(params).sort();
    var paramParts = [];
    for(var i = 0; i < keys.length; i++){
        var k = keys[i];
        paramParts.push(k + "=" + params[k]);
    }
    var queryString = paramParts.join("&");

    var signSource = queryString + signSalt;
    var fullMd5 = md5(signSource);
    var sign = fullMd5.slice(3, 10);

    var apiUrl = 'https://app.api.btime.com/video/play?' + queryString + '&sign=' + sign;

    var headers = {
        'User-Agent': 'bjtime 100600',
        'Referer': 'android-app.btime.com'
    };

    var responseText = ku9.get(apiUrl, headers);
    if (!responseText) {
        throw new Error('北京电视台接口没有返回数据');
    }

    var response;
    try {
        response = JSON.parse(responseText);
    } catch (error) {
        throw new Error('北京电视台接口数据格式错误');
    }

    if (!response.data || !response.data.video_stream || response.data.video_stream.length === 0) {
        throw new Error('北京电视台接口没有返回频道流地址：' + aliases[0]);
    }

    var playUrl = response.data.video_stream[0].streamUrl || response.data.video_stream[0].stream_url;
    playUrl = String(playUrl).replace(/^\s+|\s+$/g, '');
    if (/^https?:\/\//i.test(playUrl)) {
        return {url: playUrl};
    }

    throw new Error('没有找到频道：' + aliases[0]);
}

function matchesAlias(name, aliases) {
    var normalized = normalizeChannelName(name);
    for (var index = 0; index < aliases.length; index++) {
        if (normalized === normalizeChannelName(aliases[index])) {
            return true;
        }
    }
    return false;
}

function normalizeChannelName(value) {
    return String(value || '').replace(/\s+/g, '').replace(/[·•]/g, '');
}

// ========== 纯JS MD5实现（无CryptoJS依赖，KU9原生JS可运行） ==========
function md5(string) {
    function RotateLeft(lValue, iShiftBits) {
        return (lValue<<iShiftBits) | (lValue>>>(32-iShiftBits));
    }
    function AddUnsigned(lX,lY) {
        var lX4,lY4,lX1,lY1,lResult;
        lX1 = lX & 0x80000000;
        lY1 = lY & 0x80000000;
        lX4 = lX & 0x40000000;
        lY4 = lY & 0x40000000;
        lResult = (lX & 0x3FFFFFFF)+(lY & 0x3FFFFFFF);
        if(lX4 & lY4) return lResult ^ 0x80000000 ^ lX1 ^ lY1;
        if(lX4 | lY4) {
            if(lResult & 0x40000000) return lResult ^ 0xC0000000 ^ lX1 ^ lY1;
            else return lResult ^ 0x40000000 ^ lX1 ^ lY1;
        } else return lResult ^ lX1 ^ lY1;
    }
    function F(x,y,z){ return (x & y) | ((~x) & z); }
    function G(x,y,z){ return (x & z) | (y & (~z)); }
    function H(x,y,z){ return x ^ y ^ z; }
    function I(x,y,z){ return y ^ (x | (~z)); }
    function FF(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(F(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function GG(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(G(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function HH(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(H(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function II(a,b,c,d,x,s,ac) {
        a = AddUnsigned(a, AddUnsigned(AddUnsigned(I(b, c, d), x), ac));
        return AddUnsigned(RotateLeft(a, s), b);
    }
    function ConvertToWordArray(str) {
        var wordCount;
        var msgLengthInBits = str.length * 8;
        var wordArray = [];
        var position = 0;
        for(; position < str.length - 3; position += 4) {
            wordArray[position>>2] = str.charCodeAt(position) | (str.charCodeAt(position+1)<<8)
                | (str.charCodeAt(position+2)<<16) | (str.charCodeAt(position+3)<<24);
        }
        switch(str.length % 4) {
            case 0: wordArray[position>>2] = 0x80000000; break;
            case 1: wordArray[position>>2] = str.charCodeAt(position) | 0x800000; break;
            case 2: wordArray[position>>2] = str.charCodeAt(position) | (str.charCodeAt(position+1)<<8) | 0x8000; break;
            case 3: wordArray[position>>2] = str.charCodeAt(position) | (str.charCodeAt(position+1)<<8)
                | (str.charCodeAt(position+2)<<16) | 0x80; break;
        }
        wordCount = ((msgLengthInBits + 64)>>>9)<<4;
        while(wordArray.length < wordCount) wordArray.push(0);
        wordArray[wordCount-2] = msgLengthInBits;
        wordArray[wordCount-1] = 0;
        return wordArray;
    }
    function WordToHex(lValue) {
        var wordToHexValue="",wordToHexValueTemp="",lByte,lCount;
        for(lCount=0;lCount<=3;lCount++) {
            lByte=(lValue>>>(lCount*8))&255;
            wordToHexValueTemp="0"+lByte.toString(16);
            wordToHexValue=wordToHexValue+wordToHexValueTemp.substr(wordToHexValueTemp.length-2,2);
        }
        return wordToHexValue;
    }
    function Utf8Encode(str) {
        str = str.replace(/\r\n/g,"\n");
        var utftext = "";
        for (var n = 0; n < str.length; n++) {
            var c = str.charCodeAt(n);
            if (c < 128) utftext += String.fromCharCode(c);
            else if((c>127)&&(c<2048)) utftext += String.fromCharCode((c>>6)|192)+String.fromCharCode((c&63)|128);
            else utftext += String.fromCharCode((c>>12)|224)+String.fromCharCode(((c>>6)&63)|128)+String.fromCharCode((c&63)|128);
        }
        return utftext;
    }

    var x = ConvertToWordArray(Utf8Encode(string));
    var a=0x67452301, b=0xEFCDAB89, c=0x98BADCFE, d=0x10325476;
    var S11=7, S12=12, S13=17, S14=22;
    var S21=5, S22=9 , S23=14, S24=20;
    var S31=4, S32=11, S33=16, S34=23;
    var S41=6, S42=10, S43=15, S44=21;
    for(var k=0;k<x.length;k+=16) {
        var AA=a,BB=b,CC=c,DD=d;
        a=FF(a,b,c,d,x[k+0], S11,0xD76AA478);
        d=FF(d,a,b,c,x[k+1], S12,0xE8C7B756);
        c=FF(c,d,a,b,x[k+2], S13,0x242070DB);
        b=FF(b,c,d,a,x[k+3], S14,0xC1BDCEEE);
        a=FF(a,b,c,d,x[k+4], S11,0xF57C0FAF);
        d=FF(d,a,b,c,x[k+5], S12,0x4787C62A);
        c=FF(c,d,a,b,x[k+6], S13,0xA8304613);
        b=FF(b,c,d,a,x[k+7], S14,0xFD469501);
        a=FF(a,b,c,d,x[k+8], S11,0x698098D8);
        d=FF(d,a,b,c,x[k+9], S12,0x8B44F7AF);
        c=FF(c,d,a,b,x[k+10],S13,0xFFFF5BB1);
        b=FF(b,c,d,a,x[k+11],S14,0x895CD7BE);
        a=FF(a,b,c,d,x[k+12],S11,0x6B901122);
        d=FF(d,a,b,c,x[k+13],S12,0xFD987193);
        c=FF(c,d,a,b,x[k+14],S13,0xA679438E);
        b=FF(b,c,d,a,x[k+15],S14,0x49B40821);
        a=GG(a,b,c,d,x[k+1], S21,0xF61E2562);
        d=GG(d,a,b,c,x[k+6], S22,0xC040B340);
        c=GG(c,d,a,b,x[k+11],S23,0x265E5A51);
        b=GG(b,c,d,a,x[k+0], S24,0xE9B6C7AA);
        a=GG(a,b,c,d,x[k+5], S21,0xD62F105D);
        d=GG(d,a,b,c,x[k+10],S22,0x02441453);
        c=GG(c,d,a,b,x[k+15],S23,0xD8A1E681);
        b=GG(b,c,d,a,x[k+4], S24,0xE7D3FBC8);
        a=GG(a,b,c,d,x[k+9], S21,0x21E1CDE6);
        d=GG(d,a,b,c,x[k+14],S22,0xC33707D6);
        c=GG(c,d,a,b,x[k+3], S23,0xF4D50D87);
        b=GG(b,c,d,a,x[k+8], S24,0x455A14ED);
        a=GG(a,b,c,d,x[k+13],S21,0xA9E3E905);
        d=GG(d,a,b,c,x[k+2], S22,0xFCEFA3F8);
        c=GG(c,d,a,b,x[k+7], S23,0x676F02D9);
        b=GG(b,c,d,a,x[k+12],S24,0x8D2A4C8A);
        a=HH(a,b,c,d,x[k+5], S31,0xFFFA3942);
        d=HH(d,a,b,c,x[k+8], S32,0x8771F681);
        c=HH(c,d,a,b,x[k+11],S33,0x6D9D6122);
        b=HH(b,c,d,a,x[k+14],S34,0xFDE5380C);
        a=HH(a,b,c,d,x[k+1], S31,0xA4BEEA44);
        d=HH(d,a,b,c,x[k+4], S32,0x4BDECFA9);
        c=HH(c,d,a,b,x[k+7], S33,0xF6BB4B60);
        b=HH(b,c,d,a,x[k+10],S34,0xBEBFBC70);
        a=HH(a,b,c,d,x[k+13],S31,0x289B7EC6);
        d=HH(d,a,b,c,x[k+0], S32,0xEAA127FA);
        c=HH(c,d,a,b,x[k+3], S33,0xD4EF3085);
        b=HH(b,c,d,a,x[k+6], S34,0x04881D05);
        a=HH(a,b,c,d,x[k+9], S31,0xD9D4D039);
        d=HH(d,a,b,c,x[k+12],S32,0xE6DB99E5);
        c=HH(c,d,a,b,x[k+15],S33,0x1FA27CF8);
        b=HH(b,c,d,a,x[k+2], S34,0xC4AC5665);
        a=II(a,b,c,d,x[k+0], S41,0xF4292244);
        d=II(d,a,b,c,x[k+7], S42,0x432AFF97);
        c=II(c,d,a,b,x[k+14],S43,0xAB9423A7);
        b=II(b,c,d,a,x[k+5], S44,0xFC93A039);
        a=II(a,b,c,d,x[k+12],S41,0x655B59C3);
        d=II(d,a,b,c,x[k+3], S42,0x8F0CCC92);
        c=II(c,d,a,b,x[k+10],S43,0xFFEFF47D);
        b=II(b,c,d,a,x[k+1], S44,0x85845DD1);
        a=II(a,b,c,d,x[k+8], S41,0x6FA87E4F);
        d=II(d,a,b,c,x[k+15],S42,0xFE2CE6E0);
        c=II(c,d,a,b,x[k+6], S43,0xA3014314);
        b=II(b,c,d,a,x[k+13],S44,0x4E0811A1);
        a=II(a,b,c,d,x[k+4], S41,0xF7537E82);
        d=II(d,a,b,c,x[k+11],S42,0xBD3AF235);
        c=II(c,d,a,b,x[k+2], S43,0x2AD7D2BB);
        b=II(b,c,d,a,x[k+9], S44,0xEB86D391);
        a=AddUnsigned(a,AA); b=AddUnsigned(b,BB); c=AddUnsigned(c,CC); d=AddUnsigned(d,DD);
    }
    return (WordToHex(a)+WordToHex(b)+WordToHex(c)+WordToHex(d)).toLowerCase();
}
