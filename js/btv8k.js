// 酷9 JS脚本：获取BTime（北京时间）直播视频流
// 频道地址格式示例：http://127.0.0.1:9978/ku9/js/btime.js?id=bjws

// 频道ID映射表（从原代码提取）
const CHANNEL_MAP = {
    'bjws4k': '5481pu3mib99s696hvtkq65c25n',
    'bjws':   '573ib1kp5nk92irinpumbo9krlb',
    'bjwy':   '54db6gi5vfj8r8q1e6r89imd64s',
    'bjjs':   '53bn9rlalq08lmb8nf8iadoph0b',
    'bjys':   '50mqo8t4n4e8gtarqr3orj9l93v',
    'bjcj':   '50e335k9dq488lb7jo44olp71f5',
    'bjty':   '54hv0f3pq079d4oiil2k12dkvsc',
    'bjsh':   '50j015rjrei9vmp3h8upblr41jf',
    'bjxw':   '53gpt1ephlp86eor6ahtkg5b2hf',
    'bjkk':   '55skfjq618b9kcq9tfjr5qllb7r'
};

/**
 * 酷九主函数
 * @param {Object} item - 包含频道信息，如 item.id、item.url
 * @returns {Object} 返回播放地址对象 { url: '...' }
 */
function main(item) {
    // 1. 获取频道ID（优先从 item.id，其次从 URL 参数解析）
    let id = item.id;
    if (!id) {
        id = ku9.getQuery(item.url, 'id');
    }
    if (!id || !CHANNEL_MAP[id]) {
        // 无效频道ID返回错误地址
        return { url: 'http://error.invalid_channel_id' };
    }

    const channelCode = CHANNEL_MAP[id];
    const timestamp = Math.floor(Date.now() / 1000); // 秒级时间戳

    // 2. 生成第一个MD5（用于token和push_id）
    const token = ku9.md5(timestamp + channelCode);

    // 3. 构造请求参数（固定值从原代码提取）
    const params = {
        browse_mode: '1',
        channel: 'ali',           // 固定
        id: channelCode,
        net: 'WIFI',              // 固定
        os: 'NOX666999',          // 固定
        os_type: 'Android',       // 固定
        os_ver: '33',             // 固定
        push_id: token,
        timestamp: timestamp,
        token: token,
        ver: '100600'             // 固定
    };

    // 4. 拼接查询字符串
    const queryString = Object.keys(params)
        .map(key => key + '=' + params[key])
        .join('&');

    // 5. 生成签名（第二个MD5取第3~10位）
    const SALT = 'shi!@#$%^&*[xian!@#]*';
    const fullSign = ku9.md5(queryString + SALT);
    const sign = fullSign.slice(3, 10); // 索引3~9，共7位

    // 6. 组装最终API请求URL
    const apiUrl = 'https://app.api.btime.com/video/play?' + queryString + '&sign=' + sign;

    // 7. 设置请求头
    const headers = {
        'User-Agent': 'bjtime 100600',
        'Referer': 'android-app.btime.com'
    };

    // 8. 发起网络请求并处理响应
    try {
        const response = ku9.get(apiUrl, headers);
        const json = JSON.parse(response);

        // 检查数据结构是否符合预期
        if (json && json.data && json.data.video_stream && json.data.video_stream.length > 0) {
            const streamUrl = json.data.video_stream[0].stream_url;
            if (streamUrl) {
                return { url: streamUrl };
            }
        }
        // 数据结构不正确
        return { url: 'http://error.no_video_stream' };
    } catch (e) {
        // 请求失败或解析错误
        return { url: 'http://error.request_failed' };
    }
}