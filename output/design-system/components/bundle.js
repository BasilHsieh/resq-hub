/* @ds-bundle: {"format":4,"namespace":"ResQ","components":[{"name":"ConsentBadge"},{"name":"NeedChip"},{"name":"UpdatedAt"},{"name":"CategoryGrid"},{"name":"HouseholdRow"},{"name":"ResumeCard"},{"name":"ReportCard"},{"name":"Button"},{"name":"CountPicker"},{"name":"Notice"},{"name":"TopBar"},{"name":"DrillBanner"},{"name":"Icon"}]} */
/* ResQ Hub 設計系統：志工頁的元件。需要頁面上已有 React 18（window.React）。
   可以按的元件都收 href（mockup 串頁用）或 onClick（真的 app 用）。
   元件上的中文字是規格的一部分（D-16：同意與需求分開），不開放改字，只有少數明寫的 prop 可以換。 */
(function () {
  'use strict';
  var React = window.React;
  var h = React.createElement;

  function cx() {
    var out = [];
    for (var i = 0; i < arguments.length; i++) if (arguments[i]) out.push(arguments[i]);
    return out.join(' ');
  }
  function el(tag, attrs, kids) { return h.apply(null, [tag, attrs].concat(kids)); }
  // 從 mockup 標籤屬性傳進來的都是字串："false" 也要當成 false
  function bool(v, dflt) {
    if (v == null || v === '') return dflt;
    return !(v === false || v === 'false' || v === 0 || v === '0');
  }
  // 有 href 就是連結，否則是按鈕
  function pressable(p, className, kids, extra) {
    var attrs = Object.assign({ className: className, onClick: p.onClick }, extra || {});
    if (p.href) { attrs.href = p.href; return el('a', attrs, kids); }
    attrs.type = 'button';
    return el('button', attrs, kids);
  }

  // ---- 圖示：Tabler Icons（MIT），線寬 2、24px 格 ----
  var ICONS = {
    back: ['M5 12h14', 'M5 12l6 6', 'M5 12l6 -6'],
    check: ['M5 12l5 5l10 -10'],
    close: ['M18 6l-12 12', 'M6 6l12 12'],
    clock: ['M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0', 'M12 7v5l3 3'],
    walk: ['M13 4m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0', 'M7 21l3 -4', 'M16 21l-2 -4l-3 -3l1 -6', 'M6 12l2 -3l4 -1l3 3l3 1'],
    directions: ['M9 11a3 3 0 1 0 6 0a3 3 0 0 0 -6 0', 'M17.657 16.657l-4.243 4.243a2 2 0 0 1 -2.827 0l-4.244 -4.243a8 8 0 1 1 11.314 0z'],
    report: ['M7 7h-1a2 2 0 0 0 -2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2 -2v-1', 'M20.385 6.585a2.1 2.1 0 0 0 -2.97 -2.97l-8.415 8.385v3h3l8.385 -8.415z', 'M16 5l3 3'],
    'user-plus': ['M8 7a4 4 0 1 0 8 0a4 4 0 0 0 -8 0', 'M16 19h6', 'M19 16v6', 'M6 21v-2a4 4 0 0 1 4 -4h4'],
    users: ['M5 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0', 'M3 21v-2a4 4 0 0 1 4 -4h4a4 4 0 0 1 4 4v2', 'M16 3.13a4 4 0 0 1 0 7.75', 'M21 21v-2a4 4 0 0 0 -3 -3.85'],
    info: ['M3 12a9 9 0 1 0 18 0a9 9 0 0 0 -18 0', 'M12 9h.01', 'M11 12h1v4h1'],
    lock: ['M5 13a2 2 0 0 1 2 -2h10a2 2 0 0 1 2 2v6a2 2 0 0 1 -2 2h-10a2 2 0 0 1 -2 -2v-6z', 'M11 16a1 1 0 1 0 2 0a1 1 0 0 0 -2 0', 'M8 11v-4a4 4 0 1 1 8 0v4']
  };

  function Icon(p) {
    var paths = ICONS[p.name];
    if (!paths) return null;
    var size = Number(p.size) || 24;
    var label = p['aria-label'] || p.label;
    return h('svg', {
      className: cx('rq-icon', p.className),
      width: size, height: size, viewBox: '0 0 24 24',
      fill: 'none', stroke: 'currentColor', strokeWidth: Number(p.strokeWidth) || 2,
      strokeLinecap: 'round', strokeLinejoin: 'round', focusable: 'false',
      role: label ? 'img' : undefined,
      'aria-label': label || undefined,
      'aria-hidden': label ? undefined : 'true'
    }, paths.map(function (d, i) { return h('path', { key: i, d: d }); }));
  }

  // ---- 狀態 ----
  // 沒有紀錄＝尚未取得同意（D-16：沒人在家不是一種狀態）
  var CONSENT = {
    agreed: { label: '已同意', cls: 'rq-badge--agreed', icon: 'check' },
    pending: { label: '尚未取得同意', cls: 'rq-badge--pending' },
    declined: { label: '不同意', cls: 'rq-badge--declined' },
    public: { label: '公共區域', cls: 'rq-badge--quiet' }
  };
  function ConsentBadge(p) {
    var c = CONSENT[p.status] || CONSENT.pending;
    return h('span', { className: cx('rq-badge', c.cls, c.icon ? 'rq-t-meta-strong' : 'rq-t-meta') },
      c.icon ? h(Icon, { name: c.icon, size: 16, strokeWidth: 2.8 }) : null,
      c.label);
  }

  function needText(status, count) {
    if (status === 'need') {
      var n = String(count == null ? '' : count).trim();
      if (!n) return '缺人';
      if (/\+$/.test(n)) return '缺 ' + n.replace(/\+$/, '') + ' 人以上';
      return '缺 ' + n + ' 人';
    }
    return { unknown: '需求不明', enough: '人夠了', done: '清完了' }[status] || null;
  }
  // 只講人力。物資不放在這裡（U-06：物資廣播供給、需求一對一，待驗證）
  function NeedChip(p) {
    var text = needText(p.status, p.count);
    if (!text) return null;
    if (p.status === 'unknown') return h('span', { className: 'rq-need-unknown rq-t-meta' }, text);
    if (p.status === 'need') {
      return h('span', { className: 'rq-badge rq-badge--need rq-t-meta-strong' },
        h(Icon, { name: 'users', size: 16, strokeWidth: 2.4 }), text);
    }
    return h('span', { className: 'rq-badge rq-badge--quiet rq-t-meta' }, text);
  }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  // 時間只有一種寫法（D-16）：最後更新 14:26／最後更新 昨天 08:40／最後更新 9/24 08:40／還沒有紀錄
  function formatUpdated(at, now) {
    if (at == null || at === '') return '還沒有紀錄';
    if (typeof at === 'string') {
      var s = at.trim();
      if (/^(昨天 )?\d{1,2}:\d{2}$/.test(s) || /^\d{1,2}\/\d{1,2} \d{1,2}:\d{2}$/.test(s)) return '最後更新 ' + s;
      at = new Date(s);
    }
    var d = at instanceof Date ? at : new Date(at);
    if (isNaN(d.getTime())) return '還沒有紀錄';
    var ref = now == null ? new Date() : (now instanceof Date ? now : new Date(now));
    var hm = pad(d.getHours()) + ':' + pad(d.getMinutes());
    var day = function (x) { return new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime(); };
    var diff = Math.round((day(ref) - day(d)) / 86400000);
    if (diff === 0) return '最後更新 ' + hm;
    if (diff === 1) return '最後更新 昨天 ' + hm;
    return '最後更新 ' + (d.getMonth() + 1) + '/' + d.getDate() + ' ' + hm;
  }
  function UpdatedAt(p) {
    return h('span', { className: 'rq-updated rq-t-meta' }, formatUpdated(p.at, p.now));
  }

  // ---- 清單 ----
  // 四個分類照「現在該做什麼」分（D-16）
  var CATEGORIES = [
    { key: 'help', label: '可以直接幫忙', hint: '屋主已同意，或是公共區域。打聲招呼就能幫忙。' },
    { key: 'ask', label: '要先問屋主', hint: '先敲門問屋主，屋主同意才進門。去問一聲，就是在幫忙。' },
    { key: 'declined', label: '不同意', hint: '屋主說不用。屋主改變主意時，點一下更新。' },
    { key: 'done', label: '暫時不用去', hint: '人夠了，或已經清完了。情況變了，點一下更新。' }
  ];
  function upperFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function CategoryGrid(p) {
    var value = p.value || 'help';
    var counts = p.counts || {};
    var hrefs = p.hrefs || {};
    var current = CATEGORIES.filter(function (c) { return c.key === value; })[0] || CATEGORIES[0];
    return h('div', { className: 'rq-cats' },
      h('div', { className: 'rq-cats__grid', role: 'tablist', 'aria-label': '分類' },
        CATEGORIES.map(function (c) {
          var on = c.key === current.key;
          var n = counts[c.key] != null ? counts[c.key] : p['count' + upperFirst(c.key)];
          return pressable(
            { href: hrefs[c.key] || p['href' + upperFirst(c.key)], onClick: p.onSelect ? function () { p.onSelect(c.key); } : undefined },
            'rq-cats__tile',
            [h('span', { key: 't', className: 'rq-cats__top' },
              h('span', { className: 'rq-cats__count rq-t-count' }, n == null ? '–' : String(n)),
              on ? h('span', { className: 'rq-cats__mark' }, h(Icon, { name: 'check', size: 18, strokeWidth: 3 })) : null),
             h('span', { key: 'l', className: 'rq-t-label' }, c.label)],
            { key: c.key, role: 'tab', 'aria-selected': on ? 'true' : 'false' });
        })),
      bool(p.showHint, true)
        ? h('p', { className: 'rq-cats__hint rq-t-hint' }, h(Icon, { name: 'info', size: 22 }), h('span', null, current.hint))
        : null);
  }

  var ROW_HINTS = {
    pending: '到了先敲門，問屋主需不需要幫忙',
    agreed: '屋主已同意。到了打聲招呼就能幫忙',
    public: '公共區域，到了就能幫忙',
    declined: '屋主說不用。屋主改變主意時，按「回報這一戶」更新'
  };
  function rowParts(p) {
    return [
      h('span', { key: 'h', className: 'rq-row__head' },
        h('span', { className: 'rq-row__addr rq-t-address' }, p.address),
        p.walkMinutes == null || p.walkMinutes === '' ? null : h('span', { className: 'rq-row__walk rq-t-meta-strong' },
          h(Icon, { name: 'walk', size: 18 }), '走路 ' + p.walkMinutes + ' 分鐘')),
      h('span', { key: 's', className: 'rq-row__status' },
        h(ConsentBadge, { status: p.consent }),
        p.consent === 'declined' ? null : h(NeedChip, { status: p.need, count: p.needCount })),
      h(UpdatedAt, { key: 'u', at: p.updatedAt, now: p.now })
    ];
  }
  function HouseholdRow(p) {
    if (!bool(p.expanded, false)) {
      return pressable({ href: p.href, onClick: p.onSelect }, 'rq-row', rowParts(p),
        p.onSelect ? { 'aria-expanded': 'false' } : null);
    }
    var hint = p.hint == null ? (ROW_HINTS[p.consent] || ROW_HINTS.pending) : p.hint;
    return h('div', { className: 'rq-row rq-row--open' },
      p.href || p.onSelect
        ? pressable({ href: p.href, onClick: p.onSelect }, 'rq-row__body', rowParts(p), { 'aria-expanded': 'true' })
        : el('div', { className: 'rq-row__body' }, rowParts(p)),
      hint ? h('p', { className: 'rq-row__hint rq-t-hint' }, hint) : null,
      h('div', { className: 'rq-row__actions' },
        h(Button, { variant: 'tonal', size: 'md', icon: 'directions', href: p.directionsHref, onClick: p.onDirections }, '怎麼走'),
        h(Button, { variant: 'primary', size: 'md', icon: 'report', href: p.reportHref, onClick: p.onReport }, '回報這一戶')));
  }

  function ResumeCard(p) {
    return h('div', { className: 'rq-resume' },
      h('span', { className: 'rq-resume__label rq-t-meta' }, '你剛剛在'),
      h('span', { className: 'rq-t-address' }, p.address),
      h(Button, { variant: 'tonal', size: 'md', href: p.href, onClick: p.onClick }, '做完要離開時，回報這一戶'));
  }

  // ---- 回報 ----
  // 回報頁的兩塊各自獨立（D-16）：同意一塊、需求一塊，只填知道的那一項
  var REPORT = {
    consent: { label: '屋主同意嗎', action: '更新同意狀態' },
    need: { label: '需要人嗎', action: '更新需求' }
  };
  function ReportCard(p) {
    var kind = p.kind === 'need' ? 'need' : 'consent';
    var emph = bool(p.emphasis, false);
    var value = kind === 'consent'
      ? h(ConsentBadge, { status: p.status })
      : h(NeedChip, { status: p.status || 'unknown', count: p.count });
    return h('section', { className: cx('rq-report', emph && 'rq-report--emphasis') },
      h('span', { className: 'rq-report__label rq-t-meta-strong' }, REPORT[kind].label),
      h('span', { className: 'rq-report__value' }, value),
      h(UpdatedAt, { at: p.updatedAt, now: p.now }),
      h(Button, { variant: emph ? 'primary' : 'tonal', size: 'md', href: p.href, onClick: p.onClick }, REPORT[kind].action));
  }

  // lg＝一題一頁的答案（靠左：圖示圓＋字＋副標）；md＝卡片裡的膠囊按鈕；link＝離開這一頁
  function Button(p) {
    var variant = p.variant === 'outline' ? 'tonal' : (p.variant || 'primary');
    var size = p.size === 'md' ? 'md' : 'lg';
    var isLink = variant === 'link';
    var kids;
    if (isLink) {
      kids = [h('span', { key: 'm', className: 'rq-t-body' }, p.children)];
    } else if (size === 'lg') {
      kids = [
        p.icon ? h('span', { key: 'i', className: 'rq-btn__icon' }, h(Icon, { name: p.icon, size: 24, strokeWidth: 2.6 })) : null,
        h('span', { key: 't', className: 'rq-btn__text' },
          h('span', { className: 'rq-t-button-lg' }, p.children),
          p.sub ? h('span', { className: 'rq-btn__sub rq-t-meta' }, p.sub) : null)
      ];
    } else {
      kids = [p.icon ? h(Icon, { key: 'i', name: p.icon, size: 22 }) : null,
        h('span', { key: 'm', className: 'rq-t-button' }, p.children)];
    }
    return pressable(p, cx('rq-btn', 'rq-btn--' + variant, !isLink && 'rq-btn--' + size, size === 'lg' && p.sub && 'rq-btn--sub', p.className), kids,
      p['aria-label'] ? { 'aria-label': p['aria-label'] } : null);
  }

  function CountPicker(p) {
    var options = p.options || ['1', '2', '3', '5', '8', '10+'];
    if (typeof options === 'string') options = options.split(',').map(function (s) { return s.trim(); });
    return h('div', { className: 'rq-count', role: 'group', 'aria-label': '還要幾個人' },
      options.map(function (n) {
        var said = /\+$/.test(n) ? n.replace(/\+$/, '') + ' 人以上' : n + ' 人';
        return pressable({ href: p.href, onClick: p.onPick ? function () { p.onPick(n); } : undefined }, 'rq-count__tile',
          [h('span', { key: 'n', className: 'rq-count__n rq-t-number' }, n)], { key: n, 'aria-label': said });
      }));
  }

  function Notice(p) {
    return h('div', { className: 'rq-notice', role: 'status' },
      h('span', { className: 'rq-notice__icon' }, h(Icon, { name: 'check', size: 18, strokeWidth: 3 })),
      h('span', { className: 'rq-t-hint' }, p.children));
  }

  // ---- 外框 ----
  function TopBar(p) {
    return h('div', { className: 'rq-topbar' },
      pressable({ href: p.backHref, onClick: p.onBack }, 'rq-topbar__back', [h(Icon, { key: 'i', name: 'back' })], { 'aria-label': '返回' }),
      p.label ? h('span', { className: 'rq-topbar__label rq-t-label' }, p.label) : null);
  }

  // 演習標記（D-12）：兵推全程掛著；不是產品畫面的一部分
  function DrillBanner(p) {
    var note = p.note == null ? '地址、需求都是編的' : p.note;
    return h('div', { className: 'rq-drill', role: 'note' },
      h('span', { className: 'rq-drill__badge rq-t-drill' }, '演習'),
      note ? h('span', { className: 'rq-t-drill' }, note) : null,
      p.time ? h('span', { className: 'rq-drill__time rq-t-drill' }, p.time) : null);
  }

  window.ResQ = Object.assign(window.ResQ || {}, {
    ConsentBadge: ConsentBadge, NeedChip: NeedChip, UpdatedAt: UpdatedAt,
    CategoryGrid: CategoryGrid, HouseholdRow: HouseholdRow, ResumeCard: ResumeCard,
    ReportCard: ReportCard, Button: Button, CountPicker: CountPicker, Notice: Notice,
    TopBar: TopBar, DrillBanner: DrillBanner, Icon: Icon,
    formatUpdated: formatUpdated
  });
})();
