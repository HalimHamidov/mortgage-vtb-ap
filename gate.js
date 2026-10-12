'use strict';
(() => {
  const gate=document.getElementById('pinGate'),app=document.getElementById('app'),pin=document.getElementById('pin'),error=document.getElementById('pinError');
  const key='vtb-ap-unlocked-v1';
  const pinHash='8f7fe557bf81f8ce973f01d29924684e716a2847f9699d59138de16d10eeb873';
  function storage(value){try{if(value===undefined)return sessionStorage.getItem(key);if(value)sessionStorage.setItem(key,'yes');else sessionStorage.removeItem(key)}catch{/* Entry still works when browser storage is disabled. */}}
  function unlock(){gate.hidden=true;app.hidden=false;pin.value='';error.textContent='';window.dispatchEvent(new Event('resize'));document.getElementById('logout').focus()}
  if(storage()==='yes')unlock();
  document.getElementById('pinForm').addEventListener('submit',async event=>{
    event.preventDefault();const button=document.getElementById('unlock');button.disabled=true;
    try{
      const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(pin.value));
      const hash=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');
      if(hash===pinHash){storage(true);unlock()}else{error.textContent='Неверный PIN-код. Попробуйте ещё раз.';pin.value='';pin.focus()}
    }catch{error.textContent='Не удалось проверить PIN-код. Откройте сайт по HTTPS.'}
    finally{button.disabled=false}
  });
  document.getElementById('logout').onclick=()=>{storage(false);app.hidden=true;gate.hidden=false;pin.value='';error.textContent='';window.scrollTo(0,0);pin.focus()};
})();
