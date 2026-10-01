// 畫面截圖比對（D-19）：「所有狀態一次攤開」的每一格各截一張圖，跟 repo 裡的基準圖比。
// 規則有測試守著（rules.test.js），這一份守的是長相：畫面變了卻沒有更新基準圖，就是紅燈。
// 基準圖更新了，PR 裡看得到前後對照，Basil merge 就是點頭。
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..');

// 之後有新的「所有狀態一次攤開」（中繼站頁、遠端頁…），在這裡加一行。
const GALLERIES = [
  { prototype: '03-志工頁', page: 'output/prototype/03-志工頁/app/gallery.html' },
];

// 畫面只准連這兩個外部網址（React），而且測試時改從本機給，所以不靠網路。
// 其他任何外部連線都算錯：災區網路不穩，畫面不載入網路字型或別人的檔案（設計系統第 4 節）。
const CDN = 'https://cdnjs.cloudflare.com/ajax/libs/';
const MODULES = path.join(__dirname, 'node_modules');
const LOCAL = {
  [CDN + 'react/18.3.1/umd/react.production.min.js']: path.join(MODULES, 'react', 'umd', 'react.production.min.js'),
  [CDN + 'react-dom/18.3.1/umd/react-dom.production.min.js']: path.join(MODULES, 'react-dom', 'umd', 'react-dom.production.min.js'),
};

for (const g of GALLERIES) {
  test(g.prototype + '：每一格都跟基準圖一樣', async ({ page, baseURL }, testInfo) => {
    const outside = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(baseURL)) return route.continue();
      if (LOCAL[url]) return route.fulfill({ path: LOCAL[url], contentType: 'application/javascript' });
      outside.push(url);
      return route.abort();
    });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));

    await page.goto(encodeURI(g.page));
    await page.waitForFunction(() => window.ResQGallery && document.querySelectorAll('[data-frame]').length === window.ResQGallery.FRAMES.length);
    await page.evaluate(() => document.fonts.ready);

    const ids = await page.evaluate(() => window.ResQGallery.FRAMES.map((f) => f[0]));
    expect(ids.length, '「所有狀態一次攤開」是空的').toBeGreaterThan(0);
    expect(new Set(ids).size, '有兩格用了同一個檔名').toBe(ids.length);
    expect(errors, '頁面有程式錯誤').toEqual([]);
    expect(outside, '畫面連到了外部網址').toEqual([]);

    for (const id of ids) {
      await test.step(id, async () => {
        await expect.soft(page.locator('[data-frame="' + id + '"]')).toHaveScreenshot([g.prototype, 'screens', process.platform, id + '.png']);
      });
    }

    // 基準圖只能剛好是現在這幾格：改名或拿掉一格之後，舊圖不能留著
    const dir = path.join(REPO, 'output', 'prototype', g.prototype, 'screens', process.platform);
    const stale = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith('.png') && !ids.includes(f.normalize('NFC').slice(0, -4))) : [];
    if (['all', 'changed'].includes(testInfo.config.updateSnapshots)) stale.forEach((f) => fs.unlinkSync(path.join(dir, f)));
    else expect.soft(stale, '有多出來的基準圖（那一格已經不在了）').toEqual([]);
  });
}
