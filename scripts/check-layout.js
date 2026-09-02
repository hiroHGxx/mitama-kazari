/* 夜じたて 画面の実測。
 *
 *   NODE_PATH=../shikifuda-kasane/node_modules node scripts/check-layout.js
 *   （puppeteer-core は既存作から借りる。この作品には入れない）
 *
 * 見るもの:
 *   1 額が全部見える（第6便）      上端が画面内・下端が引き出しの上端より上・左右が画面内
 *   2 額の実寸（第6便）            393×740 で 閉 ≥250px 幅・開 ≥180px 幅／**閉じると額が大きくなる**
 *   3 保存が画面内で最下端に触れない 第0便で画面外へ出た。ホームバーに飲まれないことも見る
 *   4 頁が縦にスクロールしない（第6便） 1画面のアプリなので scrollHeight ≦ clientHeight
 *   5 引き出し（第6便）            つまみで開閉・aria-expanded が変わる・閉のとき帯と階梯が消える・
 *                                  つまみと名札の縦スワイプでも開閉する（そのとき札は開かない）
 *   6 ≡ の札（第6便）              開く・✕・外側・Esc／中に #dailyBox・#copyUrl・#log・二次創作の明記／
 *                                  #copyUrl が従来どおり動く（clipboard を差し替えて書き込みを数える）
 *   7 押し所の実寸と文字の大きさ    ≡・つまみ・名札・帯は44px／階梯は24px／12pxの床（SHITSURAE §2 §3）
 *   8 顔アイコン29柱が全部出る      素材蔵ではなく canon 側の別ホストから来る
 *   9 札絵が4系統ぜんぶ読める        /fuda/ /fuda/v2/ /fuda/v3/ /fuda/app/ と _v2 _v3 のファイル名変種
 *  10 選び直しても canvas が汚れない  crossOrigin が効いていないと toBlob が落ちる
 *  11 連打しても最後の一枚に落ち着く  古い読み込みが後から返って上書きしないこと
 *  12 顔の帯（第5便）              29柱・顔が全部出る・押し所44px以上・帯で選べる
 *  13 深さをなぞって選べる（第5便）  読み込みは離した時に1回だけ
 *  14 開幕「顕れ」の時間割（第5便）  1200ms前は押せない／1260ms以降押せる／タップで飛ばせる／
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
const SIZES = [];   // 額の実寸（端末 × 開／閉）。最後に表で出す
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
      await ready(page);   // 開幕が終わるまで叩かない。**検査は指と同じ関門を通す**（第5便で踏んだ穴）

      const shot = () => page.evaluate(() => {
        const r = el => el.getBoundingClientRect();
        const box = el => { const b = r(el); return { top: b.top, bottom: b.bottom, left: b.left, right: b.right, w: b.width, h: b.height }; };
        const depth = [...document.querySelectorAll('#depth button')];
        const strip = [...document.querySelectorAll('#strip button')];
        const sizes = [...document.querySelectorAll('body *')]
          .filter(el => el.children.length === 0 && el.textContent.trim())
          .map(el => ({ t: el.textContent.trim().slice(0, 12), px: parseFloat(getComputedStyle(el).fontSize) }));
        return {
          save: box(document.getElementById('save')),
          frame: box(document.getElementById('frame')),
          sheet: box(document.getElementById('sheet')),
          menuBtn: box(document.getElementById('menuBtn')),
          grip: box(document.getElementById('grip')),
          chooser: box(document.getElementById('chooser')),
          stripMin: strip.length ? Math.min(...strip.map(b => Math.min(r(b).width, r(b).height))) : -1,
          depthMin: depth.length ? Math.min(...depth.map(b => Math.min(r(b).width, r(b).height))) : -1,
          depthCount: depth.length,
          open: document.getElementById('sheet').getAttribute('data-open'),
          docH: document.documentElement.scrollHeight,
          cliH: document.documentElement.clientHeight,
          bodyH: document.body.scrollHeight,
          smallest: sizes.reduce((a, b) => (b.px < a.px ? b : a), { t: '-', px: 999 })
        };
      });

      const m = await shot();
      const side = b => Math.min(b.w, b.h);

      // 1 額が全部見える（引き出しに覆われない・画面から出ない）
      judge(m.frame.top >= -0.5 && m.frame.bottom <= m.sheet.top + 0.5
            && m.frame.left >= -0.5 && m.frame.right <= dev.w + 0.5,
        '額が全部見える（引き出しに覆われない）',
        `額 上${m.frame.top.toFixed(0)} 下${m.frame.bottom.toFixed(0)} / 引き出しの上端 ${m.sheet.top.toFixed(0)} / 左${m.frame.left.toFixed(0)} 右${m.frame.right.toFixed(0)}`);
      // 3 保存が画面内で、いちばん下端に触れていない（ホームバーに飲まれる。SHITSURAE 末尾）
      judge(m.save.bottom <= dev.h, '「写真に保存」が画面内にある',
        `下端 ${m.save.bottom.toFixed(0)}px / 画面 ${dev.h}px（余り ${(dev.h - m.save.bottom).toFixed(0)}px）`);
      judge(dev.h - m.save.bottom >= 8, '「写真に保存」が画面のいちばん下端に触れていない',
        `下に ${(dev.h - m.save.bottom).toFixed(0)}px 空いている`);
      // 4 頁が縦にスクロールしない（1画面のアプリ）
      judge(m.docH <= m.cliH + 1 && m.bodyH <= m.cliH + 1, '頁が縦にスクロールしない',
        `文書 ${m.docH}px / body ${m.bodyH}px / 画面 ${m.cliH}px`);
      // 7 押し所と文字
      judge(m.depthCount === 10, '深さの帯が10段', `${m.depthCount}段`);
      judge(m.depthMin >= 24, '深さの押し所が24px以上', `最小 ${m.depthMin.toFixed(1)}px`);
      judge(side(m.menuBtn) >= 44, '≡（ほかの案内）が44px以上',
        `${m.menuBtn.w.toFixed(0)}×${m.menuBtn.h.toFixed(0)}px`);
      judge(side(m.grip) >= 44, '引き出しのつまみが44px以上',
        `${m.grip.w.toFixed(0)}×${m.grip.h.toFixed(0)}px`);
      judge(side(m.chooser) >= 44, '御霊を選ぶ入口（名札）が44px以上',
        `${m.chooser.w.toFixed(0)}×${m.chooser.h.toFixed(0)}px`);
      judge(m.stripMin >= 44, '帯の押し所が44px以上', `最小 ${m.stripMin.toFixed(1)}px`);
      judge(m.smallest.px >= 12, '12px未満の文字が無い', `最小 ${m.smallest.px}px「${m.smallest.t}」`);
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));

      // 2 額の実寸。引き出しを閉じると額が大きくなる
      judge(m.open === 'true', '引き出しの既定は開', `data-open=${m.open}`);
      await page.click('#grip');
      await new Promise(r => setTimeout(r, 500));           // 伸び縮み（300ms）が終わるまで待つ
      const c = await shot();
      judge(c.open === 'false', 'つまみを押すと閉じる', `data-open=${c.open}`);
      judge(c.frame.w > m.frame.w + 1, '閉じると額が大きくなる',
        `開 ${m.frame.w.toFixed(0)}px 幅 → 閉 ${c.frame.w.toFixed(0)}px 幅`);
      judge(c.frame.top >= -0.5 && c.frame.bottom <= c.sheet.top + 0.5,
        '閉のときも額が全部見える',
        `額 上${c.frame.top.toFixed(0)} 下${c.frame.bottom.toFixed(0)} / 引き出しの上端 ${c.sheet.top.toFixed(0)}`);
      judge(c.docH <= c.cliH + 1, '閉のときも頁が縦にスクロールしない', `文書 ${c.docH}px / 画面 ${c.cliH}px`);
      judge(dev.h - c.save.bottom >= 8, '閉のときも保存が画面のいちばん下端に触れていない',
        `下に ${(dev.h - c.save.bottom).toFixed(0)}px`);
      // 額の比が崩れていない（max-* に切られると canvas だけが歪む）
      const ar = 1 * dev.real.split('x')[0] / dev.real.split('x')[1];
      judge(Math.abs(m.frame.w / m.frame.h - ar) < 0.005 && Math.abs(c.frame.w / c.frame.h - ar) < 0.005,
        '額の比が端末の比のまま',
        `開 ${(m.frame.w / m.frame.h).toFixed(4)} / 閉 ${(c.frame.w / c.frame.h).toFixed(4)} / 端末 ${ar.toFixed(4)}`);
      if (dev.w === 393 && dev.h === 740) {                 // SPEC §7.5 #2 の数値はこの端末で見る
        judge(c.frame.w >= 250, '393×740 で閉の額が250px幅以上', `${c.frame.w.toFixed(1)}px`);
        judge(m.frame.w >= 180, '393×740 で開の額が180px幅以上', `${m.frame.w.toFixed(1)}px`);
      }
      SIZES.push({ dev: dev.name, open: m.frame.w, closed: c.frame.w, openH: m.frame.h, closedH: c.frame.h });
      await page.close();
    }

    /* ---------- 5 引き出し（第6便・SPEC §7.2） ----------
       開／閉の2つだけ。既定は開。閉のとき帯と階梯は画面から消える。
       つまみのタップのほか、つまみ・名札の上の**縦スワイプ**でも開閉する
       （名札はスワイプで開け閉めした回に札を開かないこと＝二役の取り違えを起こさない）。 */
    console.log('\n【引き出し】');
    {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 393, height: 740, deviceScaleFactor: 2 });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
      const state = () => page.evaluate(() => {
        const seen = el => !!(el && el.offsetParent !== null);   // display:none は数えない
        return {
          open: document.getElementById('sheet').getAttribute('data-open'),
          aria: document.getElementById('grip').getAttribute('aria-expanded'),
          strip: seen(document.getElementById('strip')),
          depth: seen(document.getElementById('depth')),
          save: seen(document.getElementById('save')),
          chooser: seen(document.getElementById('chooser')),
          picker: document.getElementById('picker').classList.contains('show')
        };
      });

      const s0 = await state();
      judge(s0.open === 'true' && s0.aria === 'true', '既定は開（aria-expanded=true）',
        `data-open=${s0.open} / aria-expanded=${s0.aria}`);
      judge(s0.strip && s0.depth, '開のときは帯と階梯が出ている');

      await page.click('#grip');
      await new Promise(r => setTimeout(r, 400));
      const s1 = await state();
      judge(s1.open === 'false' && s1.aria === 'false', 'つまみのタップで閉じる（aria-expanded=false）',
        `data-open=${s1.open} / aria-expanded=${s1.aria}`);
      judge(!s1.strip && !s1.depth, '閉のとき帯と階梯が画面から消える',
        `帯 ${s1.strip} / 階梯 ${s1.depth}`);
      judge(s1.save && s1.chooser, '閉でも名札と「写真に保存」は出ている');

      await page.click('#grip');
      await new Promise(r => setTimeout(r, 400));
      const s2 = await state();
      judge(s2.open === 'true' && s2.strip && s2.depth, 'もう一度押すと開く');

      // 名札の上を下へなぞる → 閉じる。そのとき札（#picker）は開かない
      const nf = await page.evaluate(() => {
        const r = document.getElementById('chooser').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.move(nf.x, nf.y);
      await page.mouse.down();
      await page.mouse.move(nf.x, nf.y + 40, { steps: 6 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 400));
      const s3 = await state();
      judge(s3.open === 'false', '名札の上を下へなぞると閉じる', `data-open=${s3.open}`);
      judge(!s3.picker, 'なぞった回は札（御霊を選ぶ）を開かない');

      // つまみの上を上へなぞる → 開く
      const gp = await page.evaluate(() => {
        const r = document.getElementById('grip').getBoundingClientRect();
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      });
      await page.mouse.move(gp.x, gp.y);
      await page.mouse.down();
      await page.mouse.move(gp.x, gp.y - 40, { steps: 6 });
      await page.mouse.up();
      await new Promise(r => setTimeout(r, 400));
      const s4 = await state();
      judge(s4.open === 'true', 'つまみの上を上へなぞると開く', `data-open=${s4.open}`);

      // 名札のタップ（なぞらない）はこれまでどおり札を開く
      await page.click('#chooser');
      const s5 = await state();
      judge(s5.picker, '名札をタップすれば札は開く（役は分かれたまま）');
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));
      await page.close();
    }

    /* ---------- 6 ≡ の札（第6便・SPEC §7.3） ----------
       #picker と同じ「開いて閉じる札」の型。中身は最初の画面から外した説明ぜんぶ。
       **#dailyBox・#copyUrl は第3便のまま移しただけ**なので、動くことをここで見る。 */
    console.log('\n【≡ の札】');
    {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(String(e)));
      await page.setViewport({ width: 393, height: 852, deviceScaleFactor: 2 });
      // clipboard は差し替えて、書き込みの回数を数える（HTTPS でないと本物は通らない）
      await page.evaluateOnNewDocument(() => {
        window.__clip = [];
        Object.defineProperty(navigator, 'clipboard', {
          configurable: true,
          get: () => ({ writeText: t => { window.__clip.push(t); return Promise.resolve(); } })
        });
      });
      await page.goto(base + '#size=1179x2556', { waitUntil: 'load' });
      await ready(page);
      const shown = () => page.evaluate(() => document.getElementById('menu').classList.contains('show'));

      await page.click('#menuBtn');
      judge(await shown(), '≡ を押すと開く');
      await page.click('#menu-close');
      judge(!(await shown()), '✕ で閉じる');

      await page.click('#menuBtn');
      await page.evaluate(() => {
        const m = document.getElementById('menu');
        const r = m.getBoundingClientRect();
        m.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + 4, clientY: r.top + 4 }));
      });
      judge(!(await shown()), '外側タップで閉じる');

      await page.click('#menuBtn');
      await page.keyboard.press('Escape');
      judge(!(await shown()), 'Esc で閉じる');

      await page.click('#menuBtn');
      const inside = await page.evaluate(() => {
        const body = document.getElementById('menuBody');
        const has = id => !!body.querySelector('#' + id);
        return {
          daily: has('dailyBox'), dailyHidden: document.getElementById('dailyBox').hidden,
          copy: has('copyUrl'), log: has('log'), howto: has('howtoText'),
          url: (document.getElementById('dailyUrl').textContent || '').trim(),
          text: body.textContent.replace(/\s+/g, ''),
          scrollable: getComputedStyle(document.querySelector('#menu .pick-body')).overflowY
        };
      });
      judge(inside.daily && !inside.dailyHidden, '中に「毎朝ひとりでに替えるなら」がある（寸法が合うとき出る）',
        `#dailyBox hidden=${inside.dailyHidden}`);
      judge(inside.url.indexOf('yo-jitate-1179x2556.jpg') > 0, '毎朝の一枚のURLがこの端末の寸法で入る', inside.url);
      judge(inside.copy, '中に「URLをコピー」がある');
      judge(inside.log, '中に「この端末で通ったこと」（#log）がある');
      judge(inside.howto, '中に「壁紙にする手順」がある');
      judge(inside.text.indexOf('二次創作') >= 0, '脚注に二次創作の明記がある');
      judge(inside.text.indexOf('原本を配ってはいません') >= 0, '脚注に「原本を配っていない」が残っている');
      judge(inside.text.indexOf('破線は保存画像には入りません') >= 0, '脚注に破線の但し書きが残っている');
      judge(inside.scrollable === 'auto', '札の中は縦にスクロールする（.pick-body）', inside.scrollable);

      // #copyUrl が従来どおり動く
      await page.evaluate(() => { document.getElementById('dailyBox').open = true; });
      await page.click('#copyUrl');
      await new Promise(r => setTimeout(r, 200));
      const cp = await page.evaluate(() => ({
        n: window.__clip.length, last: window.__clip[window.__clip.length - 1] || '',
        label: document.getElementById('copyUrl').textContent.trim()
      }));
      judge(cp.n === 1 && cp.last.indexOf('yo-jitate-1179x2556.jpg') > 0, '「URLをコピー」がクリップボードへ書く',
        `${cp.n}回 / ${cp.last}`);
      judge(cp.label === '写しました', '写したことが釦に出る', cp.label);
      judge(errors.length === 0, '例外が出ていない', errors.join(' / '));
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
                                           Math.round(r.top + r.height / 2)) === s,
            // 題の顕れ: 額の時計の帯（上17%）に立っているか／仕舞われたか
            dm: (() => {
              const d = document.getElementById('daimei');
              const f = document.getElementById('frame').getBoundingClientRect();
              const rr = d.getBoundingClientRect(), cs = getComputedStyle(d);
              return {
                op: +cs.opacity, disp: cs.display,
                inBand: rr.top >= f.top - 1 && rr.bottom <= f.top + f.height * 0.17 + 1
                     && rr.left >= f.left - 1 && rr.right <= f.right + 1
              };
            })()
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
      judge(s.snaps.t600.dm.op > 0.9 && s.snaps.t600.dm.inBand,
        '600ms は題字が額の時計の帯に立っている',
        `opacity ${s.snaps.t600.dm.op} / 帯の中 ${s.snaps.t600.dm.inBand}`);
      judge(s.snaps.t2200.dm.disp === 'none', '1900ms 以降は題字が仕舞われている',
        `display ${s.snaps.t2200.dm.disp}`);
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

  console.log('\n【額の実寸（幅 px）】');
  console.log('  端末                                 開      閉');
  for (const z of SIZES) {
    console.log(`  ${z.dev.padEnd(28, ' ')} ${z.open.toFixed(1).padStart(7)} ${z.closed.toFixed(1).padStart(7)}`
      + `   （高さ ${z.openH.toFixed(0)} → ${z.closedH.toFixed(0)}）`);
  }

  console.log(failures === 0 ? '\n通った。' : `\n落ちた項目が ${failures} 件ある。`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
