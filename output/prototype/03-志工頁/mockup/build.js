// 志工頁 mockup（設計畫布）的產生器：14 張流程畫面，每一張都用設計系統的真元件組成，輸出成靜態標記。
// 樣式吃畫布上的 ds/resq/components/bundle.css（從設計系統 artifact 複製過去的），所以換主色＝設計系統改完、畫布重新複製一次。
//
//   npm install                              第一次
//   node build.js                            → out/project/*.dc.html
//   node build.js --merge <讀回來的 canvas.json>  → 另外寫 out/project/canvas.json（線上那份＋這裡管的部分）
//
// 這裡管：流程頁的 14 張畫面與它們的標題、尺寸，流程頁的便利貼，設計系統的安裝紀錄。
// 不管：別的頁（視覺方向、主色——都是已經做完決定的紀錄）、誰在畫布上拖過的位置、畫布自己存的欄位。
const fs = require('fs'), path = require('path'), vm = require('vm');
const React = require('react');
const Server = require('react-dom/server');

const DS = path.resolve(__dirname, '../../../design-system');
global.window = global; global.React = React;
vm.runInThisContext(fs.readFileSync(path.join(DS, 'components/bundle.js'), 'utf8'), { filename: 'bundle.js' });
const R = window.ResQ, h = React.createElement;
const OUT = path.join(__dirname, 'out', 'project');
const DS_ARTIFACT = 'https://claude.ai/artifact/UkEAqQ1nyqQikCMV7uCwLi';

// ---------------------------------------------------------------- 版型
const ADDR = '乙路 45 巷 6 弄 3 號';
const HREFS = { help: 'Main.dc.html', ask: 'Tab_Ask.dc.html', declined: 'Tab_Declined.dc.html', done: 'Tab_Done.dc.html' };
const col = (gap, kids, extra) => h('div', { style: Object.assign({ display: 'flex', flexDirection: 'column', gap }, extra || {}) }, ...kids);

const header = () => col('var(--space-1)', [
  h('h1', { className: 'rq-t-display', style: { margin: 0 } }, '下一戶去哪？'),
  h('p', { className: 'rq-t-hint', style: { margin: 0, color: 'var(--ink-2)' } }, '你附近走路 15 分鐘內・近的排前面')
], { padding: '0 var(--space-1)' });
const footer = () => h('p', { className: 'rq-t-meta', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 'var(--space-1) 0 0', color: 'var(--ink-3)' } },
  h(R.Icon, { name: 'lock', size: 16 }), '不用登入，不問你是誰');

function listPage({ time, value, counts, rows, top }) {
  const byWalk = rows.slice().sort((a, b) => a.walkMinutes - b.walkMinutes);
  return [
    h(R.DrillBanner, { key: 'd', time }),
    col('18px', [
      ...(top || []),
      header(),
      h(R.CategoryGrid, { value, counts, hrefs: HREFS }),
      col('var(--space-3)', byWalk.map((r, i) => h(R.HouseholdRow, Object.assign({ key: i }, r)))),
      footer()
    ], { padding: `${top ? 'var(--space-4)' : 'var(--space-6)'} var(--space-4) var(--space-8)` })
  ];
}

function reportPage({ time, back, notice, consent, need, bottom }) {
  return [
    h(R.DrillBanner, { key: 'd', time }),
    h(R.TopBar, { key: 't', label: '回報這一戶', backHref: back }),
    col('var(--space-4)', [
      notice ? h(R.Notice, null, notice) : null,
      col('6px', [
        h('h1', { className: 'rq-t-title', style: { margin: 0 } }, ADDR),
        h('p', { className: 'rq-t-hint', style: { margin: 0, color: 'var(--ink-2)' } }, '只填你知道的那一項，不知道的留著')
      ]),
      h(R.ReportCard, consent),
      h(R.ReportCard, need),
      ...bottom
    ].filter(Boolean), { padding: 'var(--space-5) var(--space-5) var(--space-6)' })
  ];
}

function questionPage({ time, back, title, hint, answers }) {
  return [
    h(R.DrillBanner, { key: 'd', time }),
    h(R.TopBar, { key: 't', label: ADDR, backHref: back }),
    h('div', { key: 'c', style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, gap: 'var(--space-6)', padding: 'var(--space-7) var(--space-5)' } },
      col('10px', [
        h('h1', { className: 'rq-t-display', style: { margin: 0 } }, title),
        hint ? h('p', { className: 'rq-t-body', style: { margin: 0, color: 'var(--ink-2)' } }, hint) : null
      ].filter(Boolean)),
      col('var(--space-3)', answers))
  ];
}

// ---------------------------------------------------------------- 資料（全部編的：地址用甲、乙，同意狀態不能掛在真實地址上）
const HELP = () => [
  { address: '甲街 20 號', consent: 'agreed', need: 'need', needCount: 5, updatedAt: '13:20', walkMinutes: 3 },
  { address: '甲街側溝', consent: 'public', need: 'need', needCount: 10, updatedAt: '12:20', walkMinutes: 5 },
  { address: '乙路 51 號', consent: 'agreed', need: 'need', needCount: 2, updatedAt: '11:20', walkMinutes: 6 },
  { address: '甲街 3 號', consent: 'agreed', need: 'unknown', updatedAt: '昨天 08:40', walkMinutes: 7 },
];
const ASK = () => [
  { address: ADDR, consent: 'pending', updatedAt: null, walkMinutes: 2 },
  { address: '乙路 45 巷 2 號', consent: 'pending', updatedAt: '14:00', walkMinutes: 2 },
  { address: '乙路 45 巷 9 號', consent: 'pending', updatedAt: null, walkMinutes: 3 },
];
const DECLINED = () => [{ address: '乙路 47 號', consent: 'declined', updatedAt: '昨天 10:00', walkMinutes: 5 }];
const DONE = () => [
  { address: '甲街 12 號', consent: 'agreed', need: 'done', updatedAt: '13:20', walkMinutes: 1 },
  { address: '甲街 16 號', consent: 'agreed', need: 'enough', updatedAt: '13:20', walkMinutes: 2 },
  { address: '甲街 24 號', consent: 'agreed', need: 'done', updatedAt: '09:20', walkMinutes: 4 },
];
const C0 = { help: 4, ask: 3, declined: 1, done: 3 }, C1 = { help: 4, ask: 2, declined: 2, done: 3 }, C2 = { help: 5, ask: 2, declined: 1, done: 3 };
const link = (href, text) => h(R.Button, { key: 'l', variant: 'link', href }, text);

// ---------------------------------------------------------------- 14 張：[標題, x, y, 高, 內容]
const BOARDS = {
  'Main.dc.html': ['1 下一戶去哪（預設：可以直接幫忙）', 0, 0, 1180, () => listPage({ time: '14:20', value: 'help', counts: C0, rows: HELP() })],
  'Tab_Ask.dc.html': ['1a 切到「要先問屋主」', 470, 0, 1040, () => listPage({ time: '14:20', value: 'ask', counts: C0,
    rows: ASK().map((r, i) => i ? r : Object.assign(r, { href: 'List_Expanded.dc.html' })) })],
  'List_Expanded.dc.html': ['2 點一戶，就地展開', 940, 0, 1160, () => listPage({ time: '14:20', value: 'ask', counts: C0,
    rows: ASK().map((r, i) => i ? r : Object.assign(r, { expanded: true, href: 'Tab_Ask.dc.html', reportHref: 'Report.dc.html' })) })],
  'Report.dc.html': ['3 回報這一戶', 1410, 0, 880, () => reportPage({ time: '14:26', back: 'List_Expanded.dc.html',
    consent: { kind: 'consent', status: 'pending', updatedAt: null, href: 'Consent.dc.html' },
    need: { kind: 'need', status: 'unknown', updatedAt: null, href: 'Need.dc.html' },
    bottom: [link('Tab_Ask.dc.html', '回到清單')] })],
  'Consent.dc.html': ['3a 更新同意狀態', 1880, 0, 844, () => questionPage({ time: '14:26', back: 'Report.dc.html', title: '屋主同意志工進去嗎？', hint: '先敲門問屋主。屋主同意才進門。', answers: [
    h(R.Button, { key: 1, variant: 'primary', icon: 'check', sub: '屋主說好、裡面有人在做，或帶隊的叫你進去', href: 'Report_Agreed.dc.html' }, '已同意'),
    h(R.Button, { key: 2, variant: 'tonal', icon: 'close', href: 'List_Declined.dc.html' }, '不同意'),
    h(R.Button, { key: 3, variant: 'dashed', icon: 'clock', sub: '沒人應門，或屋主還在考慮', href: 'List_Asked.dc.html' }, '還沒問到')] })],
  'Report_Agreed.dc.html': ['3b 同意記下了', 2350, 0, 900, () => reportPage({ time: '14:26', back: 'List_Expanded.dc.html', notice: '已記下：屋主已同意。知道需不需要人的話，順便更新。',
    consent: { kind: 'consent', status: 'agreed', updatedAt: '14:26', href: 'Consent.dc.html' },
    need: { kind: 'need', status: 'unknown', updatedAt: null, emphasis: true, href: 'Need.dc.html' },
    bottom: [link('Tab_Ask.dc.html', '回到清單')] })],
  'Need.dc.html': ['4 更新需求', 2820, 0, 844, () => questionPage({ time: '14:27', back: 'Report_Agreed.dc.html', title: '這一戶現在還需要人嗎？', answers: [
    h(R.Button, { key: 1, variant: 'primary', icon: 'user-plus', href: 'HowMany.dc.html' }, '還要人'),
    h(R.Button, { key: 2, variant: 'tonal', icon: 'users', href: 'Main_Back.dc.html' }, '人夠了'),
    h(R.Button, { key: 3, variant: 'tonal', icon: 'check', href: 'Main_Back.dc.html' }, '已經清完了')] })],
  'HowMany.dc.html': ['4a 還要幾個人', 3290, 0, 844, () => questionPage({ time: '14:27', back: 'Need.dc.html', title: '還要幾個人？', hint: '大概就好，現場會再調整。', answers: [
    h(R.CountPicker, { key: 1, href: 'Report_Final.dc.html' })] })],
  'Report_Final.dc.html': ['4b 兩項都記下了', 3760, 0, 900, () => reportPage({ time: '14:27', back: 'List_Expanded.dc.html', notice: '已記下：還要 3 人。下一個打開的人會看到。',
    consent: { kind: 'consent', status: 'agreed', updatedAt: '14:26', href: 'Consent.dc.html' },
    need: { kind: 'need', status: 'need', count: 3, updatedAt: '14:27', href: 'Need.dc.html' },
    bottom: [h(R.Button, { key: 'b', variant: 'primary', size: 'md', href: 'Main_Back.dc.html' }, '回到清單'),
      h('p', { key: 'p', className: 'rq-t-meta', style: { margin: 0, textAlign: 'center', color: 'var(--ink-3)' } }, '做完要離開時，回到這一頁更新需求')] })],
  'Main_Back.dc.html': ['5 回到清單：上方有你剛剛在的那一戶', 4230, 0, 1500, () => listPage({ time: '14:28', value: 'help', counts: C2,
    rows: HELP().concat([{ address: ADDR, consent: 'agreed', need: 'need', needCount: 3, updatedAt: '14:27', walkMinutes: 1 }]),
    top: [h(R.ResumeCard, { key: 'r', address: ADDR, href: 'Report_Final.dc.html' })] })],
  'Tab_Declined.dc.html': ['1b 切到「不同意」', 0, 1300, 900, () => listPage({ time: '14:26', value: 'declined', counts: C1,
    rows: DECLINED().concat([{ address: ADDR, consent: 'declined', updatedAt: '14:26', walkMinutes: 2 }]) })],
  'Tab_Done.dc.html': ['1c 切到「暫時不用去」', 470, 1300, 1040, () => listPage({ time: '14:20', value: 'done', counts: C0, rows: DONE() })],
  'List_Asked.dc.html': ['按了「還沒問到」之後', 940, 1300, 1120, () => listPage({ time: '14:26', value: 'ask', counts: C0,
    rows: ASK().map((r, i) => i ? r : Object.assign(r, { updatedAt: '14:26' })),
    top: [h(R.Notice, { key: 'n' }, '已記下。這一戶還是「要先問屋主」，多了這次的更新時間，不寫原因。')] })],
  'List_Declined.dc.html': ['按了「不同意」之後', 1410, 1300, 980, () => listPage({ time: '14:26', value: 'ask', counts: C1, rows: ASK().slice(1),
    top: [h(R.Notice, { key: 'n' }, '已記下。跟屋主說一聲：之後需要幫忙，跟任何志工說就可以。')] })],
};

const NOTES = {
  flow: { x: 0, y: -300, text: '志工頁：剛做完一戶，下一戶去哪', kind: 'title1', maxW: 4620, w: 240 },
  changes: { x: 1880, y: 1300, w: 400, size: 24, text: '這一版的改動（2026-09-27 下午）\n1. 長相改成「清楚大膽」：大數字分類格、色塊、膠囊按鈕，答案放在畫面下方\n2. 顏色從一個主色（靛）推出來：主色＝可以做的事，杏橘只給缺人\n3. 每一張都用設計系統的元件組成，換主色會整套一起換' },
  skip: { x: 2340, y: 1300, w: 380, size: 24, text: '公共區域只有「需求」一項。\n到了發現裡面已經有人在做，或帶隊的叫你進去：同意狀態直接按「已同意」。' },
  privacy: { x: 2800, y: 1300, w: 400, size: 24, text: '按「還沒問到」：這一戶留在「要先問屋主」，只多了這次的更新時間，不寫原因。\n按「不同意」：這一戶移到「不同意」分類，數量加一，看得到也能更新；畫面提醒志工跟屋主說，之後需要幫忙跟任何志工說就可以。' },
};

// ---------------------------------------------------------------- 輸出
function page(title, height, kids) {
  const body = Server.renderToStaticMarkup(h(React.Fragment, null, ...kids));
  if (body.includes('{{')) throw new Error(title + '：內容裡有 {{，畫布會當成變數');
  return `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<title>${title}</title>
<script src="./support.js"></script>
<link rel="stylesheet" href="ds/resq/components/bundle.css">
</head>
<body>
<x-dc>
<helmet>
<style>
body{margin:0;background:#f0f2f8}
a{color:inherit;text-decoration:none}a:hover{color:inherit}
</style>
</helmet>
<div style="width: 390px; height: ${height}px; box-sizing: border-box; display: flex; flex-direction: column; overflow: hidden; background: var(--ground); color: var(--ink); font-family: var(--font-sans)">
${body}
</div>
</x-dc>
<script type="text/x-dc" data-dc-script data-props='{"$preview":{"width":390,"height":${height}}}'>
class Component extends DCLogic {
renderVals() {
return {};
}
}
</script>
</body>
</html>
`;
}

fs.mkdirSync(OUT, { recursive: true });
for (const [file, [title, , , height, content]] of Object.entries(BOARDS)) {
  fs.writeFileSync(path.join(OUT, file), page(title, height, content()));
}

// 畫布索引：線上那份為底，只換這裡管的部分；別人拖過的位置與畫布自己的欄位都留著
const mergeAt = process.argv.indexOf('--merge');
if (mergeAt > 0) {
  const cv = JSON.parse(fs.readFileSync(process.argv[mergeAt + 1], 'utf8'));
  cv.pages = cv.pages && cv.pages.length ? cv.pages : [];
  if (!cv.pages.some(p => p.id === 'flow')) cv.pages.unshift({ id: 'flow', name: '流程' });
  cv.boards = cv.boards || {}; cv.notes = cv.notes || {}; cv.order = cv.order || [];
  for (const [file, [title, x, y, height]] of Object.entries(BOARDS)) {
    const old = cv.boards[file] || { x, y };
    cv.boards[file] = Object.assign({}, old, { w: 390, h: height, title, page: 'flow', is_interactive: true });
    if (!cv.order.includes(file)) cv.order.push(file);
  }
  for (const [id, note] of Object.entries(NOTES)) {
    const old = cv.notes[id] || {};
    cv.notes[id] = Object.assign({}, note, 'x' in old ? { x: old.x, y: old.y } : {}, { page: 'flow' });
  }
  const record = { title: 'ResQ Hub 設計系統', namespace: 'resq', artifact: DS_ARTIFACT, version: null, copiedAt: new Date().toISOString().replace(/\.\d+Z$/, 'Z') };
  cv.designSystems = (cv.designSystems || []).filter(d => d.namespace !== 'resq').concat([record]);
  cv.launch = cv.launch || { view: 'canvas', page: 'flow' };
  fs.writeFileSync(path.join(OUT, 'canvas.json'), JSON.stringify(cv, null, 2) + '\n');
}
console.log(`${Object.keys(BOARDS).length} 張 → ${path.relative(process.cwd(), OUT)}${mergeAt > 0 ? '（含 canvas.json）' : ''}`);
