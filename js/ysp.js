function main(item) {
    var url = item.url || '';
    var id = ku9.getQuery(url, 'id') || 'cctv1';
    
    // 直接使用已知的直播源
    var sources = {
        'cctv1': 'https://cctv1-hls.cctv.com/cctv1.m3u8',
        'cctv13': 'https://cctv13-hls.cctv.com/cctv13.m3u8',
        // 添加更多...
    };
    
    if (sources[id]) {
        return {
            parse: 0,
            url: sources[id]
        };
    }
    
    return { url: 'error: 未找到频道' };
}