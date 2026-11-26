(function(global){
class LiveClient{
 constructor(base='https://steps-twins-did-interpretation.trycloudflare.com/api/v1'){this.base=base;this.session=null;}
 async call(path,{method='GET',body,auth=true,raw=false,headers:extra={}}={}){
  const headers={Accept:'application/json',...extra};if(auth){if(!this.session)throw Error('請重新登入');headers.Authorization='Bearer '+this.session.accessToken;}if(body!==undefined)headers['Content-Type']='application/json';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const r=await fetch(this.base+path,{method,headers,body:body===undefined?undefined:JSON.stringify(body),credentials:'omit',redirect:'error',cache:'no-store',signal:controller.signal});if(r.ok&&r.status===204)return null;const data=await r.json();if(!r.ok){const e=Error(data.error?.message||'操作未完成');e.code=data.error?.code;e.status=r.status;e.data=data.data;throw e;}if(raw)return data;if(!Object.hasOwn(data,'data'))throw Error('回應資料不完整');return data.data;
  }catch(e){if(e.status)throw e;const error=Error('連線中斷，結果尚未確認。請先確認原操作，不要重複送出。');error.uncertain=true;throw error;}finally{clearTimeout(timer);}
 }
}
global.LiveClient=LiveClient;
})(window);
