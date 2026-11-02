#!/bin/zsh
# 渲染前检查：语法 + 乱码（U+FFFD）+ 禁用 API（Math.random / Date.now / new Date 只允许在播放器里）
#   ./tools/lint.sh                      全项目
#   ./tools/lint.sh src/scenes/b05*      只查指定文件/目录（多人同时开发时只查自己的）
cd "$(dirname $0)/.."
setopt NULL_GLOB
bad=0
if [ $# -gt 0 ]; then targets=("$@"); else targets=(src tools docs); fi
jsfiles=()
for t in $targets; do
  if [ -d "$t" ]; then jsfiles+=($t/**/*.js(N) $t/**/*.mjs(N)); elif [[ "$t" == *.js || "$t" == *.mjs ]]; then jsfiles+=($t); fi
done
for f in $jsfiles; do node --check "$f" 2>/dev/null || { echo "SYNTAX $f"; node --check "$f"; bad=1; }; done
if grep -rn $'\xef\xbf\xbd' $targets 2>/dev/null; then echo "GARBLED CHARS FOUND (U+FFFD) ↑ 修掉这些乱码"; bad=1; fi
src_js=(${jsfiles:#src/ui/*})
src_js=(${(M)src_js:#src/*})
if [ ${#src_js} -gt 0 ] && grep -nE "Math\.random\(|Date\.now\(|new Date\(" $src_js; then echo "NON-DETERMINISTIC API ↑ 镜头必须是 T 的纯函数"; bad=1; fi
[ $bad = 0 ] && echo "lint ok"
exit $bad
