'use strict';
const data=window.MORTGAGE, rows=data.rows, $=id=>document.getElementById(id);
const rub=cents=>new Intl.NumberFormat('ru-RU',{style:'currency',currency:'RUB',minimumFractionDigits:2}).format(cents/100);
const date=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{timeZone:'Europe/Moscow'});
const today=()=>new Intl.DateTimeFormat('sv-SE',{timeZone:'Europe/Moscow',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
let page=0, mode='balance', selected=0, filtered=[], nextRow;
const pageSize=15;
function sum(list,key){return list.reduce((s,r)=>s+r[key],0)}
function asof(){return $('asof').value||data.updated}
function summary(){
  const prior=rows.filter(r=>r.date<asof()), balance=prior.length?prior.at(-1).balance:data.initial;
  $('balance').textContent=rub(balance);const percent=(1-balance/data.initial)*100;
  $('progress').style.width=percent+'%';$('progressText').textContent=`Погашено основного долга: ${rub(data.initial-balance)} · ${percent.toFixed(1).replace('.',',')}%`;
  nextRow=rows.find(r=>r.date>=asof()&&r.payment>0);
  $('nextLabel').textContent=nextRow?'Ближайший платёж по графику':'График погашения завершён';
  $('nextAmount').textContent=nextRow?rub(nextRow.payment):rub(0);
  $('nextDate').textContent=nextRow?date(nextRow.date)+(nextRow.start!==nextRow.date?' · перенесён с '+date(nextRow.start):''):'Ненулевых платежей после выбранной даты нет';
  $('nextPrincipal').textContent=rub(nextRow?.principal||0);$('nextInterest').textContent=rub(nextRow?.interest||0);$('goNext').disabled=!nextRow;
}
function renderTable(){
  const query=$('search').value.trim().toLowerCase().replace(/^№\s*/,''), year=$('year').value, period=$('period').value;
  filtered=rows.filter(r=>(year==='all'||r.date.startsWith(year))&&(period==='all'||(period==='future'?r.date>=asof():r.date<asof()))&&(!query||date(r.date).includes(query)||r.date.includes(query)||String(r.n)===query||date(r.start).includes(query)));
  const pages=Math.max(1,Math.ceil(filtered.length/pageSize));page=Math.min(page,pages-1);
  $('rows').innerHTML=filtered.slice(page*pageSize,(page+1)*pageSize).map(r=>`<tr class="${r.n===rows[selected].n?'active':''}"><td>${r.n}</td><td>${date(r.date)}${r.start!==r.date?'<small>с '+date(r.start)+'</small>':''}</td><td><strong>${rub(r.payment).replace(/\s*₽/,'')}</strong></td><td>${rub(r.principal).replace(/\s*₽/,'')}</td><td>${rub(r.interest).replace(/\s*₽/,'')}</td><td>${rub(r.balance).replace(/\s*₽/,'')}</td></tr>`).join('');
  $('tableSummary').textContent=`${filtered.length} строк · платежи ${rub(sum(filtered,'payment'))} · проценты ${rub(sum(filtered,'interest'))}`;
  $('pageInfo').textContent=`Страница ${page+1} из ${pages}`;$('prev').disabled=page===0;$('next').disabled=page>=pages-1;$('empty').hidden=filtered.length>0;
}
function renderChart(){
  const w=Math.max(300,$('chart').clientWidth-22),h=260,left=72,right=w-16,top=15,bottom=226;
  let content='';
  if(mode==='balance'){
    const start=Date.parse('2024-08-12'),end=Date.parse(rows.at(-1).date), x=r=>left+(Date.parse(r.date)-start)/(end-start)*(right-left),y=b=>bottom-b/data.initial*(bottom-top);
    for(let i=0;i<=3;i++){const yy=top+(bottom-top)*i/3;content+=`<line x1="${left}" y1="${yy}" x2="${right}" y2="${yy}" stroke="#e7edf7"/><text x="4" y="${yy+4}" fill="#647187" font-size="12">${((data.initial/100)*(1-i/3)/1e6).toFixed(1).replace('.',',')} млн</text>`;}
    const points=[[left,y(data.initial)],...rows.map(r=>[x(r),y(r.balance)])];const path=points.map(([xx,yy],i)=>(i?'L':'M')+xx+','+yy).join(' ');
    content+=`<path d="${path} L${right},${bottom} L${left},${bottom} Z" fill="#edf2ff"/><path d="${path}" fill="none" stroke="#143fce" stroke-width="3"/><line x1="${x(rows[selected])}" y1="${top}" x2="${x(rows[selected])}" y2="${bottom}" stroke="#8cacef" stroke-dasharray="4 4"/><circle cx="${x(rows[selected])}" cy="${y(rows[selected].balance)}" r="6" fill="#143fce" stroke="white" stroke-width="3"/>`;
    $('chartLegend').textContent='Остаток после платежа · ₽';
  }else{
    const years=[...new Set(rows.map(r=>r.date.slice(0,4)))],groups=years.map(year=>{const list=rows.filter(r=>r.date.startsWith(year));return {year,p:sum(list,'principal'),i:sum(list,'interest')}}),max=Math.max(...groups.map(g=>g.p+g.i));
    const bw=(right-left)/groups.length;
    groups.forEach((g,i)=>{const xx=left+i*bw,ph=g.p/max*(bottom-top),ih=g.i/max*(bottom-top);content+=`<rect x="${xx}" y="${bottom-ph}" width="${Math.max(2,bw*.75)}" height="${ph}" fill="#143fce"><title>${g.year}: основной долг ${rub(g.p)}</title></rect><rect x="${xx}" y="${bottom-ph-ih}" width="${Math.max(2,bw*.75)}" height="${ih}" fill="#9cb5ee"><title>${g.year}: проценты ${rub(g.i)}</title></rect>`;if(i%(w<600?6:4)===0)content+=`<text x="${xx}" y="250" fill="#647187" font-size="12">${g.year}</text>`});
    $('chartLegend').textContent='Синий — основной долг · светлый — проценты';
  }
  $('chart').innerHTML=`<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${mode==='balance'?'Остаток долга с 2024 по 2044 год':'Основной долг и проценты по годам'}">${content}</svg>`;
}
function selection(){const r=rows[selected];$('cursor').value=selected;$('cursorLabel').textContent=`№ ${r.n} · ${date(r.date)}`;$('detail').innerHTML=[['Платёж',r.payment],['В основной долг',r.principal],['Проценты',r.interest],['Остаток после платежа',r.balance]].map(([label,val])=>`<div>${label}<strong>${rub(val)}</strong></div>`).join('');renderChart();renderTable()}
$('initial').textContent=rub(data.initial);$('allInterest').textContent=rub(sum(rows,'interest'));$('end').textContent=date(rows.filter(r=>r.payment>0).at(-1).date);
$('asof').value=today();[...new Set(rows.map(r=>r.date.slice(0,4)))].forEach(y=>$('year').add(new Option(y,y)));
selected=Math.max(0,rows.findIndex(r=>r.date>=asof()&&r.payment>0));summary();selection();
$('asof').addEventListener('change',()=>{if(!$('asof').value)$('asof').value=data.updated;page=0;summary();renderTable()});
$('today').onclick=()=>{$('asof').value=today();page=0;summary();renderTable()};
$('cursor').oninput=()=>{selected=Number($('cursor').value);selection()};
['period','year','search'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;renderTable()}));
$('reset').onclick=()=>{$('period').value='all';$('year').value='all';$('search').value='';page=0;renderTable()};
$('prev').onclick=()=>{page--;renderTable()};$('next').onclick=()=>{page++;renderTable()};
$('goNext').onclick=()=>{if(!nextRow)return;selected=rows.indexOf(nextRow);$('period').value='future';$('year').value='all';$('search').value='';page=0;selection();$('schedule').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'})};
['chartBalance','chartPayments'].forEach((id,i)=>$(id).onclick=()=>{mode=i?'payments':'balance';['chartBalance','chartPayments'].forEach(other=>{$(other).classList.toggle('selected',other===id);$(other).setAttribute('aria-pressed',String(other===id))});renderChart()});
$('export').onclick=()=>{const header=['Номер','Начальная дата','Дата платежа','Платеж RUB','Основной долг RUB','Проценты RUB','Остаток RUB'];const lines=filtered.map(r=>[r.n,date(r.start),date(r.date),...[r.payment,r.principal,r.interest,r.balance].map(c=>(c/100).toFixed(2).replace('.',','))].join(';'));const url=URL.createObjectURL(new Blob(['\ufeff'+[header.join(';'),...lines].join('\r\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='vtb-ap-'+asof()+'.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)};
window.addEventListener('resize',renderChart);
