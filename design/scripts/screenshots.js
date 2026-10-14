// Maakt de store-screenshots (1280x800) met de echte editor uit de extensie.
const { chromium } = require("playwright");
const path = require("path");
const fs = require("fs");
const root = path.resolve(__dirname, "../..");
const ext = `${root}/extension`;
const INFO = fs.readFileSync(path.join(__dirname, "demo-scherm.pa.yaml"), "utf8");
const W = 1136, H = 598;

const SHOTS = [
  { file: "1-editor", title: "Bewerk schermen en controls als YAML",
    sub: "Een volwaardige editor met syntaxkleuring, inklappen en een structuurpaneel, direct vanuit Power Apps Studio." },
  { file: "2-validatie", title: "Fouten zien voordat Studio ze weigert",
    sub: "De editor controleert YAML en Power Fx formules terwijl je typt: ontbrekende =, dubbele namen en syntaxfouten." },
  { file: "3-vervangen", title: "Opslaan vervangt het scherm in Studio",
    sub: "Eén klik zet je wijzigingen terug in Power Apps Studio, met dezelfde namen. Mislukt het, dan komt het origineel terug." },
  { file: "4-geschiedenis", title: "Nooit meer werk kwijt",
    sub: "Wijzigingen worden automatisch als concept bewaard en de laatste 30 opgeslagen versies zet je met één klik terug." },
  { file: "5-donker", title: "Licht of donker, met zoeken en vervangen",
    sub: "Zoeken, vervangen, ga naar regel en commentaar aan of uit met de sneltoetsen die je al kent." }
];

const b64 = (p) => fs.readFileSync(p).toString("base64");

function frame(shot, img) {
  return `<!doctype html><html><head><style>
  body{margin:0;width:1280px;height:800px;overflow:hidden;font-family:Inter,sans-serif;
    background:linear-gradient(135deg,#4A23A0 0%,#7B2AA8 50%,#B3218F 100%);position:relative}
  .head{position:absolute;left:72px;top:50px;display:flex;gap:20px;align-items:flex-start}
  .head img{width:52px;height:52px;margin-top:4px;filter:drop-shadow(0 4px 10px rgba(0,0,0,.25))}
  h1{margin:0;color:#fff;font:700 34px/1.2 Inter,sans-serif;letter-spacing:-.3px}
  p{margin:8px 0 0;color:rgba(255,255,255,.92);font:400 17.5px/1.4 Inter,sans-serif;max-width:1000px}
  .win{position:absolute;left:72px;top:168px;width:${W}px;height:${H + 34}px;border-radius:12px 12px 0 0;overflow:hidden;
    box-shadow:0 24px 60px rgba(30,0,60,.45);background:#fff}
  .bar{height:34px;background:#ececec;display:flex;align-items:center;gap:8px;padding-left:14px}
  .dot{width:12px;height:12px;border-radius:50%}
  .tab{margin-left:18px;height:26px;margin-top:8px;background:#fff;border-radius:8px 8px 0 0;display:flex;align-items:center;gap:6px;
    padding:0 14px;font:500 12px Inter,sans-serif;color:#333}
  .tab img{width:14px;height:14px}
  .shot{display:block;width:${W}px;height:${H}px}
  </style></head><body>
  <div class="head"><img src="data:image/png;base64,${b64(`${root}/design/icon-256.png`)}">
    <div><h1>${shot.title}</h1><p>${shot.sub}</p></div></div>
  <div class="win"><div class="bar"><span class="dot" style="background:#ff5f57"></span><span class="dot" style="background:#febc2e"></span>
    <span class="dot" style="background:#28c840"></span><div class="tab"><img src="data:image/png;base64,${b64(`${ext}/icons/icon32.png`)}">${shot.tab || "Info · AppKit"}</div></div>
    <img class="shot" src="data:image/png;base64,${img.toString("base64")}"></div></body></html>`;
}

(async () => {
  const ctx = await chromium.launchPersistentContext("", { headless: false, executablePath: process.env.CHROME_PATH || undefined,
    args: ["--headless=new", `--disable-extensions-except=${ext}`, `--load-extension=${ext}`], viewport: { width: W, height: H }, colorScheme: "light" });
  const sw = ctx.serviceWorkers()[0] || await ctx.waitForEvent("serviceworker");
  const extId = sw.url().split("/")[2];
  const now = Date.now();
  await sw.evaluate(async ({ yaml, now }) => {
    await saveSession("demo", { yaml, via: "selection", appTitle: "Kluisbeheer", created: now });
    const mk = (name, type, app, mins) => ({ name, type, app, yaml, time: now - mins * 60000 });
    await chrome.storage.local.set({ theme: "light", history: [
      mk("Info", "Screen", "Kluisbeheer", 3), mk("Info", "Screen", "Kluisbeheer", 26), mk("galKluizen", "Gallery", "Kluisbeheer", 95),
      mk("Hoofdscherm", "Screen", "Kluisbeheer", 60 * 26), mk("btnOpslaan", "Classic/Button", "Urenregistratie", 60 * 49),
      mk("Overzicht", "Screen", "Urenregistratie", 60 * 50)] });
  }, { yaml: INFO, now });

  const page = await ctx.newPage();
  const open = async () => {
    await sw.evaluate(() => chrome.storage.local.remove("draft:demo"));
    await page.goto(`chrome-extension://${extId}/editor/editor.html?session=demo`);
    await page.waitForSelector(".CodeMirror"); await page.waitForTimeout(700);
  };
  const cm = (fn, arg) => page.evaluate(new Function("arg", `const cm=document.querySelector('.CodeMirror').CodeMirror;${fn}`), arg);
  const comp = await ctx.newPage();
  const shoot = async (shot) => {
    const img = await page.screenshot();
    await comp.setViewportSize({ width: 1280, height: 800 });
    await comp.setContent(frame(shot, img)); await comp.waitForTimeout(300);
    await comp.screenshot({ path: `${root}/design/store-screenshots/${shot.file}.png` });
  };

  // 1. editor
  await open();
  await cm(`const l=cm.getValue().split('\\n').findIndex(x=>x.includes('- inStapIcoon1:'));cm.scrollTo(0,(l-6)*cm.defaultTextHeight());cm.setCursor(l+6,20);cm.focus();`);
  await page.waitForTimeout(300); await shoot(SHOTS[0]);

  // 2. validatie
  await cm(`let v=cm.getValue().replace('Text: ="Item toevoegen"','Text: Item toevoegen').replace('Color: =RGBA(0, 120, 212, 1)','Color: RGBA(0, 120, 212, 1)');cm.setValue(v);
    const l=v.split('\\n').findIndex(x=>x.includes('Color: RGBA(0, 120'));cm.scrollTo(0,(l-8)*cm.defaultTextHeight());cm.setCursor(l,30);`);
  await page.waitForTimeout(900);
  const marker = await page.$$(".CodeMirror-lint-marker-warning");
  if (marker[0]) { await marker[0].hover(); await page.waitForTimeout(500); }
  await shoot(SHOTS[1]);

  // 3. vervangen (zelfde melding en status als na een geslaagde vervanging)
  await open();
  await cm(`const l=cm.getValue().split('\\n').findIndex(x=>x.includes('- inStappen:'));cm.scrollTo(0,(l-2)*cm.defaultTextHeight());cm.setCursor(l,18);`);
  await page.evaluate(() => {
    const b = document.getElementById("banner");
    b.className = "banner banner--ok"; b.hidden = false;
    b.innerHTML = '<div class="banner__text"><b>Info</b> is in Studio vervangen. Ongedaan maken kan in Studio met Ctrl+Z.</div><div class="banner__actions"><button class="icon-btn">×</button></div>';
    document.getElementById("status").dataset.state = "saved";
    document.getElementById("statusText").textContent = "Opgeslagen";
  });
  await page.waitForTimeout(300); await shoot(SHOTS[2]);

  // 4. geschiedenis
  await open();
  await page.click("#btnHistory"); await page.waitForTimeout(500); await shoot(SHOTS[3]);
  await page.keyboard.press("Escape");

  // 5. donker met zoeken
  await page.click("#btnTheme"); await open();
  await cm(`cm.focus();cm.setCursor(0,0);`);
  await page.keyboard.press("Control+f"); await page.waitForTimeout(200);
  await page.keyboard.type("RGBA"); await page.waitForTimeout(600);
  await shoot(SHOTS[4]);

  await ctx.close();
})().catch((e) => { console.error(e); process.exit(1); });
