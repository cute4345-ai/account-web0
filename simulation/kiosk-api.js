(function(global){
 'use strict';
 const terminal=new Set(['SUCCEEDED','FAILED','CANCELLED','EXPIRED']);
 class KioskFlow{
  constructor(base,storage=global.sessionStorage,fetcher){this.api=new WalletConsole.AdminApi(base,{},fetcher);this.storage=storage;this.storageKey='ewallet.kiosk.v041.'+base;this.state=null;this.stage='idle';this.busy=false;this.pending=null;this.receipt=null;this.balanceMinor=null;this.session=null;this.saved=null;this.draft=null;}
  save(){this.storage.setItem(this.storageKey,JSON.stringify(this.saved));}
  async work(fn){if(this.busy)throw Error('原操作尚未完成');this.busy=true;try{return await fn();}finally{this.busy=false;}}
  async call(path,body,key){return this.api.request(path,{method:body===undefined?'GET':'POST',body,auth:false,headers:key?{'Idempotency-Key':key}:{}});}
  apply(r){if(!r||!/^[a-f0-9]{64}$/.test(r.requestId)||!['WAITING_CARD','CARD_READY','WAITING_CASH','PROCESSING',...terminal].includes(r.status))throw Error('自助儲值回應格式不符');if(this.saved.id&&this.saved.id!==r.requestId)throw Error('後端回傳其他工作階段');if(r.amountMinor&&this.saved.amountMinor&&r.amountMinor!==this.saved.amountMinor)throw Error('後端固定金額與本機不同，請先核對原儲值，不重新收款');if(r.status==='CARD_READY')this.saved.amountMinor=null;this.saved.id=r.requestId;this.state=r;this.session={sessionId:r.requestId,stationName:r.stationName||this.session?.stationName,cardNumber:r.cardNumber||this.session?.cardNumber};this.balanceMinor=r.balanceMinor??this.balanceMinor;
   this.stage=({WAITING_CARD:'reading',CARD_READY:this.draft?'confirm':'card',WAITING_CASH:'cash',PROCESSING:'processing',SUCCEEDED:'success',FAILED:'failed',CANCELLED:'cancelled',EXPIRED:'expired'})[r.status];
   if(terminal.has(r.status)){this.pending=null;this.draft=null;this.receipt={...r,requestId:this.saved.id};}else if(this.saved.amountMinor)this.pending={amountMinor:this.saved.amountMinor};this.save();return r;
  }
  async startRequest(){try{const r=await this.call('/kiosk/topups',{},this.saved.key);this.availabilityWait=false;return this.apply(r);}catch(e){this.availabilityWait=['NO_READER_AVAILABLE','READER_BUSY'].includes(e.code);this.stage='unknown';throw e;}}
  async open(){return this.work(async()=>{if(this.saved)throw Error('請先確認或結束原儲值，不建立另一筆');this.saved={key:crypto.randomUUID(),id:null,amountMinor:null};this.save();this.stage='reading';try{await this.startRequest();}catch(e){this.stage='unknown';throw e;}});}
  async recover(){return this.work(async()=>{if(!this.saved){const s=this.storage.getItem(this.storageKey);if(s){const p=JSON.parse(s);if(p){if(typeof p.key!=='string'||p.id&&!/^[a-f0-9]{64}$/.test(p.id))throw Error('本機待確認資料格式不符，請先核對原交易');this.saved=p;}}}if(!this.saved)return;if(this.saved.id)await this.query();else await this.startRequest();});}
  async query(){try{return this.apply(await this.call('/kiosk/topups/'+this.saved.id));}catch(e){this.stage=e.status===404&&!this.saved.amountMinor?'expired':'unknown';throw e;}}
  async poll(){return this.work(async()=>{if(!this.saved)throw Error('尚無儲值工作階段');if(!this.saved.id)return this.startRequest();return this.query();});}
  async balance(){return this.poll();}
  async prepare(value){return this.work(async()=>{if(this.stage!=='card'||!this.session?.cardNumber)throw Error('請先刷卡');this.draft=WalletConsole.amountMinor(value);this.pending={amountMinor:this.draft};this.stage='confirm';});}
  async edit(){if(this.stage!=='confirm'||this.saved.amountMinor)throw Error('金額已送出，不能更改');this.draft=null;this.pending=null;this.stage='card';}
  async submit(){return this.work(async()=>{if(this.stage!=='confirm'||!this.draft)throw Error('請先核對金額');if(this.state.expiresAt&&Date.parse(this.state.expiresAt)<=Date.now())throw Error('儲值已過期，請勿投入金額');this.saved.amountMinor=this.draft;this.save();this.stage='processing';try{this.apply(await this.call('/kiosk/topups/'+this.saved.id+'/amount',{amountMinor:this.saved.amountMinor}));}catch(e){this.stage='unknown';throw e;}});}
  async retryAmount(){return this.work(async()=>{if(!this.saved?.id||!this.saved.amountMinor)throw Error('尚無原金額');this.apply(await this.call('/kiosk/topups/'+this.saved.id+'/amount',{amountMinor:this.saved.amountMinor}));});}
  async cancelRead(){return this.cancel();}
  async cancel(){return this.work(async()=>{if(!this.saved?.id){if(this.availabilityWait){this.saved=null;this.storage.removeItem(this.storageKey);this.availabilityWait=false;this.stage='ready';return;}throw Error('建立結果尚未確認，請先確認原工作階段');}this.apply(await this.call('/kiosk/topups/'+this.saved.id+'/cancel',{}));});}
  async finish(){return this.work(async()=>{if(this.saved?.id&&!terminal.has(this.state?.status)&&this.stage!=='expired')throw Error('請先取消或確認原交易結果');if(this.stage==='unknown')throw Error('結果不明，請先向機台確認，不重新收款');this.saved=null;this.state=null;this.pending=null;this.receipt=null;this.session=null;this.balanceMinor=null;this.draft=null;this.storage.removeItem(this.storageKey);this.stage='ready';});}
 }
 global.WalletConsole.KioskFlow=KioskFlow;
})(window);
