const API_BASE = location.hostname.includes("cpanel.site")
  ? "back.php"
  : "https://magnificent-magenta-duck.190-2-143-208.cpanel.site/bot/back.php";

function fmt(n){ n = Number(n||0); return n.toLocaleString("en-US"); }
function toast(msg){
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toast._tm);
  toast._tm = setTimeout(()=>t.classList.remove("show"), 2600);
}
async function apiGet(path, params={}){
  const qs = new URLSearchParams(params).toString();
  const url = `${API_BASE}?action=call&method=GET&path=${encodeURIComponent(path)}${qs?'&'+qs:''}`;
  try{
    const r = await fetch(url, {credentials:"include"});
    return await r.json();
  }catch(e){ return {ok:false, error:"خطا در ارتباط با سرور"}; }
}
async function apiPost(path, body={}){
  const url = `${API_BASE}?action=call&method=POST&path=${encodeURIComponent(path)}`;
  try{
    const r = await fetch(url, {method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify(body), credentials:"include"});
    return await r.json();
  }catch(e){ return {ok:false, error:"خطا در ارتباط با سرور"}; }
}

function openCenter(html, extraClass){
  const body = document.getElementById("centerModalBody");
  body.className = "center-modal" + (extraClass ? (" " + extraClass) : "");
  body.innerHTML = html;
  document.getElementById("centerOverlay").classList.remove("hidden");
}
function closeCenter(){
  document.getElementById("centerOverlay").classList.add("hidden");
}
document.getElementById("centerOverlay").addEventListener("click", (e)=>{
  if (e.target.id === "centerOverlay") closeCenter();
});

let ME = null;
let SHOP = null;
let COUNTRIES_CACHE = null;
let CART = {};
let currentAttackTarget = null;
let currentAttackTypes = [];
let currentCyberOp = "asset";

window.addEventListener("DOMContentLoaded", boot);

async function diagnose(){
  try{
    await fetch(`${API_BASE}?action=session`, {mode:"no-cors"});
    return "سرور در دسترسه ولی مرورگر به خاطر CORS جلوش رو گرفته (هدر Access-Control-Allow-Origin نمیاد)";
  }catch(e){
    return "به سرور وصل نمیشه (SSL / دامنه / فایروال هاست)";
  }
}

async function boot(){
  let data;
  try{
    const res = await fetch(`${API_BASE}?action=session`, {credentials:"include"});
    const text = await res.text();
    try{ data = JSON.parse(text); }
    catch(_){
      showScreenGroup("login");
      document.getElementById("loginError").textContent = "پاسخ سرور JSON نبود: " + text.slice(0,120);
      return;
    }
  }catch(e){
    showScreenGroup("login");
    document.getElementById("loginError").textContent = await diagnose();
    return;
  }
  if (!data.ok || !data.data || !data.data.logged_in){
    showScreenGroup("login");
    return;
  }
  if (!data.data.has_country){
    showScreenGroup("create-country");
    loadCountries();
    return;
  }
  await enterApp();
}

function showScreenGroup(which){
  const loginEl = document.getElementById("screen-login");
  const createEl = document.getElementById("screen-create-country");
  const appEl = document.getElementById("mainApp");

  loginEl.style.display = "none";
  createEl.style.display = "none";
  appEl.classList.add("hidden");

  if (which === "login"){
    loginEl.style.display = "flex";
  } else if (which === "create-country"){
    createEl.style.display = "block";
  } else {
    appEl.classList.remove("hidden");
  }
}

async function enterApp(){
  showScreenGroup("app");
  goToScreen("home");
  await loadHome();
  refreshBellDot();
  setInterval(refreshBellDot, 30000);
}

document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("tokenInput").addEventListener("keydown", (e)=>{ if(e.key==="Enter") doLogin(); });

async function doLogin(){
  const input = document.getElementById("tokenInput");
  const token = input.value.trim();
  const errBox = document.getElementById("loginError");
  errBox.textContent = "";
  if (!token){
    input.classList.add("shake"); setTimeout(()=>input.classList.remove("shake"), 400);
    errBox.textContent = "توکن را وارد کن";
    return;
  }
  const btn = document.getElementById("loginBtn");
  btn.disabled = true; btn.textContent = "در حال ورود...";
  let data;
  try{
    const res = await fetch(`${API_BASE}?action=login`, {
      method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({token}), credentials:"include"
    });
    data = await res.json();
  }catch(e){
    btn.disabled = false; btn.textContent = "ورود";
    errBox.textContent = await diagnose();
    return;
  }
  btn.disabled = false; btn.textContent = "ورود";
  if (!data.ok){
    input.classList.add("shake"); setTimeout(()=>input.classList.remove("shake"), 400);
    errBox.textContent = data.error || "توکن نامعتبر است";
    return;
  }
  if (!data.data.has_country){
    showScreenGroup("create-country");
    loadCountries();
  } else {
    await enterApp();
  }
}

async function loadCountries(){
  const res = await apiGet("/countries");
  const grid = document.getElementById("countryGrid");
  if (!res.ok){ grid.innerHTML = `<div class="empty-state">خطا در بارگذاری کشورها</div>`; return; }
  COUNTRIES_CACHE = res.data.countries;
  renderCountryGrid(COUNTRIES_CACHE);
}
function renderCountryGrid(list){
  const grid = document.getElementById("countryGrid");
  if (!list.length){ grid.innerHTML = `<div class="empty-state">کشوری یافت نشد</div>`; return; }
  grid.innerHTML = list.map(c => `
    <div class="country-pick ${c.taken ? 'taken':'avail'}" data-code="${c.code}" data-taken="${c.taken}">
      <div class="badges">${c.oil?'🛢️':''}${c.vip?'👑':''}${c.taken?'🔒':''}</div>
      <span class="flag">${c.flag||'🏳️'}</span>
      <span class="nm">${c.name}</span>
    </div>
  `).join("");
  grid.querySelectorAll(".country-pick").forEach(el=>{
    el.addEventListener("click", ()=>{
      if (el.dataset.taken === "true") return;
      confirmCreateCountry(el.dataset.code, el.querySelector(".nm").textContent, el.querySelector(".flag").textContent);
    });
  });
}
document.getElementById("countrySearch").addEventListener("input", (e)=>{
  const q = e.target.value.trim().toLowerCase();
  if (!COUNTRIES_CACHE) return;
  const filtered = COUNTRIES_CACHE.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  renderCountryGrid(filtered);
});
function confirmCreateCountry(code, name, flag){
  openCenter(`
    <div class="result-icon">${flag}</div>
    <h3>ساخت کشور ${name}؟</h3>
    <div class="desc" style="margin:8px 0 16px;">بعد از ساخت، این انتخاب قابل تغییر نیست.</div>
    <div class="btnrow">
      <button class="btn" id="cancelCreateBtn">لغو</button>
      <button class="btn solid" id="confirmCreateBtn">تایید</button>
    </div>
  `);
  document.getElementById("cancelCreateBtn").onclick = closeCenter;
  document.getElementById("confirmCreateBtn").onclick = async ()=>{
    const res = await apiPost("/create_country", {country_code: code});
    if (!res.ok){ toast(res.error || "خطا در ساخت کشور"); return; }
    closeCenter();
    await enterApp();
  };
}

const screens = document.querySelectorAll("#mainApp .screen");
const navButtons = document.querySelectorAll(".bottomnav button");
navButtons.forEach(btn=>{
  btn.addEventListener("click", ()=> goToScreen(btn.dataset.screen));
});
function goToScreen(name){
  screens.forEach(s => s.classList.toggle("active", s.id === "screen-" + name));
  navButtons.forEach(b => b.classList.toggle("active", b.dataset.screen === name));
  window.scrollTo({top:0, behavior:"smooth"});
  updateCartFabVisibility();
  if (name === "market" && !SHOP) loadMarket();
  if (name === "leaderboard") loadLeaderboard();
  if (name === "attack") loadMilitaryTargets();
  if (name === "diplomacy") loadStatementHistory();
}

document.querySelectorAll(".subtabs").forEach(group=>{
  group.querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const groupName = group.dataset.group;
      group.querySelectorAll("button").forEach(b=>b.classList.toggle("active", b===btn));
      const sub = btn.dataset.sub;
      const prefix = groupName==="rank"?"rank":groupName==="dip"?"dip":groupName==="attack"?"attack":"market";
      document.querySelectorAll(`.subview[id^="${prefix}-"]`).forEach(v=>{
        v.classList.toggle("active", v.id === `${prefix}-${sub}`);
      });
      updateCartFabVisibility();
      if (groupName === "market" && sub === "coins") loadCoinPlans();
      if (groupName === "market" && sub === "sell") loadSellList();
      if (groupName === "dip" && sub === "oil") loadOil();
      if (groupName === "dip" && sub === "alliance") loadAlliance();
      if (groupName === "dip" && sub === "export") loadExport();
      if (groupName === "dip" && sub === "companies") loadCompanies();
      if (groupName === "attack" && sub === "cyber") loadCyberTargets();
    });
  });
});

async function loadHome(){
  const box = document.getElementById("homeContent");
  const [meRes, limitsRes, protRes] = await Promise.all([
    apiGet("/me"), apiGet("/limits/daily"), apiGet("/protection/status")
  ]);
  if (!meRes.ok){ box.innerHTML = `<div class="empty-state">خطا در بارگذاری اطلاعات</div>`; return; }
  ME = meRes.data;
  const limits = limitsRes.ok ? limitsRes.data : null;
  const prot = protRes.ok ? protRes.data : null;

  let protHtml = "";
  if (prot && prot.protected){
    const min = Math.ceil(prot.remaining_seconds/60);
    protHtml = `<div class="status-pill protect-pill">🛡 محافظت: ${min} دقیقه باقی‌مانده</div>`;
  }

  const rows = [
    ["💰","بودجه", fmt(ME.budget)],
    ["📈","درآمد روزانه", fmt(ME.daily_income)],
    ["🛢️","نفت", fmt(ME.oil_reserves)],
    ["⛽","درآمد نفتی", fmt(ME.oil_income)],
  ];
  const rows2 = [["😊","رضایت", ME.satisfaction + "٪"]];
  const rows3 = [
    ["⚔️","قدرت حمله", fmt(ME.attack_power)],
    ["🛡","قدرت دفاع", fmt(ME.defense_power)],
  ];
  const rows4 = [
    ["🤝","اتحاد", ME.alliance_name || "—"],
    ["🏢","شرکت‌ها", (ME.companies||[]).length],
  ];

  const rowsHtml = arr => arr.map(([ic,l,v])=>`<div class="stat-row"><span class="lbl">${ic} ${l}</span><span class="val">${v}</span></div>`).join("");

  let limitsHtml = "";
  if (limits){
    limitsHtml = `<div class="stat-row"><span class="lbl">📊 امروز</span><span class="val" style="font-weight:600;font-size:11.5px;">
      💣 ${limits.attacks.used}/${limits.attacks.max}&nbsp; 💻 ${limits.cyber.used}/${limits.cyber.max}&nbsp; 🕵️ ${limits.spy.used}/${limits.spy.max}
    </span></div>`;
  }

  let warnHtml = "";
  if (ME.warnings > 0){
    warnHtml = `<div class="stat-row warn-row"><span class="lbl">⚠️ اخطارها</span><span class="val">${ME.warnings} از ۵</span></div>`;
  }

  box.innerHTML = `
    <div class="card country-card">
      <div class="country-head">
        <div class="flag">${ME.flag||"🏳️"}</div>
        <div><b>${ME.country_name||ME.country}</b><span>👤 ${ME.username||"بازیکن"}</span></div>
      </div>
      ${protHtml ? `<div style="padding:8px 14px 0;">${protHtml}</div>` : ""}
      <div class="stat-list">
        ${rowsHtml(rows)}
        ${rowsHtml(rows2)}
        ${rowsHtml(rows3)}
        ${rowsHtml(rows4)}
        ${limitsHtml}
        ${warnHtml}
      </div>
    </div>
  `;
}

async function loadMarket(){
  const res = await apiGet("/shop");
  const root = document.getElementById("accordionRoot");
  if (!res.ok){ root.innerHTML = `<div class="empty-state">خطا در بارگذاری بازار</div>`; return; }
  SHOP = res.data.categories;
  renderAccordion();
}

function itemInfo(key){
  if (!SHOP) return null;
  for (const cat of SHOP){
    const found = cat.items.find(i=>i.key===key);
    if (found) return found;
  }
  return null;
}

function renderAccordion(){
  const root = document.getElementById("accordionRoot");
  root.innerHTML = SHOP.map(cat => `
    <div class="accordion-item" data-cat="${cat.key}">
      <button class="accordion-head">
        <span class="name">${cat.name}</span><span class="chev">▾</span>
      </button>
      <div class="accordion-body">
        ${cat.items.map(it => `
          <div class="item-row" data-item="${it.key}">
            <span class="iname">${it.name}${it.vip?' 👑':''}</span>
            <span class="iprice">${fmt(it.price)} <span class="plus">+</span></span>
          </div>
        `).join("")}
      </div>
    </div>
  `).join("");

  root.querySelectorAll(".accordion-head").forEach(head=>{
    head.addEventListener("click", ()=>{
      head.parentElement.classList.toggle("open");
    });
  });
  root.querySelectorAll(".item-row").forEach(row=>{
    row.addEventListener("click", ()=> openItemModal(row.dataset.item));
  });
}

let modalItemKey = null;
function openItemModal(key){
  modalItemKey = key;
  const it = itemInfo(key);
  if (!it) return;
  document.getElementById("modalItemName").textContent = it.name;
  document.getElementById("modalItemPrice").textContent = fmt(it.price);
  document.getElementById("modalCustomQty").value = "";
  updateModalSummary();
  document.getElementById("itemOverlay").classList.remove("hidden");
}
function updateModalSummary(){
  const it = itemInfo(modalItemKey);
  if (!it) return;
  const qty = CART[modalItemKey] || 0;
  document.getElementById("modalInCart").textContent = fmt(qty) + " عدد";
  document.getElementById("modalTotal").textContent = fmt(qty * it.price);
}
document.querySelectorAll(".qtybtn").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const amt = parseInt(btn.dataset.amt, 10);
    let cur = CART[modalItemKey] || 0;
    cur = Math.max(0, cur + amt);
    if (cur > 0) CART[modalItemKey] = cur; else delete CART[modalItemKey];
    updateModalSummary();
    updateCartFab();
  });
});
document.getElementById("modalCustomQty").addEventListener("input", (e)=>{
  const v = parseInt(e.target.value, 10);
  if (!isNaN(v) && v >= 0){
    if (v > 0) CART[modalItemKey] = v; else delete CART[modalItemKey];
    updateModalSummary();
    updateCartFab();
  }
});
document.getElementById("modalCloseBtn").addEventListener("click", ()=> document.getElementById("itemOverlay").classList.add("hidden"));
document.getElementById("modalDoneBtn").addEventListener("click", ()=> document.getElementById("itemOverlay").classList.add("hidden"));

function updateCartFab(){
  const count = Object.keys(CART).length;
  document.getElementById("cartCount").textContent = count;
  updateCartFabVisibility();
}
function updateCartFabVisibility(){
  const marketActive = document.getElementById("screen-market").classList.contains("active");
  const weaponsActive = document.getElementById("market-weapons").classList.contains("active");
  const count = Object.keys(CART).length;
  const show = marketActive && weaponsActive && count > 0;
  const fab = document.getElementById("cartFab");
  fab.classList.toggle("hidden", !show);
  if (show) {
    fab.innerHTML = `🛒 مشاهده سبد خرید (${count})`;
  }
}
document.getElementById("cartFab").addEventListener("click", openCartDrawer);
document.getElementById("cartCloseBtn").addEventListener("click", ()=> document.getElementById("cartDrawer").classList.add("hidden"));

function openCartDrawer(){
  renderCartLines();
  document.getElementById("cartDrawer").classList.remove("hidden");
}
function renderCartLines(){
  const wrap = document.getElementById("cartLines");
  const keys = Object.keys(CART);
  if (!keys.length){
    wrap.innerHTML = `<div class="cart-empty">سبد خرید خالی است</div>`;
    document.getElementById("cartGrandTotal").textContent = "0";
    return;
  }
  let total = 0;
  wrap.innerHTML = keys.map(k=>{
    const it = itemInfo(k);
    if (!it) return "";
    const line = it.price * CART[k];
    total += line;
    return `<div class="cart-line" data-item="${k}">
      <span>${it.name} × ${fmt(CART[k])}</span>
      <span style="display:flex;align-items:center;gap:8px;"><b>${fmt(line)}</b><button class="del-btn" data-item="${k}">حذف</button></span>
    </div>`;
  }).join("");
  document.getElementById("cartGrandTotal").textContent = fmt(total);
  wrap.querySelectorAll(".del-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      delete CART[b.dataset.item];
      renderCartLines();
      updateCartFab();
    });
  });
}
document.getElementById("checkoutBtn").addEventListener("click", async ()=>{
  if (!Object.keys(CART).length){ toast("سبد خرید خالی است"); return; }
  const res = await apiPost("/buy", {items: CART});
  if (!res.ok){ toast(res.error || "خطا در خرید"); return; }
  toast("خرید با موفقیت انجام شد ✅");
  CART = {};
  renderCartLines();
  updateCartFab();
  document.getElementById("cartDrawer").classList.add("hidden");
  loadHome();
});

let COIN_PLANS_CACHE = null;
async function loadCoinPlans(){
  const res = await apiGet("/coin_plans");
  const grid = document.getElementById("coinPlanGrid");
  if (!res.ok){ grid.innerHTML = `<div class="empty-state">خطا در بارگذاری پلن‌ها</div>`; return; }
  COIN_PLANS_CACHE = res.data.plans;
  grid.innerHTML = COIN_PLANS_CACHE.map(p => `
    <div class="plan" data-idx="${p.index}">
      <div class="name">${p.name}</div>
      <div class="coins">${fmt(p.coins)}</div>
      <div class="price">${fmt(p.final_price_toman)} تومان</div>
    </div>
  `).join("");
  grid.querySelectorAll(".plan").forEach(el=>{
    el.addEventListener("click", ()=> openPayBox(COIN_PLANS_CACHE[el.dataset.idx*1]));
  });
}
let receiptBase64 = null;
function openPayBox(plan){
  receiptBase64 = null;
  const wrap = document.getElementById("payBoxWrap");
  wrap.innerHTML = `
    <div class="pay-box">
      <h3 style="margin-bottom:10px;">🪙 ${plan.name} - ${fmt(plan.coins)} سکه</h3>
      <div class="pay-row"><span>شماره کارت</span><b>6219-8614-5072-2391</b></div>
      <div class="pay-row"><span></span><button class="copy-btn" id="copyCardBtn">کپی شماره کارت</button></div>
      <div class="pay-row"><span>به نام</span><b>محمد طاها</b></div>
      <div class="pay-row"><span>مبلغ</span><b>${fmt(plan.final_price_toman)} تومان</b></div>
      <div class="form-field" style="margin-top:14px;">
        <label>📎 آپلود رسید</label>
        <div class="upload-box" id="uploadBox">
          <input type="file" id="receiptFile" accept="image/*" style="display:none;">
          <button class="btn block" id="chooseFileBtn">انتخاب فایل</button>
          <img class="prev hidden" id="receiptPreview">
        </div>
      </div>
      <button class="btn solid block" style="margin-top:10px;" id="sendReceiptBtn">ارسال برای تایید</button>
    </div>
  `;
  document.getElementById("copyCardBtn").onclick = ()=>{
    navigator.clipboard?.writeText("6219861450722391");
    toast("شماره کارت کپی شد");
  };
  document.getElementById("chooseFileBtn").onclick = ()=> document.getElementById("receiptFile").click();
  document.getElementById("receiptFile").onchange = (e)=>{
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ()=>{
      receiptBase64 = reader.result.split(",")[1];
      const prev = document.getElementById("receiptPreview");
      prev.src = reader.result;
      prev.classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  };
  document.getElementById("sendReceiptBtn").onclick = async ()=>{
    if (!receiptBase64){ toast("لطفاً رسید را آپلود کن"); return; }
    const res = await apiPost("/coin_purchase", {plan_index: plan.index, pay_method:"toman", receipt_base64: receiptBase64});
    if (!res.ok){ toast(res.error || "خطا در ثبت خرید"); return; }
    toast("رسید ارسال شد، منتظر تایید ادمین باش ⏳");
    document.getElementById("payBoxWrap").innerHTML = "";
  };
  wrap.scrollIntoView({behavior:"smooth", block:"start"});
}

async function loadSellList(){
  const box = document.getElementById("sellList");
  if (!SHOP){
    const r = await apiGet("/shop");
    if (r.ok) SHOP = r.data.categories;
    else { box.innerHTML = `<div class="empty-state">خطا در بارگذاری اطلاعات بازار</div>`; return; }
  }
  const meRes = await apiGet("/me");
  if (!meRes.ok){ box.innerHTML = `<div class="empty-state">خطا در بارگذاری</div>`; return; }
  const weapons = meRes.data.weapons || {};
  const entries = Object.entries(weapons);
  if (meRes.data.oil_reserves > 0) entries.push(["oil", meRes.data.oil_reserves]);
  if (!entries.length){ box.innerHTML = `<div class="empty-state">چیزی برای فروش نداری</div>`; return; }

  box.innerHTML = entries.map(([key, qty])=>{
    const it = key === "oil" ? {name:"🛢️ نفت خام", price:10} : itemInfo(key);
    if (!it) return "";
    return `<div class="card" data-key="${key}" data-max="${qty}">
      <div class="card-row"><h3>${it.name}</h3><span class="tag">موجودی: ${fmt(qty)}</span></div>
      <div class="desc">قیمت پایه (هر واحد): ${fmt(it.price)}</div>
      <div style="display:flex;gap:8px;margin-top:10px;">
        <input type="number" class="sellQty" min="1" max="${qty}" placeholder="تعداد" style="flex:1;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px;">
        <button class="btn solid sellBtn">فروش</button>
      </div>
    </div>`;
  }).join("");

  box.querySelectorAll(".card").forEach(card=>{
    const key = card.dataset.key;
    const max = parseInt(card.dataset.max, 10);
    card.querySelector(".sellBtn").addEventListener("click", ()=>{
      const qty = parseInt(card.querySelector(".sellQty").value, 10);
      if (!qty || qty < 1){ toast("تعداد را وارد کن"); return; }
      if (qty > max){ toast("موجودی کافی نیست"); return; }
      const it = key==="oil" ? {name:"🛢️ نفت خام", price:10} : itemInfo(key);
      if (!it) return;
      const total = it.price * qty;
      const fee = Math.floor(total * 0.1);
      const youGet = total - fee;
      openCenter(`
        <h3>⚠️ تایید فروش</h3>
        <div class="row"><span>📦 کالا</span><b>${it.name}</b></div>
        <div class="row"><span>🔢 تعداد</span><b>${fmt(qty)}</b></div>
        <div class="row"><span>💰 مجموع</span><b>${fmt(total)}</b></div>
        <div class="row"><span>💳 کارمزد ۱۰٪</span><b>${fmt(fee)}</b></div>
        <div class="row"><span>✅ دریافتی</span><b>${fmt(youGet)}</b></div>
        <div class="btnrow">
          <button class="btn" id="cancelSellBtn">لغو</button>
          <button class="btn solid" id="confirmSellBtn">تایید فروش</button>
        </div>
      `);
      document.getElementById("cancelSellBtn").onclick = closeCenter;
      document.getElementById("confirmSellBtn").onclick = async ()=>{
        const res = await apiPost("/sell_to_market", {item_key:key, qty});
        if (!res.ok){ toast(res.error||"خطا در فروش"); return; }
        toast("فروخته شد ✅");
        closeCenter();
        loadSellList();
        loadHome();
      };
    });
  });
}

async function loadLeaderboard(){
  const [powerRes, wealthRes] = await Promise.all([apiGet("/leaderboard/power"), apiGet("/leaderboard/wealth")]);
  const myCountry = ME ? ME.country : null;
  if (powerRes.ok){
    document.getElementById("rankPowerBody").innerHTML = powerRes.data.rankings.slice(0, 10).map(r => `
      <tr class="${r.country===myCountry?'me':''}"><td class="pos">${r.rank}</td>
      <td class="nm">${r.flag} ${r.name}</td><td>${fmt(r.score)}</td></tr>
    `).join("");
  }
  if (wealthRes.ok){
    document.getElementById("rankWealthBody").innerHTML = wealthRes.data.rankings.slice(0, 10).map(r => `
      <tr class="${r.country===myCountry?'me':''}"><td class="pos">${r.rank}</td>
      <td class="nm">${r.flag} ${r.name}</td><td>${fmt(r.budget)}</td></tr>
    `).join("");
  }
}

const ATTACK_TYPE_LABELS = {air:"✈️ هوایی", ground:"🪖 زمینی", sea:"⚓ دریایی", atomic:"☢️ اتمی"};

async function loadMilitaryTargets(){
  const listBox = document.getElementById("militaryTargets");
  const statusLine = document.getElementById("militaryStatusLine");
  document.getElementById("militaryConfig").classList.add("hidden");
  listBox.classList.remove("hidden");
  listBox.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  const res = await apiGet("/attack_targets");
  if (!res.ok){ listBox.innerHTML = `<div class="empty-state">خطا در بارگذاری اهداف</div>`; return; }
  const { targets, reason, remain, daily_attacks } = res.data;
  statusLine.textContent = `📊 حملات امروز: ${daily_attacks ?? 0} از ۵`;
  if (!targets.length){
    const msgs = {
      war_disabled: "جنگ در حال حاضر بسته است",
      time_closed: "ساعت حمله بسته است",
      daily_limit: "سقف حملات روزانه پر شده",
      cooldown: `باید ${remain ? Math.ceil(remain/60) : ''} دقیقه دیگر صبر کنی`,
    };
    listBox.innerHTML = `<div class="empty-state">${msgs[reason] || "هدفی برای حمله موجود نیست"}</div>`;
    return;
  }
  targets.sort((a,b)=> b.defense_power - a.defense_power);
  const maxDef = Math.max(...targets.map(t=>t.defense_power), 1);
  listBox.innerHTML = targets.map(t => {
    const pct = Math.round((t.defense_power / maxDef) * 100);
    const tier = pct < 20 ? "🟢 ضعیف" : pct < 50 ? "🟡 متوسط" : pct < 80 ? "🟠 قوی" : "🔴 خیلی قوی";
    return `<div class="card target-card" data-code="${t.country}">
      <div class="target">
        <span class="flag">${t.flag}</span>
        <div class="info"><b>${t.name}</b><small>${tier} — قدرت دفاع: ${fmt(t.defense_power)}</small></div>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:var(--red-soft);"></div></div>
      <div class="desc" style="margin-top:6px;">💰 بودجه: ${fmt(t.budget)}</div>
    </div>`;
  }).join("");
  listBox.querySelectorAll(".target-card").forEach(card=>{
    card.addEventListener("click", ()=>{
      listBox.querySelectorAll(".target-card").forEach(c => c.classList.remove("selected"));
      card.classList.add("selected");
      setTimeout(() => {
        openMilitaryConfig(card.dataset.code);
      }, 200);
    });
  });
}

async function openMilitaryConfig(code){
  currentAttackTarget = code;
  currentAttackTypes = [];
  document.getElementById("militaryTargets").classList.add("hidden");
  const cfg = document.getElementById("militaryConfig");
  cfg.classList.remove("hidden");
  document.getElementById("attackTypeGrid").innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  const res = await apiGet("/attack/available_types", {target_country: code});
  if (!res.ok || !res.data.types.length){
    document.getElementById("attackTypeGrid").innerHTML = `<div class="empty-state">هیچ نوع حمله‌ای در دسترس نیست (تجهیزات کافی نداری)</div>`;
    document.getElementById("attackPreviewBody").textContent = "";
    document.getElementById("confirmAttackBtn").disabled = true;
    return;
  }
  document.getElementById("confirmAttackBtn").disabled = false;
  document.getElementById("attackTypeGrid").innerHTML = res.data.types.map(t=>
    `<button data-type="${t}">${ATTACK_TYPE_LABELS[t]||t}</button>`
  ).join("");
  document.getElementById("attackTypeGrid").querySelectorAll("button").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      btn.classList.toggle("active");
      const t = btn.dataset.type;
      if (currentAttackTypes.includes(t)) currentAttackTypes = currentAttackTypes.filter(x=>x!==t);
      else currentAttackTypes.push(t);
      updateAttackPreview();
    });
  });
  document.getElementById("powerSlider").value = 50;
  document.getElementById("powerSliderVal").textContent = "۵۰٪";
  updateAttackPreview();
}
document.getElementById("militaryBackBtn").addEventListener("click", ()=>{
  document.getElementById("militaryConfig").classList.add("hidden");
  document.getElementById("militaryTargets").classList.remove("hidden");
});
document.getElementById("powerSlider").addEventListener("input", (e)=>{
  document.getElementById("powerSliderVal").textContent = e.target.value + "٪";
  updateAttackPreview();
});
let previewDebounce = null;
function updateAttackPreview(){
  clearTimeout(previewDebounce);
  const body = document.getElementById("attackPreviewBody");
  if (!currentAttackTypes.length){
    body.textContent = "حداقل یک نوع حمله انتخاب کن";
    return;
  }
  body.textContent = "در حال محاسبه...";
  previewDebounce = setTimeout(async ()=>{
    const percent = parseInt(document.getElementById("powerSlider").value, 10);
    const res = await apiPost("/attack/preview", {target_country: currentAttackTarget, attack_types: currentAttackTypes, percent});
    if (!res.ok){ body.textContent = res.error || "خطا در محاسبه"; return; }
    const d = res.data;
    if (d.too_weak){ body.innerHTML = `⚠️ حمله خیلی ضعیف است`; return; }
    let extra = "";
    if (d.annihilated) extra = `<div style="color:var(--red-soft);font-weight:700;margin-top:6px;">☢️ نابودی کامل!</div>`;
    else if (d.conquered) extra = `<div style="color:var(--gold-soft);font-weight:700;margin-top:6px;">🏴 فتح کامل!</div>`;
    body.innerHTML = `
      💪 قدرت حمله: ${fmt(d.atk_power)}<br>
      🛡 قدرت دفاع: ${fmt(d.def_power)}<br>
      📊 آسیب: ${d.damage_percent}٪<br>
      💰 غرامت تخمینی: ${fmt(d.transferred)}
      ${extra}
    `;
  }, 350);
}
document.getElementById("confirmAttackBtn").addEventListener("click", async ()=>{
  if (!currentAttackTypes.length){ toast("نوع حمله را انتخاب کن"); return; }
  const percent = parseInt(document.getElementById("powerSlider").value, 10);
  const res = await apiPost("/attack", {target_country: currentAttackTarget, attack_types: currentAttackTypes, percent});
  if (!res.ok){ toast(res.error || "خطا در حمله"); return; }
  const r = res.data.result;
  let cls = "";
  if (r.annihilated) cls = "annihilate"; else if (r.conquered) cls = "conquer";
  openCenter(`
    <div class="result-icon">${r.annihilated ? "☢️" : r.conquered ? "🏴" : "⚔️"}</div>
    <h3>نتیجه‌ی حمله</h3>
    <div class="row"><span>📊 آسیب</span><b>${r.damage_percent}٪</b></div>
    <div class="row"><span>💰 غرامت</span><b>${fmt(r.transferred)}</b></div>
    <div class="row"><span>نتیجه</span><b>${r.annihilated?"نابودی کامل!":r.conquered?"فتح کامل!":"حمله موفق"}</b></div>
    <div class="btnrow"><button class="btn solid block" id="attackOkBtn">اوکی</button></div>
  `, cls);
  document.getElementById("attackOkBtn").onclick = ()=>{
    closeCenter();
    document.getElementById("militaryConfig").classList.add("hidden");
    document.getElementById("militaryTargets").classList.remove("hidden");
    loadMilitaryTargets();
    loadHome();
  };
});

document.getElementById("cyberOpGrid").querySelectorAll("button").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    document.getElementById("cyberOpGrid").querySelectorAll("button").forEach(b=>b.classList.toggle("active", b===btn));
    currentCyberOp = btn.dataset.op;
    loadCyberTargets();
  });
});
async function loadCyberTargets(){
  const box = document.getElementById("cyberTargets");
  const statusLine = document.getElementById("cyberStatusLine");
  box.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  const [limRes, res] = await Promise.all([apiGet("/limits/daily"), apiGet("/cyber_targets", {hack_type: currentCyberOp})]);
  if (limRes.ok){
    const l = limRes.data;
    statusLine.textContent = currentCyberOp === "spy"
      ? `📊 جاسوسی‌های امروز: ${l.spy.used} از ${l.spy.max}`
      : `📊 هک‌های امروز: ${l.cyber.used} از ${l.cyber.max}`;
  }
  if (!res.ok){ box.innerHTML = `<div class="empty-state">خطا در بارگذاری اهداف</div>`; return; }
  const targets = res.data.targets;
  targets.sort((a,b)=> b.defense_percent - a.defense_percent);
  
  if (!targets.length){ box.innerHTML = `<div class="empty-state">${res.data.reason === "cyber_disabled" ? "جنگ سایبری بسته است" : "هدفی موجود نیست"}</div>`; return; }
  box.innerHTML = targets.map(t => `
    <div class="card target-card" data-code="${t.country}">
      <div class="target">
        <span class="flag">${t.flag}</span>
        <div class="info"><b>${t.name}</b><small>${t.tier === "ضعیف" ? "🟢" : t.tier==="متوسط"?"🟡":t.tier==="قوی"?"🟠":"🔴"} فایروال ${t.tier}</small></div>
      </div>
      <div class="bar-track"><div class="bar-fill" style="width:${t.defense_percent}%;background:var(--red-soft);"></div></div>
    </div>
  `).join("");
  box.querySelectorAll(".target-card").forEach(card=>{
    card.addEventListener("click", ()=> openCyberModal(card.dataset.code));
  });
}
async function openCyberModal(code){
  if (currentCyberOp === "spy"){ openSpyModal(code); return; }
  openCenter(`<div class="loading-wrap"><div class="spinner"></div></div>`);
  const res = await apiPost("/cyber/preview", {target_country: code, hack_type: currentCyberOp});
  if (!res.ok){ openCenter(`<div class="empty-state">${res.error||"خطا"}</div>`); return; }
  const d = res.data;
  const extraRow = currentCyberOp === "asset"
    ? `<div class="row"><span>💰 در صورت موفقیت</span><b>${fmt(d.potential_steal)}</b></div>`
    : `<div class="row"><span>💥 قابل تخریب</span><b>${d.destroyable_types} نوع</b></div>`;
  openCenter(`
    <h3>${currentCyberOp === "asset" ? "💰 هک دارایی" : "⚔️ هک نظامی"}</h3>
    <div class="row"><span>💪 قدرت هک</span><b>${fmt(d.attack_power)}</b></div>
    <div class="row"><span>🛡 ضد هک</span><b>${fmt(d.defense_power)}</b></div>
    <div class="row"><span>📊 شانس موفقیت</span><b>${d.success_rate}٪</b></div>
    ${extraRow}
    <div class="row"><span>🎯 موجودی آیتم هک</span><b>${d.hack_items_available}</b></div>
    <div class="btnrow">
      <button class="btn" id="cyberCancelBtn">لغو</button>
      <button class="btn solid" id="cyberConfirmBtn" ${d.hack_items_available<=0?'disabled':''}>تایید</button>
    </div>
  `);
  document.getElementById("cyberCancelBtn").onclick = closeCenter;
  document.getElementById("cyberConfirmBtn").onclick = async ()=>{
    const r = await apiPost("/cyber_attack", {target_country: code, hack_type: currentCyberOp});
    if (!r.ok){ toast(r.error||"خطا"); return; }
    const result = r.data.result;
    let body = `<div class="result-icon">${result.success?"✅":"❌"}</div><h3>${result.success?"هک موفق بود":"هک ناموفق بود"}</h3>`;
    if (result.stolen) body += `<div class="row"><span>💰 دزدیده شد</span><b>${fmt(result.stolen)}</b></div>`;
    if (result.destroyed) body += Object.entries(result.destroyed).map(([k,v])=>`<div class="row"><span>${itemInfo(k)?.name||k}</span><b>-${v}</b></div>`).join("");
    body += `<div class="btnrow"><button class="btn solid block" id="cyberOkBtn">اوکی</button></div>`;
    openCenter(body);
    document.getElementById("cyberOkBtn").onclick = ()=>{ closeCenter(); loadCyberTargets(); loadHome(); };
  };
}
async function openSpyModal(code){
  const meRes = ME || (await apiGet("/me")).data;
  openCenter(`
    <h3>🕵️ جاسوسی اطلاعات</h3>
    <div class="row"><span>🕵️ جاسوس‌های شما</span><b>${fmt(meRes.weapons?.spy||0)}</b></div>
    <div class="form-field" style="text-align:right;margin-top:10px;">
      <label>تعداد جاسوس اعزامی</label>
      <input type="number" id="spyCountInput" min="1" max="${meRes.weapons?.spy||0}" value="${Math.min(10, meRes.weapons?.spy||0)}" style="width:100%;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px;text-align:center;">
    </div>
    <div id="spyPreviewBody" class="desc" style="margin:10px 0;">در حال محاسبه...</div>
    <div class="btnrow">
      <button class="btn" id="spyCancelBtn">لغو</button>
      <button class="btn solid" id="spyConfirmBtn">تایید</button>
    </div>
  `);
  async function refreshSpyPreview(){
    const cnt = parseInt(document.getElementById("spyCountInput").value, 10) || 1;
    const res = await apiPost("/spy/preview", {target_country: code, spy_count: cnt});
    const body = document.getElementById("spyPreviewBody");
    if (!res.ok){ body.textContent = res.error || "خطا"; return; }
    body.innerHTML = `🎲 شانس موفقیت: ${res.data.success_rate}٪<br>📊 سطح اطلاعات: پله ${res.data.tier}<br>💰 قیمت فروش تخمینی: ${fmt(res.data.price)}`;
  }
  const spyInput = document.getElementById("spyCountInput");
  spyInput.addEventListener("input", refreshSpyPreview);
  spyInput.addEventListener("change", refreshSpyPreview);
  spyInput.addEventListener("keyup", refreshSpyPreview);
  refreshSpyPreview();
  document.getElementById("spyCancelBtn").onclick = closeCenter;
  document.getElementById("spyConfirmBtn").onclick = async ()=>{
    const cnt = parseInt(document.getElementById("spyCountInput").value, 10) || 1;
    const r = await apiPost("/spy", {target_country: code, spy_count: cnt});
    if (!r.ok){ toast(r.error||"خطا"); return; }
    const result = r.data.result;
    let body = `<div class="result-icon">${result.exposed?"🚨":result.success?"✅":"❌"}</div>`;
    body += `<h3>${result.exposed?"جاسوس شناسایی شد!":result.success?"جاسوسی موفق بود":"جاسوسی ناموفق بود"}</h3>`;
    
    if (result.success && !result.exposed && result.snapshot) {
      body += `<div class="desc" style="margin:12px 0;text-align:right;font-size:11.5px;line-height:1.8;max-height:40vh;overflow-y:auto;background:var(--panel-2);padding:10px;border-radius:6px;">${result.snapshot}</div>`;
      body += `<div class="row"><span>📊 سطح اطلاعات</span><b>پله ${result.tier}</b></div>`;
      body += `<div class="row"><span>💰 قیمت فروش</span><b>${fmt(result.price)}</b></div>`;
      body += `<div class="btnrow" style="flex-direction:column;gap:8px;">
        <button class="btn solid block" id="spySellBtn">📤 فروش به بازار جاسوسی</button>
        <button class="btn block" id="spyOkBtn">اوکی</button>
      </div>`;
    } else {
      body += `<div class="btnrow"><button class="btn solid block" id="spyOkBtn">اوکی</button></div>`;
    }
    
    openCenter(body);
    
    if (result.success && !result.exposed && result.snapshot) {
      document.getElementById("spySellBtn").onclick = async () => {
        const sellRes = await apiPost("/spy/sell_info", {
          target_country: code,
          tier: result.tier,
          price: result.price,
          info_snapshot: result.snapshot
        });
        if (sellRes.ok) {
          toast("اطلاعات برای فروش عرضه شد ✅");
          closeCenter();
          loadCyberTargets();
        } else {
          toast(sellRes.error || "خطا در فروش");
        }
      };
    }
    
    document.getElementById("spyOkBtn").onclick = ()=>{ closeCenter(); loadCyberTargets(); loadHome(); };
  };
}

document.getElementById("statementText").addEventListener("input", (e)=>{
  document.getElementById("charCount").textContent = e.target.value.length;
});
document.getElementById("sendStatementBtn").addEventListener("click", async ()=>{
  const text = document.getElementById("statementText").value.trim();
  if (text.length < 2){ toast("متن بیانیه را بنویس"); return; }
  const res = await apiPost("/declaration", {text});
  if (!res.ok){ toast(res.error || "خطا در ارسال"); return; }
  toast("بیانیه برای بررسی ادمین ارسال شد ⏳");
  document.getElementById("statementText").value = "";
  document.getElementById("charCount").textContent = "0";
  loadStatementHistory();
});
async function loadStatementHistory(){
  const box = document.getElementById("declarationHistory");
  const res = await apiGet("/declaration_history");
  if (!res.ok || !res.data.declarations.length){ box.innerHTML = ""; return; }
  const statusLabel = {pending:"⏳ در انتظار بررسی", approved:"✅ تایید شده", rejected:"❌ رد شده"};
  box.innerHTML = res.data.declarations.slice(0,10).map(d => `
    <div class="list-card">
      <div class="sub">${d.text}</div>
      <div class="status-pill" style="margin-top:8px;">${statusLabel[d.status]||d.status}</div>
    </div>
  `).join("");
}

async function loadOil(){
  const box = document.getElementById("oilContent");
  const res = await apiGet("/oil/status");
  if (!res.ok){ box.innerHTML = `<div class="empty-state">خطا در بارگذاری</div>`; return; }
  const d = res.data;
  box.innerHTML = `
    <div class="card">
      <div class="card-row"><h3>🛢️ استخراج نفت</h3></div>
      <div class="desc" style="margin-top:6px;">🛢️ نفت‌کش‌ها: ${fmt(d.oil_tanker)}</div>
      <div class="desc">⛽ ذخایر فعلی: ${fmt(d.oil_reserves)}</div>
      <div class="desc">📈 درآمد نفتی روزانه: ${fmt(d.oil_income)}</div>
    </div>
    ${d.oil_tanker > 0 ? `
      <div class="form-field">
        <label>تعداد نفت‌کش برای استخراج</label>
        <input type="number" id="tankerCount" min="1" max="${d.oil_tanker}" value="${d.oil_tanker}">
      </div>
      <button class="btn solid block" id="extractBtn" ${d.can_extract_today?'':'disabled'}>
        ${d.can_extract_today ? 'تایید و استخراج' : 'امروز قبلاً استخراج کردی'}
      </button>
    ` : `<div class="empty-state">نفت‌کشی نداری — از بازار تسلیحات بخر</div>`}
  `;
  const btn = document.getElementById("extractBtn");
  if (btn) btn.addEventListener("click", async ()=>{
    const cnt = parseInt(document.getElementById("tankerCount").value, 10);
    if (!cnt || cnt < 1){ toast("تعداد را وارد کن"); return; }
    const res2 = await apiPost("/oil_extraction", {tanker_count: cnt});
    if (!res2.ok){ toast(res2.error || "خطا"); return; }
    toast(`${fmt(res2.data.extracted)} بشکه نفت استخراج شد ✅`);
    loadOil();
    loadHome();
  });
}

async function loadAlliance(){
  const box = document.getElementById("allianceContent");
  box.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  const res = await apiGet("/alliance/info");
  if (!res.ok){ box.innerHTML = `<div class="empty-state">خطا در بارگذاری</div>`; return; }
  if (!res.data.in_alliance){
    renderAllianceBrowse(box);
    return;
  }
  renderAlliancePanel(box, res.data);
}
async function renderAllianceBrowse(box){
  const res = await apiGet("/alliances");
  const list = res.ok ? res.data.alliances : [];
  box.innerHTML = `
    <div class="screen-sub">اتحادی نیستی — یکی رو پیدا کن یا خودت بساز</div>
    ${list.length ? list.map(a => `
      <div class="list-card">
        <div class="head"><b>🤝 ${a.name}</b><span class="tag gold">${fmt(a.members_count)} عضو</span></div>
        <div class="sub">👑 لیدر: ${a.leader_flag||""} ${a.leader_name||""}</div>
        <div class="actions"><button class="btn block join-alliance-btn" data-id="${a.id}">درخواست عضویت</button></div>
      </div>
    `).join("") : `<div class="empty-state">اتحادی موجود نیست</div>`}
    <button class="btn solid block" id="createAllianceBtn" style="margin-top:10px;">🏗 ساخت اتحاد جدید</button>
  `;
  box.querySelectorAll(".join-alliance-btn").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const r = await apiPost("/alliance/join", {alliance_id: parseInt(b.dataset.id,10)});
      toast(r.ok ? "درخواست عضویت ارسال شد ✅" : (r.error||"خطا"));
    });
  });
  document.getElementById("createAllianceBtn").onclick = ()=>{
    openCenter(`
      <h3>🏗 ساخت اتحاد جدید</h3>
      <div class="desc" style="margin:6px 0 12px;">💰 هزینه: ${fmt(1000000000)}</div>
      <input type="text" id="allianceNameInput" placeholder="اسم اتحاد" style="width:100%;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px;text-align:center;">
      <div class="btnrow" style="margin-top:14px;">
        <button class="btn" id="cancelAllianceBtn">لغو</button>
        <button class="btn solid" id="confirmAllianceBtn">تایید و ساخت</button>
      </div>
    `);
    document.getElementById("cancelAllianceBtn").onclick = closeCenter;
    document.getElementById("confirmAllianceBtn").onclick = async ()=>{
      const name = document.getElementById("allianceNameInput").value.trim();
      if (name.length < 2){ toast("اسم معتبر وارد کن"); return; }
      const r = await apiPost("/alliance/create", {name});
      if (!r.ok){ toast(r.error||"خطا"); return; }
      toast("اتحاد ساخته شد ✅");
      closeCenter();
      loadAlliance();
      loadHome();
    };
  };
}
async function renderAlliancePanel(box, info){
  box.innerHTML = `
    <div class="card">
      <div class="card-row"><h3>🤝 ${info.name}</h3></div>
      <div class="desc">👑 لیدر: ${info.leader_flag||""} ${info.leader_name||""}${info.is_leader?' (شما)':''}</div>
      <div class="desc">👥 ${fmt(info.members_count)} عضو</div>
    </div>
    <button class="btn block" id="viewMembersBtn" style="margin-bottom:8px;">👥 اعضای اتحاد</button>
    ${info.is_leader ? `
      <button class="btn block" id="viewRequestsBtn" style="margin-bottom:8px;">📋 درخواست‌های عضویت</button>
      <button class="btn block" id="allianceAttackBtn" style="margin-bottom:8px;">⚔️ حمله اتحادی</button>
      <button class="btn danger block" id="disbandBtn" style="margin-bottom:8px;">🗑 انحلال اتحاد</button>
    ` : `
      <button class="btn danger block" id="leaveAllianceBtn" style="margin-bottom:8px;">🚪 خروج از اتحاد</button>
    `}
  `;
  document.getElementById("viewMembersBtn").onclick = async ()=>{
    const r = await apiGet("/alliance/members");
    if (!r.ok){ toast(r.error||"خطا"); return; }
    openCenter(`
      <h3>👥 اعضای اتحاد</h3>
      <div style="max-height:50vh;overflow-y:auto;text-align:right;">
        ${r.data.members.map(m => `
          <div class="row"><span>${m.flag||""} ${m.country_name||m.country}${m.is_leader?' 👑':''}</span>
          ${info.is_leader && !m.is_leader ? `<button class="btn sm danger kick-btn" data-country="${m.country}" data-uid="${m.user_id}">اخراج</button>` : ''}
          </div>
        `).join("")}
      </div>
      <div class="btnrow"><button class="btn block" id="closeMembersBtn">بستن</button></div>
    `);
    document.getElementById("closeMembersBtn").onclick = closeCenter;
    box_querySelectorAllSafe(".kick-btn", async (b)=>{
      const r2 = await apiPost("/alliance/kick", {target_country: b.dataset.country});
      toast(r2.ok ? "اخراج شد" : (r2.error||"خطا"));
      closeCenter(); loadAlliance();
    });
  };
  if (info.is_leader){
    document.getElementById("viewRequestsBtn").onclick = async ()=>{
      const r = await apiGet("/alliance/requests");
      if (!r.ok){ toast(r.error||"خطا"); return; }
      openCenter(`
        <h3>📋 درخواست‌های عضویت</h3>
        <div style="max-height:50vh;overflow-y:auto;">
          ${r.data.requests.length ? r.data.requests.map(rq => `
            <div class="row"><span>${rq.sender_flag||""} ${rq.sender_name||rq.sender_country}</span>
            <span><button class="btn sm solid req-accept" data-id="${rq.id}">تایید</button>
            <button class="btn sm danger req-reject" data-id="${rq.id}">رد</button></span></div>
          `).join("") : `<div class="empty-state">درخواستی نیست</div>`}
        </div>
        <div class="btnrow"><button class="btn block" id="closeReqBtn">بستن</button></div>
      `);
      document.getElementById("closeReqBtn").onclick = closeCenter;
      box_querySelectorAllSafe(".req-accept", async (b)=>{
        const r2 = await apiPost("/alliance/accept_request", {request_id: parseInt(b.dataset.id,10)});
        toast(r2.ok?"تایید شد":(r2.error||"خطا")); closeCenter(); loadAlliance();
      });
      box_querySelectorAllSafe(".req-reject", async (b)=>{
        const r2 = await apiPost("/alliance/reject_request", {request_id: parseInt(b.dataset.id,10)});
        toast(r2.ok?"رد شد":(r2.error||"خطا")); closeCenter(); loadAlliance();
      });
    };
    document.getElementById("allianceAttackBtn").onclick = async ()=>{
      const tRes = await apiGet("/attack_targets");
      const targets = tRes.ok ? tRes.data.targets : [];
      openCenter(`
        <h3>⚔️ حمله اتحادی</h3>
        <select id="allyAttackTarget" style="width:100%;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px;margin:10px 0;">
          ${targets.map(t=>`<option value="${t.country}">${t.flag} ${t.name}</option>`).join("")}
        </select>
        <div class="slider-wrap">
          <input type="range" id="allyPercent" min="1" max="100" value="50">
          <div class="slider-val" id="allyPercentVal">۵۰٪</div>
        </div>
        <div class="desc">⏳ درخواست به تلگرام اعضا فرستاده می‌شود</div>
        <div class="btnrow">
          <button class="btn" id="cancelAllyAttackBtn">لغو</button>
          <button class="btn solid" id="sendAllyAttackBtn">ارسال به اعضا</button>
        </div>
      `);
      document.getElementById("allyPercent").addEventListener("input", e=>{
        document.getElementById("allyPercentVal").textContent = e.target.value+"٪";
      });
      document.getElementById("cancelAllyAttackBtn").onclick = closeCenter;
      document.getElementById("sendAllyAttackBtn").onclick = async ()=>{
        const target = document.getElementById("allyAttackTarget").value;
        const percent = parseInt(document.getElementById("allyPercent").value,10);
        const r = await apiPost("/alliance/attack/start", {target_country: target, percent});
        toast(r.ok ? "درخواست حمله اتحادی ارسال شد ✅" : (r.error||"خطا"));
        closeCenter();
      };
    };
    document.getElementById("disbandBtn").onclick = ()=>{
      openCenter(`
        <h3>🗑 انحلال اتحاد</h3>
        <div class="desc" style="margin:8px 0 16px;">این عمل غیرقابل بازگشت است.</div>
        <div class="btnrow">
          <button class="btn" id="cancelDisbandBtn">لغو</button>
          <button class="btn danger" id="confirmDisbandBtn">انحلال</button>
        </div>
      `);
      document.getElementById("cancelDisbandBtn").onclick = closeCenter;
      document.getElementById("confirmDisbandBtn").onclick = async ()=>{
        const r = await apiPost("/alliance/disband", {});
        toast(r.ok?"اتحاد منحل شد":(r.error||"خطا"));
        closeCenter(); loadAlliance();
      };
    };
  } else {
    document.getElementById("leaveAllianceBtn").onclick = async ()=>{
      const r = await apiPost("/alliance/leave", {});
      toast(r.ok?"از اتحاد خارج شدی":(r.error||"خطا"));
      loadAlliance();
    };
  }
}
function box_querySelectorAllSafe(sel, handler){
  document.getElementById("centerModalBody").querySelectorAll(sel).forEach(el=>{
    el.addEventListener("click", ()=> handler(el));
  });
}

async function loadExport(){
  if (!SHOP){
    const shopRes = await apiGet("/shop");
    if (shopRes.ok) SHOP = shopRes.data.categories;
  }

  const meRes = await apiGet("/me");
  if (!meRes.ok) return;
  ME = meRes.data;
  const goodSel = document.getElementById("exportGood");
  const weapons = Object.entries(ME.weapons||{});
  let opts = weapons.map(([k,q]) => `<option value="${k}">${itemInfo(k)?.name || k} (${fmt(q)})</option>`).join("");
  if (ME.oil_reserves > 0) opts += `<option value="oil">🛢️ نفت (${fmt(ME.oil_reserves)})</option>`;
  goodSel.innerHTML = opts || `<option value="">چیزی برای صادرات نداری</option>`;

  if (!COUNTRIES_CACHE){ const r = await apiGet("/countries"); if (r.ok) COUNTRIES_CACHE = r.data.countries; }
  const countrySel = document.getElementById("exportCountry");
  countrySel.innerHTML = COUNTRIES_CACHE.filter(c=>c.taken && c.code !== ME.country)
    .map(c=>`<option value="${c.code}">${c.flag} ${c.name}</option>`).join("");

  loadExportOffers();
}
document.getElementById("sendExportBtn").addEventListener("click", async ()=>{
  const item_key = document.getElementById("exportGood").value;
  const qty = parseInt(document.getElementById("exportQty").value, 10);
  const total_price = parseInt(document.getElementById("exportPrice").value, 10);
  const buyer_country = document.getElementById("exportCountry").value;
  if (!item_key || !qty || !total_price || !buyer_country){ toast("همه فیلدها را پر کن"); return; }
  const res = await apiPost("/export_offer", {item_key, qty, total_price, buyer_country});
  if (!res.ok){ toast(res.error || "خطا در ارسال پیشنهاد"); return; }
  toast("پیشنهاد صادراتی ارسال شد ✅");
  document.getElementById("exportQty").value = "";
  document.getElementById("exportPrice").value = "";
  loadExportOffers();
});
async function loadExportOffers(){
  const box = document.getElementById("exportOffersLists");
  const [mine, incoming] = await Promise.all([apiGet("/export/my_offers"), apiGet("/export/incoming")]);
  let html = "";
  if (incoming.ok && incoming.data.offers.length){
    html += `<h3 style="font-size:13px;margin-bottom:8px;">📥 پیشنهادهای دریافتی</h3>`;
    html += incoming.data.offers.map(o => `
      <div class="list-card">
        <div class="sub">از ${o.seller_country} — ${itemInfo(o.item_key)?.name||o.item_key} × ${fmt(o.quantity)}</div>
        <div class="sub">💰 ${fmt(o.total_price)}</div>
        <div class="actions">
          <button class="btn sm solid export-accept" data-id="${o.id}">قبول</button>
          <button class="btn sm danger export-reject" data-id="${o.id}">رد</button>
        </div>
      </div>
    `).join("");
  }
  if (mine.ok && mine.data.offers.length){
    html += `<h3 style="font-size:13px;margin:14px 0 8px;">📤 پیشنهادهای من</h3>`;
    html += mine.data.offers.slice(0,15).map(o => `
      <div class="list-card">
        <div class="sub">به ${o.buyer_country} — ${itemInfo(o.item_key)?.name||o.item_key} × ${fmt(o.quantity)}</div>
        <div class="sub">💰 ${fmt(o.total_price)} — وضعیت: ${o.status}</div>
      </div>
    `).join("");
  }
  box.innerHTML = html;
  box.querySelectorAll(".export-accept").forEach(b=>b.addEventListener("click", async ()=>{
    const r = await apiPost("/export/accept", {offer_id: parseInt(b.dataset.id,10)});
    toast(r.ok?"معامله انجام شد ✅":(r.error||"خطا"));
    loadExportOffers();
    loadHome();
    loadSellList();
  }));
  box.querySelectorAll(".export-reject").forEach(b=>b.addEventListener("click", async ()=>{
    const r = await apiPost("/export/reject", {offer_id: parseInt(b.dataset.id,10)});
    toast(r.ok?"رد شد":(r.error||"خطا")); loadExportOffers();
  }));
}

async function loadCompanies(){
  const box = document.getElementById("companiesContent");
  box.innerHTML = `<div class="loading-wrap"><div class="spinner"></div></div>`;
  const [mine, available, sales] = await Promise.all([apiGet("/companies/my"), apiGet("/companies/available"), apiGet("/company_sales")]);
  let html = `<h3 style="font-size:13px;margin-bottom:8px;">🏭 شرکت‌های من</h3>`;
  if (mine.ok && mine.data.companies.length){
    html += mine.data.companies.map(c => `
      <div class="list-card">
        <div class="head"><b>${c.name}</b></div>
        <div class="sub">درآمد روزانه: ${fmt(c.income)}</div>
        <div class="actions"><button class="btn sm company-sell-btn" data-key="${c.key}" data-name="${c.name}">💰 فروش شرکت</button></div>
      </div>
    `).join("");
  } else {
    html += `<div class="empty-state">شرکتی نداری</div>`;
  }

  if (sales.ok && sales.data.sales.length){
    html += `<h3 style="font-size:13px;margin:16px 0 8px;">🏪 بازار شرکت‌ها</h3>`;
    html += sales.data.sales.map(s => `
      <div class="list-card">
        <div class="head"><b>${s.company_name}</b><span class="tag gold">${fmt(s.price)}</span></div>
        <div class="actions"><button class="btn sm solid buy-from-sale-btn" data-id="${s.id}">خرید</button></div>
      </div>
    `).join("");
  }

  html += `<h3 style="font-size:13px;margin:16px 0 8px;">🏗 خرید شرکت جدید</h3>`;
  if (available.ok && available.data.companies.length){
    html += `<div class="grid-2">` + available.data.companies.map(c => `
      <div class="card">
        <h3 style="font-size:12.5px;">${c.name}</h3>
        <div class="desc">${fmt(c.price)} — نفت: ${fmt(c.oil_needed)}</div>
        <div class="desc">درآمد: ${fmt(c.income)}/روز</div>
        <button class="btn sm solid block buy-company-btn" data-key="${c.key}" style="margin-top:8px;">خرید</button>
      </div>
    `).join("") + `</div>`;
  } else {
    html += `<div class="empty-state">شرکتی برای خرید موجود نیست</div>`;
  }

  box.innerHTML = html;

  box.querySelectorAll(".company-sell-btn").forEach(b=>{
    b.addEventListener("click", ()=>{
      openCenter(`
        <h3>💰 فروش شرکت</h3>
        <div class="desc" style="margin:6px 0 10px;">🏭 ${b.dataset.name}</div>
        <input type="number" id="sellPriceInput" placeholder="قیمت فروش" style="width:100%;background:var(--panel-2);border:1px solid var(--border);color:var(--text);border-radius:6px;padding:9px;text-align:center;">
        <div class="btnrow" style="margin-top:14px;">
          <button class="btn" id="cancelCoSellBtn">لغو</button>
          <button class="btn solid" id="confirmCoSellBtn">تایید فروش</button>
        </div>
      `);
      document.getElementById("cancelCoSellBtn").onclick = closeCenter;
      document.getElementById("confirmCoSellBtn").onclick = async ()=>{
        const price = parseInt(document.getElementById("sellPriceInput").value,10);
        if (!price){ toast("قیمت را وارد کن"); return; }
        const r = await apiPost("/company/sell", {company_key: b.dataset.key, price});
        toast(r.ok?"شرکت برای فروش گذاشته شد ✅":(r.error||"خطا"));
        closeCenter(); loadCompanies();
      };
    });
  });
  box.querySelectorAll(".buy-company-btn").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const r = await apiPost("/buy_company", {company_key: b.dataset.key});
      toast(r.ok?"شرکت خریداری شد ✅":(r.error||"خطا"));
      loadCompanies(); loadHome();
    });
  });
  box.querySelectorAll(".buy-from-sale-btn").forEach(b=>{
    b.addEventListener("click", async ()=>{
      const r = await apiPost("/company/buy_from_sale", {sale_id: parseInt(b.dataset.id,10)});
      toast(r.ok?"شرکت خریداری شد ✅":(r.error||"خطا"));
      loadCompanies(); loadHome();
    });
  });
}

document.getElementById("bellBtn").addEventListener("click", async ()=>{
  const res = await apiGet("/notifications");
  const list = document.getElementById("notifList");
  if (!res.ok){ list.innerHTML = `<div class="empty-state">خطا در بارگذاری</div>`; }
  else {
    const notifs = res.data.notifications;
    list.innerHTML = notifs.length ? notifs.map(n => `
      <div class="notif-item ${n.is_read ? 'read':''}">
        <div class="notif-dot"></div>
        <div class="txt"><b>${n.text}</b><small>${n.created_at||''}</small></div>
      </div>
    `).join("") : `<div class="empty-state">اعلانی نیست</div>`;
  }
  document.getElementById("notifOverlay").classList.remove("hidden");
  refreshBellDot();
});
document.getElementById("notifCloseBtn").addEventListener("click", ()=> document.getElementById("notifOverlay").classList.add("hidden"));
document.getElementById("markAllReadBtn").addEventListener("click", async ()=>{
  await apiPost("/notifications/read_all", {});
  document.querySelectorAll(".notif-item").forEach(el=>el.classList.add("read"));
  refreshBellDot();
});
async function refreshBellDot(){
  const res = await apiGet("/notifications/unread_count");
  if (res.ok) document.getElementById("bellDot").classList.toggle("hidden", res.data.count <= 0);
}