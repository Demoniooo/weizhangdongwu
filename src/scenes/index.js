// 各块场景汇总（集成负责人维护，场景作者不要改）。
// 每块单独动态加载：某一块有语法错误只会让那一块空着（控制台报 [block load failed]），不影响其它块和资产模型图。
// ?only=b05,b06 时只加载这些块。单文件打包时由构建入口注入 globalThis.__STATIC_BLOCKS__。
export const BLOCK_NAMES = ["b01_book", "b02_dragon", "b03_oath", "b04_ask", "b05_names", "b06_title", "b07_journey1", "b08_journey2", "b09_cave", "b10_dragonname", "b11_battle", "b12_theater1", "b13_namesword", "b14_return", "b15_wedding", "b16_family", "b17_close"];

export async function loadBlocks() {
  if (globalThis.__STATIC_BLOCKS__) return globalThis.__STATIC_BLOCKS__;
  const only = new URLSearchParams(globalThis.location?.search || '').get('only');
  const pre = only ? only.split(',') : null;
  const out = [];
  for (const name of BLOCK_NAMES) {
    if (pre && !pre.some((p) => name.startsWith(p) || p.startsWith(name.slice(0, 3)))) { out.push([]); continue; }
    try {
      const m = await import(`./${name}.js`);
      out.push([].concat(m.default || []));
    } catch (e) {
      console.error('[block load failed]', name, e && e.message);
      out.push([]);
    }
  }
  if (!out.some((b) => b.length) && !pre) {
    const m = await import('./_kit_test.js');
    return [m.default];
  }
  return out;
}
