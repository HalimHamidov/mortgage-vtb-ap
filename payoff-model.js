'use strict';
// Illustrative cash-flow projection, not a replacement for the bank schedule.
window.projectPayoff = function(source,dailyExtra=200000){
  if(!Number.isInteger(dailyExtra)||dailyExtra<0)throw new Error('Daily payment must be nonnegative integer kopecks');
  const asof=source.paymentConfirmationDate||source.updated;
  const confirmed=source.confirmedPaymentNumbers||[];
  const past=source.rows.filter(r=>r.date<asof||(r.date===asof&&confirmed.includes(r.n)));
  const future=source.rows.filter(r=>r.payment>0&&r.date>=asof&&!confirmed.includes(r.n));
  let balance=past.length?past.at(-1).balance:source.initial;
  if(!future.length||balance<=0)return {stages:[],monthlyCount:0,extra:0,end:asof,initial:balance};
  const initial=balance,rate=source.rate/100,regular=future[0].payment;
  if(dailyExtra===0)return {stages:future.map(r=>({...r,extra:0})),monthlyCount:future.length,extra:0,end:future.at(-1).date,initial};
  const annualDays=d=>new Date(Date.UTC(d.getUTCFullYear(),1,29)).getUTCMonth()===1?366:365;
  const nextDay=d=>new Date(d.getTime()+86400000),iso=d=>d.toISOString().slice(0,10);
  const start=new Date(asof+'T00:00:00Z');
  // Preserve interest already accrued before the snapshot using the first bank payment.
  let remainingAccrual=0;
  for(let d=nextDay(start);iso(d)<=future[0].date;d=nextDay(d))remainingAccrual+=balance*rate/annualDays(d);
  let interest=Math.max(0,future[0].interest-remainingAccrual);
  let extra=0,monthlyCount=0,monthlyPaid=0,stages=[];
  const history=[{date:asof,balance,extra:0,extraPaid:0,payment:0}];
  const due=new Set(future.map(r=>r.date));
  function pay(budget){const charge=Math.min(budget,Math.round(interest));interest=Math.max(0,interest-charge);const principal=Math.min(balance,budget-charge);balance-=principal;return charge+principal;}
  for(let d=nextDay(start),i=0;i<365*50;i++,d=nextDay(d)){
    interest+=balance*rate/annualDays(d);
    const extraPaid=dailyExtra>0?pay(dailyExtra):0;extra+=extraPaid;
    let payment=0;
    if(balance+Math.round(interest)>0&&due.has(iso(d))){payment=pay(regular);monthlyPaid+=payment;monthlyCount++;}
    const done=balance===0&&Math.round(interest)===0;
    history.push({date:iso(d),balance,extra,extraPaid,payment});
    if(payment>0||done)stages.push({date:iso(d),payment,balance,extra,monthlyPaid,finalExtra:done&&payment===0});
    if(done)return {stages,history,monthlyCount,extra,end:iso(d),initial};
  }
  throw new Error('Payoff projection did not converge');
};
