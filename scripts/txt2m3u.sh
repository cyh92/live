#!/bin/bash
set -e

# 判断参数数量
if [ $# -ne 2 ]; then
    echo "用法: $0 输入.txt 输出.m3u"
    echo "示例: $0 live.txt live.m3u"
    exit 1
fi

IN_FILE="$1"
OUT_FILE="$2"

if [ ! -f "${IN_FILE}" ]; then
    echo "错误：输入文件 ${IN_FILE} 不存在！"
    exit 1
fi

GLOBAL_ATTR='x-tvg-url="https://cnb.cool/my_team/live/-/git/raw/main/playback.xml,https://cyh92.github.io/live/playback.xml,https://gh-proxy.com/https://raw.githubusercontent.com/cyh92/live/refs/heads/main/playback.xml" catchup="append" catchup-source="&playbackbegin=${(b)yyyyMMddHHmmss}&playbackend=${(e)yyyyMMddHHmmss}"'

echo "#EXTM3U ${GLOBAL_ATTR}" > "${OUT_FILE}"

while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    name=$(echo "$line" | cut -d',' -f1)
    url=$(echo "$line" | cut -d',' -f2)
    echo "#EXTINF:-1,${name}" >> "${OUT_FILE}"
    echo "${url}" >> "${OUT_FILE}"
done < "${IN_FILE}"

echo "✅ 转换完成：${OUT_FILE}"
