/* 夜じたて 画面の実測。
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
 *   7 顔の帯（第5便）              29柱・顔が全部出る・押し所44px以上・帯で選べる
 *   8 深さをなぞって選べる（第5便）  読み込みは離した時に1回だけ
 *   9 開幕「顕れ」の時間割（第5便）  1200ms前は押せない／1260ms以降押せる／タップで飛ばせる／
 *                                  **絵の顕れが終わってから保存が有効になる**
 *
 * 罠:
 *   - **ヘッドレスChromeの `screen.width` はOSの画面を返す。**viewport を 393 にしても 393 にならない。
 *     額装の寸法は `#size=1179x2556` で上書きして測る。
 *   - **検証用のサーバーはこの中で立てて、この中で閉じる。**外に残すと継続実行になる。
 *   - **開幕の時刻は「ページを開いた時刻」から測るので、走らせる側の待ちでは測れない。**
 *     頁の中に定刻の写し取りを仕込んで（evaluateOnNewDocument）、あとから読む。
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
/* 開幕が終わる（＝押せるようになる）まで待つ。第5便から 1260ms は誰も押せない。
   **指と同じ関門を通す**ため、待たずに叩く検査を書かない
   （待たずに page.click すると pointer-events:none をすり抜けて別の要素を叩き、
     「開かない」という嘘の落ち方をする）。 */
const ready = page => page.waitForFunction(
  () => !document.body.classList.contains('locked'), { timeout: 15000 });
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
      await ready(page);
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

    /* ---------- 7 顔の帯（第5便・最初の画面に29柱の顔がいる） ---------- */
    console.log('\n【顔の帯】');
    {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      // lazy 読み込みなので、帯を端まで送ってから数える
      await page.evaluate(async () => {
        const s = document.getElementById('strip');
        for (let x = 0; x <= s.scrollWidth; x += 200) {
          s.scrollLeft = x;
          await new Promise(r => setTimeout(r, 120));
        }
        await new Promise(r => setTimeout(r, 600));
      });
      const m = await page.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const btns = [...document.querySelectorAll('#strip button')];
        const imgs = [...document.querySelectorAll('#strip img')];
        return {
          count: btns.length,
          minSide: Math.min(...btns.map(b => Math.min(r(b).width, r(b).height))),
          loaded: imgs.filter(i => i.complete && i.naturalWidth > 0).length,
          broken: imgs.filter(i => i.complete && i.naturalWidth === 0).map(i => i.src),
          // <img> に click を付けていないこと（SHITSURAE §2）。押し所は button の側にある
          imgHandlers: imgs.filter(i => i.onclick).length,
          pressed: btns.filter(b => b.getAttribute('aria-pressed') === 'true').length,
          gaps: document.querySelectorAll('#strip .sato-gap').length,
          minName: Math.min(...[...document.querySelectorAll('#strip button span')]
            .map(s => parseFloat(getComputedStyle(s).fontSize)))
        };
      });
      judge(m.count === 29, '帯に29柱ならんでいる', `${m.count}柱`);
      judge(m.broken.length === 0 && m.loaded === 29, '帯の顔が29柱ぜんぶ出る',
        `読めた ${m.loaded}/29` + (m.broken.length ? ' / 欠け ' + m.broken.join(',') : ''));
      judge(m.minSide >= 44, '帯の押し所が44px以上', `最小 ${m.minSide.toFixed(1)}px`);
      judge(m.imgHandlers === 0, '<img> にクリックを付けていない');
      judge(m.pressed === 1, '帯の選んだ印はひとつだけ', `${m.pressed}件`);
      judge(m.gaps === 4, '里の境に隙間がある（5里 → 4か所）', `${m.gaps}か所`);
      judge(m.minName >= 12, '帯の名前が12px以上', `最小 ${m.minName}px`);

      // 帯で選ぶと額の中が入れ替わる（札に潜らない）
      const after = await page.evaluate(async () => {
        const b = [...document.querySelectorAll('#strip button')]
          .find(x => x.querySelector('img').src.includes('/shinra_icon.webp'));
        if (!b) return { err: '帯に shinra が無い' };
        b.click();
        const t0 = Date.now();
        while (document.getElementById('save').disabled) {
          if (Date.now() - t0 > 30000) return { err: '30秒たっても焼き上がらない' };
          await new Promise(r => setTimeout(r, 100));
        }
        return {
          name: document.getElementById('chooserName').textContent,
          pickerOpen: document.getElementById('picker').classList.contains('show'),
          pressed: [...document.querySelectorAll('#strip button')]
            .filter(x => x.getAttribute('aria-pressed') === 'true').length
        };
      });
      if (after.err) ng('帯で選ぶと額が入れ替わる', after.err);
      else {
        judge(after.name === 'シンラ', '帯で選ぶと名札が入れ替わる', after.name);
        judge(!after.pickerOpen, '帯で選んでも札は開かない');
        judge(after.pressed === 1, '選んだあとも印はひとつだけ', `${after.pressed}件`);
      }
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));
      await page.close();
    }

    /* ---------- 8 深さをなぞって選ぶ（第5便） ---------- */
    console.log('\n【深さをなぞる】');
    {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      // 読みにいった回数を数える。1回の読み込み＝1回「写真に保存」が伏せられる。
      // 網の回数では測れない（先読みが同じURLを温めているので、2度目は網に出ない）。
      await page.evaluate(() => {
        window.__reloads = 0;
        const s = document.getElementById('save');
        new MutationObserver(() => { if (s.disabled) window.__reloads++; })
          .observe(s, { attributes: true, attributeFilter: ['disabled'] });
      });

      const box = await page.evaluate(() => {
        const bs = [...document.querySelectorAll('#depth button')];
        const a = bs[1].getBoundingClientRect(), b = bs[7].getBoundingClientRect();
        return { x1: a.left + a.width / 2, x2: b.left + b.width / 2, y: a.top + a.height / 2 };
      });
      await page.mouse.move(box.x1, box.y);
      await page.mouse.down();
      await page.mouse.move(box.x2, box.y, { steps: 12 });   // 2段目 → 8段目までなぞる
      const mid = await page.evaluate(() => ({
        pressed: [...document.querySelectorAll('#depth button')]
          .findIndex(b => b.getAttribute('aria-pressed') === 'true') + 1,
        num: document.getElementById('depthNum').textContent
      }));
      await page.mouse.up();
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      const end = await page.evaluate(() => ({
        pressed: [...document.querySelectorAll('#depth button')]
          .findIndex(b => b.getAttribute('aria-pressed') === 'true') + 1,
        num: document.getElementById('depthNum').textContent,
        // 数字は選んだ段にだけ出す
        numbered: [...document.querySelectorAll('#depth button')].filter(b => b.textContent.trim()).length,
        labels: [...document.querySelectorAll('#depth button')]
          .filter(b => /^深さ \d+$/.test(b.getAttribute('aria-label') || '')).length,
        // 選んだ段まで金泥が満ちているか（下の段に地が残っていないか）
        filled: [...document.querySelectorAll('#depth button')]
          .map(b => b.style.backgroundColor).filter(v => v && v !== '').length,
        reloads: window.__reloads
      }));
      judge(mid.pressed === 8, 'なぞった先の段に印が動く', `深さ ${mid.pressed}（表示 ${mid.num}）`);
      judge(end.pressed === 8 && end.num === '08', '離した段に落ち着く', `深さ ${end.pressed}（表示 ${end.num}）`);
      judge(end.numbered === 1, '数字は選んだ段にだけ出る', `${end.numbered}段`);
      judge(end.labels === 10, '10段すべてに aria-label が残っている', `${end.labels}段`);
      judge(end.filled === 8, '選んだ段まで金泥が満ちる', `${end.filled}段ぶん`);
      judge(end.reloads <= 2, 'なぞり1回の読み込みは1回だけ（6段またいでも増えない）',
        `読み込み ${end.reloads}回`);
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));
      await page.close();
    }

    /* ---------- 札の閉じ方（✕・外側タップ・Esc）。既存作と同じ作法か ---------- */
    console.log('\n【御霊を選ぶ札の作法】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
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
        try { stored = JSON.parse(localStorage.getItem('yo-jitate.pick')); } catch (e) {}
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

    /* ---------- 保存が通ったときだけ出る札（第5便・SPEC §2.4） ----------
       ヘッドレスの navigator.share は呼んでも解決も棄却もしない（共有UIが無い）ので、
       **3つの結末を仕込んで**それぞれの出方を見る。実機の share は本人が確かめる。 */
    console.log('\n【保存後の札】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      const shown = () => page.evaluate(() => document.getElementById('tips').classList.contains('show'));

      // ① 取り消された（AbortError）… 保存していないので出さない
      await page.evaluate(() => {
        navigator.canShare = () => true;
        navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }));
      });
      await page.click('#save');
      await new Promise(r => setTimeout(r, 400));
      judge(!(await shown()), '取り消し（AbortError）では札を出さない');

      // ② 共有シートが通った
      await page.evaluate(() => { navigator.share = () => Promise.resolve(); });
      await page.click('#save');
      await page.waitForFunction(() => document.getElementById('tips').classList.contains('show'), { timeout: 5000 })
        .then(() => ok('共有シートが通ったら札を出す')).catch(() => ng('共有シートが通ったら札を出す'));

      // 閉じ方は #picker と同じ作法（✕・外側タップ・Esc）
      await page.click('#tips-close');
      judge(!(await shown()), '✕ で閉じる');
      await page.evaluate(() => { document.getElementById('tips').classList.add('show'); });
      await page.evaluate(() => {
        const t = document.getElementById('tips');
        const r = t.getBoundingClientRect();
        t.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
      });
      judge(!(await shown()), '外側タップで閉じる');
      await page.evaluate(() => { document.getElementById('tips').classList.add('show'); });
      await page.keyboard.press('Escape');
      judge(!(await shown()), 'Esc で閉じる');

      // ③ download 経路（デスクトップ・Android）でも出す
      await page.evaluate(() => { navigator.canShare = () => false; });
      await page.click('#save');
      await page.waitForFunction(() => document.getElementById('tips').classList.contains('show'), { timeout: 5000 })
        .then(() => ok('download 経路が通っても札を出す')).catch(() => ng('download 経路が通っても札を出す'));

      // 中身は「壁紙にする手順」の2段落そのまま（文言の正本は1か所）
      const same = await page.evaluate(() => {
        const norm = s => s.replace(/\s+/g, '');
        return norm(document.getElementById('tipsBody').textContent)
            === norm(document.getElementById('howtoText').textContent);
      });
      judge(same, '札の中身が「壁紙にする手順」と同じ文言');

      // 押し所を画面のいちばん下端に置かない（ホームバーに飲まれる）
      const gap = await page.evaluate(() => {
        const r = document.querySelector('#tips .pick-card').getBoundingClientRect();
        return innerHeight - r.bottom;
      });
      judge(gap >= 16, '札の下端が画面のいちばん下でない', `下に ${gap.toFixed(0)}px 空いている`);
      await page.close();
    }

    /* ---------- 9 開幕「顕れ」の時間割（第5便・SHITSURAE §1） ----------
       時刻は**ページを開いた時刻**が起点。走らせる側の待ちでは測れないので、
       頁の中に定刻の写し取りを仕込んでおいて、あとから読む。 */
    console.log('\n【開幕（顕れ）】');
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(() => {
        window.__snaps = {};
        window.__enableLog = [];
        const snap = () => {
          const s = document.getElementById('save');
          const r = s.getBoundingClientRect();
          return {
            t: Math.round(performance.now()),
            pe: getComputedStyle(s).pointerEvents,
            op: +getComputedStyle(document.querySelector('h1')).opacity,
            // 押せるかは pointer-events だけでなく、実際にその点で拾えるかで見る
            hit: document.elementFromPoint(Math.round(r.left + r.width / 2),
                                           Math.round(r.top + r.height / 2)) === s
          };
        };
        document.addEventListener('DOMContentLoaded', () => {
          [[600, 't600'], [1100, 't1100'], [1400, 't1400'], [2200, 't2200']]
            .forEach(([ms, k]) => setTimeout(() => { window.__snaps[k] = snap(); }, ms));
          // 「写真に保存」が有効になった瞬間に、絵の顕れが終わっているか
          const s = document.getElementById('save');
          new MutationObserver(() => {
            if (s.disabled) return;
            const rv = window.__yojitateReveal;
            window.__enableLog.push({
              t: Math.round(performance.now()),
              alpha: rv ? rv.alpha : null, running: rv ? rv.running : null
            });
          }).observe(s, { attributes: true, attributeFilter: ['disabled'] });
        });
      });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__snaps && window.__snaps.t2200, { timeout: 30000 });
      await page.waitForFunction(() => !document.getElementById('save').disabled, { timeout: 30000 });
      const s = await page.evaluate(() => ({ snaps: window.__snaps, log: window.__enableLog }));

      judge(s.snaps.t600.op < 0.02 && s.snaps.t600.pe === 'none' && !s.snaps.t600.hit,
        '600ms は部品が伏せていて押せない',
        `opacity ${s.snaps.t600.op} / pointer-events ${s.snaps.t600.pe}`);
      judge(s.snaps.t1100.pe === 'none' && !s.snaps.t1100.hit,
        '1200ms 前は部品が押せない', `pointer-events ${s.snaps.t1100.pe}`);
      judge(s.snaps.t1400.pe !== 'none' && s.snaps.t1400.hit,
        '1260ms 以降は押せる', `t=${s.snaps.t1400.t}ms / pointer-events ${s.snaps.t1400.pe}`);
      judge(s.snaps.t2200.op > 0.99, '1900ms 以降は完全不透明', `opacity ${s.snaps.t2200.op}`);
      judge(s.log.length > 0 && s.log.every(e => e.alpha === 1 && e.running === false),
        '絵の顕れが終わってから保存が有効になる',
        s.log.map(e => `t=${e.t}ms alpha=${e.alpha}`).join(' / ') || '一度も有効にならなかった');
      await page.close();
    }

    /* ---------- 9-b 画面のどこをタップしても飛ばせる ---------- */
    {
      const page = await browser.newPage();
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      await page.evaluateOnNewDocument(() => {
        window.__skip = {};
        document.addEventListener('DOMContentLoaded', () => {
          setTimeout(() => {
            window.__skip.tapAt = Math.round(performance.now());
            // 実際の指と同じ道（どこを叩いても document まで上がってくる）
            document.body.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
            setTimeout(() => {
              const s = document.getElementById('save');
              const r = s.getBoundingClientRect();
              window.__skip.after = {
                t: Math.round(performance.now()),
                op: +getComputedStyle(document.querySelector('h1')).opacity,
                pe: getComputedStyle(s).pointerEvents,
                hit: document.elementFromPoint(Math.round(r.left + r.width / 2),
                                               Math.round(r.top + r.height / 2)) === s
              };
            }, 60);
          }, 400);
        });
      });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await page.waitForFunction(() => window.__skip && window.__skip.after, { timeout: 30000 });
      const k = await page.evaluate(() => window.__skip);
      judge(k.after.t < 1200, '飛ばしの確認は 1200ms より前に済んでいる', `t=${k.after.t}ms`);
      judge(k.after.op > 0.99 && k.after.pe !== 'none' && k.after.hit,
        'タップで開幕を飛ばせる（即座に立ち上がって押せる）',
        `タップ ${k.tapAt}ms → ${k.after.t}ms で opacity ${k.after.op} / 押せる ${k.after.hit}`);
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
