// API preparation layer for admin.html and topup.html. User entry is untouched.
if(ENTRY==='admin'||ENTRY==='topup'){
 let consoleMode='api';
 const consoleCfg=window.WalletConsoleConfig,consoleApi=new WalletConsole.AdminApi(consoleCfg.apiBase,consoleCfg.adminQueries),consoleFlow=new WalletConsole.KioskFlow(consoleCfg.apiBase);
 let consoleTopupViewKey=null;
 let consoleError='',consoleBusy=false,consoleRows=null,consoleCursor=null,consoleKind='',consoleSearch='',consoleDetail=null,consoleTask=null,consoleRevision=0,consoleBlocked=false,consoleStats=null,consoleReplacementWait=null;
 const consoleMoney=value=>{if(!/^\d+$/.test(String(value)))return '—';const n=BigInt(value);return 'NT$ '+(n/100n).toLocaleString('zh-TW')+'.'+String(n%100n).padStart(2,'0');};
 const consoleTime=value=>{const d=new Date(value);return Number.isNaN(d.getTime())?'—':d.toLocaleString('zh-TW',{timeZone:'Asia/Taipei'});};
 const consoleButton=(text,action,primary=false,disabled=false)=>btn(text,'console-'+action,primary,disabled);
 const toolbar=document.createElement('section');toolbar.className='console-toolbar';toolbar.setAttribute('aria-label','串接模式');document.querySelector('.topbar').insertAdjacentElement('afterend',toolbar);
 function consoleToolbar(){toolbar.innerHTML=`<div><strong>${consoleMode==='api'?'後端連線模式':'原版示範模式'}</strong><span>${consoleMode==='api'?'後端自動分派工作站；交易結果以資料庫為準':'僅本機模擬，不改後端資料'}</span></div><div class="actions">${consoleButton(consoleMode==='api'?'切回原版示範':'切換後端連線模式','mode')}${consoleMode==='api'?consoleButton('連線設定','settings'):''}</div>`;document.querySelector('.simulation-tools').hidden=consoleMode==='api';}
 function consoleNotice(){return `<p class="error-message" role="alert">${esc(consoleError)}</p>${consoleBusy?'<p role="status">正在處理，請勿重複送出…</p>':''}`;}
 function consoleSettings(){openDialog('後端自動分派設定',`<p>API：<span class="console-break">${esc(consoleApi.base)}</span></p><p>管理員登入後管理商家、工作站及權限。自助儲值免登入，不使用操作員或固定儲值密鑰。</p><p>網頁建立任務後，已啟動的讀卡工作站會自動領取；請依畫面顯示的工作站插卡。</p><p>STATION_API_TOKEN只在首次登記後交付讀卡電腦，不放進網站程式。</p>${consoleButton('關閉','close')}`);} function consoleAdminRender(){
  if(!consoleApi.session){consoleReplacementWait=null;consoleTask=null;consoleRows=null;consoleDetail=null;consoleStats=null,consoleReplacementWait=null;app.innerHTML=`<main class="auth-shell" id="content"><section class="panel console-login"><h1>管理員登入</h1><p>使用後端核發的管理員帳號；開啟此網址不代表具有管理員權限。</p><form id="console-login">${field('console-username','管理員帳號','text','','autocomplete="username"')}${field('console-password','密碼','password','','autocomplete="current-password"')}<button class="primary wide" ${consoleBusy?'disabled':''}>登入管理員端</button></form>${consoleNotice()}</section></main>`;return;}
  const nav=[['admin','總覽與使用者'],['admin-review','商家審核'],['admin-cancellations','卡片註銷紀錄'],['admin-cards','卡片暫停／恢復'],['admin-replace','管理員補卡'],['admin-stations','讀卡工作站'],['admin-transactions','全站交易'],['admin-audit','稽核紀錄'],['admin-operators','舊操作員授權']];
  app.innerHTML=`<div class="layout admin"><aside class="sidebar ${menuOpen?'open':''}"><h2>管理員後台</h2><nav>${nav.map(([r,t])=>`<a href="#${r}" class="${page===r?'active':''}">${esc(t)}</a>`).join('')}</nav>${consoleButton('登出管理員','logout')}</aside><main class="content" id="content"><div class="page">${consoleAdminContent()}${consoleNotice()}</div></main></div>`;
 }
 function consoleAdminContent(){const extra=consoleAdminExtra();if(extra!==null)return extra;
  if(page==='admin-cards')return `<h1>卡片暫停／恢復</h1><section class="panel"><p>此功能不能恢復永久註銷的卡片。</p><form id="console-card-status">${field('console-card-id','後端cardId','text','','pattern="[1-9][0-9]*"')}<label for="console-card-state">卡片狀態</label><select id="console-card-state"><option value="SUSPENDED">暫停使用</option><option value="ACTIVE">恢復使用</option></select>${field('console-card-note','原因')}<button class="primary">核對後送出</button></form></section>`;
  if(page==='admin-replace')return consoleReplacement();
  if(page==='admin-detail'){
   const u=consoleDetail;if(!u)return '<h1>使用者詳細資料</h1><p>請從清單選擇使用者，再查詢後端資料。</p>';
   return `<h1>使用者詳細資料</h1><section class="panel">${summary([['使用者編號',esc(u.userId)],['姓名',esc(u.fullName)],['帳號',esc(u.username)],['卡號',esc(u.card?.cardNumber||'—')],['卡片狀態',esc(u.card?.status||'—')],['餘額',consoleMoney(u.balanceMinor)],['商家狀態',esc(u.merchant?.status||'未申請')]])}</section><section class="panel"><h2>歷史卡片</h2>${table(['cardId','卡號','狀態','註銷時間'],(u.cards||[]).map(c=>[esc(c.cardId),esc(c.cardNumber),esc(c.status),esc(consoleTime(c.revokedAt))]),'沒有歷史卡片')}<form id="console-user-status"><label for="console-user-state">帳號狀態</label><select id="console-user-state"><option value="DISABLED">停用</option><option value="ACTIVE">恢復</option></select>${field('console-user-note','原因')}<button>核對後更新帳號</button></form></section>${consoleButton('返回清單','back')}`;
  }
  const kind=page==='admin-review'?'merchants':page==='admin-cancellations'?'cancellations':'users';const title={users:'總覽與使用者',merchants:'商家審核',cancellations:'卡片註銷紀錄'}[kind];
  const rows=consoleKind===kind?consoleRows:null;
  const statValue=k=>Number.isSafeInteger(consoleStats?.[k])&&consoleStats[k]>=0?String(consoleStats[k]):'—';
  const stats=kind==='users'?'<div class="stats">'+[['userCount','使用者數'],['boundCardCount','綁卡數'],['pendingMerchantCount','待審核數']].map(([k,title])=>'<section class="stat"><h2>'+title+'</h2><strong class="stat-value">'+statValue(k)+'</strong></section>').join('')+'</div>':'';
  const heads=kind==='users'?['使用者編號','姓名','帳號','卡片狀態','商家資格','操作']:kind==='merchants'?['商家編號','商家名稱','申請人','申請日期','狀態']:['卡片編號','使用者編號','卡號','註銷時間','狀態'];
  const values=(rows||[]).map(r=>kind==='users'?[esc(r.userId),esc(r.fullName),esc(r.username),esc(r.card?.status||'未綁定'),esc(r.merchantStatus||'未申請'),`<button data-action="console-detail" data-id="${esc(r.userId)}">查看</button>`]:kind==='merchants'?[esc(r.merchantId),esc(r.merchantName),esc(r.fullName||r.ownerUserId),esc(consoleTime(r.appliedAt)),esc(r.status)]:[esc(r.cardId),esc(r.userId),esc(r.cardNumber),esc(consoleTime(r.revokedAt)),esc(r.status)]);
  return `<h1>${title}</h1>${stats}<section class="panel"><form id="console-search" class="actions search"><input id="console-query" aria-label="搜尋姓名或帳號" placeholder="搜尋姓名或帳號" value="${esc(consoleSearch)}"><button class="primary">查詢／重新整理</button></form><p class="small">${rows?'目前顯示 '+rows.length+' 筆；總數須由後端提供。':'尚未取得資料。請按查詢；未設定API時不顯示模擬資料。'}</p>${table(heads,values,rows?'沒有符合條件的資料':'等待查詢')}${consoleCursor?consoleButton('下一頁','more'):''}</section>${kind==='merchants'?`<section class="panel"><h2>已核准商家停權／恢復</h2><form id="console-merchant-status">${field('console-status-merchant-id','merchantId','text','','pattern="[1-9][0-9]*"')}<label for="console-merchant-state">狀態</label><select id="console-merchant-state"><option value="SUSPENDED">停權</option><option value="APPROVED">恢復已核准商家</option></select>${field('console-merchant-note','原因')}<button>核對後更新狀態</button></form></section>`:''}${kind==='merchants'?`<section class="panel"><h2>核對申請後審核</h2><p>使用後端merchantId；姓名與商家名稱不能代替編號。</p><form id="console-review">${field('console-merchant-id','商家編號','text','','pattern="[1-9][0-9]*"')}<label for="console-decision">審核決定</label><select id="console-decision"><option value="APPROVED">同意申請</option><option value="REJECTED">拒絕申請</option></select>${field('console-review-note','審核備註')}<button class="primary" ${consoleBlocked?'disabled':''}>核對後送出審核</button></form>${consoleBlocked?'<p>上次結果未確認，請先查詢後端審核結果再操作。</p>':''}</section>`:''}`;
 }
 function consoleReplacement(){if(consoleReplacementWait)return `<h1>等候補卡工作站</h1><section class="panel"><p>等待有補卡權限的讀卡程式上線／空閒，每五秒重新分派。</p>${consoleButton('停止等候','stop-replacement-wait')}</section>`;
  if(!consoleTask)return `<h1>管理員補卡</h1><section class="panel"><p>請現場核對原持卡人證件。使用未登記的新卡，保留原帳號餘額與歷史。</p><form id="console-replacement-start">${field('console-user-id','原帳號userId','text','','pattern="[1-9][0-9]*"')}${field('console-fullname','原姓名')}${field('console-national-id','原身分證字號')}<button class="primary">核對後建立補卡任務</button></form></section>`;
  return `<h1>管理員補卡</h1><section class="panel"><p>後端已自動分派讀卡工作站，請核對機台顯示的用途與帳號，再插入未登記的新卡。</p><p>工作站：${esc(consoleTask.stationName||"後端指定讀卡站")}</p><p>目標userId：${esc(consoleTask.userId)}</p><p>到期：${esc(consoleTime(consoleTask.expiresAt))}</p>${consoleButton('更新讀卡狀態','poll-replace')}${consoleButton('取消本次補卡任務','cancel-replace')}<p>狀態：${esc(consoleTask.status)}</p>${consoleTask.cardReadToken?`<p>新卡號：${esc(consoleTask.cardNumber)}</p><form id="console-replacement-confirm">${field('console-fullname','再次核對原姓名')}${field('console-national-id','再次核對原身分證字號')}${field('console-replace-note','補卡原因')}<button class="primary" ${consoleBlocked?'disabled':''}>核對新卡後確認補卡</button></form>`:''}<p>結果不明時先核對管理員稽核與帳號資料，不連續補卡。</p></section>`;
 }
 async function consoleLoad(more=false){const revision=++consoleRevision;const kind=page==='admin-review'?'merchants':page==='admin-cancellations'?'cancellations':'users';const r=await consoleApi.query(kind,{query:consoleSearch,cursor:more?consoleCursor:undefined});if(revision!==consoleRevision)return;const items=Array.isArray(r?.items)?r.items:null;if(!items)throw Error('查詢對照器應回傳items陣列與nextCursor');consoleKind=kind;consoleRows=more?[...(consoleRows||[]),...items]:items;consoleCursor=r.nextCursor||null;if(kind==="users")consoleStats=r.statistics||null;consoleBlocked=false;}
 function consoleTopupRender(){const f=consoleFlow;let content='';
 if(['idle','ready'].includes(f.stage))content=`<h1>自助儲值</h1><p>免登入。點開始後，後端會自動安排讀卡工作站。</p>${consoleButton('開始，等候刷卡','read',true)}${consoleButton('確認上次儲值結果','recover')}`;
 else if(f.stage==='reading')content=`<h1>請刷卡</h1><p>指定工作站：${esc(f.session?.stationName||'後端分派中')}</p><p>請核對機台畫面後插卡；原卡已插著時請先取卡再插回。</p><span class="spinner"></span>${consoleButton('取消本次操作','cancel')}`;
 else if(f.stage==='card')content=`<h1>卡片操作</h1><p>卡號：${esc(f.session?.cardNumber)}</p><p>餘額：${consoleMoney(f.balanceMinor)}</p>${consoleButton('查看／更新餘額','balance')}<form id="console-topup-amount">${field('console-amount','儲值金額（元）','text','','inputmode="decimal"')}<button class="primary wide">核對儲值金額</button></form>${consoleButton('取消／結束交易','cancel')}`;
 else if(f.stage==='confirm')content=`<h1>確認儲值金額</h1><p class="amount">${consoleMoney(f.pending.amountMinor)}</p><p>送出後金額固定，再到指定機台確認模擬投入金額。此時尚未加值。</p>${consoleButton('確認金額，送往機台','submit',true)}${consoleButton('返回修改','edit')}`;
 else if(f.stage==='cash')content=`<h1>等待機台確認模擬收款</h1><p class="amount">${consoleMoney(f.saved.amountMinor||f.state.amountMinor)}</p><p>請在讀卡電腦核對金額，確認已模擬投入後再按機台的收款確認。網頁不能自行加值。</p><span class="spinner"></span>${consoleButton('取消本次儲值','cancel')}`;
 else if(f.stage==='processing')content='<h1>等待後端確認入帳</h1><span class="spinner"></span><p>請勿重新收款、重複開始或更換卡片。</p>';
 else if(f.stage==='unknown')content=`<h1>原儲值結果尚未確認</h1><p>先確認原操作，不能另外建立一筆。API重新啟動時，需等讀卡機台恢復原交易。</p>${consoleButton('確認原工作階段結果','retry',true)}${f.state?.status==='CARD_READY'&&f.saved?.amountMinor?consoleButton('沿用原金額確認送出','retry-amount'):''}${f.availabilityWait?'<p>等待讀卡程式上線／空閒，每五秒確認分派。</p>':''}`;
 else content=`<h1>${f.stage==='success'?'儲值完成':f.stage==='failed'?'儲值失敗，未入帳':f.stage==='cancelled'?'已取消本次操作':'工作階段已到期'}</h1>${f.receipt?summary([['金額',consoleMoney(f.receipt.amountMinor)],['目前餘額',consoleMoney(f.balanceMinor)],['帳本編號',esc(f.receipt.transactionId||'—')],['原因',esc(f.receipt.failureCode||'—')]]):''}<p>請取回卡片。下一筆仍會要求重新插卡，不自動連續加值。</p>${consoleButton('結束本次／取卡後繼續','finish',true)}`;
 app.innerHTML=`<main class="station" id="content"><div class="page"><div class="station-grid">${reader(f.stage==='success'?'success':f.stage==='reading'?'waiting':f.stage,true)}<section class="panel">${content}${consoleNotice()}</section></div></div></main>`;
}

 // Inserted within the admin console scope at build time.
const consoleExtraKinds={'admin-stations':'stations','admin-operators':'operators','admin-transactions':'transactions','admin-audit':'audit'};
function consoleAdminExtra(){
 const kind=consoleExtraKinds[page];if(!kind)return null;const rows=consoleKind===kind?consoleRows||[]:[];
 const headings={stations:'讀卡工作站管理',operators:'儲值操作員（舊相容模式）',transactions:'全站交易紀錄',audit:'管理員稽核紀錄'};
 let content=`<h1>${headings[kind]}</h1>${consoleButton('重新查詢','extra-refresh')}<p>資料以後端查詢為準。</p>`;
 if(kind==='stations')content+=`<section class="panel">${table(['工作站','名稱','用途','在線','啟用','優先序'],rows.map(r=>[esc(r.stationId),esc(r.displayName),esc(r.purposes?.join('、')),r.online?'在線':'離線',r.enabled?'啟用':'停用',esc(r.priority)]),'請查詢工作站')}<h2>首次登記工作站</h2><p>僅首次設定需交付工作站權杖。之後每筆操作由後端自動分派。</p><form id="console-station-create">${field('console-station-id','工作站代號','text','','pattern="[A-Za-z0-9_-]{1,60}"')}${field('console-station-name','顯示名稱')}<fieldset><legend>允許用途</legend>${['BIND','BALANCE','TOPUP','REPLACE','PAYMENT'].map(p=>`<label class="check"><input type="checkbox" name="purpose" value="${p}" ${p==='PAYMENT'?'':'checked'}>${p}</label>`).join('')}</fieldset>${field('console-station-priority','優先序（越小越優先）','number','100','min="0" max="1000000" step="1"')}<label for="console-station-merchant">付款用途的merchantId</label><input id="console-station-merchant" inputmode="numeric"><label for="console-station-code">付款用途的8碼merchantCode</label><input id="console-station-code" maxlength="8"><button class="primary">登記並取得一次性權杖</button></form></section><section class="panel"><h2>啟停／換發權杖</h2><form id="console-station-status">${field('console-existing-station','工作站代號')}<label for="console-station-operation">操作</label><select id="console-station-operation"><option value="disable">停用工作站</option><option value="enable">啟用工作站</option><option value="rotate">換發權杖（舊權杖立即失效）</option></select>${field('console-station-note','原因')}<button>核對後執行</button></form></section>`;
 if(kind==='operators')content+=`<section class="panel"><p>自助儲值不需操作員登入；本頁只管理舊相容介面。</p>${table(['userId','帳號','授權'],rows.map(r=>[esc(r.userId),esc(r.username),r.enabled?'允許':'未授權']),'請查詢操作員')}<form id="console-operator-status">${field('console-operator-user','userId','text','','pattern="[1-9][0-9]*"')}<label for="console-operator-enabled">授權</label><select id="console-operator-enabled"><option value="true">允許舊操作員儲值</option><option value="false">撤銷授權</option></select>${field('console-operator-note','原因')}<button>核對後更新</button></form></section>`;
 if(kind==='transactions')content+=`<section class="panel">${table(['帳本編號','類型','金額','狀態','完成時間（台北）'],rows.map(r=>[esc(r.transactionId),esc(r.type),consoleMoney(r.amountMinor),esc(r.status),esc(consoleTime(r.completedAt))]),'尚無資料')}</section>`;
 if(kind==='audit')content+=`<section class="panel">${table(['稽核編號','操作人','動作','對象','時間（台北）'],rows.map(r=>[esc(r.auditId),esc(r.actorUserId||r.actorType),esc(r.action),esc(r.targetType)+' '+esc(r.targetId),esc(consoleTime(r.createdAt))]),'尚無資料')}</section>`;
 return content+(consoleCursor?consoleButton('下一頁','more'):'');
}
function consoleTokenDialog(secret){if(!/^[a-f0-9]{64}$/.test(secret))throw Error('工作站權杖格式不符');openDialog('工作站權杖（只顯示本次）','<p>只交給指定讀卡電腦，填入STATION_API_TOKEN並加密保存。不要放進網站程式、聊天室或GitHub。</p><label for="console-one-time-token">一次性權杖</label><input id="console-one-time-token" type="password" readonly><p>關閉後此畫面清除權杖；列表不會再顯示。</p>'+consoleButton('顯示／隱藏','show-token')+consoleButton('已保存，關閉','close'));dialog.querySelector('#console-one-time-token').value=secret;}
async function consoleExtraSubmit(f){const val=id=>f.querySelector('#'+id).value.trim(),id=f.id;
 if(id==='console-station-create'){
  const purposes=[...f.querySelectorAll('input[name="purpose"]:checked')].map(e=>e.value);if(!purposes.length)throw Error('至少選一種用途');
  const body={stationId:val('console-station-id'),displayName:val('console-station-name'),priority:Number(val('console-station-priority')),purposes};
  if(purposes.includes('PAYMENT')){body.merchantId=val('console-station-merchant');body.merchantCode=val('console-station-code');if(!/^[1-9]\d*$/.test(body.merchantId)||!/^[A-Za-z0-9]{8}$/.test(body.merchantCode))throw Error('付款用途須填已核准merchantId及8碼merchantCode');}
  const r=await consoleApi.request('/admin/hardware-stations',{method:'POST',body});if(!/^[a-f0-9]{64}$/.test(r.stationToken))throw Error('權杖回應格式不符');f.reset();consoleTokenDialog(r.stationToken);return true;
 }
 if(id==='console-station-status'){
  const station=val('console-existing-station');if(!/^[A-Za-z0-9_-]{1,60}$/.test(station))throw Error('工作站代號格式錯誤');const operation=val('console-station-operation'),note=val('console-station-note');
  const r=await consoleApi.request('/admin/hardware-stations/'+station+(operation==='rotate'?'/rotate-token':'/status'),{method:'POST',body:operation==='rotate'?{note}:{enabled:operation==='enable',note}});if(operation==='rotate')consoleTokenDialog(r.stationToken);else consoleError='後端已確認工作站狀態，請重新查詢。';return true;
 }
 if(id==='console-operator-status'){const userId=val('console-operator-user');if(!/^[1-9]\d*$/.test(userId))throw Error('userId格式錯誤');await consoleApi.request('/admin/topup-operators/'+userId+'/status',{method:'POST',body:{enabled:val('console-operator-enabled')==='true',note:val('console-operator-note')}});consoleError='後端已更新相容操作員授權。';return true;}
 if(id==='console-user-status'){await consoleApi.request('/admin/users/'+consoleDetail.userId+'/status',{method:'POST',body:{status:val('console-user-state'),note:val('console-user-note')}});consoleDetail=await consoleApi.query('userDetail',{userId:consoleDetail.userId});return true;}
 if(id==='console-merchant-status'){const merchantId=val('console-status-merchant-id');if(!/^[1-9]\d*$/.test(merchantId))throw Error('merchantId格式錯誤');await consoleApi.request('/admin/merchants/'+merchantId+'/status',{method:'POST',body:{status:val('console-merchant-state'),note:val('console-merchant-note')}});if(consoleDetail)consoleDetail=await consoleApi.query('userDetail',{userId:consoleDetail.userId});consoleError='後端已確認商家狀態。';return true;}
 return false;
}
const consoleBaseLoad=consoleLoad;
consoleLoad=async function(more=false){const kind=consoleExtraKinds[page];if(!kind)return consoleBaseLoad(more);const r=await consoleApi.query(kind,{cursor:more?consoleCursor:undefined});consoleKind=kind;consoleRows=more?[...(consoleRows||[]),...r.items]:r.items;consoleCursor=r.nextCursor||null;};
let consoleAutoTimer=null;
function consoleAutoSchedule(){clearTimeout(consoleAutoTimer);if(consoleMode!=='api')return;
 if(ENTRY==='admin'&&consoleReplacementWait&&page==='admin-replace'&&consoleApi.session){const pending=consoleReplacementWait,session=consoleApi.session;consoleAutoTimer=setTimeout(async()=>{if(consoleBusy){consoleAutoSchedule();return;}try{const r=await consoleApi.replacementTask(pending.userId,pending.identity);if(consoleReplacementWait===pending&&consoleApi.session===session){consoleTask={...r,userId:pending.userId};consoleReplacementWait=null;}}catch(e){if(!['NO_READER_AVAILABLE','READER_BUSY'].includes(e.code)){consoleReplacementWait=null;consoleError=e.message;}}render();},5000);return;}
 if(ENTRY==='topup'&&consoleFlow.saved&&consoleFlow.availabilityWait){consoleAutoTimer=setTimeout(async()=>{if(consoleBusy||consoleFlow.busy){consoleAutoSchedule();return;}try{await consoleFlow.poll();consoleError='';}catch(e){consoleError=e.message;}render();},5000);return;}
 if(ENTRY==='topup'&&consoleFlow.saved&&!['success','failed','cancelled','expired','ready','idle','unknown'].includes(consoleFlow.stage))consoleAutoTimer=setTimeout(async()=>{if(consoleBusy||consoleFlow.busy){consoleAutoSchedule();return;}try{await consoleFlow.poll();consoleError='';}catch(e){consoleError=e.message;}render();},1000);
 if(ENTRY==='admin'&&consoleTask&&!consoleBlocked&&['WAITING','PROCESSING'].includes(consoleTask.status))consoleAutoTimer=setTimeout(async()=>{const t=consoleTask;if(consoleBusy){consoleAutoSchedule();return;}try{const r=await consoleApi.pollReplacement(t.requestId);if(consoleTask!==t)return;if(r.requestId!==t.requestId||r.purpose!=='REPLACE')throw Error('補卡任務不符');Object.assign(t,r);}catch(e){if(consoleTask===t){consoleTask.status='FAILED';consoleError=e.message;}}render();},1000);
}

// Keep the original shell, icons, artwork, tables, stats and detail-grid.
const consoleOriginalVisual={adminPage,adminDetail,renderTopup};
function consoleVisualUser(r){return {id:r.userId,name:r.fullName||'—',username:r.username||r.userId,bound:!!r.card,card:r.card,balance:Number(r.balanceMinor||0)/100,merchant:({PENDING:'pending',APPROVED:'approved',REJECTED:'rejected',SUSPENDED:'suspended'})[r.merchant?.status||r.merchantStatus]||'none',store:r.merchant?.merchantName||r.merchantName||'',phone:r.merchant?.phone||''};}
function consoleAdminRender(){
 if(!consoleApi.session){consoleReplacementWait=null;consoleTask=null;consoleRows=null;consoleDetail=null;consoleStats=null;app.innerHTML=`<main class="login-page" id="content"><div class="login-art"><img src="./assets/card-scene.svg" alt="懸浮晶片卡與青藍感應平台"></div><section class="auth-panel" aria-labelledby="page-title"><h1 id="page-title">管理員登入</h1><form id="console-login">${field('console-username','帳號','text','','autocomplete="username"')}${field('console-password','密碼','password','','autocomplete="current-password"')}<button class="primary wide" ${consoleBusy?'disabled':''}>登入管理員端</button><p class="small">請使用後端授權的管理員帳號。</p></form>${consoleNotice()}</section></main>`;return;}
 mode='admin';shell();
 document.querySelector('#content').innerHTML='<div class="page">'+consoleAdminContent()+consoleNotice()+'</div>';
}
const consoleApiContent=consoleAdminContent;
consoleAdminContent=function(){
 if(page==='admin'||page==='admin-review'){
  const kind=page==='admin-review'?'merchants':'users',rows=consoleKind===kind?consoleRows:null;
  db.users=(rows||[]).map(r=>kind==='merchants'?consoleVisualUser({userId:r.ownerUserId,fullName:r.fullName||r.merchantName,username:r.username||r.ownerUserId,merchant:r}):consoleVisualUser(r));adminSearch=consoleSearch;
  let html=consoleOriginalVisual.adminPage().replace(note,'').replace('id="admin-search"','id="console-search"').replace('id="admin-query"','id="console-query"');
  let index=0;const stats=['userCount','boundCardCount','pendingMerchantCount'];html=html.replace(/<strong class="stat-value">[^<]*<\/strong>/g,()=>'<strong class="stat-value">'+(Number.isSafeInteger(consoleStats?.[stats[index]])?consoleStats[stats[index++]]:(index++,'—'))+'</strong>');
  html=html.replace(/data-user="([^"]*)" data-action="admin-detail"/g,(_,username)=>{const u=db.users.find(u=>esc(u.username)===username);return `data-id="${esc(u?.id||'')}" data-action="console-detail"`;});
  if(rows===null)html=html.replace('尚無使用者資料','尚未查詢，請按搜尋取得後端資料');if(page==='admin')html+=consoleManagementLinks();return html+(consoleCursor?consoleButton('下一頁','more'):'');
 }
 if(page==='admin-detail'){
  const d=consoleDetail;if(!d)return '<h1>請先從使用者清單選擇帳戶</h1>'+consoleButton('返回清單','back');const u=consoleVisualUser(d);db.users=[u];detailUser=u.username;db.cancellations=[];
  let html=consoleOriginalVisual.adminDetail().replace(note,'').replace('模擬餘額','帳戶餘額').replace('卡號末四碼','卡號').replace('4821',esc(d.card?.cardNumber||'—'));
  html=html.replace('尚無註銷紀錄',table(['卡號','狀態','綁定時間','註銷時間'],(d.cards||[]).map(c=>[esc(c.cardNumber),esc(c.status),esc(consoleTime(c.boundAt)),esc(consoleTime(c.revokedAt))]),'沒有歷史卡片'));
  html=html.replace(/<section class="panel"><h2>註銷紀錄<\/h2>[\s\S]*?<\/section>/, '<section class="panel"><h2>卡片歷史／註銷紀錄</h2>'+table(['卡號','狀態','綁定時間','註銷時間'],(d.cards||[]).map(c=>[esc(c.cardNumber),esc(c.status),esc(consoleTime(c.boundAt)),esc(consoleTime(c.revokedAt))]),'沒有歷史卡片')+'</section>');
 html+=`<section class="panel"><h2>帳號狀態</h2><form id="console-user-status"><label for="console-user-state">狀態</label><select id="console-user-state"><option value="DISABLED">停用</option><option value="ACTIVE">恢復</option></select>${field('console-user-note','原因')}<button class="primary">核對後更新帳號</button></form></section>`;
  if(d.merchant&&['APPROVED','SUSPENDED'].includes(d.merchant.status))html+=`<section class="panel"><h2>商家狀態管理</h2><form id="console-merchant-status"><input type="hidden" id="console-status-merchant-id" value="${esc(d.merchant.merchantId)}"><label for="console-merchant-state">商家狀態</label><select id="console-merchant-state"><option value="SUSPENDED">暫停商家收款</option><option value="APPROVED">恢復已核准商家</option></select>${field('console-merchant-note','原因')}<button class="primary">核對後更新</button></form></section>`;
  return html;
 }
 return consoleApiContent();
};
function consoleManagementLinks(){return '<section class="panel"><h2>其他管理功能</h2><div class="actions">'+[['admin-cards','卡片暫停／恢復'],['admin-replace','補卡'],['admin-stations','讀卡工作站'],['admin-transactions','全站交易'],['admin-audit','稽核紀錄'],['admin-operators','舊操作員授權']].map(([route,label])=>'<button data-action="console-open-page" data-page="'+route+'">'+label+'</button>').join('')+consoleButton('登出管理員','logout')+'</div></section>';}
function consoleReviewDialog(decision){const merchant=consoleDetail?.merchant;if(!merchant||merchant.status!=='PENDING')throw Error('請先更新待審核商家資料');openDialog(decision==='APPROVED'?'核准商家申請':'駁回商家申請',`<p>商家：${esc(merchant.merchantName)}</p><form id="console-review"><input id="console-merchant-id" type="hidden" value="${esc(merchant.merchantId)}"><input id="console-decision" type="hidden" value="${decision}">${field('console-review-note','審核備註')}<div class="actions">${consoleButton('取消','close')}<button class="primary">確認送出</button></div></form>`);}

// Match semantic actions: browsers normalize whitespace and boolean attributes in innerHTML.
function consoleReplaceAction(html,action,replacement){return html.replace(new RegExp('<button\\b(?=[^>]*\\bdata-action="'+action+'")[^>]*>[\\s\\S]*?</button>','g'),()=>replacement);}
function consoleTopupRender(){const f=consoleFlow;
 const viewKey=JSON.stringify([f.stage,consoleBusy,consoleError,!!f.availabilityWait,f.balanceMinor,f.session?.stationName,f.session?.cardNumber,f.pending?.amountMinor,f.saved?.amountMinor,f.state?.amountMinor,f.receipt?.transactionId,f.receipt?.failureCode]);
 if(viewKey===consoleTopupViewKey)return;
 const stage=({idle:'start',ready:'start',reading:'waiting',card:'amount',confirm:'confirm',cash:'processing',processing:'processing',unknown:'unknown',success:'success',failed:'error',cancelled:'error',expired:'error'})[f.stage];
 tx=stage==='start'?null:{kind:'topup',stage,id:f.receipt?.transactionId||'',amount:Number(f.pending?.amountMinor||f.saved?.amountMinor||f.state?.amountMinor||0)/100,inserted:!['waiting','start'].includes(stage),balanceAfter:f.balanceMinor===null?null:Number(f.balanceMinor)/100,committed:f.stage==='success',error:f.receipt?.failureCode||({failed:'儲值失敗，沒有入帳。',cancelled:'本次操作已取消。',expired:'工作階段已到期。'})[f.stage]||''};
 consoleOriginalVisual.renderTopup();document.body.dataset.stage=stage;let html=app.innerHTML;
 html=consoleReplaceAction(html,'device-insert','<p>工作站：'+esc(f.session?.stationName||'後端指定讀卡站')+'。請依機台提示插卡。</p>');
 html=consoleReplaceAction(html,'transaction-cancel',consoleButton('取消','cancel'));html=consoleReplaceAction(html,'topup-start',consoleButton('開始儲值','read',true));
 html=html.replace('id="topup-form"','id="console-topup-amount"').replace('id="topup-amount" name="topup-amount"','id="console-amount" name="console-amount"').replace('for="topup-amount"','for="console-amount"').replace('min="1" max="9999999" step="1" inputmode="numeric"','min="0.01" max="10000" step="0.01" inputmode="decimal"').replace('讀卡完成 · 卡號末四碼 4821','讀卡完成 · 卡號 '+esc(f.session?.cardNumber||'—')).replace('請先核對收到的現金。','請輸入金額，後續由機台確認模擬收款。');
 if(['card','confirm'].includes(f.stage))html=html.replace('<h1>輸入儲值金額</h1>','<h1>輸入儲值金額</h1><p>目前餘額：'+consoleMoney(f.balanceMinor)+'</p>'+consoleButton('查看餘額','balance'));
 if(f.stage==='cash')html=html.replace('正在加值，請稍候','等待機台確認模擬收款').replace('請勿取出卡片或重複送出。','請核對讀卡電腦上的金額，確認模擬投入後才會入帳。');
 html=consoleReplaceAction(html,'device-resolve',consoleButton('查詢原交易結果','retry',true));
 html=consoleReplaceAction(html,'device-remove',consoleButton(f.stage==='success'?'結束交易':'取卡後結束','finish'));
 html=consoleReplaceAction(html,'next-transaction',consoleButton('取卡後繼續交易','next',true)).replace('收到拔卡事件後，才會啟用下一筆。','請先取卡；下一筆仍需重新插卡，不會自動連續加值。');
 if(['failed','cancelled','expired'].includes(f.stage))html=html.replace('<h1>讀卡失敗</h1>','<h1>'+({failed:'儲值未完成',cancelled:'已取消',expired:'工作階段已到期'})[f.stage]+'</h1>');
 html=html.replace('模擬現金儲值 · 無實際金流 · 儲值工作站獨立入口','自助儲值 · 由機台確認模擬收款 · 無實際銀行金流');
 if(f.stage==='unknown'&&f.availabilityWait)html=html.replace('正在確認加值結果','等候讀卡工作站上線／空閒');
 app.innerHTML=html;document.querySelector('.station .page').insertAdjacentHTML('beforeend',consoleNotice());consoleTopupViewKey=viewKey;
 if(f.stage==='confirm'&&!dialog.open)openDialog('確認加值',`<p style="text-align:center">本次儲值金額</p><p class="amount">${consoleMoney(f.pending.amountMinor)}</p><p style="text-align:center">請核對金額。後續須由機台確認模擬投入，不會在此直接加值。</p><div class="actions">${consoleButton('返回修改','edit')}${consoleButton('確認送出','submit',true)}</div>`,{dark:true});
}

 const previousConsoleRender=render;
 render=function(){consoleToolbar();if(consoleMode==='demo'){consoleTopupViewKey=null;previousConsoleRender();return;}document.body.dataset.page=ENTRY==='topup'?'topup':page;document.title=(ENTRY==='admin'?'管理員後台':'儲值工作站')+'｜後端連線模式';paused=false;document.body.classList.remove('motion-paused');document.querySelector('#area-name').textContent=ENTRY==='admin'?'管理員後台':'卡片儲值';if(ENTRY==='admin')consoleAdminRender();else consoleTopupRender();consoleAutoSchedule();};
 async function consoleAction(fn){if(consoleBusy)return;consoleBusy=true;consoleError='';render();try{await fn();}catch(e){consoleError=e.code==='NOT_CONFIGURED'?e.message:(e.message||'操作未完成');}finally{consoleBusy=false;render();}}
 document.addEventListener('submit',e=>{if(consoleMode!=='api')return;e.preventDefault();e.stopImmediatePropagation();const f=e.target,val=id=>f.querySelector('#'+id).value;const id=f.id;if(!f.reportValidity())return;
  consoleAction(async()=>{
   if(await consoleExtraSubmit(f))return;
   if(id==='console-login'){await consoleApi.login(val('console-username').trim(),val('console-password'));f.reset();await consoleLoad();}
   else if(id==='console-search'){consoleSearch=val('console-query').trim();await consoleLoad();}
   else if(id==='console-review'){try{await consoleApi.review(val('console-merchant-id'),val('console-decision'),val('console-review-note'));f.reset();closeDialog();if(consoleDetail)consoleDetail=await consoleApi.query('userDetail',{userId:consoleDetail.userId});consoleError='後端已確認審核結果。';}catch(e){if(e.uncertain)consoleBlocked=true;throw e;}}
   else if(id==='console-card-status'){await consoleApi.cardStatus(val('console-card-id'),val('console-card-state'),val('console-card-note'));f.reset();consoleError='後端已確認卡片狀態。';}
   else if(id==='console-replacement-start'){const userId=val('console-user-id'),identity={fullName:val('console-fullname'),nationalId:val('console-national-id')};f.reset();try{const r=await consoleApi.replacementTask(userId,identity);consoleTask={...r,userId};}catch(e){if(['NO_READER_AVAILABLE','READER_BUSY'].includes(e.code))consoleReplacementWait={userId,identity};else throw e;}}
   else if(id==='console-replacement-confirm'){try{const r=await consoleApi.replace(consoleTask.userId,{fullName:val('console-fullname'),nationalId:val('console-national-id'),cardReadToken:consoleTask.cardReadToken,note:val('console-replace-note')});f.reset();consoleTask=null;consoleError='後端已確認補卡，新卡號：'+r.card.cardNumber+'，原餘額與歷史保留。';}catch(e){if(e.uncertain)consoleBlocked=true;throw e;}}
   else if(id==='console-topup-amount')await consoleFlow.prepare(val('console-amount').trim());
  });
 },true);
 document.addEventListener('click',e=>{
  const b=e.target.closest('[data-action]');const action=b?.dataset.action;
  if(action==='console-mode'){e.preventDefault();e.stopImmediatePropagation();consoleAction(async()=>{if(consoleFlow.pending||consoleFlow.busy||consoleFlow.session||consoleFlow.saved||consoleTask)throw Error('請先完成目前交易或補卡任務，不能切換模式');if(consoleApi.session)await consoleApi.logout();clearTransaction();consoleRevision++;consoleRows=null;consoleStats=null,consoleReplacementWait=null;consoleError='';consoleMode=consoleMode==='api'?'demo':'api';try{localStorage.setItem('wallet-console-mode-'+ENTRY,consoleMode);}catch{}if(consoleMode==='api'&&ENTRY==='topup')await consoleFlow.recover();});return;}
  if(consoleMode!=='api')return;
  const anchor=e.target.closest('a[href^="#"]');if(anchor&&!anchor.classList.contains('skip')&&!anchor.dataset.action){e.preventDefault();e.stopImmediatePropagation();if(consoleBusy)return;page=anchor.hash.slice(1);consoleDetail=null;consoleError='';consoleRevision++;render();return;}
  if(!b)return;e.preventDefault();e.stopImmediatePropagation();if(action==='console-open-page'){page=b.dataset.page;consoleRows=null;consoleDetail=null;consoleError='';render();return;}if(action==='console-settings'){consoleSettings();return;}if(action==='console-close'){closeDialog();dialog.innerHTML='';return;}if(action==='menu'){menuOpen=!menuOpen;render();return;}if(['approve','reject'].includes(action)){try{consoleReviewDialog(action==='approve'?'APPROVED':'REJECTED');}catch(e){consoleError=e.message;render();}return;}
  if(action==='motion'){paused=false;document.body.classList.remove('motion-paused');return;}if(action==='console-cancel-read'){consoleFlow.cancelRead().catch(e=>{consoleError=e.message;}).finally(()=>render());return;}
  consoleAction(async()=>{
   if(action==='console-show-token'){const input=dialog.querySelector('#console-one-time-token');if(input)input.type=input.type==='password'?'text':'password';}
   else if(action==='console-extra-refresh')await consoleLoad();
   else if(action==='console-stop-replacement-wait')consoleReplacementWait=null;
   else if(action==='console-cancel-replace'){if(consoleTask){await consoleApi.request('/card-reads/'+consoleTask.requestId+'/cancel',{method:'POST',body:{}});consoleTask=null;consoleBlocked=false;}}
   else if(action==='console-logout'){if(consoleTask&&!consoleBlocked&&['WAITING','READY'].includes(consoleTask.status))await consoleApi.request('/card-reads/'+consoleTask.requestId+'/cancel',{method:'POST',body:{}});await consoleApi.logout();consoleTask=null;consoleRows=null;consoleDetail=null;consoleStats=null,consoleReplacementWait=null;}
   else if(action==='console-more')await consoleLoad(true);
   else if(action==='console-detail'){consoleDetail=await consoleApi.query('userDetail',{userId:b.dataset.id});page='admin-detail';}
   else if(action==='console-back'){page='admin';consoleDetail=null;}
   else if(action==='console-poll-replace'){const r=await consoleApi.pollReplacement(consoleTask.requestId);if(r.requestId!==consoleTask.requestId||r.purpose!=='REPLACE')throw Error('回報任務不符');consoleTask={...consoleTask,...r};}
   else if(action==='console-read')await consoleFlow.open();
   else if(action==='console-balance')await consoleFlow.balance();
   else if(action==='console-submit'){closeDialog();await consoleFlow.submit();}
   else if(action==='console-retry')await consoleFlow.poll();
   else if(action==='console-retry-amount')await consoleFlow.retryAmount();
   else if(action==='console-cancel')await consoleFlow.cancel();
   else if(action==='console-edit'){await consoleFlow.edit();closeDialog();}
   else if(action==='console-finish')await consoleFlow.finish();
   else if(action==='console-next'){await consoleFlow.finish();await consoleFlow.open();}
   else if(action==='console-recover')await consoleFlow.recover();
  });
 },true);
 window.addEventListener('beforeunload',e=>{if(consoleMode==='api'&&(consoleFlow.pending||consoleFlow.busy)){e.preventDefault();e.returnValue='';}});
 dialog.addEventListener('cancel',e=>{if(consoleMode!=='api')return;e.preventDefault();e.stopImmediatePropagation();if(ENTRY==='topup'&&consoleFlow.stage==='confirm')consoleAction(async()=>{await consoleFlow.edit();closeDialog();});else closeDialog();},true);
 render();
 if(consoleMode==='api'&&ENTRY==='topup')consoleAction(()=>consoleFlow.recover());
}
