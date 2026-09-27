/* ResQ Hub 志工頁：畫面（KEEP）。
   每一張畫面都是「狀態＋資料」的純函式：互動版與「所有狀態一次攤開」用同一份程式畫（D-18）。
   畫面只用設計系統的元件拼（window.ResQ，D-17）；規則在 rules.js；資料只透過 store.js 拿（D-12）。
   最下面的「演習控制」是 THROW，不是產品的一部分。 */
(function () {
  'use strict';
  var React = window.React, ReactDOM = window.ReactDOM;
  var h = React.createElement;
  var R = window.ResQ, Rules = window.ResQRules;

  // 畫面上的固定用字（跟設計系統元件一樣，是規格的一部分）
  var COPY = {
    title: '下一戶去哪？',
    nearby: '你附近走路 15 分鐘內・近的排前面',
    empty: '附近沒有這一類。',
    footer: '不用登入，不問你是誰',
    reportHint: '只填你知道的那一項，不知道的留著',
    consentQ: '屋主同意志工進去嗎？', consentHint: '先敲門問屋主。屋主同意才進門。',
    agreedSub: '屋主說好、裡面有人在做，或帶隊的叫你進去', waitSub: '沒人應門，或屋主還在考慮',
    needQ: '這一戶現在還需要人嗎？',
    countQ: '還要幾個人？', countHint: '大概就好，現場會再調整。',
    savedAgreed: '已記下：屋主已同意。知道需不需要人的話，順便更新。',
    savedPending: '已記下。這一戶還是「要先問屋主」，多了這次的更新時間，不寫原因。',
    savedDeclined: '已記下。跟屋主說一聲：之後需要幫忙，跟任何志工說就可以。',
    savedEnough: '已記下：人夠了。',
    savedDone: '已記下：清完了。',
    // 這一版只存在這支手機，所以不寫「下一個打開的人會看到」（Notice 的規則）
    savedCount: function (n) { return '已記下：還要 ' + (/\+$/.test(String(n)) ? String(n).replace(/\+$/, '') + ' 人以上' : n + ' 人') + '。'; },
    leaveHint: '做完要離開時，回到這一頁更新需求',
    noDirections: '這一版還沒有導航（演習）。'
  };

  function col(gap, kids, style) {
    return h.apply(null, ['div', { style: Object.assign({ display: 'flex', flexDirection: 'column', gap: gap }, style || {}) }].concat(kids));
  }
  function screenStyle() {
    return { display: 'flex', flexDirection: 'column', minHeight: 'var(--screen-min-h, 100dvh)', background: 'var(--ground)', color: 'var(--ink)', fontFamily: 'var(--font-sans)' };
  }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function drillTime(now, start) {
    var d = new Date(now), s = new Date(start == null ? now : start);
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    return d.toDateString() === s.toDateString() ? hm : (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }
  function findTarget(data, id) { return data.targets.filter(function (t) { return t.id === id; })[0]; }
  var none = function () {};

  // ---------------------------------------------------------------- 清單：下一戶去哪
  function ListScreen(p) {
    var v = p.view, data = p.data, act = p.act || {};
    var b = Rules.board(data.targets, data.reports, data.now);
    var rows = b.rows.filter(function (d) { return d.category === v.category; });
    var resume = data.resume ? findTarget(data, data.resume) : null;
    var top = [];
    if (v.notice) top.push(h(R.Notice, { key: 'n' }, v.notice));
    if (resume) top.push(h(R.ResumeCard, { key: 'r', address: resume.address, onClick: act.resume }));
    return h('div', { style: screenStyle() },
      h(R.DrillBanner, { time: drillTime(data.now, data.start) }),
      col('18px', top.concat([
        col('var(--space-1)', [
          h('h1', { key: 't', className: 'rq-t-display', style: { margin: 0 } }, COPY.title),
          h('p', { key: 's', className: 'rq-t-hint', style: { margin: 0, color: 'var(--ink-2)' } }, COPY.nearby)
        ], { padding: '0 var(--space-1)' }),
        h(R.CategoryGrid, { key: 'g', value: v.category, counts: b.counts, onSelect: act.selectCategory }),
        rows.length
          ? col('var(--space-3)', rows.map(function (d) {
            var id = d.target.id, need = Rules.needLabel(d) || {};
            return h(R.HouseholdRow, {
              key: id, address: d.target.address, consent: d.consent.value,
              need: need.status, needCount: need.count, updatedAt: d.lastAt, now: data.now,
              walkMinutes: d.target.walkMinutes, expanded: v.expanded === id,
              onSelect: act.toggleRow ? function () { act.toggleRow(id); } : undefined,
              onReport: act.openReport ? function () { act.openReport(id); } : undefined,
              onDirections: act.directions || undefined
            });
          }))
          : h('p', { key: 'e', className: 'rq-t-hint', style: { margin: 0, padding: 'var(--space-4) var(--space-1)', color: 'var(--ink-3)' } }, COPY.empty),
        h('p', { key: 'f', className: 'rq-t-meta', style: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', margin: 'var(--space-1) 0 0', color: 'var(--ink-3)' } },
          h(R.Icon, { name: 'lock', size: 16 }), COPY.footer)
      ]), { padding: (top.length ? 'var(--space-4)' : 'var(--space-6)') + ' var(--space-4) var(--space-8)' }));
  }

  // ---------------------------------------------------------------- 回報這一戶：同意、需求各一塊（D-16）
  function ReportScreen(p) {
    var v = p.view, data = p.data, act = p.act || {};
    var t = findTarget(data, v.target), d = Rules.derive(t, data.reports, data.now);
    var needStatus = { need: 'need', enough: 'enough', done: 'done' }[d.need.value] || 'unknown';
    var bottom = v.savedNeed
      ? [h(R.Button, { key: 'b', variant: 'primary', size: 'md', onClick: act.backToList }, '回到清單'),
        h('p', { key: 'p', className: 'rq-t-meta', style: { margin: 0, textAlign: 'center', color: 'var(--ink-3)' } }, COPY.leaveHint)]
      : [h(R.Button, { key: 'l', variant: 'link', onClick: act.backToList }, '回到清單')];
    return h('div', { style: screenStyle() },
      h(R.DrillBanner, { time: drillTime(data.now, data.start) }),
      h(R.TopBar, { label: '回報這一戶', onBack: act.backToList }),
      col('var(--space-4)', [
        v.notice ? h(R.Notice, { key: 'n' }, v.notice) : null,
        col('6px', [
          h('h1', { key: 't', className: 'rq-t-title', style: { margin: 0 } }, t.address),
          h('p', { key: 'h', className: 'rq-t-hint', style: { margin: 0, color: 'var(--ink-2)' } }, COPY.reportHint)
        ]),
        t.kind === 'place' ? null : h(R.ReportCard, { key: 'c', kind: 'consent', status: d.consent.value, updatedAt: d.consent.at, now: data.now, onClick: act.openConsent }),
        h(R.ReportCard, { key: 'd', kind: 'need', status: needStatus, count: d.need.count, updatedAt: d.need.at, now: data.now, emphasis: !!v.emphasizeNeed, onClick: act.openNeed })
      ].filter(Boolean).concat(bottom), { padding: 'var(--space-5) var(--space-5) var(--space-6)' }));
  }

  // ---------------------------------------------------------------- 一題一頁：問題在上、答案在下
  function QuestionScreen(p, title, hint, answers) {
    var data = p.data, t = findTarget(data, p.view.target);
    return h('div', { style: screenStyle() },
      h(R.DrillBanner, { time: drillTime(data.now, data.start) }),
      h(R.TopBar, { label: t.address, onBack: (p.act || {}).back }),
      h('div', { style: { display: 'flex', flexDirection: 'column', justifyContent: 'space-between', flexGrow: 1, gap: 'var(--space-6)', padding: 'var(--space-7) var(--space-5)' } },
        col('10px', [
          h('h1', { key: 'q', className: 'rq-t-display', style: { margin: 0 } }, title),
          hint ? h('p', { key: 'h', className: 'rq-t-body', style: { margin: 0, color: 'var(--ink-2)' } }, hint) : null
        ].filter(Boolean)),
        col('var(--space-3)', answers)));
  }
  function ConsentScreen(p) {
    var a = p.act || {}, pick = function (v) { return a.answerConsent ? function () { a.answerConsent(v); } : undefined; };
    return QuestionScreen(p, COPY.consentQ, COPY.consentHint, [
      h(R.Button, { key: 1, variant: 'primary', icon: 'check', sub: COPY.agreedSub, onClick: pick('agreed') }, '已同意'),
      h(R.Button, { key: 2, variant: 'tonal', icon: 'close', onClick: pick('declined') }, '不同意'),
      h(R.Button, { key: 3, variant: 'dashed', icon: 'clock', sub: COPY.waitSub, onClick: pick('pending') }, '還沒問到')]);
  }
  function NeedScreen(p) {
    var a = p.act || {}, pick = function (v) { return a.answerNeed ? function () { a.answerNeed(v); } : undefined; };
    return QuestionScreen(p, COPY.needQ, null, [
      h(R.Button, { key: 1, variant: 'primary', icon: 'user-plus', onClick: pick('need') }, '還要人'),
      h(R.Button, { key: 2, variant: 'tonal', icon: 'users', onClick: pick('enough') }, '人夠了'),
      h(R.Button, { key: 3, variant: 'tonal', icon: 'check', onClick: pick('done') }, '已經清完了')]);
  }
  function CountScreen(p) {
    return QuestionScreen(p, COPY.countQ, COPY.countHint, [h(R.CountPicker, { key: 1, onPick: (p.act || {}).pickCount })]);
  }

  var SCREENS = { list: ListScreen, report: ReportScreen, consent: ConsentScreen, need: NeedScreen, howmany: CountScreen };
  function Screen(p) { return h(SCREENS[p.view.screen] || ListScreen, p); }

  // ---------------------------------------------------------------- 互動：狀態只放在這裡
  var START_VIEW = { screen: 'list', category: 'help', expanded: null, target: null, notice: null, emphasizeNeed: false, savedNeed: false };

  function App(p) {
    var store = p.store;
    var vs = React.useState(Object.assign({}, START_VIEW, p.initialView)), view = vs[0], setView = vs[1];
    var ts = React.useState(0), setTick = ts[1];
    React.useEffect(function () { return store.subscribe(function () { setTick(function (n) { return n + 1; }); }); }, [store]);
    var data = { targets: store.targets(), reports: store.reports(), now: store.now(), resume: store.resume(), start: p.start };

    function go(patch) {
      var next = Object.assign({}, view, { notice: null, emphasizeNeed: false, savedNeed: false }, patch);
      if (next.screen !== view.screen && typeof window.scrollTo === 'function') window.scrollTo(0, 0);
      setView(next);
    }
    function current() { return Rules.derive(findTarget(data, view.target), data.reports, data.now); }
    var act = {
      selectCategory: function (k) { go({ category: k, expanded: null }); },
      toggleRow: function (id) { go({ expanded: view.expanded === id ? null : id }); },
      directions: function () { go({ notice: COPY.noDirections }); if (window.scrollTo) window.scrollTo(0, 0); },
      openReport: function (id) { store.setResume(id); go({ screen: 'report', target: id }); },
      resume: function () { go({ screen: 'report', target: data.resume }); },
      backToList: function () { go({ screen: 'list', expanded: null }); },
      back: function () { go({ screen: { consent: 'report', need: 'report', howmany: 'need' }[view.screen] || 'list' }); },
      openConsent: function () { go({ screen: 'consent' }); },
      openNeed: function () { go({ screen: 'need' }); },
      answerConsent: function (v) {
        var needUnknown = current().need.value === 'unknown';
        store.report({ target: view.target, consent: v });
        if (v === 'agreed') go({ screen: 'report', notice: COPY.savedAgreed, emphasizeNeed: needUnknown });
        else go({ screen: 'list', expanded: null, notice: v === 'declined' ? COPY.savedDeclined : COPY.savedPending });
      },
      answerNeed: function (v) {
        if (v === 'need') { go({ screen: 'howmany' }); return; }
        store.report({ target: view.target, need: { value: v } });
        if (data.resume === view.target) store.setResume(null);   // 做完要離開了，「你剛剛在」收起來
        go({ screen: 'list', expanded: null, notice: v === 'enough' ? COPY.savedEnough : COPY.savedDone });
      },
      pickCount: function (n) {
        store.report({ target: view.target, need: { value: 'need', count: /\+$/.test(n) ? n : Number(n) } });
        go({ screen: 'report', notice: COPY.savedCount(n), savedNeed: true });
      }
    };
    return h(React.Fragment, null, h(Screen, { view: view, data: data, act: act }), p.drill ? h(DrillControl, { store: store }) : null);
  }

  // ---------------------------------------------------------------- 演習控制（THROW：不是產品的一部分）
  function DrillControl(p) {
    var s = p.store, HOUR = 3600 * 1000;
    function btn(label, fn) { return h(R.Button, { key: label, variant: 'tonal', size: 'md', onClick: fn }, label); }
    return h('div', { style: { margin: '0 var(--space-4) var(--space-8)', padding: 'var(--space-4)', border: 'var(--stroke-emphasis) dashed var(--ink-3)', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' } },
      h('div', { className: 'rq-t-label' }, '演習控制（不是產品的一部分）'),
      h('p', { className: 'rq-t-meta', style: { margin: 0, color: 'var(--ink-2)' } }, '讓時間往前，看「人夠了」三小時、「清完了」一天之後怎麼回到「可以直接幫忙」。重來會清掉這支手機上的紀錄。'),
      h('div', { style: { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 'var(--space-2)' } },
        btn('往前 1 小時', function () { s.advance(HOUR); }), btn('往前 3 小時', function () { s.advance(3 * HOUR); }),
        btn('往前 1 天', function () { s.advance(24 * HOUR); }), btn('重來', function () { s.reset(); })),
      h(R.Button, { variant: 'link', href: 'gallery.html' }, '所有狀態一次攤開'));
  }

  function mount(el, opts) {
    var D = window.ResQDemo;
    var store = window.ResQStore.createLocalStore({ targets: D.TARGETS, reports: D.REPORTS, now: D.NOW, storageKey: 'resq-volunteer-demo-v1' });
    ReactDOM.createRoot(el).render(h(App, Object.assign({ store: store, drill: true, start: D.NOW }, opts || {})));
  }

  window.ResQApp = { COPY: COPY, Screen: Screen, App: App, START_VIEW: START_VIEW, mount: mount };
})();
