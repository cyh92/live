function main(item) {
    // 获取id参数
    var id = ku9.getQuery(item.url, "id");
    
    // 如果没有提供id参数，默认使用hbws
    if (!id || id === "") {
        id = "hbws";
    }
    
    // 频道映射表 - 河北电视台频道
    var channelsMapping = {
        'hbws': 10524916,  // 河北卫视
        'hbjjsh': 10516507,  // 河北经济生活
        'hbsn': 10516508,  // 河北三农频道
        'hbds': 10516509,  // 河北都市
        'hbysj': 10516510,  // 河北影视剧
        'hbse': 10516511,  // 河北少儿科教
        'hbwl': 10516512,  // 河北文旅·公共
        'hbgw': 10516513   // 河北三佳购物
    };
    
    var channelId;
    if (channelsMapping.hasOwnProperty(id)) {
        channelId = channelsMapping[id];
    } else {
        channelId = parseInt(id) || 10524916; // 默认河北卫视
    }
    
    // 获取频道列表API
    var apiUrl = "https://api.cmc.hebtv.com/scms/api/com/article/getArticleList?catalogId=32557&siteId=1";
    
    // 发送网络请求
    var response = ku9.request(apiUrl, "GET");
    
    var streamUrl = "";
    var channelData = null;
    
    if (response.code === 200) {
        try {
            var data = JSON.parse(response.body);
            
            if (data && data.returnData && data.returnData.news) {
                var newsList = data.returnData.news;
                
                // 查找对应ID的频道
                for (var i = 0; i < newsList.length; i++) {
                    var newsItem = newsList[i];
                    if (parseInt(newsItem.id) === parseInt(channelId)) {
                        channelData = newsItem;
                        break;
                    }
                }
                
                if (channelData) {
                    // 提取基础播放地址
                    if (channelData.liveVideo && channelData.liveVideo.length > 0) {
                        var liveVideo = channelData.liveVideo[0];
                        if (liveVideo.formats && liveVideo.formats.length > 0) {
                            var baseUrl = liveVideo.formats[0].url;
                            
                            // 提取签名参数
                            if (channelData.appCustomParams) {
                                var appCustomParams = channelData.appCustomParams;
                                if (appCustomParams.movie) {
                                    var movie = appCustomParams.movie;
                                    var liveUri = movie.liveUri;
                                    var liveKey = movie.liveKey;
                                    
                                    if (liveUri && liveKey) {
                                        // 计算签名 - 当前时间戳 + 7200秒
                                        var t = Math.floor(new Date().getTime() / 1000) + 7200;
                                        var k = ku9.md5(liveUri + liveKey + t);
                                        
                                        // 构造最终播放地址
                                        streamUrl = baseUrl + "?t=" + t + "&k=" + k;
                                    }
                                }
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log("JSON解析错误: " + e.message);
        }
    } else {
        console.log("请求失败，状态码: " + response.code);
    }
    
    // 如果没有找到流地址，尝试备用方案
    if (!streamUrl || streamUrl === "") {
        console.log("未找到流地址，频道ID: " + channelId);
        streamUrl = "";
    }
    
    // 返回播放地址，包含必要的请求头
    return {
        url: streamUrl,
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Referer": "https://api.cmc.hebtv.com/",
            "Accept": "application/json, text/plain, */*",
            "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8"
        }
    };
}

// 测试代码 - 模拟ku9环境
function test() {
    // 模拟ku9对象
    var mockKu9 = {
        getQuery: function(url, param) {
            var regex = new RegExp('[?&]' + param + '=([^&#]*)');
            var results = regex.exec(url);
            return results === null ? '' : decodeURIComponent(results[1]);
        },
        md5: function(str) {
            // 简单的MD5模拟，实际中需要使用完整的MD5实现
            var hash = 0;
            for (var i = 0; i < str.length; i++) {
                var char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash = hash & hash;
            }
            return Math.abs(hash).toString(16);
        },
        request: function(url, method) {
            // 模拟请求响应
            console.log("模拟请求: " + url);
            
            // 这里返回模拟的响应数据
            // 实际使用时需要替换为真实的数据
            return {
                code: 200,
                body: JSON.stringify({
                    returnData: {
                        news: [
                            {
                                id: 10524916,
                                liveVideo: [
                                    {
                                        formats: [
                                            { url: "https://example.com/hbws.m3u8" }
                                        ]
                                    }
                                ],
                                appCustomParams: {
                                    movie: {
                                        liveUri: "hbws",
                                        liveKey: "testkey123"
                                    }
                                }
                            },
                            {
                                id: 10516507,
                                liveVideo: [
                                    {
                                        formats: [
                                            { url: "https://example.com/hbjjsh.m3u8" }
                                        ]
                                    }
                                ],
                                appCustomParams: {
                                    movie: {
                                        liveUri: "hbjjsh",
                                        liveKey: "testkey123"
                                    }
                                }
                            }
                        ]
                    }
                })
            };
        }
    };
    
    // 替换全局ku9对象
    var originalKu9 = ku9;
    ku9 = mockKu9;
    
    // 测试不同的频道ID
    var testCases = [
        { url: "http://test.com/?id=hbws", expected: "https://example.com/hbws.m3u8" },
        { url: "http://test.com/?id=hbjjsh", expected: "https://example.com/hbjjsh.m3u8" },
        { url: "http://test.com/?id=999", expected: "" } // 不存在的频道
    ];
    
    console.log("=== 开始测试 ===");
    for (var i = 0; i < testCases.length; i++) {
        var testCase = testCases[i];
        var result = main({ url: testCase.url });
        
        // 提取实际URL（去掉参数部分以便比较）
        var actualUrl = result.url;
        if (actualUrl && actualUrl.indexOf('?') > -1) {
            actualUrl = actualUrl.split('?')[0];
        }
        
        var passed = (actualUrl === testCase.expected);
        console.log("测试用例 " + (i + 1) + ": " + (passed ? "通过" : "失败"));
        console.log("  输入URL: " + testCase.url);
        console.log("  预期输出: " + testCase.expected);
        console.log("  实际输出: " + (result.url || "空地址"));
    }
    console.log("=== 测试结束 ===");
    
    // 恢复原始ku9对象
    ku9 = originalKu9;
}

// 如果是Node.js环境，可以运行测试
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { main: main };
    
    // 运行测试
    console.log("检测到Node.js环境，运行测试...");
    test();
}