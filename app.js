'use strict';

// In-memory UI prototype. No cookies, storage APIs, network or real personal data.
const main = document.querySelector('#main-content');
const dialog = document.querySelector('#flow-dialog');
const loginTemplate = main.innerHTML;
const demoTools = document.querySelector('#demo-tools');
const money = n => `NT$ ${Number(n).toLocaleString('en-US')}`;
const cardNumber = '**** **** **** 4821';
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const icon = (name, extra = '') => `<img class="icon ${extra}" src="./assets/icons/${name}.svg" alt="" aria-hidden="true" width="24" height="24">`;
const screens = [
  ['login','個人帳戶登入'],['register','註冊'],['register-success','註冊成功'],['register-duplicate','身分證字號重複'],
  ['recovery','忘記密碼'],['recovery-question','安全問題驗證'],['recovery-password','更新密碼'],['recovery-complete','更新完成'],
  ['home','主畫面'],['transactions','交易紀錄'],['transaction-search','交易日期查詢'],['home-unbound','主畫面・未綁卡'],
  ['merchant','商家介面'],['merchant-application','申請商家權限'],['merchant-pending','商家審核中'],['merchant-profile','商家資訊'],
  ['merchant-receipts','商家收款紀錄'],['card','卡片管理'],['card-password','變更密碼'],['card-password-success','密碼變更成功'],
  ['card-cancel','遺失註銷'],['card-unbound','尚未綁定卡片'],['card-insert','請插入卡片'],['card-reading','讀卡中'],
  ['card-bind-confirm','確認綁定卡片'],['card-bind-complete','綁定完成'],['logout','登出確認']
];
const personalRows = [
  ['T0008','小巷書店','2026-11-05',360,'支出'],['T0007','青禾餐坊','2026-11-04',180,'支出'],
  ['T0006','山光商店','2026-11-03',1200,'收款'],['T0005','晨光咖啡','2026-11-02',260,'支出'],
  ['T0004','綠野超市','2026-11-01',480,'支出'],['T0003','文心書局','2026-10-31',300,'支出'],
  ['T0002','日和餐館','2026-10-30',720,'支出'],['T0001','小巷書店','2026-10-29',150,'支出']
];
// Keep one consistent data source for the real date filter (the two reference
// screenshots disagree about T0007's date). All dates are explicit demo data.
const merchantRows = [['M0012','小巷書店','2026-11-05',360,'收款'],['M0011','青禾餐坊','2026-11-05',180,'收款'],['M0010','日和餐館','2026-11-04',720,'收款']];
let users, currentKey, authenticated, recovering, recoveryVerified, completion;
let readingTimer = null, readReady = false, route = 'login', balanceHidden = false;
let menuOpen = false, sidebarCollapsed = false, pendingFocus = null;
let dateFilters = {personal:'', merchant:''};
let payment = null, paymentTimer = null, paymentSequence = 0;
function clearPayment() { clearTimeout(paymentTimer); paymentTimer=null; payment=null; }
function resetData() {
  clearPayment(); paymentSequence=0;
  users = new Map([['demo',{name:'示範使用者',username:'demo',password:'demo1234',identity:'DEMO-ID-001',question:'我最喜歡的書是什麼？',answer:'小王子',bound:true,merchant:'none',merchantName:'青禾餐坊',phone:'02-0000-0000',sample:true}]]);
  currentKey = null; authenticated = false; recovering = null; recoveryVerified = false; completion = null;
  balanceHidden = false; readReady = false; menuOpen = false; dateFilters = {personal:'',merchant:''};
  clearTimeout(readingTimer); readingTimer = null;
}
resetData();
const user = () => users.get(currentKey);
// Successful receipts are the shared ledger for the merchant and personal views.
const accountBalance = () => (user().sample?12580:0)+(user().receipts||[]).reduce((sum,row)=>sum+row[3],0);
const btn = (text, action, secondary = false, extra = '') => `<button type="button" class="btn${secondary?' secondary':''} ${extra}" data-action="${action}">${text}</button>`;
const back = () => '<div class="return-link"><a class="text-link" href="#login">返回登入</a></div>';
const note = (text = '流程示範・僅在本頁暫存，未連接正式服務。') => `<p class="demo-note">${text}</p>`;
const mark = number => { document.body.dataset.screen = String(number).padStart(2,'0'); };
function goto(next) { if (location.hash === `#${next}`) render(); else location.hash = next; }
function errorFor(id, text) {
  const input = document.getElementById(id), message = document.getElementById(`${id}-error`);
  input.setAttribute('aria-invalid','true'); input.setAttribute('aria-describedby',message.id);
  message.textContent = text; message.hidden = false; message.setAttribute('role','alert'); input.focus();
}
function field(id, label, type = 'text', autocomplete = 'off', value = '') {
  const input = `<input id="${id}" name="${id}" type="${type}" autocomplete="${autocomplete}" value="${esc(value)}" ${type==='password'?'placeholder="********"':''} required aria-describedby="${id}-error">`;
  return `<div class="field"><label for="${id}">${label}</label>${type==='password'?`<div class="password-input">${input}<button type="button" class="password-toggle" aria-label="顯示密碼" aria-controls="${id}" aria-pressed="false"><img class="eye-icon" src="./assets/icons/eye.svg" alt="" aria-hidden="true" width="39" height="30"></button></div>`:input}<p class="error-text" id="${id}-error" hidden></p></div>`;
}
function authPanel(title, body, classes='') { main.innerHTML = `<section class="login-panel auth-panel ${classes}" aria-labelledby="page-title"><h1 id="page-title" tabindex="-1">${title}</h1>${body}</section>`; }
function renderRegister(duplicate=false) {
  const values = duplicate?['示範姓名','new-demo','','DEMO-ID-001','我最喜歡的書是什麼？','']:['','','','','',''];
  const fields = [['reg-name','姓名','text','off'],['reg-account','帳號','text','off'],['reg-password','密碼','password','new-password'],['reg-identity','身分證字號','text','off'],['reg-question','自訂安全提示問題','text','off'],['reg-answer','自訂答案','text','off']];
  authPanel('註冊',`<form id="register-form">${fields.map((f,i)=>field(...f,values[i])).join('')}<button class="btn wide" type="submit">註冊</button>${back()}</form>`,'register-panel');
  if (duplicate) errorFor('reg-identity','此身分證字號已有帳號');
}
function renderRecovery(step) {
  if (step==='recovery') authPanel('忘記密碼',`<p class="subtitle">請輸入帳號。</p><form id="recovery-form">${field('recovery-account','帳號','text','username')}<button class="btn wide" type="submit">下一步</button><a class="btn secondary wide" href="#login">返回登入</a></form>`,'recovery-panel account-step');
  else if (step==='recovery-question') authPanel('安全問題驗證',`<form id="answer-form"><div class="question-heading"><span>安全提示問題</span><small>虛構資料</small></div><div class="question-box">${esc(users.get(recovering).question)}</div>${field('recovery-answer','答案')}<button class="btn wide" type="submit">驗證答案</button>${back()}</form>`,'recovery-panel question-step');
  else authPanel('更新密碼',`<form id="recovery-password-form">${field('new-password','新密碼','password','new-password')}${field('confirm-password','請再次輸入新密碼','password','new-password')}<button class="btn wide" type="submit">確認更新</button>${back()}</form>`,'recovery-panel password-step');
}
function renderResult(title, subtitle='', small=false) {
  main.className='result-main';
  main.innerHTML=`<div class="result-surface"><section class="login-panel auth-panel result-box ${small?'small':''}" aria-labelledby="page-title"><h1 id="page-title" tabindex="-1">${title}</h1>${subtitle?`<p>${subtitle}</p>`:''}<a class="btn" href="#login">${small?'返回登入':'重新登入'}</a></section></div>`;
}
function activeGroup() { return route.startsWith('merchant')?'merchant':route.startsWith('card')?'card':route==='logout'?'logout':'home'; }
function shell(title, bare=false) {
  const group=activeGroup(); main.className=`dashboard${sidebarCollapsed?' collapsed':''}`;
  document.body.classList.toggle('sidebar-collapsed',sidebarCollapsed);
  main.innerHTML=`<button type="button" class="mobile-menu" data-action="menu" aria-controls="side-nav" aria-expanded="${menuOpen}">${icon('menu')}<span>${title}</span><span>選單</span></button><aside class="sidebar${menuOpen?' is-open':''}" id="side-nav"><nav aria-label="個人帳戶功能">${[['home','home','主畫面'],['merchant','store','商家介面'],['card','card','卡片管理'],['logout','logout','登出']].map(([r,i,t])=>`<a href="#${r}" ${group===r?'aria-current="page"':''} aria-label="${t}">${icon(i)}<span class="nav-label">${t}</span></a>`).join('')}</nav></aside><section class="workspace${bare?' bare':''}" aria-labelledby="page-title"><h1 id="page-title" tabindex="-1">${title}</h1><div id="workspace-content"></div></section>`;
  const toggle=document.createElement('button'); toggle.type='button'; toggle.className='sidebar-toggle'; toggle.dataset.action='sidebar';
  toggle.innerHTML=`${icon('menu')}<span>${sidebarCollapsed?'展開導覽':'收合導覽'}</span>`; toggle.setAttribute('aria-controls','side-nav'); toggle.setAttribute('aria-expanded',String(!sidebarCollapsed)); document.querySelector('.site-header').append(toggle);
}
function workspace(html,demo=true) { const includeNote=demo&&!['transactions','transaction-search','merchant-receipts'].includes(route); document.querySelector('#workspace-content').innerHTML=html+(includeNote?note('虛構資料・流程示範，未連接帳戶、金流或審核服務。'):''); }
function renderHome() {
  shell('主畫面');
  if (!user().bound) { mark(12); workspace('<div class="info-panel notice-panel"><p>尚未綁定卡片，請至卡片管理綁定。</p><a class="btn" href="#card">前往卡片管理</a></div>'); return; }
  workspace(`<div class="info-panel balance-panel"><div class="balance-card"><h2>卡號</h2><p class="card-number">${cardNumber}</p><p class="card-state">已綁定卡片</p></div><div class="balance-side"><h2>可用餘額</h2><div class="balance-row"><p class="balance-value" id="balance-value">${balanceHidden?'****':money(accountBalance())}</p><button class="btn" data-action="balance" type="button" aria-pressed="${balanceHidden}">${icon(balanceHidden?'eye-off':'eye')}<span>${balanceHidden?'顯示餘額':'隱藏餘額'}</span></button></div></div><a class="btn secondary compact balance-records" href="#transactions">交易紀錄</a></div>`);
}
function renderMerchant() {
  shell('商家介面');
  if (user().merchant==='none') { mark(13); workspace('<div class="info-panel merchant-unapplied"><h2>尚未申請商家</h2><a href="#merchant-application" class="btn">申請商家權限</a></div>'); }
  else if (user().merchant==='pending') { mark(15); workspace(`<div class="info-panel notice-panel pending-panel">${icon('clock')}<p>商家權限申請審核中。</p></div>`); }
  else { mark(16); workspace(`<div class="info-panel profile-panel"><div class="profile-heading"><h2>商家資訊</h2><span class="badge">已註冊</span></div><dl class="data-list"><div><dt>商家名稱</dt><dd>${esc(user().merchantName)}</dd></div><div><dt>電話</dt><dd>${esc(user().phone)}</dd></div></dl><div class="panel-footer"><a href="#merchant-receipts" class="btn compact">收款紀錄</a></div></div>${paymentPanel()}`); }
}
function paymentPanel() {
  const p=payment, stage=p?.stage||'form';
  const summary=p?`<dl class="payment-summary"><div><dt>付款項目</dt><dd>${esc(p.item)}</dd></div><div><dt>付款金額</dt><dd>${money(p.amount)}</dd></div></dl>`:'';
  let content='';
  if(stage==='form') content=`<form id="payment-form"><div class="payment-fields"><div class="field"><label for="payment-amount">付款金額（新台幣）</label><input id="payment-amount" name="amount" type="number" inputmode="numeric" min="1" max="999999999" step="1" value="${p?.amount||''}" required aria-describedby="payment-amount-error"><p class="error-text" id="payment-amount-error" hidden></p></div><div class="field"><label for="payment-item">付款項目</label><input id="payment-item" name="item" maxlength="80" value="${esc(p?.item||'')}" required aria-describedby="payment-item-error"><p class="error-text" id="payment-item-error" hidden></p></div></div><button class="btn" type="submit">開始收款</button></form>`;
  else if(stage==='waiting') content=`${summary}<div class="payment-status" role="status">${icon('card-reader')}<p>等待付款人插卡</p></div><p class="demo-note">插卡後將自動結帳。尚未連接讀卡機，請使用下方按鈕模擬插卡。</p><div class="actions start">${btn('模擬付款人插卡','payment-insert')}${btn('模擬插卡並付款失敗','payment-insert-fail',true)}${btn('返回修改','payment-edit',true)}${btn('取消收款','payment-cancel',true)}</div>`;
  else if(stage==='processing') content=`${summary}<div class="payment-status" role="status"><span class="spinner" aria-hidden="true"></span><p>模擬付款處理中，請稍候。</p></div>${btn('取消收款','payment-cancel',true)}`;
  else if(stage==='success') content=`<p class="payment-status" role="status">模擬付款成功</p>${summary}<p>示範流水號：${esc(p.receipt)}</p><p class="demo-note">已同步更新本次分頁的示範餘額、交易與收款紀錄，未實際扣款或入帳。</p><div class="actions start">${btn('下一筆收款','payment-new')}<a class="btn secondary" href="#merchant-receipts" data-action="payment-receipts">查看收款紀錄</a></div>`;
  else content=`<p class="payment-status" role="alert">模擬付款失敗，未新增收款紀錄。</p>${summary}<div class="actions start">${btn('重新等待插卡','payment-retry')}${btn('返回修改','payment-edit',true)}${btn('取消收款','payment-cancel',true)}</div>`;
  return `<section class="info-panel payment-panel" aria-labelledby="payment-title"><h2 id="payment-title">刷卡收款</h2><p class="demo-note payment-demo">流程模擬・未連接讀卡設備或金流</p>${content}</section>`;
}
function paymentAction(action) {
  if(!authenticated||user()?.merchant!=='approved'||!['merchant','merchant-profile'].includes(route))return;
  if(action==='receipts'){dateFilters.merchant='';return;}
  if(action==='new'||action==='cancel'){clearPayment();render();document.querySelector('#payment-amount')?.focus();return;}
  if(!payment||payment.owner!==currentKey)return;
  const stage=payment.stage;
  if(action==='edit'&&['waiting','failed'].includes(stage))payment.stage='form';
  else if(action==='retry'&&stage==='failed')payment.stage='waiting';
  else if(['insert','insert-fail'].includes(action)&&stage==='waiting'){
    payment.stage='processing';const pending=payment;
    paymentTimer=setTimeout(()=>{
      paymentTimer=null;
      if(payment!==pending||!authenticated||currentKey!==pending.owner||user()?.merchant!=='approved'||!['merchant','merchant-profile'].includes(route))return;
      if(action==='insert-fail'){pending.stage='failed';render();document.querySelector('#payment-title')?.scrollIntoView({block:'nearest'});return;}
      const now=new Date(), date=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
      pending.receipt=`SIM-${String(++paymentSequence).padStart(4,'0')}`;
      (user().receipts??=[]).unshift([pending.receipt,'示範付款人',date,pending.amount,'收款',pending.item]);
      pending.stage='success';render();document.querySelector('#payment-title')?.scrollIntoView({block:'nearest'});
    },1200);
  }else return;
  render();document.querySelector('#payment-title')?.scrollIntoView({block:'nearest'});
}
function formatDate(v) { const [y,m,d]=v.split('-'); return `${y}年${Number(m)}月${Number(d)}日`; }
function renderRecords(merchant=false, search=false) {
  const selected=search?dateFilters[merchant?'merchant':'personal']:'';
  const receipts=user().receipts||[];
  let rows=merchant?[...receipts,...(user().sample?merchantRows:[])]:[...receipts.map(r=>[r[0],`${r[1]}・${r[5]}`,r[2],r[3],r[4]]),...(user().sample?personalRows:[])];
  if (selected) rows=rows.filter(r=>r[2]===selected);
  const headers=merchant?['流水號','付款人','付款項目','交易日期','交易金額','交易狀態']:['流水號','交易對象','交易日期','交易金額','交易狀態'];
  shell(merchant?'商家收款紀錄':'交易紀錄'); document.querySelector('.workspace > h1').remove();
  workspace(`<div class="records-heading"><div><h1 id="page-title" tabindex="-1">${merchant?'商家收款紀錄':'交易紀錄'}</h1><p>虛構資料</p></div>${search?`<button class="text-link" type="button" data-action="focus-date" style="border:0;background:transparent;gap:10px">${icon('search')}查詢日期</button>`:''}</div><div class="records-inner">${search?`<form id="date-form" class="date-filter"><label for="transaction-date">交易日期</label><input id="transaction-date" type="date" name="date" value="${selected}" required><button class="btn" type="submit">查詢</button><button class="btn secondary" type="button" data-action="clear-date">清除日期條件</button></form>`:`<div class="records-tools"><a class="btn" href="#transaction-search">${icon('search')}查詢日期</a></div>`}<div class="table-scroll" tabindex="0" role="region" aria-label="${merchant?'商家收款':'個人交易'}紀錄"><table role="table"><caption>${merchant?'商家收款':'個人交易'}紀錄・虛構資料</caption><thead role="rowgroup"><tr role="row">${headers.map(h=>`<th scope="col" role="columnheader">${h}</th>`).join('')}</tr></thead><tbody role="rowgroup">${rows.length?rows.map(r=>`<tr role="row">${(merchant?[r[0],esc(r[1]),esc(r[5]||'示範款項'),formatDate(r[2]),money(r[3]),r[4]]:[r[0],esc(r[1]),formatDate(r[2]),money(r[3]),r[4]]).map((v,i)=>`<td role="cell" data-label="${headers[i]}">${v}</td>`).join('')}</tr>`).join(''):`<tr class="empty-row"><td colspan="${headers.length}">${selected?'目前沒有符合條件的交易紀錄':'目前沒有交易紀錄'}</td></tr>`}</tbody></table></div>${search?`<p class="filter-status" role="status">${selected?`${formatDate(selected)}，共 ${rows.length} 筆紀錄`:'顯示所有日期的紀錄'}</p>`:''}</div>`);
}
function renderCard() {
  shell('卡片管理');
  if (!user().bound) { mark(22); workspace('<div class="info-panel notice-panel"><p>尚未綁定卡片</p><a href="#card-insert" class="btn">綁定卡片</a></div>'); }
  else workspace(`<div class="info-panel"><h2>目前卡片</h2><dl class="data-list card-details"><div><dt>卡號</dt><dd>${cardNumber}</dd></div><div><dt>已綁定卡片</dt><dd>虛構資料</dd></div></dl><div class="actions start"><a class="btn" href="#card-password">變更密碼</a><a class="btn secondary" href="#card-cancel">遺失註銷</a></div></div>`);
}
function openModal(html,className='') { dialog.className=`flow-dialog ${className}`; dialog.innerHTML=html; dialog.showModal(); }
const modalTitle = text => `<h2 id="dialog-title">${text}</h2>`;
function renderModal() {
  shell(route.startsWith('merchant')?'商家介面':route==='logout'?'登出':'卡片管理',true); workspace('',false);
  if (route==='merchant-application') openModal(`${modalTitle('申請商家權限')}<form id="merchant-form"><div class="horizontal-field">${field('merchant-name','商家名稱')}</div><div class="horizontal-field">${field('merchant-phone','電話','tel')}</div><div class="actions"><button class="btn" type="submit">申請</button>${btn('取消','cancel-modal',true)}</div>${note('示範申請不會送交真實審核。')}</form>`,'merchant-modal');
  else if (route==='card-password') openModal(`${modalTitle('變更密碼')}<form id="card-password-form">${field('old-password','舊密碼','password','current-password')}${field('card-new-password','新密碼','password','new-password')}${field('card-confirm-password','請再次輸入新密碼','password','new-password')}<div class="actions"><button class="btn" type="submit">確認變更</button>${btn('取消','cancel-modal',true)}</div></form>`,'password-modal');
  else if (route==='card-password-success') openModal(`${modalTitle('密碼變更成功！')}${btn('重新登入','finish-login')}${note('示範密碼已更新，請重新登入。')}`,'success-modal');
  else if (route==='card-cancel') {
    openModal(`${modalTitle('遺失註銷')}<div class="confirm-row"><span>卡片帳號</span><strong>${cardNumber}</strong></div><p class="demo-note">虛構資料</p><p class="question">是否註銷此卡片？</p><div class="actions">${btn('確認註銷','cancel-card')}${btn('否','cancel-modal',true)}</div>`);
    dialog.querySelector('[data-action="cancel-modal"]').focus();
  } else if (route==='card-insert'||route==='card-reading') {
    const reading=route==='card-reading';
    openModal(`${modalTitle('綁定卡片')}${reading?'<div class="spinner" aria-hidden="true"></div>':icon('card-reader','reader-icon')}<p class="question" role="status">${reading?'讀卡中請稍後。':'請插入卡片。'}</p><p class="demo-note">流程預覽・未連接讀卡設備${reading?'。':''}</p>${reading?'':'<button type="button" class="simulate-insert" data-action="simulate-insert">模擬插入示範卡片</button>'}<div class="actions">${btn('取消','cancel-modal',true)}</div>`,reading?'reader-stage':'reader-stage reader-insert');
    if (reading&&!readingTimer) readingTimer=setTimeout(()=>{readingTimer=null;if(route==='card-reading'&&authenticated){readReady=true;goto('card-bind-confirm');}},3000);
  } else if (route==='card-bind-confirm') openModal(`${modalTitle('確認綁定卡片')}<div class="confirm-row"><span>卡號</span><strong>${cardNumber}</strong></div><p class="demo-note">虛構資料<br>流程預覽・未連接讀卡設備</p><div class="actions">${btn('確認綁卡','confirm-bind')}${btn('取消','cancel-modal',true)}</div>`);
  else if (route==='card-bind-complete') openModal(`${modalTitle('綁定完成')}<p>卡片綁定完成，請重新登入。</p>${btn('重新登入','finish-login')}<p class="demo-note">流程預覽・未連接讀卡設備</p>`,'success-modal');
  else if (route==='logout') {
    workspace(`<section class="logout-confirm" aria-labelledby="dialog-title">${modalTitle('確定要登出嗎？')}<div class="actions">${btn('是','confirm-logout')}${btn('否','cancel-modal',true)}</div></section>`,false);
  }
}
function preparePreview(number) {
  currentKey='demo'; authenticated=number>=9; completion=null;
  user().bound=![12,22,23,24,25].includes(number);
  user().merchant=number===15?'pending':[16,17].includes(number)?'approved':'none';
  user().merchantName='青禾餐坊';user().phone='02-0000-0000';
  if ([6,7,8].includes(number)) {recovering='demo';recoveryVerified=number>=7;}
  if(number===3)completion='register'; if(number===8)completion='recovery';
  if(number===20){completion='password';authenticated=false;} if(number===26){completion='bind';authenticated=false;}
  if(number===25)readReady=true;
  if(number===11)dateFilters.personal='2026-11-05'; if(number===17)dateFilters.merchant='2026-11-05';
}
function render() {
  if(dialog.open)dialog.close();
  const hash=location.hash.slice(1)||'login', preview=/^preview\/(\d{2})$/.exec(hash);
  if(preview){const n=Number(preview[1]);if(n<1||n>screens.length){goto('login');return;}preparePreview(n);route=screens[n-1][0];history.replaceState(null,'',`#${route}`);}else route=hash;
  const index=screens.findIndex(([key])=>key===route); if(index<0){goto('login');return;}
  if(!['merchant','merchant-profile'].includes(route)||!authenticated||user()?.merchant!=='approved')clearPayment();
  if(route!=='card-reading'){clearTimeout(readingTimer);readingTimer=null;}
  if(route==='login'){authenticated=false;currentKey=null;completion=null;recovering=null;recoveryVerified=false;readReady=false;}
  const resultAllowed=(route==='card-password-success'&&completion==='password')||(route==='card-bind-complete'&&completion==='bind');
  if(index>=8&&!authenticated&&!resultAllowed){goto('login');return;}
  if(route==='register-success'&&completion!=='register'){goto('register');return;}
  if(route==='recovery-complete'&&completion!=='recovery'){goto('recovery');return;}
  if(route==='recovery-question'&&!recovering){goto('recovery');return;}
  if(route==='recovery-password'&&(!recovering||!recoveryVerified)){goto('recovery');return;}
  if(route==='card-bind-confirm'&&!readReady){goto('card-insert');return;}
  if(index>=8){
    if(route==='merchant-receipts'&&user().merchant!=='approved'){goto('merchant');return;}
    if(route==='merchant-application'&&user().merchant!=='none'){goto('merchant');return;}
    if(['card-password','card-cancel'].includes(route)&&!user().bound){goto('card');return;}
    if(['card-insert','card-reading','card-bind-confirm'].includes(route)&&user().bound){goto('card');return;}
  }
  main.className='';document.body.classList.remove('sidebar-collapsed');document.querySelector('.sidebar-toggle')?.remove();mark(index+1);
  if(route==='login'){main.innerHTML=loginTemplate;main.querySelector('[type="submit"]').disabled=false;}
  else if(route==='register'||route==='register-duplicate')renderRegister(route.endsWith('duplicate'));
  else if(route==='register-success')renderResult('註冊成功','請重新登入',true);
  else if(['recovery','recovery-question','recovery-password'].includes(route))renderRecovery(route);
  else if(route==='recovery-complete')renderResult('更新完成！請重新登入！');
  else if(route==='home'||route==='home-unbound')renderHome();
  else if(route==='transactions'||route==='transaction-search')renderRecords(false,route==='transaction-search');
  else if(['merchant','merchant-pending','merchant-profile'].includes(route))renderMerchant();
  else if(route==='merchant-receipts')renderRecords(true,true);
  else if(route==='card'||route==='card-unbound')renderCard();
  else renderModal();
  document.title=`${screens[Number(document.body.dataset.screen)-1][1]}｜個人帳戶`;
  document.querySelector('#preview-screen').value='';
  if(!dialog.open){const heading=main.querySelector('h1');const target=pendingFocus?document.querySelector(pendingFocus):null;pendingFocus=null;if(target)target.focus({preventScroll:true});else if(heading&&route!=='register-duplicate'){heading.tabIndex=-1;heading.focus({preventScroll:true});}scrollTo(0,0);}
}
function cancelModal() {
  clearTimeout(readingTimer);readingTimer=null;readReady=false;
  pendingFocus=route==='merchant-application'?'a[href="#merchant-application"]':route==='card-password'?'a[href="#card-password"]':route==='card-cancel'?'a[href="#card-cancel"]':'a[href="#card-insert"]';
  if(route==='logout')goto('home');
  else if(['card-password-success','card-bind-complete'].includes(route))goto('login');
  else goto(route==='merchant-application'?'merchant':'card');
}
dialog.addEventListener('cancel',e=>{e.preventDefault();cancelModal();});
dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();cancelModal();}});
document.addEventListener('input',e=>{
  const input=e.target;if(!(input instanceof HTMLInputElement))return;
  input.setCustomValidity('');input.removeAttribute('aria-invalid');const error=document.getElementById(`${input.id}-error`);if(error)error.hidden=true;
});
document.addEventListener('submit',e=>{
  const form=e.target;if(!(form instanceof HTMLFormElement))return;e.preventDefault();
  const blank=[...form.querySelectorAll('input[required]')].find(input=>!input.value.trim());
  if(blank){blank.setCustomValidity('請填寫此欄位。');blank.reportValidity();return;}if(!form.reportValidity())return;
  const val=id=>form.querySelector(`#${id}`).value;
  if(form.id==='login-form'){
    const key=val('account').trim(), account=users.get(key);
    if(!account||account.password!==val('password')){const m=document.querySelector('#form-message');m.textContent='帳號或密碼輸入錯誤，請重新輸入。示範帳號 demo，密碼 demo1234。';m.hidden=false;return;}
    currentKey=key;authenticated=true;completion=null;balanceHidden=false;menuOpen=false;goto('home');
  }else if(form.id==='register-form'){
    const identity=val('reg-identity').trim(), key=val('reg-account').trim();
    if([...users.values()].some(u=>u.identity.toUpperCase()===identity.toUpperCase())){mark(4);errorFor('reg-identity','此身分證字號已有帳號');return;}
    if(users.has(key)){errorFor('reg-account','此帳號已被使用，請使用其他帳號。');return;}
    users.set(key,{name:val('reg-name').trim(),username:key,password:val('reg-password'),identity,question:val('reg-question').trim(),answer:val('reg-answer').trim(),bound:false,merchant:'none',merchantName:'',phone:'',sample:false});
    completion='register';goto('register-success');
  }else if(form.id==='recovery-form'){
    const key=val('recovery-account').trim();if(!users.has(key)){errorFor('recovery-account','找不到此示範帳號，請確認或先註冊。');return;}
    recovering=key;recoveryVerified=false;goto('recovery-question');
  }else if(form.id==='answer-form'){
    if(val('recovery-answer').trim()!==users.get(recovering).answer){errorFor('recovery-answer','答案不正確，請重新輸入。');return;}
    recoveryVerified=true;goto('recovery-password');
  }else if(form.id==='recovery-password-form'){
    if(!recovering||!recoveryVerified){goto('recovery');return;}
    if(val('new-password')!==val('confirm-password')){errorFor('confirm-password','兩次輸入的新密碼不一致。');return;}
    users.get(recovering).password=val('new-password');recoveryVerified=false;recovering=null;authenticated=false;completion='recovery';goto('recovery-complete');
  }else if(form.id==='payment-form'){
    if(!authenticated||user()?.merchant!=='approved')return;
    if(payment&&payment.stage!=='form')return;
    const amount=Number(val('payment-amount')), item=val('payment-item').trim();
    if(!Number.isSafeInteger(amount)||amount<1||amount>999999999){errorFor('payment-amount','請輸入 1 至 999,999,999 的整數金額。');return;}
    if(!item||item.length>80){errorFor('payment-item','請輸入 1 至 80 個字的付款項目。');return;}
    clearPayment();payment={owner:currentKey,amount,item,stage:'waiting'};render();document.querySelector('#payment-title')?.scrollIntoView({block:'nearest'});
  }else if(form.id==='merchant-form'){
    user().merchantName=val('merchant-name').trim();user().phone=val('merchant-phone').trim();user().merchant='pending';goto('merchant');
  }else if(form.id==='card-password-form'){
    if(user().password!==val('old-password')){errorFor('old-password','舊密碼不正確。');return;}
    if(val('card-new-password')!==val('card-confirm-password')){errorFor('card-confirm-password','兩次輸入的新密碼不一致。');return;}
    user().password=val('card-new-password');authenticated=false;completion='password';goto('card-password-success');
  }else if(form.id==='date-form'){
    dateFilters[route==='merchant-receipts'?'merchant':'personal']=val('transaction-date');render();document.querySelector('.filter-status')?.scrollIntoView({block:'nearest'});
  }
});
document.addEventListener('click',e=>{
  const toggle=e.target.closest('.password-toggle');
  if(toggle){const input=document.getElementById(toggle.getAttribute('aria-controls')), show=input.type==='password';input.type=show?'text':'password';toggle.setAttribute('aria-pressed',String(show));toggle.setAttribute('aria-label',show?'隱藏密碼':'顯示密碼');toggle.querySelector('.eye-icon').src=`./assets/icons/${show?'eye-off':'eye'}.svg`;return;}
  const nav=e.target.closest('.sidebar a');if(nav)menuOpen=false;
  const trigger=e.target.closest('[data-action]');if(!trigger)return;
  if(trigger.dataset.action.startsWith('payment-')){paymentAction(trigger.dataset.action.slice(8));return;}
  switch(trigger.dataset.action){
    case 'demo-login':currentKey='demo';authenticated=true;completion=null;demoTools.open=false;goto('home');break;
    case 'demo-reset':resetData();demoTools.open=false;goto('login');break;
    case 'menu':menuOpen=!menuOpen;document.querySelector('.sidebar').classList.toggle('is-open',menuOpen);trigger.setAttribute('aria-expanded',String(menuOpen));break;
    case 'sidebar':sidebarCollapsed=!sidebarCollapsed;render();document.querySelector('.sidebar-toggle')?.focus();break;
    case 'balance':balanceHidden=!balanceHidden;document.querySelector('#balance-value').textContent=balanceHidden?'****':money(accountBalance());trigger.innerHTML=`${icon(balanceHidden?'eye-off':'eye')}<span>${balanceHidden?'顯示餘額':'隱藏餘額'}</span>`;trigger.setAttribute('aria-pressed',String(balanceHidden));break;
    case 'cancel-modal':cancelModal();break;
    case 'finish-login':goto('login');break;
    case 'cancel-card':user().bound=false;authenticated=false;goto('login');break;
    case 'simulate-insert':readReady=false;goto('card-reading');break;
    case 'confirm-bind':if(!readReady||!authenticated)return;user().bound=true;readReady=false;authenticated=false;completion='bind';goto('card-bind-complete');break;
    case 'confirm-logout':authenticated=false;currentKey=null;recovering=null;recoveryVerified=false;completion=null;goto('login');break;
    case 'focus-date':document.querySelector('#transaction-date').focus();break;
    case 'clear-date':dateFilters[route==='merchant-receipts'?'merchant':'personal']='';render();document.querySelector('#transaction-date').focus();break;
  }
});
const previewSelect=document.querySelector('#preview-screen');
screens.forEach(([,title],i)=>{const option=document.createElement('option');option.value=String(i+1).padStart(2,'0');option.textContent=`${option.value} · ${title}`;previewSelect.append(option);});
previewSelect.addEventListener('change',()=>{if(previewSelect.value){const n=previewSelect.value;demoTools.open=false;goto(`preview/${n}`);}});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){demoTools.open=false;if(menuOpen&&!dialog.open){menuOpen=false;document.querySelector('.sidebar')?.classList.remove('is-open');document.querySelector('.mobile-menu')?.setAttribute('aria-expanded','false');document.querySelector('.mobile-menu')?.focus();}}});
window.addEventListener('hashchange',()=>render());
// Appended to the original app.js at build time. Original visual components remain.
const API_BASE='https://arlington-hunting-den-owned.trycloudflare.com/api/v1';
let apiSession=null,apiTask=null,apiEpoch=0,apiPollTimer=null,apiBusy=false,apiNotice='';
const originalRender=render,originalModal=renderModal,originalRegister=renderRegister;
async function backend(path,{method='GET',body,login=false}={}){
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);
 try{const headers={Accept:'application/json'};if(body)headers['Content-Type']='application/json';if(login){if(!apiSession)throw Error('請先登入');headers.Authorization=`Bearer ${apiSession.accessToken}`;}
 const response=await fetch(API_BASE+path,{method,headers,body:body?JSON.stringify(body):undefined,signal:controller.signal,cache:'no-store',credentials:'omit',redirect:'error'});
 const result=await response.json().catch(()=>{throw Error('後端沒有回傳有效JSON');});if(!response.ok){const err=Error(result.error?.message||result.error?.code||`HTTP ${response.status}`);err.code=result.error?.code;throw err;}
 if(!result.data)throw Error('後端回應缺少data欄位');return result.data;
 }catch(e){if(e.name==='AbortError'||e instanceof TypeError){const error=Error('連線中斷，結果尚未確認。請先核對後端結果，勿重複提交。');error.uncertain=true;throw error;}throw e;}finally{clearTimeout(timeout);}
}
function apiMessage(text){apiNotice=text;let target=document.querySelector('#api-status');if(!target){target=document.createElement('p');target.id='api-status';target.className='error-text';target.setAttribute('role','status');target.setAttribute('aria-live','polite');(dialog.open?dialog:main.querySelector('.login-panel')||main).append(target);}target.textContent=text;}
function clearApiTask(){apiEpoch++;clearTimeout(apiPollTimer);apiTask=null;readReady=false;}
renderRegister=function(){originalRegister(false);const form=document.querySelector('#register-form');form.querySelector('#reg-password').closest('.field').insertAdjacentHTML('afterend',field('reg-confirm','確認密碼','password','new-password'));form.querySelector('#reg-password').minLength=12;form.querySelector('#reg-password').maxLength=128;form.querySelector('#reg-confirm').minLength=12;form.querySelector('#reg-account').pattern='[A-Za-z0-9_]{3,50}';};
renderHome=function(){shell('主畫面');workspace(`<div class="info-panel notice-panel"><h2>${esc(user().name)}</h2><p>帳號：${esc(user().username)}</p>${user().bound?`<p>本次已確認綁定卡號：${esc(user().liveCardNumber)}</p>`:'<p>登入成功。既有卡片狀態尚未透過查詢API取得，請依實際帳號情況操作。</p>'}<a class="btn" href="#card">前往卡片管理</a></div>`,false);};
renderCard=function(){shell('卡片管理');workspace(user().bound?`<div class="info-panel"><h2>目前卡片</h2><dl class="data-list card-details"><div><dt>卡號</dt><dd>${esc(user().liveCardNumber)}</dd></div><div><dt>公鑰指紋</dt><dd style="overflow-wrap:anywhere">${esc(user().liveFingerprint)}</dd></div></dl><p>以上為本次後端成功綁卡回應。</p></div>`:'<div class="info-panel notice-panel"><p>建立綁卡任務後，請將任務編號交給本機讀卡程式。</p><a href="#card-insert" class="btn">綁定卡片</a></div>',false);};
function taskMarkup(){if(!apiTask)return '<p class="question">請先建立綁卡任務，再插入實體卡。</p>'+btn('建立綁卡任務','api-create-task');
 return `<div class="field"><label for="bind-request">讀卡任務編號（請保密）</label><textarea id="bind-request" readonly rows="3" style="width:100%;overflow-wrap:anywhere">${esc(apiTask.requestId)}</textarea></div>${btn('複製任務編號','api-copy-task',true)}<p class="demo-note">請貼到讀卡程式「註冊綁卡回報」。<br>期限：${esc(apiTask.expiresAt)}</p><p class="question" role="status">${apiTask.status==='READY'?'實體卡已回報，請核對卡號。':'等待讀卡程式回報實體卡…'}</p>`;
}
renderModal=function(){
 if(['card-insert','card-reading'].includes(route)){shell('卡片管理',true);workspace('',false);openModal(`${modalTitle('綁定卡片')}${icon('card-reader','reader-icon')}${taskMarkup()}<div class="actions">${btn('取消','cancel-modal',true)}</div>`,'reader-stage reader-insert');return;}
 if(route==='card-bind-confirm'){shell('卡片管理',true);workspace('',false);openModal(`${modalTitle('確認綁定卡片')}<div class="confirm-row"><span>卡號</span><strong>${esc(apiTask?.cardNumber)}</strong></div><p>請確認這是你剛插入的卡片。</p><div class="actions">${btn('確認綁卡','confirm-bind')}${btn('取消','cancel-modal',true)}</div>`);return;}
 if(route==='card-bind-complete'){shell('卡片管理',true);workspace('',false);openModal(`${modalTitle('綁定完成')}<p>後端已確認卡片與公鑰綁定成功。</p><p>卡號：${esc(user()?.liveCardNumber)}</p><a class="btn" href="#card">查看卡片</a>`,'success-modal');return;}
 originalModal();
};
render=function(){apiEpoch++;clearTimeout(apiPollTimer);apiPollTimer=null;apiNotice='';
 const next=location.hash.slice(1)||'login';
 if(next.startsWith('preview/')){goto('login');return;}
 if(next==='login'){apiSession=null;clearApiTask();}
 const supported=['login','register','register-success','home','home-unbound','card','card-unbound','card-insert','card-reading','card-bind-confirm','card-bind-complete','logout'];
 if(!supported.includes(next)){if(dialog.open)dialog.close();main.className='';panelUnavailable(next);return;}
 originalRender();
 if(['card-insert','card-reading'].includes(route)&&apiTask&&apiTask.status==='WAITING')schedulePoll(apiEpoch);
};
function panelUnavailable(next){if(apiSession){route=next;shell('功能串接中');workspace('<div class="info-panel notice-panel"><p>目前先完成註冊、登入與實體卡綁定；此功能尚未串接後端。</p><a class="btn" href="#home">返回主畫面</a></div>',false);}else{authPanel('功能串接中','<p>此功能尚未串接後端。</p>'+back());}}
function schedulePoll(epoch){apiPollTimer=setTimeout(()=>pollTask(epoch),1000);}
async function pollTask(epoch){if(epoch!==apiEpoch||!apiTask||!apiSession)return;const task=apiTask;
 try{if(Date.now()>=Date.parse(task.expiresAt))throw Error('讀卡任務已到期，請重新建立。');const result=await backend('/card-reads/'+encodeURIComponent(task.requestId));if(epoch!==apiEpoch||apiTask!==task)return;
 if(result.requestId!==task.requestId||result.purpose!=='BIND')throw Error('讀卡任務不符');
 if(result.status==='READY'){if(!result.cardReadToken||!result.cardNumber)throw Error('缺少讀卡憑證或卡號');Object.assign(task,result);readReady=true;goto('card-bind-confirm');return;}
 if(result.status!=='WAITING')throw Error('讀卡狀態不符');schedulePoll(epoch);
 }catch(e){if(epoch!==apiEpoch)return;apiMessage(e.message);if(e.uncertain){apiPollTimer=setTimeout(()=>pollTask(epoch),3000);return;}clearApiTask();dialog.querySelector('.question')?.remove();const refresh=document.createElement('button');refresh.type='button';refresh.className='btn';refresh.dataset.action='api-create-task';refresh.textContent='重新建立綁卡任務';dialog.append(refresh);}}
document.addEventListener('submit',async e=>{
 const form=e.target;if(!['login-form','register-form'].includes(form.id)){e.preventDefault();e.stopImmediatePropagation();return;}e.preventDefault();e.stopImmediatePropagation();if(apiBusy||!form.reportValidity())return;
 const val=id=>form.querySelector('#'+id).value;let body;
 if(form.id==='register-form'){body={fullName:val('reg-name').trim(),username:val('reg-account').trim(),password:val('reg-password'),confirmPassword:val('reg-confirm'),nationalId:val('reg-identity').trim(),securityQuestion:val('reg-question').trim(),securityAnswer:val('reg-answer').trim()};if(body.password!==body.confirmPassword){errorFor('reg-confirm','兩次密碼不一致');return;}}
 else body={username:val('account').trim(),password:val('password')};
 apiBusy=true;const epoch=apiEpoch;const button=form.querySelector('[type="submit"]');button.disabled=true;apiMessage('正在連線後端…');
 try{const result=await backend(form.id==='register-form'?'/auth/register':'/auth/login',{method:'POST',body});if(epoch!==apiEpoch)return;
 if(form.id==='register-form'){form.reset();completion='register';goto('register-success');}
 else{if(!result.accessToken||!result.user)throw Error('登入回應不完整');apiSession=result;users=new Map();currentKey=result.user.username;users.set(currentKey,{name:result.user.fullName,username:currentKey,bound:false,merchant:'none',sample:false});authenticated=true;completion=null;clearApiTask();goto('home');}}
 catch(e){if(epoch===apiEpoch)apiMessage(e.message);}finally{apiBusy=false;if(button.isConnected)button.disabled=false;}
},true);
document.addEventListener('click',async e=>{
 const trigger=e.target.closest('[data-action]');if(!trigger)return;const action=trigger.dataset.action;
 if(['cancel-modal','confirm-logout'].includes(action)){clearApiTask();if(action==='confirm-logout')apiSession=null;return;}
 if(!['api-create-task','api-copy-task','confirm-bind','simulate-insert','demo-login','demo-reset'].includes(action))return;
 e.preventDefault();e.stopImmediatePropagation();
 if(action==='api-copy-task'){try{await navigator.clipboard.writeText(apiTask.requestId);apiMessage('已複製，請貼到讀卡程式。');}catch{dialog.querySelector('#bind-request')?.select();apiMessage('請手動複製選取的任務編號。');}return;}
 if(!['api-create-task','confirm-bind'].includes(action)||apiBusy||!apiSession)return;
 apiBusy=true;trigger.disabled=true;const epoch=apiEpoch;
 try{if(action==='api-create-task'){const result=await backend('/card-reads',{method:'POST',body:{purpose:'BIND'},login:true});if(epoch!==apiEpoch)return;if(!result.requestId||result.purpose!=='BIND'||result.status!=='WAITING'||!Number.isFinite(Date.parse(result.expiresAt)))throw Error('後端任務格式不符');apiTask=result;goto('card-reading');}
 else{if(!apiTask?.cardReadToken)throw Error('尚未取得讀卡憑證');const task=apiTask;const result=await backend('/me/cards/bind',{method:'POST',body:{cardReadToken:task.cardReadToken},login:true});if(epoch!==apiEpoch)return;
 if(!result.card||!result.signingKey||result.card.cardNumber!==task.cardNumber)throw Error('回應資料不完整，請先確認後端是否已綁定');user().bound=true;user().liveCardNumber=result.card.cardNumber;user().liveFingerprint=result.signingKey.fingerprint;clearApiTask();completion='bind';goto('card-bind-complete');}}
 catch(e){if(epoch===apiEpoch){apiMessage(e.message);if(action==='confirm-bind'){trigger.disabled=true;apiMessage(e.message+' 請先核對後端結果再繼續，不直接重送。');}else trigger.disabled=false;}}
 finally{apiBusy=false;}
},true);
// Use the original layout, but remove the prototype's seeded identities and preview controls.
users=new Map();currentKey=null;authenticated=false;if(demoTools)demoTools.hidden=true;
render();
