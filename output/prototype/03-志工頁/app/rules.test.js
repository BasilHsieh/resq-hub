// 規格的例子（資料模型與狀態機 §7）寫成會自動跑的測試。這一份就是「動態規格」：測試沒過，程式就不能改（D-18）。
// 跑法：node --test "output/prototype/03-志工頁/app/rules.test.js"
// 例 1 的「多久沒人去過」、例 8 的覆蓋率是兵推結算的數字，不在志工頁，測試在 01 兵推。
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const R = require('./rules.js');

const H = 3600 * 1000;
const at = (day, hh, mm = 0) => day * 24 * H + hh * H + mm * 60 * 1000; // 想定裡的模擬時鐘：T+day 天 hh:mm
const house = (id, walk = 3) => ({ id, kind: 'household', address: id, walkMinutes: walk });
const place = (id, walk = 3) => ({ id, kind: 'place', address: id, walkMinutes: walk });

test('例 1 · 從來沒人去過的戶：尚未取得同意、需求不知道、沒有更新時間', () => {
  const d = R.derive(house('大全街 12 號'), [], at(5, 9));
  assert.equal(d.consent.value, 'pending');
  assert.equal(d.need.value, 'unknown');
  assert.equal(d.lastAt, null);
  assert.equal(d.category, 'ask');
});

test('例 2 · 需求不會自己消失', () => {
  const reports = [{ target: 'a', at: at(4, 14), consent: 'agreed', need: { value: 'need', count: 3 } }];
  const d = R.derive(house('a'), reports, at(5, 8));
  assert.equal(d.need.value, 'need');
  assert.equal(d.need.count, 3);
  assert.equal(d.need.at, at(4, 14)); // 畫面寫「最後更新」那一筆的時間，看的人自己判斷新舊
});

test('例 3 · 「沒事」會過期：清完了超過 24 小時回到不知道', () => {
  const reports = [{ target: 'a', at: at(4, 14), consent: 'agreed', need: { value: 'done' } }];
  assert.equal(R.derive(house('a'), reports, at(5, 13)).need.value, 'done');
  const d = R.derive(house('a'), reports, at(5, 15));
  assert.equal(d.need.value, 'unknown');
  assert.equal(d.need.faded, 'done');
  assert.equal(d.category, 'help'); // 已同意、需求不明 → 可以直接幫忙
});

test('例 4 · 兩筆衝突取最新，舊的留在歷程裡', () => {
  const reports = [
    { target: 'a', at: at(5, 9), consent: 'agreed', need: { value: 'need', count: 2 } },
    { target: 'a', at: at(5, 11), need: { value: 'done' } },
  ];
  assert.equal(R.derive(house('a'), reports, at(5, 12)).need.value, 'done');
  assert.equal(reports.length, 2);
  // 送出的順序不影響：看的是觀察到的時間
  assert.equal(R.derive(house('a'), reports.slice().reverse(), at(5, 12)).need.value, 'done');
});

test('例 5 · 進不去：可再看時間之前維持，之後回到不知道', () => {
  const reports = [{ target: 'a', at: at(5, 10), consent: 'agreed', need: { value: 'blocked', until: at(7, 0) } }];
  assert.equal(R.derive(house('a'), reports, at(6, 12)).need.value, 'blocked');
  const d = R.derive(house('a'), reports, at(7, 0, 1));
  assert.equal(d.need.value, 'unknown');
  assert.equal(d.need.faded, 'blocked');
});

test('例 6 · 時間往前走不會讓情況變好', () => {
  const cases = [
    [],
    [{ target: 'a', at: at(5, 9), consent: 'agreed', need: { value: 'need', count: 4 } }],
    [{ target: 'a', at: at(5, 9), consent: 'agreed', need: { value: 'enough' } }],
    [{ target: 'a', at: at(5, 9), consent: 'agreed', need: { value: 'done' } }],
  ];
  for (const reports of cases) {
    let before = R.derive(house('a'), reports, at(5, 9)).need.value;
    for (let h = 1; h <= 24 * 10; h += 1) {
      const now = R.derive(house('a'), reports, at(5, 9) + h * H).need.value;
      if (before === 'unknown') assert.equal(now, 'unknown'); // 不知道不會自己變成缺人或清完
      if (before === 'need') assert.equal(now, 'need');       // 缺人不會自己變好
      before = now;
    }
  }
});

test('例 7 · 不需處理不褪色，也不列在選下一戶', () => {
  const reports = [{ target: 'a', at: at(4, 10), need: { value: 'none' }, channel: 'chief' }];
  const d = R.derive(house('a'), reports, at(9, 10));
  assert.equal(d.need.value, 'none');
  assert.equal(d.category, null);
});

test('例 8 · 滿了不是清完了：人夠了放「暫時不用去」', () => {
  const reports = [
    { target: 'a', at: at(5, 9), byOwner: true, need: { value: 'need', count: 5 } },
    { target: 'a', at: at(5, 10), need: { value: 'enough' } },
  ];
  const d = R.derive(house('a'), reports, at(5, 10, 30));
  assert.equal(d.need.value, 'enough');
  assert.equal(d.category, 'done');
});

test('例 9 · 滿了會過期：超過 3 小時回到不知道，不自動回到缺人', () => {
  const reports = [
    { target: 'a', at: at(5, 9), byOwner: true, need: { value: 'need', count: 5 } },
    { target: 'a', at: at(5, 10), need: { value: 'enough' } },
  ];
  assert.equal(R.derive(house('a'), reports, at(5, 12, 59)).need.value, 'enough');
  const d = R.derive(house('a'), reports, at(5, 13, 30));
  assert.equal(d.need.value, 'unknown');
  assert.equal(d.need.faded, 'enough');
  assert.equal(d.category, 'help');
});

test('例 10 · 名單不能刪：不需處理的戶不在選下一戶，但還在名單裡', () => {
  const targets = [house('a', 2), house('b', 3)];
  const reports = [{ target: 'b', at: at(7, 10), need: { value: 'none' }, channel: 'chief' }];
  const { rows, counts } = R.board(targets, reports, at(7, 11));
  assert.deepEqual(rows.map((d) => d.target.id), ['a']);
  assert.equal(counts.ask, 1);
  assert.equal(targets.length, 2);
  assert.equal(typeof R.remove, 'undefined'); // 沒有任何動作能讓一戶從名單消失
});

test('例 11 · 沒人在家不會被說出來：畫面上的字不准出現「沒人在家」「空屋」', () => {
  const files = [
    path.join(__dirname, 'app.js'),
    path.join(__dirname, 'gallery.js'),
    path.join(__dirname, '../../../design-system/components/bundle.js'),
  ];
  for (const f of files) {
    const src = fs.readFileSync(f, 'utf8');
    const literals = src.match(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g) || [];
    for (const s of literals) {
      assert.ok(!/沒人在家|空屋/.test(s), `${path.basename(f)} 的畫面文字出現「${s}」`);
    }
  }
});

test('例 12 · 不同意不會自己變回來', () => {
  const reports = [{ target: 'a', at: at(6, 10), consent: 'declined' }];
  for (const later of [at(6, 11), at(9, 10), at(60, 0)]) {
    const d = R.derive(house('a'), reports, later);
    assert.equal(d.consent.value, 'declined');
    assert.equal(d.category, 'declined');
  }
  assert.equal(R.needLabel(R.derive(house('a'), reports, at(6, 11))), null); // 不同意不顯示需求
});

test('例 13 · 屋主自己喊就是同意', () => {
  const reports = [{ target: 'a', at: at(6, 8), byOwner: true, need: { value: 'need', count: 5 } }];
  const d = R.derive(house('a'), reports, at(6, 9));
  assert.equal(d.consent.value, 'agreed');
  assert.equal(d.category, 'help');
  assert.deepEqual(R.needLabel(d), { status: 'need', count: 5 });
});

test('例 14 · 地點不用同意', () => {
  const reports = [{ target: 'a', at: at(6, 9), need: { value: 'need', count: 10 } }];
  const d = R.derive(place('a'), reports, at(6, 10));
  assert.equal(d.consent.value, 'public');
  assert.equal(d.category, 'help');
});

test('例 15 · 需求可以先於同意；要不要進門只看同意', () => {
  const neighbor = { target: 'a', at: at(6, 9), need: { value: 'need', count: 5 } };
  let d = R.derive(house('a'), [neighbor], at(6, 9, 30));
  assert.equal(d.category, 'ask');
  assert.deepEqual(R.needLabel(d), { status: 'need', count: 5 }); // 同一列標「尚未取得同意」與「缺 5 人」
  d = R.derive(house('a'), [neighbor, { target: 'a', at: at(6, 10), consent: 'agreed' }], at(6, 10, 30));
  assert.equal(d.category, 'help');
  assert.equal(d.need.count, 5);
  assert.equal(d.need.at, at(6, 9)); // 需求仍是 09:00 那筆
});

test('清單只列附近走路 15 分鐘內，數量也只算附近', () => {
  const { rows, counts } = R.board([house('near', 15), house('far', 16)], [], at(6, 9));
  assert.deepEqual(rows.map((d) => d.target.id), ['near']);
  assert.deepEqual(counts, { help: 0, ask: 1, declined: 0, done: 0 });
});

test('清單上的「最後更新」是最近一筆回報的時間，同意或需求都算', () => {
  const reports = [
    { target: 'a', at: at(6, 9), consent: 'agreed' },
    { target: 'a', at: at(6, 11), need: { value: 'need', count: 2 } },
  ];
  assert.equal(R.derive(house('a'), reports, at(6, 12)).lastAt, at(6, 11));
});
