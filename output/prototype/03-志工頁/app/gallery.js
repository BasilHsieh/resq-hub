/* ResQ Hub 志工頁：所有狀態一次攤開（THROW 的資料，KEEP 的畫面）。
   每一格＝同一份畫面程式（ResQApp.Screen）＋一組演習資料＋一個狀態，所以跟互動版不可能長得不一樣（D-18）。
   給 Basil 整排比對，也給之後的截圖比對用。 */
(function () {
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM, h = React.createElement;
  var App = window.ResQApp, D = window.ResQDemo, C = App.COPY;
  var MIN = 60 * 1000, HOUR = 60 * MIN;

  function data(extra, opts) {
    opts = opts || {};
    return { targets: D.TARGETS, reports: D.REPORTS.concat(extra || []), now: opts.now || D.NOW, resume: opts.resume || null, start: D.NOW };
  }
  function view(v) { return Object.assign({}, App.START_VIEW, v); }
  var T = 'h4', ADDR_AT = D.NOW + 6 * MIN;                       // 乙路 45 巷 6 弄 3 號，14:26 回報
  var agreed = [{ target: T, at: ADDR_AT, consent: 'agreed' }];
  var needs3 = agreed.concat([{ target: T, at: ADDR_AT + MIN, need: { value: 'need', count: 3 } }]);

  var FRAMES = [
    ['1 下一戶去哪（預設：可以直接幫忙）', view({ category: 'help' }), data()],
    ['1a 切到「要先問屋主」', view({ category: 'ask' }), data()],
    ['2 點一戶，就地展開', view({ category: 'ask', expanded: T }), data()],
    ['3 回報這一戶', view({ screen: 'report', target: T }), data()],
    ['3a 屋主同意嗎', view({ screen: 'consent', target: T }), data()],
    ['3b 同意記下了', view({ screen: 'report', target: T, notice: C.savedAgreed, emphasizeNeed: true }), data(agreed, { now: ADDR_AT })],
    ['4 這一戶還需要人嗎', view({ screen: 'need', target: T }), data(agreed, { now: ADDR_AT })],
    ['4a 還要幾個人', view({ screen: 'howmany', target: T }), data(agreed, { now: ADDR_AT })],
    ['4b 兩項都記下了', view({ screen: 'report', target: T, notice: C.savedCount(3), savedNeed: true }), data(needs3, { now: ADDR_AT + MIN })],
    ['5 回到清單：上方有你剛剛在的那一戶', view({ category: 'help' }), data(needs3, { now: ADDR_AT + 2 * MIN, resume: T })],
    ['1b 切到「不同意」', view({ category: 'declined' }), data([{ target: T, at: ADDR_AT, consent: 'declined' }], { now: ADDR_AT })],
    ['1c 切到「暫時不用去」', view({ category: 'done' }), data()],
    ['按了「還沒問到」之後', view({ category: 'ask', notice: C.savedPending }), data([{ target: T, at: ADDR_AT, consent: 'pending' }], { now: ADDR_AT })],
    ['按了「不同意」之後', view({ category: 'ask', notice: C.savedDeclined }), data([{ target: T, at: ADDR_AT, consent: 'declined' }], { now: ADDR_AT })],
    ['三小時後：甲街 16 號的「人夠了」過期，回到可以直接幫忙', view({ category: 'help' }), data([], { now: D.NOW + 3 * HOUR })],
    ['隔天：清完了還沒滿 24 小時的留在暫時不用去', view({ category: 'done' }), data([], { now: D.NOW + 20 * HOUR })]
  ];

  function Gallery() {
    return h('div', { style: { display: 'flex', flexWrap: 'wrap', gap: '32px 24px', padding: '24px', alignItems: 'flex-start' } },
      FRAMES.map(function (f) {
        return h('figure', { key: f[0], style: { margin: 0, width: '390px', display: 'flex', flexDirection: 'column', gap: '8px' } },
          h('figcaption', { className: 'rq-t-meta-strong', style: { color: 'var(--ink-2)' } }, f[0]),
          h('div', { style: { '--screen-min-h': '844px', width: '390px', borderRadius: '24px', overflow: 'hidden', border: 'var(--stroke-hairline) solid var(--line)', background: 'var(--ground)' } },
            h(App.Screen, { view: f[1], data: f[2], act: null })));
      }));
  }

  window.ResQGallery = { FRAMES: FRAMES, mount: function (el) { ReactDOM.createRoot(el).render(h(Gallery)); } };
})();
