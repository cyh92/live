// CCTV直播/回看获取脚本 (酷9 JS版本)
// 支持直播和回看(通过playseek参数)

// 频道映射表
var channelMap = {
    'cctv1': ['2024078201', '600001859', 'shd'],     // CCTV-1高清
    'cctv2': ['2024075401', '600001800', 'fhd'],     // CCTV-2高清
    'cctv3': ['2024068501', '600001801', 'fhd'],     // CCTV-3高清
    'cctv4': ['2029797101', '600001814', 'fhd'],     // CCTV-4高清
    'cctv5': ['2024078401', '600001818', 'fhd'],     // CCTV-5高清
    'cctv5p': ['2024078001', '600001817', 'fhd'],    // CCTV-5+高清
    'cctv6': ['2013693901', '600108442', 'fhd'],     // CCTV-6高清
    'cctv7': ['2024072001', '600004092', 'fhd'],     // CCTV-7高清
    'cctv8': ['2029793001', '600001803', 'fhd'],     // CCTV-8高清
    'cctv9': ['2024078601', '600004078', 'fhd'],     // CCTV-9高清
    'cctv10': ['2024078701', '600001805', 'fhd'],    // CCTV-10高清
    'cctv11': ['2027248701', '600001806', 'fhd'],    // CCTV-11高清
    'cctv12': ['2027248801', '600001807', 'fhd'],    // CCTV-12高清
    'cctv13': ['2029797201', '600001811', 'fhd'],    // CCTV-13高清
    'cctv14': ['2027248901', '600001809', 'fhd'],    // CCTV-14高清
    'cctv15': ['2027249001', '600001815', 'fhd'],    // CCTV-15高清
    'cctv16': ['2027249101', '600098637', 'fhd'],    // CCTV-16高清
    'cctv164k': ['2027249301', '600099502', 'fhd'],  // CCTV-16(4K)
    'cctv17': ['2027249401', '600001810', 'fhd'],    // CCTV-17高清
    'cctv4k': ['2029810301', '600002264', 'fhd'],    // CCTV-4K
    'cctv8k': ['2026774101', '600156816', 'fhd'],    // CCTV-8K
    'cgtn': ['2024181701', '600014550', 'fhd'],      // CGTN
    'cgtnfy': ['2024181801', '600084704', 'fhd'],    // CGTN法语
    'cgtney': ['2024181901', '600084758', 'fhd'],    // CGTN俄语
    'cgtnalby': ['2024182001', '600084782', 'fhd'],  // CGTN阿拉伯语
    'cgtnxby': ['2024182101', '600084744', 'fhd'],   // CGTN西班牙语
    'cgtnwyjl': ['2024182301', '600084781', 'fhd'],  // CGTN外语纪录
    'cctvfyjc': ['2025637103', '600099658', 'shd'],  // CCTV风云剧场
    'cctvdyjc': ['2026874203', '600099655', 'shd'],  // CCTV第一剧场
    'cctvhjjc': ['2026874303', '600099620', 'shd'],  // CCTV怀旧剧场
    'cctvsjdl': ['2026874403', '600099637', 'shd'],  // CCTV世界地理
    'cctvfyyy': ['2026874503', '600099660', 'shd'],  // CCTV风云音乐
    'cctvbqkj': ['2026874603', '600099649', 'shd'],  // CCTV兵器科技
    'cctvfyzq': ['2026966203', '600099636', 'shd'],  // CCTV风云足球
    'cctvgeqwq': ['2026874703', '600099659', 'shd'], // CCTV高尔夫网球
    'cctvnxss': ['2026874803', '600099650', 'shd'],  // CCTV女性时尚
    'cctvyswhjp': ['2026874903', '600099653', 'shd'],// CCTV文化精品
    'cctvystq': ['2026875003', '600099652', 'shd'],  // CCTV台球
    'cctvdszn': ['2026875103', '600099656', 'shd'],  // CCTV电视指南
    'cctvwsjk': ['2025637003', '600099651', 'shd'],  // CCTV卫生健康
    'bjws': ['2024052703', '600002309', 'fhd'],      // 北京卫视
    'jsws': ['2024171103', '600002521', 'fhd'],      // 江苏卫视
    'dfws': ['2024054503', '600002483', 'fhd'],      // 东方卫视
    'zjws': ['2024054703', '600002520', 'fhd'],      // 浙江卫视
    'hnws': ['2024054803', '600002475', 'fhd'],      // 湖南卫视
    'hbws': ['2024171203', '600002508', 'fhd'],      // 湖北卫视
    'gdws': ['2024060903', '600002485', 'fhd'],      // 广东卫视
    'gxws': ['2024060703', '600002509', 'fhd'],      // 广西卫视
    'hljws': ['2029797003', '600002498', 'fhd'],     // 黑龙江卫视
    'hnws2': ['2024055603', '600002506', 'fhd'],     // 海南卫视
    'cqws': ['2024061103', '600002531', 'fhd'],      // 重庆卫视
    'szws': ['2024061303', '600002481', 'fhd'],      // 深圳卫视
    'scws': ['2024061403', '600002516', 'fhd'],      // 四川卫视
    'henanws': ['2029797303', '600002525', 'fhd'],   // 河南卫视
    'fjdnhz': ['2024061503', '600002484', 'fhd'],    // 福建东南卫视
    'gzhws': ['2024061603', '600002490', 'fhd'],     // 贵州卫视
    'jxws': ['2024061703', '600002503', 'fhd'],      // 江西卫视
    'lnws': ['2024171303', '600002505', 'fhd'],      // 辽宁卫视
    'ahws': ['2024171403', '600002532', 'fhd'],      // 安徽卫视
    'hbws2': ['2024171503', '600002493', 'fhd'],     // 河北卫视
    'sdws': ['2029787903', '600002513', 'fhd'],      // 山东卫视
    'tjws': ['2019927003', '600152137', 'fhd'],      // 天津卫视
    'jlws': ['2025561503', '600190405', 'fhd'],      // 吉林卫视
    'shanxiws': ['2029795103', '600190400', 'fhd'],  // 陕西卫视
    'nxws': ['2025608503', '600190737', 'fhd'],      // 宁夏卫视
    'nmgws': ['2025561203', '600190401', 'fhd'],     // 内蒙古卫视
    'ynws': ['2025561303', '600190402', 'fhd'],      // 云南卫视
    'shanxiws2': ['2025560803', '600190407', 'fhd'], // 山西卫视
    'qhws': ['2025559103', '600190406', 'fhd'],      // 青海卫视
    'xzws': ['2025558003', '600190403', 'fhd'],      // 西藏卫视
    'cetv1': ['2022823801', '600171827', 'fhd'],     // 中国教育1
    'gxpd': ['2029360403', '600213139', 'fhd'],      // 国学频道
    'btws': ['2025990501', '600193252', 'fhd'],      // 兵团卫视
    'xjws': ['2019927403', '600152138', 'fhd']       // 新疆卫视
};

// ==================== TEA加密相关常量 ====================
var TEA_DELTA = 0x9e3779b9;
var TEA_ROUNDS = 16;
var TEA_CKEY = '59b2f7cf725ef43c34fdd7c123411ed3';
var GUARD_TEA_KEY = '110DBEC10C23E7D2E56A1CAD6914EF1B';
var XOR_KEY = [0x84, 0x2E, 0xED, 0x08, 0xF0, 0x66, 0xE6, 0xEA, 0x48, 0xB4, 0xCA, 0xA9, 0x91, 0xED, 0x6F, 0xF3];
var GUARD_XOR_KEY = [0xB3, 0xC9, 0x53, 0xA0, 0x69, 0x13, 0xAD, 0x4D];
var CUSTOM_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-=';
var STANDARD_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

// ==================== 工具函数 ====================

// 生成随机十六进制字符串
function randomHexStr(length) {
    var hex = '';
    for (var i = 0; i < length; i++) {
        hex += Math.floor(Math.random() * 16).toString(16);
    }
    return hex.toUpperCase();
}

// 生成随机GUID (32位十六进制)
function generateGuid() {
    var guid = '';
    for (var i = 0; i < 32; i++) {
        guid += Math.floor(Math.random() * 16).toString(16);
    }
    return guid;
}

// 生成UUID v4
function generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0;
        var v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// 计算签名 (与PHP calcSignature一致)
function calcSignature(buffer) {
    var signature = 0;
    for (var i = 0; i < buffer.length; i++) {
        signature = (0x83 * signature + (buffer[i] & 0xFF)) & 0x7FFFFFFF;
    }
    return signature;
}

// 自定义Base64解码 (URL-safe)
function customDecode(text) {
    if (!text) return '';
    text = text.replace(/-/g, '+').replace(/_/g, '/');
    while (text.length % 4) {
        text += '=';
    }
    return ku9.decodeBase64(text);
}

// 自定义Base64编码 (URL-safe)
function customEncode(text) {
    var encoded = ku9.encodeBase64(text);
    return encoded.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// XOR加密/解密
function xorArray(bytes) {
    var result = [];
    for (var i = 0; i < bytes.length; i++) {
        result.push(bytes[i] ^ XOR_KEY[i & 0xF]);
    }
    return result;
}

// 字节数组转字符串 (用于TEA)
function bytesToString(bytes) {
    var str = '';
    for (var i = 0; i < bytes.length; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return str;
}

// 字符串转字节数组
function stringToBytes(str) {
    var bytes = [];
    for (var i = 0; i < str.length; i++) {
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
}

// 十六进制字符串转字节数组
function hexToBytes(hex) {
    var bytes = [];
    for (var i = 0; i < hex.length; i += 2) {
        bytes.push(parseInt(hex.substr(i, 2), 16));
    }
    return bytes;
}

// 字节数组转十六进制字符串
function bytesToHex(bytes) {
    var hex = '';
    for (var i = 0; i < bytes.length; i++) {
        var h = bytes[i].toString(16);
        if (h.length === 1) h = '0' + h;
        hex += h;
    }
    return hex;
}

// 打包为N字节大端整数
function packN(value) {
    var bytes = [];
    bytes.push((value >> 24) & 0xFF);
    bytes.push((value >> 16) & 0xFF);
    bytes.push((value >> 8) & 0xFF);
    bytes.push(value & 0xFF);
    return bytes;
}

// 打包为n字节大端整数
function packn(value) {
    var bytes = [];
    bytes.push((value >> 8) & 0xFF);
    bytes.push(value & 0xFF);
    return bytes;
}

// 解包N字节大端整数
function unpackN(bytes, offset) {
    offset = offset || 0;
    return ((bytes[offset] || 0) << 24) | ((bytes[offset+1] || 0) << 16) | 
           ((bytes[offset+2] || 0) << 8) | (bytes[offset+3] || 0);
}

// 解包n字节大端整数
function unpackn(bytes, offset) {
    offset = offset || 0;
    return ((bytes[offset] || 0) << 8) | (bytes[offset+1] || 0);
}

// 数组拼接
function concatArrays(arr1, arr2) {
    var result = arr1.slice();
    for (var i = 0; i < arr2.length; i++) {
        result.push(arr2[i]);
    }
    return result;
}

// ==================== TEA加密函数 ====================

// TEA ECB加密 (与PHP teaEncryptECB一致)
function teaEncryptECB(inBuf, key) {
    if (inBuf.length < 8) {
        var pad = [];
        for (var i = 0; i < 8 - inBuf.length; i++) pad.push(0);
        inBuf = concatArrays(inBuf, pad);
    }
    
    var y = unpackN(inBuf, 0);
    var z = unpackN(inBuf, 4);
    
    var k = [
        unpackN(key, 0),
        unpackN(key, 4),
        unpackN(key, 8),
        unpackN(key, 12)
    ];
    
    var sum = 0;
    for (var i = 0; i < TEA_ROUNDS; i++) {
        sum = (sum + TEA_DELTA) & 0xFFFFFFFF;
        y = (y + ((((z << 4) & 0xFFFFFFFF) + k[0]) ^ (z + sum) ^ (((z >> 5) & 0xFFFFFFFF) + k[1]))) & 0xFFFFFFFF;
        z = (z + ((((y << 4) & 0xFFFFFFFF) + k[2]) ^ (y + sum) ^ (((y >> 5) & 0xFFFFFFFF) + k[3]))) & 0xFFFFFFFF;
    }
    
    return concatArrays(packN(y), packN(z));
}

// TEA ECB解密 (与PHP teaDecryptECB一致)
function teaDecryptECB(inBuf, key) {
    var y = unpackN(inBuf, 0);
    var z = unpackN(inBuf, 4);
    
    var k = [
        unpackN(key, 0),
        unpackN(key, 4),
        unpackN(key, 8),
        unpackN(key, 12)
    ];
    
    var sum = (TEA_DELTA << 4) & 0xFFFFFFFF;
    
    for (var i = 0; i < TEA_ROUNDS; i++) {
        z = (z - ((((y << 4) & 0xFFFFFFFF) + k[2]) ^ (y + sum) ^ (((y >> 5) & 0xFFFFFFFF) + k[3]))) & 0xFFFFFFFF;
        y = (y - ((((z << 4) & 0xFFFFFFFF) + k[0]) ^ (z + sum) ^ (((z >> 5) & 0xFFFFFFFF) + k[1]))) & 0xFFFFFFFF;
        sum = (sum - TEA_DELTA) & 0xFFFFFFFF;
    }
    
    return concatArrays(packN(y), packN(z));
}

// CBC模式加密 (简化版，与PHP oiSymmetryEncrypt2一致)
function oiSymmetryEncrypt2(inBuf, key) {
    var SALT_LEN = 2;
    var ZERO_LEN = 7;
    
    var nInBufLen = inBuf.length;
    var nPadSaltBodyZeroLen = nInBufLen + 1 + SALT_LEN + ZERO_LEN;
    var nPadlen = nPadSaltBodyZeroLen % 8;
    if (nPadlen) {
        nPadlen = 8 - nPadlen;
    }
    
    var srcBuf = [];
    for (var i = 0; i < 8; i++) srcBuf.push(0);
    srcBuf[0] = (Math.floor(Math.random() * 256) & 0xF8) | nPadlen;
    var srcI = 1;
    
    while (nPadlen > 0) {
        srcBuf[srcI] = Math.floor(Math.random() * 256);
        srcI++;
        nPadlen--;
    }
    
    var ivPlain = [0,0,0,0,0,0,0,0];
    var ivCrypt = [0,0,0,0,0,0,0,0];
    var outBuf = [];
    
    // Salt
    var i = 0;
    while (i < SALT_LEN) {
        if (srcI < 8) {
            srcBuf[srcI] = Math.floor(Math.random() * 256);
            srcI++;
            i++;
        }
        if (srcI === 8) {
            for (var j = 0; j < 8; j++) srcBuf[j] ^= ivCrypt[j];
            var tempOut = teaEncryptECB(srcBuf, key);
            for (var j = 0; j < 8; j++) tempOut[j] ^= ivPlain[j];
            ivPlain = srcBuf.slice();
            ivCrypt = tempOut.slice();
            outBuf = concatArrays(outBuf, tempOut);
            srcBuf = [0,0,0,0,0,0,0,0];
            srcI = 0;
        }
    }
    
    // 主体数据
    var inIndex = 0;
    while (nInBufLen > 0) {
        if (srcI < 8) {
            srcBuf[srcI] = inBuf[inIndex];
            inIndex++;
            srcI++;
            nInBufLen--;
        }
        if (srcI === 8) {
            for (var j = 0; j < 8; j++) srcBuf[j] ^= ivCrypt[j];
            var tempOut = teaEncryptECB(srcBuf, key);
            for (var j = 0; j < 8; j++) tempOut[j] ^= ivPlain[j];
            ivPlain = srcBuf.slice();
            ivCrypt = tempOut.slice();
            outBuf = concatArrays(outBuf, tempOut);
            srcBuf = [0,0,0,0,0,0,0,0];
            srcI = 0;
        }
    }
    
    // Zero填充
    i = 0;
    while (i < ZERO_LEN) {
        if (srcI < 8) {
            srcBuf[srcI] = 0;
            srcI++;
            i++;
        }
        if (srcI === 8) {
            for (var j = 0; j < 8; j++) srcBuf[j] ^= ivCrypt[j];
            var tempOut = teaEncryptECB(srcBuf, key);
            for (var j = 0; j < 8; j++) tempOut[j] ^= ivPlain[j];
            ivPlain = srcBuf.slice();
            ivCrypt = tempOut.slice();
            outBuf = concatArrays(outBuf, tempOut);
            srcBuf = [0,0,0,0,0,0,0,0];
            srcI = 0;
        }
    }
    
    // 最后一组
    if (srcI > 0) {
        for (var j = srcI; j < 8; j++) srcBuf[j] = 0;
        for (var j = 0; j < 8; j++) srcBuf[j] ^= ivCrypt[j];
        var tempOut = teaEncryptECB(srcBuf, key);
        for (var j = 0; j < 8; j++) tempOut[j] ^= ivPlain[j];
        outBuf = concatArrays(outBuf, tempOut);
    }
    
    return outBuf;
}

// CBC模式解密 (简化版)
function oiSymmetryDecrypt2(inBuf, key) {
    var SALT_LEN = 2;
    var ZERO_LEN = 7;
    
    if (inBuf.length % 8 !== 0 || inBuf.length < 16) {
        return null;
    }
    
    // 解密第一个块
    var destBuf = teaDecryptECB(inBuf.slice(0, 8), key);
    var nPadLen = destBuf[0] & 0x07;
    
    var i = inBuf.length - 1;
    i = i - nPadLen - SALT_LEN - ZERO_LEN;
    if (i < 0) return null;
    
    var pOutBufLen = i;
    var ivPreCrypt = [0,0,0,0,0,0,0,0];
    var ivCurCrypt = inBuf.slice(0, 8);
    var inOffset = 8;
    var destI = 1;
    destI += nPadLen;
    
    // Salt
    var saltCount = 1;
    while (saltCount <= SALT_LEN) {
        if (destI < 8) {
            destI++;
            saltCount++;
        } else if (destI === 8) {
            ivPreCrypt = ivCurCrypt.slice();
            ivCurCrypt = inBuf.slice(inOffset, inOffset + 8);
            for (var j = 0; j < 8; j++) {
                if (inOffset + j >= inBuf.length) return null;
                destBuf[j] ^= ivCurCrypt[j];
            }
            destBuf = teaDecryptECB(destBuf, key);
            inOffset += 8;
            destI = 0;
        }
    }
    
    // 还原明文
    var plainBytes = [];
    var nPlainLen = pOutBufLen;
    while (nPlainLen > 0) {
        if (destI < 8) {
            plainBytes.push(destBuf[destI] ^ ivPreCrypt[destI]);
            destI++;
            nPlainLen--;
        } else if (destI === 8) {
            ivPreCrypt = ivCurCrypt.slice();
            ivCurCrypt = inBuf.slice(inOffset, inOffset + 8);
            for (var j = 0; j < 8; j++) {
                if (inOffset + j >= inBuf.length) return null;
                destBuf[j] ^= ivCurCrypt[j];
            }
            destBuf = teaDecryptECB(destBuf, key);
            inOffset += 8;
            destI = 0;
        }
    }
    
    return plainBytes;
}

// ==================== 核心加密函数 ====================

// 生成spvcode
function spvcode(defn) {
    var height = 1080;
    if (/4k|8k|hdr/i.test(defn)) {
        height = 2160;
    }
    var frameRates = [30, 60, 90, 120];
    var h264Parts = [];
    var h265Parts = [];
    for (var i = 0; i < frameRates.length; i++) {
        h264Parts.push(frameRates[i] + ':' + height);
        h265Parts.push(frameRates[i] + ':' + height);
    }
    var spvcodeRaw = 'H(' + h264Parts.join(',') + '|' + h264Parts.join(',') + ');2(' + h265Parts.join(',') + '|' + h265Parts.join(',') + ')';
    return ku9.encodeBase64(spvcodeRaw);
}

// 生成ck_guard_time (与PHP generateCkGuardTime一致)
function generateCkGuardTime(timestamp, guid, guardData, packageName, processName) {
    guardData = guardData || '-1';
    packageName = packageName || 'null';
    processName = processName || 'null';
    
    var body = packN(timestamp);
    var parts = [
        guardLastFive(guid),
        guardLastFive(packageName),
        guardLastFive(processName),
        guardData
    ];
    for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        body = concatArrays(body, packn(p.length));
        for (var j = 0; j < p.length; j++) {
            body.push(p.charCodeAt(j));
        }
    }
    
    var plain = concatArrays(packn(body.length), body);
    var checksum = calcSignature(plain);
    
    var encrypted = oiSymmetryEncrypt2(plain, hexToBytes(GUARD_TEA_KEY));
    var checksumBytes = packN(checksum);
    encrypted = concatArrays(encrypted, checksumBytes);
    
    for (var i = 0; i < encrypted.length; i++) {
        encrypted[i] ^= GUARD_XOR_KEY[i & 7];
    }
    
    return bytesToHex(encrypted);
}

function guardLastFive(value) {
    value = String(value);
    return value.length >= 5 ? value.substr(-5) : '';
}

// 构建数据包 (与PHP buildPacket一致)
function buildPacket(params) {
    var data = [];
    
    // 1. 固定头部
    var header = hexToBytes('0000004200000004000004d2');
    data = concatArrays(data, header);
    
    // 2. Platform
    data = concatArrays(data, packN(params.Platform));
    
    // 3. Signature (占位)
    data = concatArrays(data, [0,0,0,0]);
    
    // 4. Timestamp
    data = concatArrays(data, packN(params.Timestamp));
    
    // 5. Sdtfrom
    var sdtfrom = params.Sdtfrom;
    data = concatArrays(data, packn(sdtfrom.length));
    for (var i = 0; i < sdtfrom.length; i++) data.push(sdtfrom.charCodeAt(i));
    
    // 6. randFlag
    var randFlag = params.randFlag;
    data = concatArrays(data, packn(randFlag.length));
    for (var i = 0; i < randFlag.length; i++) data.push(randFlag.charCodeAt(i));
    
    // 7. appVer
    var appVer = params.appVer;
    data = concatArrays(data, packn(appVer.length));
    for (var i = 0; i < appVer.length; i++) data.push(appVer.charCodeAt(i));
    
    // 8. vid
    var vid = params.vid;
    data = concatArrays(data, packn(vid.length));
    for (var i = 0; i < vid.length; i++) data.push(vid.charCodeAt(i));
    
    // 9. guid
    var guid = params.guid;
    data = concatArrays(data, packn(guid.length));
    for (var i = 0; i < guid.length; i++) data.push(guid.charCodeAt(i));
    
    // 10. part1
    data = concatArrays(data, packN(1));
    
    // 11. isDlna
    data = concatArrays(data, packN(1));
    
    // 12. uid
    var uid = "2622783A";
    data = concatArrays(data, packn(uid.length));
    for (var i = 0; i < uid.length; i++) data.push(uid.charCodeAt(i));
    
    // 13. bundleID
    var bundleID = "nil";
    data = concatArrays(data, packn(bundleID.length));
    for (var i = 0; i < bundleID.length; i++) data.push(bundleID.charCodeAt(i));
    
    // 14. uuid4
    var uuid4 = params.uuid4;
    data = concatArrays(data, packn(uuid4.length));
    for (var i = 0; i < uuid4.length; i++) data.push(uuid4.charCodeAt(i));
    
    // 15. bundleID1
    data = concatArrays(data, packn(bundleID.length));
    for (var i = 0; i < bundleID.length; i++) data.push(bundleID.charCodeAt(i));
    
    // 16. ckeyVersion
    var ckeyVersion = "v0.1.000";
    data = concatArrays(data, packn(ckeyVersion.length));
    for (var i = 0; i < ckeyVersion.length; i++) data.push(ckeyVersion.charCodeAt(i));
    
    // 17. packageName
    var packageName = "com.cctv.yangshipin.app.iphone";
    data = concatArrays(data, packn(packageName.length));
    for (var i = 0; i < packageName.length; i++) data.push(packageName.charCodeAt(i));
    
    // 18. platform_str
    var platformStr = "4330403";
    data = concatArrays(data, packn(platformStr.length));
    for (var i = 0; i < platformStr.length; i++) data.push(platformStr.charCodeAt(i));
    
    // 19. ex_json_bus
    var exJsonBus = "ex_json_bus";
    data = concatArrays(data, packn(exJsonBus.length));
    for (var i = 0; i < exJsonBus.length; i++) data.push(exJsonBus.charCodeAt(i));
    
    // 20. ex_json_vs
    var exJsonVs = "ex_json_vs";
    data = concatArrays(data, packn(exJsonVs.length));
    for (var i = 0; i < exJsonVs.length; i++) data.push(exJsonVs.charCodeAt(i));
    
    // 21. ck_guard_time
    var ckGuardTime = params.ck_guard_time;
    data = concatArrays(data, packn(ckGuardTime.length));
    for (var i = 0; i < ckGuardTime.length; i++) data.push(ckGuardTime.charCodeAt(i));
    
    var bodyLength = data.length;
    var buffer = concatArrays(packn(bodyLength), data);
    
    var signature = calcSignature(buffer);
    
    // 更新签名位置 (跳过长度头2字节+头部12字节+Platform4字节=18字节)
    buffer[18] = (signature >> 24) & 0xFF;
    buffer[19] = (signature >> 16) & 0xFF;
    buffer[20] = (signature >> 8) & 0xFF;
    buffer[21] = signature & 0xFF;
    
    return buffer;
}

// 生成cKey
function generateCKey(cnlid, timestamp, guid) {
    if (!timestamp) timestamp = Math.floor(Date.now() / 1000);
    if (!guid) guid = generateGuid();
    
    var randFlag = '_zj1A5Gh6QYcxWjIUGos2w==';
    var uuid4 = '57eab0c4-2c58-44c6-8ae9-dd2757525dc5';
    var ckGuardTime = generateCkGuardTime(timestamp, guid);
    
    var params = {
        Platform: 4330403,
        Timestamp: timestamp,
        Sdtfrom: 'dcgh',
        vid: cnlid,
        guid: guid,
        appVer: 'V8.22.1035.3031',
        randFlag: randFlag,
        uuid4: uuid4,
        ck_guard_time: ckGuardTime
    };
    
    var buffer = buildPacket(params);
    var ckey = encryptDataToCKey(buffer);
    
    return {
        ckey: ckey,
        params: params,
        buffer: buffer
    };
}

// 加密数据生成cKey
function encryptDataToCKey(data) {
    var teaCkey = hexToBytes(TEA_CKEY);
    var checksum = calcSignature(data);
    var encrypted = oiSymmetryEncrypt2(data, teaCkey);
    var checksumBytes = packN(checksum);
    encrypted = concatArrays(encrypted, checksumBytes);
    var xorEncrypted = xorArray(encrypted);
    var base64Encoded = customEncode(bytesToString(xorEncrypted));
    return "--01" + base64Encoded;
}

// ==================== 主请求函数 ====================

function makeLiveRequest(cnlid, livepid, defn, playseek) {
    livepid = livepid || '600001859';
    defn = defn || 'fhd';
    
    var guid = generateGuid();
    var timestamp = Math.floor(Date.now() / 1000);
    
    var ckeyResult = generateCKey(cnlid, timestamp, guid);
    var ckey = ckeyResult.ckey;
    var params = ckeyResult.params;
    
    var flowid = generateUUID() + '_' + 4330403;
    
    var isPlayback = playseek && playseek.length > 0;
    var playbackTimestamp = null;
    
    if (isPlayback) {
        var parts = playseek.split('-');
        if (parts.length === 2) {
            var startStr = parts[0];
            // 解析 YYYYMMDDHHMMSS 格式
            var year = parseInt(startStr.substr(0, 4));
            var month = parseInt(startStr.substr(4, 2)) - 1;
            var day = parseInt(startStr.substr(6, 2));
            var hour = parseInt(startStr.substr(8, 2));
            var minute = parseInt(startStr.substr(10, 2));
            var second = parseInt(startStr.substr(12, 2));
            playbackTimestamp = Math.floor(new Date(year, month, day, hour, minute, second).getTime() / 1000);
        }
    }
    
    var spvcodeStr = spvcode(defn);
    
    var requestParams = {
        "atime": "120",
        "livepid": livepid,
        "cnlid": cnlid,
        "appVer": "V8.22.1035.3031",
        "app_version": "300090",
        "caplv": "1",
        "cmd": "2",
        "defn": defn,
        "device": "iPhone",
        "encryptVer": "4.2",
        "getpreviewinfo": "0",
        "hevclv": "33",
        "lang": "zh-Hans_JP",
        "livequeue": "0",
        "logintype": "1",
        "nettype": "1",
        "newnettype": "1",
        "newplatform": "4330403",
        "platform": "4330403",
        "sdtfrom": "v3021",
        "spacode": "23",
        "spaudio": "1",
        "spdemuxer": "6",
        "spdrm": "2",
        "spdynamicrange": "7",
        "spflv": "1",
        "spflvaudio": "1",
        "sphdrfps": "60",
        "sphttps": "0",
        "spvcode": spvcodeStr,
        "spvideo": "4",
        "stream": "1",
        "system": "1",
        "sysver": "ios18.2.1",
        "uhd_flag": "4",
        "cKey": ckey,
        "guid": guid,
        "fntick": params.Timestamp,
        "flowid": flowid
    };
    
    if (isPlayback) {
        requestParams["playbacktime"] = playbackTimestamp;
    } else {
        requestParams["playbacktime"] = "0";
    }
    
    // 构建URL并发送请求
    var url = "https://bkliveinfo.ysp.cctv.cn?" + buildQueryString(requestParams);
    
    try {
        var response = ku9.get(url, { 'User-Agent': 'qqlive' });
        var data = JSON.parse(response);
        
        if (data.iretcode === 0 && data.playurl) {
            var playurl = data.playurl;
            
            // 如果是回看，需要处理URL
            if (isPlayback) {
                // 检查是否返回了有效地址，如果无效则重试(不带playbacktime)
                var urlParts = playurl.split('/');
                if (urlParts.length >= 3) {
                    urlParts[2] = 'tlivecloud-playback-cdn.ysp.cctv.cn/tcloud.cctv.com';
                    playurl = urlParts.join('/');
                    if (playurl.indexOf('?') !== -1) {
                        playurl += '&starttime=' + playbackTimestamp;
                    } else {
                        playurl += '?starttime=' + playbackTimestamp;
                    }
                }
            }
            
            return {
                success: true,
                playurl: playurl,
                response: data
            };
        } else {
            // 如果是回看且第一次失败，尝试不带playbacktime
            if (isPlayback) {
                delete requestParams.playbacktime;
                var url2 = "https://bkliveinfo.ysp.cctv.cn?" + buildQueryString(requestParams);
                var response2 = ku9.get(url2, { 'User-Agent': 'qqlive' });
                var data2 = JSON.parse(response2);
                
                if (data2.iretcode === 0 && data2.playurl) {
                    var playurl2 = data2.playurl;
                    var urlParts2 = playurl2.split('/');
                    if (urlParts2.length >= 3) {
                        urlParts2[2] = 'tlivecloud-playback-cdn.ysp.cctv.cn/tcloud.cctv.com';
                        playurl2 = urlParts2.join('/');
                        if (playurl2.indexOf('?') !== -1) {
                            playurl2 += '&starttime=' + playbackTimestamp;
                        } else {
                            playurl2 += '?starttime=' + playbackTimestamp;
                        }
                    }
                    return {
                        success: true,
                        playurl: playurl2,
                        response: data2
                    };
                }
            }
            
            return {
                success: false,
                error: data.errinfo || '获取失败',
                iretcode: data.iretcode
            };
        }
    } catch (e) {
        return {
            success: false,
            error: '请求异常: ' + e.message
        };
    }
}

// 构建查询字符串
function buildQueryString(params) {
    var parts = [];
    for (var key in params) {
        if (params.hasOwnProperty(key)) {
            parts.push(encodeURIComponent(key) + '=' + encodeURIComponent(params[key]));
        }
    }
    return parts.join('&');
}

// 获取播放地址
function getPlayUrl(cnlid, livepid, defn, playseek) {
    var result = makeLiveRequest(cnlid, livepid, defn, playseek);
    if (result.success) {
        return result.playurl;
    }
    return null;
}

// ==================== 主入口函数 ====================

function main(item) {
    // 从item中获取参数
    var url = item.url || '';
    var id = ku9.getQuery(url, 'id') || 'cctv1';
    var playseek = ku9.getQuery(url, 'playseek') || null;
    
    // 检查频道是否存在
    if (!channelMap[id]) {
        return { url: 'error: 未知频道 ' + id };
    }
    
    var channel = channelMap[id];
    var cnlid = channel[0];
    var livepid = channel[1];
    var defn = channel[2];
    
    // 判断是否为回看
    var isLive = !playseek || playseek === '';
    var maxAttempts = 2;
    var playUrl = null;
    var m3u8Content = null;
    var baseUrl = null;
    
    // 缓存key (仅直播)
    var cacheKey = 'cctv_' + id;
    
    for (var attempt = 1; attempt <= maxAttempts; attempt++) {
        var needRefresh = true;
        
        // 直播且第一次尝试检查缓存
        if (attempt === 1 && isLive) {
            var cached = ku9.getCache(cacheKey);
            if (cached) {
                try {
                    var cacheData = JSON.parse(cached);
                    var now = Math.floor(Date.now() / 1000);
                    if ((now - cacheData.time) <= 80) { // 80秒缓存
                        needRefresh = false;
                        playUrl = cacheData.url;
                    }
                } catch (e) {}
            }
        }
        
        if (needRefresh) {
            playUrl = getPlayUrl(cnlid, livepid, defn, playseek);
            if (!playUrl) {
                if (attempt === 1 && isLive) {
                    // 清除缓存
                    ku9.setCache(cacheKey, '', 0);
                }
                continue;
            }
            
            // 直播更新缓存
            if (isLive) {
                var cacheData = JSON.stringify({
                    url: playUrl,
                    time: Math.floor(Date.now() / 1000)
                });
                ku9.setCache(cacheKey, cacheData, 3600000); // 1小时缓存
            } else {
                // 回看直接返回地址 (带webview播放)
                return { url: playUrl };
            }
        }
        
        // 获取M3U8内容 (仅直播)
        try {
            m3u8Content = ku9.get(playUrl);
            if (m3u8Content && m3u8Content.indexOf('#EXTM3U') !== -1) {
                break;
            }
        } catch (e) {
            m3u8Content = null;
        }
        
        // 获取失败，清除缓存重试
        if (attempt === 1 && isLive && !needRefresh) {
            ku9.setCache(cacheKey, '', 0);
        }
    }
    
    if (!m3u8Content || m3u8Content.indexOf('#EXTM3U') === -1) {
        return { url: 'error: 无法获取直播流' };
    }
    
    // 处理M3U8内容
    var lastSlash = playUrl.lastIndexOf('/');
    baseUrl = playUrl.substring(0, lastSlash + 1);
    
    // 替换TS分片路径
    m3u8Content = m3u8Content.replace(/(.*?.ts)/gi, function(match) {
        if (match.indexOf('http://') === 0 || match.indexOf('https://') === 0) {
            return match;
        }
        return baseUrl + match;
    });
    
    // 插入刷新标签
    var refreshTag = '#EXT-X-REFRESH:40\n';
    if (m3u8Content.indexOf('#EXTM3U') === 0) {
        m3u8Content = '#EXTM3U\n' + refreshTag + m3u8Content.substring('#EXTM3U\n'.length);
    } else {
        m3u8Content = '#EXTM3U\n' + refreshTag + m3u8Content;
    }
    
    // 强制分片时长不超过30秒
    m3u8Content = m3u8Content.replace(/#EXTINF:(\d+\.?\d*),/g, function(match, duration) {
        var t = parseFloat(duration);
        if (t > 30) {
            return '#EXTINF:30.000,';
        }
        return match;
    });
    
    // 返回M3U8内容
    return { m3u8: m3u8Content };
}