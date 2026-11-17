(function(global){
 'use strict';
 class ApiError extends Error{constructor(message,code,status){super(message);this.code=code;this.status=status;}}
 const assert=(condition,message)=>{if(!condition)throw new Error(message);};
 function base(value){const u=new URL(value);assert(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.replace(/\/$/,'').endsWith('/api/v1'),'API網址須為HTTPS並以/api/v1結尾');return u.href.replace(/\/$/,'');}
 function amountMinor(value){assert(/^\d+(\.\d{1,2})?$/.test(value),'金額須為正數，最多兩位小數');const [whole,fraction='']=value.split('.');const n=BigInt(whole)*100n+BigInt(fraction.padEnd(2,'0'));assert(n>0n&&n<=1000000n,'單筆儲值須介於0.01與10000元');return n.toString();}
 class AdminApi{
  constructor(apiBase,queries={},fetcher=global.fetch.bind(global)){this.base=base(apiBase);this.queries=queries;this.fetcher=fetcher;this.session=null;}
  async request(path,{method='GET',body,auth=true,raw=false,headers:extra={}}={}){
   assert(typeof path==='string'&&path.startsWith('/')&&!path.startsWith('//')&&!/[\r\n#\\]/.test(path),'API路徑格式錯誤');
   assert(new URL(this.base+path).origin===new URL(this.base).origin,'API路徑不可跨站');
   const headers={Accept:'application/json',...extra};if(auth){assert(this.session?.accessToken,'請先以管理員帳號登入');headers.Authorization='Bearer '+this.session.accessToken;}if(body!==undefined)headers['Content-Type']='application/json';
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
   try{const r=await this.fetcher(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});
    if(r.status===204&&r.ok)return null;const json=await r.json();
    if(!r.ok){if(r.status===401)this.session=null;throw new ApiError(json.error?.message||'後端請求失敗',json.error?.code,r.status);}
    if(raw)return json;assert(Object.hasOwn(json,'data'),'API回應缺少data欄位');return json.data;
   }catch(e){if(e instanceof ApiError)throw e;const error=new Error('無法確認後端結果，請重新查詢資料後再操作。');error.uncertain=method!=='GET';throw error;}finally{clearTimeout(timer);}
  }
  async login(username,password){const data=await this.request('/auth/login',{method:'POST',body:{username,password},auth:false});assert(data?.accessToken&&data.user,'登入回應不完整');if(data.user.role&&data.user.role!=='ADMIN')throw new ApiError('此帳號不是管理員','ADMIN_REQUIRED',403);this.session=data;try{const p=await this.request('/me/permissions');assert(p.canAdmin===true,'此帳號沒有管理員權限');this.permissions=p;}catch(e){this.session=null;throw e;}return data.user;}
  async logout(){try{await this.request('/auth/logout',{method:'POST',body:{}});}catch(e){if(e.status!==401)throw e;}this.session=null;}
  async query(kind,{query='',userId,cursor}={}){
   assert(this.session,'請先以管理員帳號登入');const binding=this.queries[kind];if(typeof binding!=='function')throw new ApiError('尚待後端提供此查詢API規格','NOT_CONFIGURED');
   return binding({request:this.request.bind(this),query,userId,cursor});
  }
  async review(merchantId,decision,note=''){assert(/^[1-9]\d*$/.test(merchantId)&&['APPROVED','REJECTED'].includes(decision),'商家編號或審核決定格式錯誤');const result=await this.request('/admin/merchants/'+merchantId+'/review',{method:'POST',body:{decision,note}});assert(result?.status===decision,'後端未確認指定審核狀態');return result;}
  async cardStatus(cardId,status,note=''){assert(/^[1-9]\d*$/.test(cardId)&&['ACTIVE','SUSPENDED'].includes(status),'卡片編號或狀態格式錯誤');const result=await this.request('/admin/cards/'+cardId+'/status',{method:'POST',body:{status,note}});assert(result?.status===status,'後端未確認卡片狀態');return result;}
  async replacementTask(userId,identity){assert(/^[1-9]\d*$/.test(userId),'使用者編號格式錯誤');const r=await this.request('/admin/users/'+userId+'/card-replacement-reads',{method:'POST',body:{fullName:identity.fullName,nationalId:identity.nationalId}});assert(r?.purpose==='REPLACE'&&['WAITING','READY','PROCESSING'].includes(r.status)&&/^[a-f0-9]{64}$/.test(r.requestId),'補卡任務格式不符');return r;}
  async pollReplacement(id){assert(/^[a-f0-9]{64}$/.test(id),'任務格式錯誤');return this.request('/card-reads/'+id,{auth:false});}
  async replace(userId,{fullName,nationalId,cardReadToken,note=''}){assert(/^[1-9]\d*$/.test(userId),'使用者編號格式錯誤');assert(/^[a-f0-9]{64}$/.test(cardReadToken),'補卡憑證格式錯誤');const r=await this.request('/admin/users/'+userId+'/cards/replace',{method:'POST',body:{fullName,nationalId,cardReadToken,note}});assert(r?.oldCardsRevoked===true&&r.card?.status==='ACTIVE','補卡結果尚未確認');return r;}
 }
 class TopupFlow{
  constructor(bridge){this.bridge=bridge;this.stage='idle';this.session=null;this.pending=null;this.receipt=null;this.balanceMinor=null;this.busy=false;this.readEpoch=0;}
  method(name){assert(this.bridge&&typeof this.bridge[name]==='function','桌面儲值橋接尚未串接：'+name);return this.bridge[name].bind(this.bridge);}
  async work(fn){assert(!this.busy,'上一個操作尚未結束');this.busy=true;try{return await fn();}finally{this.busy=false;}}
  restore(p){if(!p)return;assert(typeof p.preparedRef==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId)&&/^[0-9]+$/.test(p.amountMinor)&&p.session?.sessionId&&p.session.cardNumber,'待確認儲值格式不符');this.pending=p;this.session=p.session;this.stage='unknown';}
  async recover(){return this.work(async()=>{assert(!this.pending,'請先確認原交易');this.restore(await this.method('recoverPending')());});}
  async open(){return this.work(async()=>{assert(!this.pending&&['idle','ready'].includes(this.stage),'請先完成原交易');this.restore(await this.method('recoverPending')());assert(!this.pending,'發現上次待確認儲值，請先確認原結果');const epoch=++this.readEpoch;this.stage='reading';try{const s=await this.method('openSession')();if(epoch!==this.readEpoch)return;assert(s?.sessionId&&s.cardNumber,'讀卡回應缺少卡片資訊');this.session=s;this.stage='card';}catch(e){if(epoch===this.readEpoch)this.stage='idle';throw e;}});}
  async cancelRead(){assert(this.stage==='reading','目前不是等候讀卡狀態');const r=await this.method('cancelRead')();assert(r?.cancelled===true,'設備尚未確認取消讀卡');this.readEpoch++;this.stage='idle';}
  async balance(){return this.work(async()=>{assert(this.session&&['card','amount'].includes(this.stage)&&!this.pending,'請先讀卡並完成原交易');const r=await this.method('balance')({sessionId:this.session.sessionId});assert(/^[0-9]+$/.test(r?.balanceMinor)&&r.currency==='TWD','餘額資料格式不符');this.balanceMinor=r.balanceMinor;this.stage='card';return r;});}
  async prepare(value){return this.work(async()=>{assert(this.session&&!this.pending&&['card','amount'].includes(this.stage),'請先讀卡');const minor=amountMinor(value);const p=await this.method('prepareTopup')({sessionId:this.session.sessionId,amountMinor:minor});assert(typeof p?.preparedRef==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(p.requestId)&&p.amountMinor===minor,'儲值準備資料不符');this.pending=p;this.stage='confirm';return p;});}
  async edit(){return this.work(async()=>{assert(this.stage==='confirm'&&this.pending,'目前無可修改的儲值');await this.method('discardPrepared')({preparedRef:this.pending.preparedRef});this.pending=null;this.stage='amount';});}
  async submit(){return this.work(async()=>{assert(this.pending&&['confirm','unknown'].includes(this.stage),'請先核對金額');this.stage='processing';try{
   const r=await this.method('submitTopup')({preparedRef:this.pending.preparedRef});assert(r?.requestId===this.pending.requestId&&r.amountMinor===this.pending.amountMinor&&['SUCCEEDED','FAILED'].includes(r.status),'尚未取得同一筆儲值的最終結果');this.receipt=r;this.stage=r.status==='SUCCEEDED'?'success':'failed';this.pending=null;return r;
  }catch(e){this.stage='unknown';throw e;}});}
  async finish(){return this.work(async()=>{assert(!this.pending&&this.stage!=='processing','原儲值尚未確認，不能結束');const r=await this.method('finishSession')({sessionId:this.session?.sessionId});assert(r?.cardRemoved===true,'請先取卡，再確認結束');this.session=null;this.receipt=null;this.balanceMinor=null;this.stage='ready';});}
 }
 global.WalletConsole={AdminApi,TopupFlow,ApiError,amountMinor};
})(window);
