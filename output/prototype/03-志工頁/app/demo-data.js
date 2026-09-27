/* ResQ Hub 志工頁：演習資料（THROW）。全部是編的：地址用甲、乙，刻意不像真實門牌，同意狀態不能掛在真實地址上。
   演習時鐘從 T+6 天 14:20 開始；「昨天」就是前一天。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResQDemo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var NOW = new Date(2026, 9, 2, 14, 20).getTime();          // 演習時間 14:20
  function today(hh, mm) { return new Date(2026, 9, 2, hh, mm || 0).getTime(); }
  function yesterday(hh, mm) { return new Date(2026, 9, 1, hh, mm || 0).getTime(); }
  function house(id, address, walk) { return { id: id, kind: 'household', address: address, walkMinutes: walk }; }
  function place(id, address, walk) { return { id: id, kind: 'place', address: address, walkMinutes: walk }; }

  var TARGETS = [
    house('h1', '甲街 20 號', 3),
    place('p1', '甲街側溝', 5),
    house('h2', '乙路 51 號', 6),
    house('h3', '甲街 3 號', 7),
    house('h4', '乙路 45 巷 6 弄 3 號', 2),
    house('h5', '乙路 45 巷 2 號', 2),
    house('h6', '乙路 45 巷 9 號', 3),
    house('h7', '乙路 47 號', 5),
    house('h8', '甲街 12 號', 1),
    house('h9', '甲街 16 號', 2),
    house('h10', '甲街 24 號', 4),
    house('h11', '丙巷 8 號', 22)                              // 走路超過 15 分鐘：不列、不算
  ];

  var REPORTS = [
    { id: 'd1', target: 'h1', at: today(10, 5), consent: 'agreed' },
    { id: 'd2', target: 'h1', at: today(13, 20), need: { value: 'need', count: 5 } },
    { id: 'd3', target: 'p1', at: today(12, 20), need: { value: 'need', count: 10 } },
    { id: 'd4', target: 'h2', at: today(11, 20), consent: 'agreed', need: { value: 'need', count: 2 } },
    { id: 'd5', target: 'h3', at: yesterday(8, 40), consent: 'agreed' },
    { id: 'd6', target: 'h5', at: today(14, 0), consent: 'pending' },
    { id: 'd7', target: 'h7', at: yesterday(10, 0), consent: 'declined' },
    { id: 'd8', target: 'h8', at: today(13, 20), consent: 'agreed', need: { value: 'done' } },
    { id: 'd9', target: 'h9', at: today(13, 20), consent: 'agreed', need: { value: 'enough' } },
    { id: 'd10', target: 'h10', at: today(9, 20), consent: 'agreed', need: { value: 'done' } },
    { id: 'd11', target: 'h11', at: today(9, 0), consent: 'agreed', need: { value: 'need', count: 4 } }
  ].map(function (r) { return Object.assign({ role: 'volunteer', channel: 'self' }, r); });

  return { NOW: NOW, TARGETS: TARGETS, REPORTS: REPORTS, today: today };
});
