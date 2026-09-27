/* ResQ Hub 志工頁：規則（KEEP）。
   狀態不儲存，由回報歷程推導：狀態(對象, 現在) = f(這個對象的回報, 現在)（資料模型與狀態機 §2）。
   這一份是規格的程式版；規格的例子寫在 rules.test.js，測試沒過就不能改（D-18）。
   瀏覽器裡掛在 window.ResQRules；Node 裡用 require。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResQRules = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var HOUR = 3600 * 1000;
  // 褪色門檻（§0d、§2）：人夠了 3 小時、清完了 24 小時；缺人不褪色（需求不會自己消失）
  var FADE_MS = { enough: 3 * HOUR, done: 24 * HOUR };
  // 清單只列附近（§0d）：走路 15 分鐘內，數量也只算附近
  var NEARBY_MINUTES = 15;
  var CATEGORY_KEYS = ['help', 'ask', 'declined', 'done'];

  function forTarget(reports, id) {
    return reports.filter(function (r) { return r.target === id; });
  }
  function latestBy(list, pick) {
    var best = null;
    list.forEach(function (r) {
      var v = pick(r);
      if (v == null) return;
      if (!best || r.at > best.at) best = { value: v, at: r.at, report: r };
    });
    return best;
  }

  // 同意（§0d）：尚未取得／不同意／同意；屋主自己喊需求就是同意（例 13）；地點沒有同意這一層（例 14）。
  // 同意不設過期，以最新一筆為準。
  function deriveConsent(target, reports) {
    if (target.kind === 'place') return { value: 'public', at: null };
    var best = latestBy(forTarget(reports, target.id), function (r) {
      if (r.consent != null) return r.consent;
      if (r.byOwner && r.need) return 'agreed';
      return null;
    });
    return best ? { value: best.value, at: best.at } : { value: 'pending', at: null };
  }

  // 需求（§2）：need 缺人／enough 人夠了／done 清完了／none 不需處理／blocked 進不去（附可再看時間 until）。
  // 過期只會往「不知道」走，絕不會自己變好（例 6）。
  function deriveNeed(target, reports, now) {
    var best = latestBy(forTarget(reports, target.id), function (r) { return r.need || null; });
    if (!best) return { value: 'unknown', at: null };
    var n = best.value, age = now - best.at;
    if (n.value === 'enough' && age > FADE_MS.enough) return { value: 'unknown', at: best.at, faded: 'enough' };
    if (n.value === 'done' && age > FADE_MS.done) return { value: 'unknown', at: best.at, faded: 'done' };
    if (n.value === 'blocked' && n.until != null && now >= n.until) return { value: 'unknown', at: best.at, faded: 'blocked' };
    return { value: n.value, count: n.count, until: n.until, at: best.at };
  }

  // 四個分類照「現在該做什麼」分（D-16、§0d）。要不要進門只看同意（例 15）。
  function categoryOf(consent, need) {
    if (need.value === 'none') return null;              // 不需處理：仍在名單與分母裡，不列在「選下一戶」（例 10）
    if (consent.value === 'declined') return 'declined';
    if (consent.value === 'pending') return 'ask';
    // 🚧 進不去（blocked）放哪一類規格沒寫；暫放「暫時不用去」（現在做不了）
    if (need.value === 'enough' || need.value === 'done' || need.value === 'blocked') return 'done';
    return 'help';                                       // 已同意或公共區域：缺人、需求不明
  }

  // 一個對象此刻的樣子。lastAt＝最近一筆回報的時間（同意或需求都算），清單上的「最後更新」用它。
  function derive(target, reports, now) {
    var consent = deriveConsent(target, reports);
    var need = deriveNeed(target, reports, now);
    var mine = forTarget(reports, target.id);
    var lastAt = mine.length ? Math.max.apply(null, mine.map(function (r) { return r.at; })) : null;
    return { target: target, consent: consent, need: need, lastAt: lastAt, category: categoryOf(consent, need) };
  }

  // 清單上的需求標籤（§0d）：不同意不顯示需求；尚未取得同意、需求不知道就不寫；已同意或公共區域不知道寫「需求不明」
  function needLabel(d) {
    if (d.consent.value === 'declined') return null;
    switch (d.need.value) {
      case 'need': return { status: 'need', count: d.need.count };
      case 'enough': return { status: 'enough' };
      case 'done': return { status: 'done' };
      case 'unknown': return d.consent.value === 'pending' ? null : { status: 'unknown' };
      default: return null;                              // 🚧 進不去怎麼顯示未定
    }
  }

  // 選下一戶的清單：附近的對象、依走路時間排序、四個分類的數量
  function board(targets, reports, now, maxWalk) {
    var max = maxWalk == null ? NEARBY_MINUTES : maxWalk;
    var rows = targets
      .filter(function (t) { return t.walkMinutes != null && t.walkMinutes <= max; })
      .map(function (t) { return derive(t, reports, now); })
      .filter(function (d) { return d.category; })
      .sort(function (a, b) { return a.target.walkMinutes - b.target.walkMinutes; });
    var counts = { help: 0, ask: 0, declined: 0, done: 0 };
    rows.forEach(function (d) { counts[d.category] += 1; });
    return { rows: rows, counts: counts };
  }

  return {
    FADE_MS: FADE_MS, NEARBY_MINUTES: NEARBY_MINUTES, CATEGORY_KEYS: CATEGORY_KEYS,
    deriveConsent: deriveConsent, deriveNeed: deriveNeed, categoryOf: categoryOf,
    derive: derive, needLabel: needLabel, board: board
  };
});
