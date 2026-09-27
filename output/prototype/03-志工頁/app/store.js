/* ResQ Hub 志工頁：資料層接縫（KEEP）。
   畫面只透過這幾個動作拿資料、送回報。兵推接模擬器、災時接真後端時，只換這一層（D-12：同一套介面、兩種資料來源）。
   這一份是「只在這支手機」的版本：回報存在瀏覽器裡，不傳給任何人。 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ResQStore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function storage() {
    try { return typeof localStorage !== 'undefined' ? localStorage : null; } catch (e) { return null; }
  }
  function read(key) {
    try { var s = storage(); var v = s && s.getItem(key); return v ? JSON.parse(v) : null; } catch (e) { return null; }
  }
  function write(key, value) {
    try { var s = storage(); if (s) s.setItem(key, JSON.stringify(value)); } catch (e) { /* 存不了就只留在這一頁 */ }
  }
  function forget(key) {
    try { var s = storage(); if (s) s.removeItem(key); } catch (e) { /* 同上 */ }
  }

  // 回報只增不減、不改（§2：留下完整歷程）。每一筆：{ id, target, at, consent?, need?, byOwner?, role, channel }
  // 沒有使用者欄位：收情報之前不問你是誰（D-01）。
  function createLocalStore(seed) {
    var key = seed.storageKey;
    var saved = key ? read(key) : null;
    var state = {
      targets: seed.targets,
      reports: saved ? saved.reports : seed.reports.slice(),
      now: saved ? saved.now : seed.now,
      resume: saved ? saved.resume : null
    };
    var listeners = [];
    function commit() {
      if (key) write(key, { reports: state.reports, now: state.now, resume: state.resume });
      listeners.slice().forEach(function (fn) { fn(); });
    }
    return {
      targets: function () { return state.targets; },
      reports: function () { return state.reports; },
      now: function () { return state.now; },
      // 送一筆回報；時間＝觀察到的時間，這一版就是現在（§1）
      report: function (fields) {
        var r = Object.assign({ id: 'r' + (state.reports.length + 1), at: state.now, role: 'volunteer', channel: 'self' }, fields);
        state.reports = state.reports.concat([r]);
        commit();
        return r;
      },
      // 「你剛剛在」只記在這支手機裡，不上傳（ResumeCard）
      resume: function () { return state.resume; },
      setResume: function (targetId) { state.resume = targetId; commit(); },
      subscribe: function (fn) {
        listeners.push(fn);
        return function () { listeners = listeners.filter(function (x) { return x !== fn; }); };
      },
      // ---- 以下是演習用（THROW）：讓時間往前、重來 ----
      advance: function (ms) { state.now += ms; commit(); },
      reset: function () {
        state.reports = seed.reports.slice(); state.now = seed.now; state.resume = null;
        if (key) forget(key);
        listeners.slice().forEach(function (fn) { fn(); });
      }
    };
  }

  return { createLocalStore: createLocalStore };
});
