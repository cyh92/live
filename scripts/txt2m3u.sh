#!/bin/bash
set -e

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

# 保存当前分组名称
current_group=""

while IFS= read -r line; do
    [[ -z "${line}" ]] && continue
    [[ "${line}" == \#* ]] && continue

    col1=$(echo "$line" | cut -d',' -f1)
    col2=$(echo "$line" | cut -d',' -f2)

    # 判断分组标记行：xxx,#genre#
    if [[ "${col2}" == "#genre#" ]]; then
        current_group="${col1}"
        continue
    fi

    # 普通频道行
    ch_name="${col1}"
    ch_url="${col2}"

    # 拼接EXTINF，带上分组
    echo "#EXTINF:-1 group-title=\"${current_group}\",${ch_name}" >> "${OUT_FILE}"
    echo "${ch_url}" >> "${OUT_FILE}"
done < "${IN_FILE}"

echo "✅ 转换完成：${OUT_FILE}"
