// 畫面截圖比對的設定（D-19）。
// 怎麼跑、畫面變了怎麼更新基準圖：output/prototype/03-志工頁/README.md 第 5 節。
const path = require('path');
const { defineConfig } = require('@playwright/test');

const REPO = path.resolve(__dirname, '..', '..');
const PORT = 4319;

module.exports = defineConfig({
  testDir: __dirname,
  testMatch: '*.spec.js',
  outputDir: path.join(__dirname, 'test-results'),
  // 基準圖放在畫面旁邊：output/prototype/<哪一頁>/screens/<作業系統>/<哪一格>.png
  // linux＝GitHub 上跑出來的那一份，進 repo，只有它算數；
  // darwin＝在 Mac 上改畫面時自己先看一眼用的，不進 repo（兩邊字型不同，圖不可能一樣）。
  snapshotPathTemplate: path.join(REPO, 'output', 'prototype', '{arg}{ext}'),
  // GitHub 上只比對、不寫檔：少一張基準圖就是紅燈，不會自己補上。
  updateSnapshots: process.env.CI ? 'none' : 'missing',
  forbidOnly: !!process.env.CI,
  retries: 0,
  workers: 1,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  expect: {
    toHaveScreenshot: {
      // 同一種機器、同一份程式畫兩次應該一模一樣，所以一個點都不能不同（maxDiffPixels）。
      // 每個點的顏色只留一點點餘地（threshold），吸收不同機器算出來的雜訊。
      // 實測（2026-10-01）：間距差 1px、字換一個、灰階差 6 都會被抓到；顏色只差 2～4 抓不到，
      // 那種改動由 token 的檢查負責（顏色只能從 tokens.json 改，kb.py check）。
      maxDiffPixels: 0,
      threshold: 0.02,
      animations: 'disabled',
      scale: 'css',
    },
  },
  use: {
    browserName: 'chromium',
    baseURL: 'http://127.0.0.1:' + PORT + '/',
    viewport: { width: 1280, height: 900 },
    deviceScaleFactor: 1,
    locale: 'zh-TW',
    timezoneId: 'Asia/Taipei',
    colorScheme: 'light',
  },
  // 用最陽春的方式把整個 repo 當網站開起來，跟「直接打開 gallery.html」是同一份檔案。
  webServer: {
    command: 'python3 -m http.server ' + PORT + ' --bind 127.0.0.1',
    cwd: REPO,
    url: 'http://127.0.0.1:' + PORT + '/',
    reuseExistingServer: false,
    stdout: 'ignore',
    stderr: 'ignore',
  },
});
