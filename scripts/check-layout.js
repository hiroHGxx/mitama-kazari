/* 御霊かざり 画面の実測。
 *
 *   NODE_PATH=../shikifuda-kasane/node_modules node scripts/check-layout.js
 *   （puppeteer-core は既存作から借りる。この作品には入れない）
 *
 * 見るもの:
 *   1 押し所が最初の画面に収まる  第0便で「写真に保存」が画面外へ出た。二度踏まないため実測する
 *   2 押し所の実寸と文字の大きさ  24pxの床・12pxの床（SHITSURAE §2 §3）
 *   3 顔アイコン29柱が全部出る    素材蔵ではなく canon 側の別ホストから来る
 *   4 札絵が4系統ぜんぶ読める      /fuda/ /fuda/v2/ /fuda/v3/ /fuda/app/ と _v2 _v3 のファイル名変種
 *   5 選び直しても canvas が汚れない  crossOrigin が効いていないと toBlob が落ちる
 *   6 連打しても最後の一枚に落ち着く  古い読み込みが後から返って上書きしないこと
 *
 * 罠:
 *   - **ヘッドレスChromeの `screen.width` はOSの画面を返す。**viewport を 393 にしても 393 にならない。
 *     額装の寸法は `#size=1179x2556` で上書きして測る。
 *   - **検証用のサーバーはこの中で立てて、この中で閉じる。**外に残すと継続実行になる。
 */
'use strict';
const puppeteer = require('puppeteer-core');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const ROOT = path.join(__dirname, '..');
const HTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

let failures = 0;
function ok(label, note) { console.log(`  ✓ ${label}${note ? '  ' + note : ''}`); }
function ng(label, note) { failures++; console.log(`  ✗ ${label}${note ? '  ' + note : ''}`); }
function judge(cond, label, note) { (cond ? ok : ng)(label, note); }

/* 端末ごとの見え方。高さは「iOS Safari の上下バーが出ている時の実効値」を採る。
   852 や 667 は全画面の値で、実際に見えているのはそれより低い。 */
const DEVICES = [
  { name: 'iPhone 15/16（バー表示中）', w: 393, h: 740, real: '1179x2556' },
  { name: 'iPhone SE（バー表示中）',    w: 375, h: 560, real: '750x1334'  },
  { name: 'iPhone 15/16（全画面）',     w: 393, h: 852, real: '1179x2556' }
];

async function main() {
  const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(HTML);
  });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}/`;

  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    /* ---------- 1・2 各端末で押し所と文字を測る ---------- */
    for (const dev of DEVICES) {
      console.log(`\n【${dev.name}】 ${dev.w}×${dev.h}`);
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: dev.w, height: dev.h, deviceScaleFactor: 2 });
      await page.goto(base + '#size=' + dev.real, { waitUntil: 'load' });
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });

      const m = await page.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const save = document.getElementById('save');
        const depth = [...document.querySelectorAll('#depth button')];
        const sizes = [...document.querySelectorAll('body *')]
          .filter(el => el.children.length === 0 && el.textContent.trim())
          .map(el => ({ t: el.textContent.trim().slice(0, 12), px: parseFloat(getComputedStyle(el).fontSize) }));
        return {
          saveBottom: r(save).bottom,
          saveTop: r(save).top,
          chooser: (({ width, height }) => ({ width, height }))(r(document.getElementById('chooser'))),
          depthMin: Math.min(...depth.map(b => Math.min(r(b).width, r(b).height))),
          depthCount: depth.length,
          frameH: r(document.getElementById('frame')).height,
          docH: document.documentElement.scrollHeight,
          smallest: sizes.reduce((a, b) => (b.px < a.px ? b : a), { t: '-', px: 999 })
        };
      });

      judge(m.saveBottom <= dev.h, '「写真に保存」が最初の画面に収まる',
        `下端 ${m.saveBottom.toFixed(0)}px / 画面 ${dev.h}px（余り ${(dev.h - m.saveBottom).toFixed(0)}px）`);
      judge(m.depthCount === 10, '深さの帯が10段', `${m.depthCount}段`);
      judge(m.depthMin >= 24, '深さの押し所が24px以上', `最小 ${m.depthMin.toFixed(1)}px`);
      judge(Math.min(m.chooser.width, m.chooser.height) >= 24, '御霊を選ぶ入口が24px以上',
        `${m.chooser.width.toFixed(0)}×${m.chooser.height.toFixed(0)}px`);
      judge(m.smallest.px >= 12, '12px未満の文字が無い', `最小 ${m.smallest.px}px「${m.smallest.t}」`);
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));
      console.log(`     （枠 ${m.frameH.toFixed(0)}px / 文書全体 ${m.docH}px）`);
      await page.close();
    }

    /* ---------- 3 顔アイコン29柱 ---------- */
    console.log('\n【顔アイコン】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await page.click('#chooser');
      // lazy 読み込みなので、札の中を最後まで送ってから数える
      await page.evaluate(async () => {
        const body = document.getElementById('pickBody');
        for (let y = 0; y <= body.scrollHeight; y += 120) {
          body.scrollTop = y;
          await new Promise(r => setTimeout(r, 120));
        }
      });
      const icons = await page.evaluate(() => {
        const imgs = [...document.querySelectorAll('#pickBody img')];
        return {
          total: imgs.length,
          loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
          broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)
        };
      });
      judge(icons.total === 29, '札に29柱ならんでいる', `${icons.total}柱`);
      judge(icons.broken.length === 0 && icons.loaded === 29, '顔アイコンが29柱ぜんぶ出る',
        `読めた ${icons.loaded}/29` + (icons.broken.length ? ' / 欠け ' + icons.broken.join(',') : ''));
      await page.close();
    }

    /* ---------- 札の閉じ方（✕・外側タップ・Esc）。既存作と同じ作法か ---------- */
    console.log('\n【御霊を選ぶ札の作法】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      const shown = () => page.evaluate(() => document.getElementById('picker').classList.contains('show'));

      await page.click('#chooser');
      judge(await shown(), '入口を押すと開く');
      await page.click('#pick-close');
      judge(!(await shown()), '✕ で閉じる');

      await page.click('#chooser');
      await page.evaluate(() => {
        const p = document.getElementById('picker');
        const r = p.getBoundingClientRect();
        p.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
      });
      judge(!(await shown()), '外側タップで閉じる');

      await page.click('#chooser');
      await page.keyboard.press('Escape');
      judge(!(await shown()), 'Esc で閉じる');

      // 選ぶと札が閉じ、入口の名札が入れ替わる
      await page.click('#chooser');
      await page.evaluate(() => {
        [...document.querySelectorAll('#pickBody button')]
          .find(b => b.querySelector('img').src.includes('/shinra_icon.webp')).click();
      });
      const after = await page.evaluate(() => ({
        open: document.getElementById('picker').classList.contains('show'),
        name: document.getElementById('chooserName').textContent,
        pressed: [...document.querySelectorAll('#pickBody button')]
          .filter(b => b.getAttribute('aria-pressed') === 'true').length
      }));
      judge(!after.open, '選ぶと札が閉じる');
      judge(after.name === 'シンラ', '入口の名札が入れ替わる', after.name);
      judge(after.pressed === 1, '選んだ印はひとつだけ', `${after.pressed}件`);
      await page.close();
    }

    /* ---------- 4・5 4系統の札絵と、選び直したあとの書き出し ---------- */
    console.log('\n【札絵の4系統と書き出し】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });

      // 径路とファイル名の型を網羅する組み合わせ
      const cases = [
        ['anne', 5, '/fuda/ 直下'],
        ['atoza', 5, '/fuda/v2/'],
        ['benten', 5, '/fuda/v3/'],
        ['sakuya', 5, '/fuda/app/'],
        ['aun', 5, 'ファイル名に _v2'],
        ['orochi', 7, 'ファイル名に _v3'],
        ['orochi', 1, '同じ柱の素の型']
      ];
      for (const [id, depth, label] of cases) {
        const r = await page.evaluate(async (id, depth) => {
          const cv = document.getElementById('cv');
          document.querySelector(`#pickBody button[aria-label^="${''}"]`); // noop
          // 画面の操作と同じ道で選ぶ（内部関数を叩かない）
          const btn = [...document.querySelectorAll('#pickBody button')]
            .find(b => b.querySelector('img').src.includes('/' + id + '_icon.webp'));
          if (!btn) return { err: '札に ' + id + ' が無い' };
          btn.click();
          document.querySelectorAll('#depth button')[depth - 1].click();
          const t0 = Date.now();
          while (document.getElementById('save').disabled) {
            if (Date.now() - t0 > 30000) return { err: '30秒たっても焼き上がらない' };
            await new Promise(r => setTimeout(r, 100));
          }
          let bytes = -1;
          try {
            bytes = await new Promise(res => cv.toBlob(b => res(b ? b.size : -1), 'image/png'));
          } catch (e) { return { err: 'toBlob: ' + e.message }; }
          return { bytes, tainted: bytes < 0 };
        }, id, depth);
        if (r.err) ng(`${label}（${id} 深さ${depth}）`, r.err);
        else judge(!r.tainted && r.bytes > 0, `${label}（${id} 深さ${depth}）`,
          `${Math.round(r.bytes / 1024)} KB を書き出せた`);
      }
      await page.close();
    }

    /* ---------- 6 連打しても最後の一枚に落ち着く ---------- */
    console.log('\n【連打】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      const r = await page.evaluate(async () => {
        const btns = [...document.querySelectorAll('#depth button')];
        [2, 9, 4, 10, 3].forEach(d => btns[d - 1].click());   // 待たずに続けて押す
        const t0 = Date.now();
        while (document.getElementById('save').disabled) {
          if (Date.now() - t0 > 30000) return { err: '焼き上がらない' };
          await new Promise(r => setTimeout(r, 100));
        }
        await new Promise(r => setTimeout(r, 2500));           // 遅れて届く読み込みを待ち受ける
        const pressed = btns.findIndex(b => b.getAttribute('aria-pressed') === 'true') + 1;
        let stored = null;
        try { stored = JSON.parse(localStorage.getItem('mitama-kazari.pick')); } catch (e) {}
        return { pressed, stored, disabled: document.getElementById('save').disabled };
      });
      if (r.err) ng('連打のあと', r.err);
      else {
        judge(r.pressed === 3, '最後に押した段が選ばれたまま', `深さ ${r.pressed}`);
        judge(r.stored && r.stored.depth === 3, '控えも最後の一枚', JSON.stringify(r.stored));
        judge(r.disabled === false, '保存が押せる状態に戻っている');
      }
      await page.close();
    }

    /* ---------- 控えが無い環境でも開く ---------- */
    console.log('\n【控えが使えない環境】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(() => {
        Object.defineProperty(window, 'localStorage', {
          get() { throw new Error('localStorage は使えません'); }
        });
      });
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      let baked = true;
      try {
        await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      } catch (e) { baked = false; }
      judge(baked && errors.length === 0, 'localStorage が例外を投げても最後まで動く',
        errors.join(' / '));
      await page.close();
    }
  } finally {
    await browser.close();
    await new Promise(r => server.close(r));   // 立てたサーバーはここで閉じる
  }

  console.log(failures === 0 ? '\n通った。' : `\n落ちた項目が ${failures} 件ある。`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
