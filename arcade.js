'use strict';
(() => {
  const root=document.getElementById('payoffArcade'),canvas=document.getElementById('arcadeCanvas');
  if(!root||!canvas)return;
  const ctx=canvas.getContext('2d'),el=id=>document.getElementById(id);
  const source=window.MORTGAGE,now=source.paymentConfirmationDate||source.updated;
  const payments=source.rows.filter(r=>r.payment>0&&r.date>=now&&!(source.confirmedPaymentNumbers||[]).includes(r.n));
  const baseline=payments,amounts=[0,1000,2000,3000,4000,5000,10000,...Array.from({length:10},(_,i)=>(i+11)*1000)];
  const scenarioCache=new Map();
  let dailyAmount=2000;
  const unit=()=>'день';
  function scenario(amount){const key=amount;if(!scenarioCache.has(key))scenarioCache.set(key,window.projectPayoff(source,amount*100));return scenarioCache.get(key);}
  let projection=scenario(dailyAmount);
  const displayDate=iso=>iso.split('-').reverse().join('.');
  let route=[],total=0,dailyStates=new Map(),currentDay=now,dayState=null,markedStep=-1;
  const money=n=>new Intl.NumberFormat('ru-RU').format(n)+' ₽';
  let running=false,started=false,finished=false,passed=0,progress=0,jump=0,boost=0,last=0,frame=0,world=0,sparks=[];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  function calendarState(){
    const previous=route[passed-1],next=route[passed];
    const from=previous?.date||now,to=next?.date||projection.end;
    const fromTime=Date.parse(from+'T00:00:00Z'),toTime=Date.parse(to+'T00:00:00Z');
    currentDay=finished?projection.end:new Date(fromTime+Math.floor((toTime-fromTime)/86400000*Math.min(progress,1))*86400000).toISOString().slice(0,10);
    dayState=dailyStates.get(currentDay)||{balance:previous?.balance??projection.initial,extra:previous?.extra||0,extraPaid:0,payment:0};
    if(finished&&previous)dayState={...dayState,balance:previous.balance,extra:previous.extra||0};
  }
  function markTimeline(){
    if(markedStep===passed)return;markedStep=passed;
    document.querySelectorAll('#arcadeTimeline [data-step]').forEach(row=>{
      const step=Number(row.dataset.step);
      row.classList.toggle('timeline-done',step<passed);row.classList.toggle('timeline-current',step===passed);
      if(step===passed)row.setAttribute('aria-current','step');else row.removeAttribute('aria-current');
    });
  }
  function stats(){
    calendarState();markTimeline();
    el('arcadeCount').textContent=passed+' / '+total;
    el('arcadeGameDate').textContent=displayDate(currentDay);
    el('arcadeGameFinish').textContent=displayDate(projection.end);
    el('arcadeTodayExtra').textContent=money((dayState.extraPaid||0)/100);
    el('arcadeNextDate').textContent=route[passed]?displayDate(route[passed].date):'Финиш!';
    el('arcadeDaily').textContent=money(dayState.extra/100);
    el('arcadeDebt').textContent=money(dayState.balance/100);
    el('arcadeBar').value=passed;el('arcadeBar').max=Math.max(1,total);
    el('arcadeMonthly').textContent=route[passed]?(route[passed].finalExtra?'Досрочный финиш':money(route[passed].payment/100)):'Все пройдены!';
    el('arcadePause').disabled=!started||finished;
    el('arcadePause').textContent=running?'Пауза':'Продолжить';
    el('arcadeBoost').disabled=!running;
    el('arcadeJump').disabled=!running;
  }
  function message(text){el('arcadeMessage').textContent=text;}
  function renderTimeline(){
    const years=new Map(),formatMonth=iso=>new Date(iso+'T12:00:00Z').toLocaleDateString('ru-RU',{month:'long',timeZone:'Europe/Moscow'});
    let previousExtra=0,previousBalance=projection.initial,previousDate=now;
    for(const [i,r] of route.entries()){
      const year=r.date.slice(0,4),extra=(r.extra||0)-previousExtra,principal=previousBalance-r.balance;
      if(!years.has(year))years.set(year,[]);
      years.get(year).push('<tr data-step="'+i+'"'+(i===route.length-1?' class="timeline-finish"':'')+'><th scope="row">'+formatMonth(r.date)+'<small>'+displayDate(r.date)+(i===route.length-1?' · ФИНИШ':'')+'</small></th><td>'+money(r.payment/100)+'</td><td>'+money(extra/100)+'<small>'+displayDate(previousDate)+' — '+displayDate(r.date)+'</small></td><td>'+money(principal/100)+'</td><td>'+money(r.balance/100)+'</td></tr>');
      previousExtra=r.extra||0;previousBalance=r.balance;previousDate=r.date;
    }
    el('arcadeFinish').textContent=displayDate(projection.end);
    el('arcadeDuration').textContent=projection.monthlyCount+' ежемесячных платежей'+(route.at(-1)?.finalExtra?' + досрочный финиш':'');
    el('timelineScenario').textContent=dailyAmount?'Расчетный сценарий: +'+money(dailyAmount)+' в '+unit():'Банковский график без новых досрочных взносов';
    el('arcadeTimeline').innerHTML=[...years].map(([year,entries],i)=>'<details'+(i===0?' open':'')+'><summary>'+year+' год <span>'+entries.length+' дат</span></summary><div class="table-wrap"><table><caption class="sr-only">Хронология погашения за '+year+' год</caption><thead><tr><th scope="col">Месяц / дата</th><th scope="col">Плановый взнос</th><th scope="col">Досрочно за интервал</th><th scope="col">Погашено тела за интервал</th><th scope="col">Остаток</th></tr></thead><tbody>'+entries.join('')+'</tbody></table></div></details>').join('');
    el('timelineExpand').textContent='Развернуть годы';
  }
  function reset(){
    projection=scenario(dailyAmount);route=projection.stages;total=route.length;
    dailyStates=new Map((projection.history||[]).map(day=>[day.date,day]));markedStep=-1;
    document.querySelectorAll('[data-daily]').forEach(button=>{const active=Number(button.dataset.daily)===dailyAmount;button.setAttribute('aria-pressed',String(active));button.classList.toggle('selected',active);});
    el('arcadeComparison').textContent=dailyAmount?money(dailyAmount)+' в '+unit()+': примерно '+projection.monthlyCount+' ежемесячных платежей'+(projection.stages.at(-1)?.finalExtra?' и отдельное досрочное закрытие':'')+' до '+displayDate(projection.end)+'. Без досрочных — '+baseline.length+' платежей.':'Без новых досрочных взносов: '+baseline.length+' платежей до '+displayDate(projection.end)+'.';
    el('arcadeIntro').textContent=dailyAmount?'Дополнительные '+money(dailyAmount)+' в '+unit()+' сокращают расчетный путь: '+total+' препятствий вместо '+baseline.length+'.':'Обычный режим: банковский график без новых досрочных взносов.';
    renderTimeline();
    running=false;started=false;finished=false;passed=0;progress=0;jump=0;boost=0;world=0;sparks=[];last=0;cancelAnimationFrame(frame);stats();message('Платежи — ступеньки. Впереди твой свободный дом!');draw();}
  function start(){if(finished||!started){reset();started=true;}if(!total){win();return;}running=true;last=0;message('Бежим легко! Ежемесячный платеж — прыжок. Выбранный режим определяет длину пути.');stats();cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}
  function pause(){if(!started||finished)return;if(running){running=false;cancelAnimationFrame(frame);message('Передышка. Прогресс сохранен до конца этой игры.');stats();draw();}else start();}
  function leap(){if(!running)return;jump=1;boost=Math.max(boost,.5);draw();}
  function turbo(){if(!running)return;boost=2.5;jump=1;message('Быстрый просмотр! Расчетный путь не меняется.');draw();}
  function win(){running=false;finished=true;passed=total;cancelAnimationFrame(frame);stats();message('Финиш '+displayDate(projection.end)+'! Остаток 0 ₽. Пройдено '+total+' этапов — ты справился!');el('arcadeStart').textContent='Еще раз';draw();}
  function tick(time){if(!running)return;const dt=Math.min((time-(last||time))/1000,.05);last=time;
    const speed=boost>0?2:1;
    world+=dt*speed;boost=Math.max(0,boost-dt);jump=Math.max(0,jump-dt*2);
    progress+=dt*speed/1.15;
    // Friendly automatic jumps: no lost lives, missed payments or financial actions.
    if(progress>.65&&jump===0)jump=.9;
    if(progress>=1){progress-=1;passed++;jump=1;
      if(!reduced)for(let i=0;i<9;i++)sparks.push({x:185,y:180,vx:40+Math.random()*120,vy:-100-Math.random()*100,life:.7});
      if(passed>=total){win();return;}
      const completed=route[passed-1];message(displayDate(completed.date)+': платеж '+money(completed.payment/100)+' пройден. Остаток '+money(completed.balance/100)+'.');
    }
    sparks=sparks.filter(p=>(p.life-=dt)>0);for(const p of sparks){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=300*dt;}
    stats();draw();frame=requestAnimationFrame(tick);
  }
  function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function label(text,x,y,size=16,color='#173451',align='left'){ctx.fillStyle=color;ctx.font='700 '+size+'px Arial';ctx.textAlign=align;ctx.fillText(text,x,y);}
  function draw(){
    const w=900,h=300,ratio=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==w*ratio){canvas.width=w*ratio;canvas.height=h*ratio;}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    const sky=ctx.createLinearGradient(0,0,0,h);sky.addColorStop(0,'#dff6ff');sky.addColorStop(1,'#fff8db');ctx.fillStyle=sky;ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#ffd46b';ctx.beginPath();ctx.arc(745,58,31,0,Math.PI*2);ctx.fill();
    for(let i=0;i<5;i++){const x=(i*240-world*12)%1200;round(x,70+(i%2)*25,100,24,12,'#ffffffb8');}
    ctx.fillStyle='#b4dfca';ctx.beginPath();ctx.moveTo(0,248);ctx.quadraticCurveTo(210,105,450,248);ctx.quadraticCurveTo(650,145,900,238);ctx.lineTo(900,300);ctx.lineTo(0,300);ctx.fill();
    round(0,246,900,54,0,'#274f54');round(0,242,900,6,0,'#75bf86');
    for(let i=0;i<18;i++)round((i*65-world*100)%1000,270,26,3,1,'#75a794');
    round(18,15,300,48,12,'#ffffffdf');label(new Date(currentDay+'T12:00:00Z').toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'Europe/Moscow'}),32,44,19,'#214d6c');
    label('Финиш '+displayDate(projection.end),875,25,14,'#214d6c','right');
    // The destination stays visible throughout the run.
    round(785,164,64,77,5,'#fff6df');ctx.fillStyle='#df8259';ctx.beginPath();ctx.moveTo(774,165);ctx.lineTo(817,126);ctx.lineTo(861,165);ctx.fill();round(810,199,19,42,3,'#335d77');round(793,179,13,14,2,'#8dd7e8');label('МОЙ ДОМ',817,116,13,'#2c6561','center');
    const x=650-progress*490;
    if(!finished&&total){round(x,196,70,46,7,'#4775db');label(String(passed+1),x+35,224,20,'white','center');label(route[passed].finalExtra?'досрочный финиш':displayDate(route[passed].date),x+35,186,12,'#31598a','center');}
    if(dailyAmount>0&&!finished){for(let i=0;i<4;i++){const cx=270+i*110-(world*95%110);ctx.fillStyle='#ffcb59';ctx.beginPath();ctx.arc(cx,142,13,0,Math.PI*2);ctx.fill();label('₽',cx,147,16,'#8f5b10','center');}label('+'+money(dailyAmount)+' / '+unit(),450,99,16,'#806017','center');}
    const heroX=finished?741:145,heroY=215-Math.sin(jump*Math.PI/2)*65;
    if(boost>0&&!reduced){for(let i=0;i<3;i++)round(heroX-40-i*17,heroY+7+i*8,35,4,2,'#f0a62f');}
    ctx.fillStyle='#f0b98a';ctx.beginPath();ctx.arc(heroX+15,heroY-29,13,0,Math.PI*2);ctx.fill();round(heroX+2,heroY-50,27,10,5,'#233851');round(heroX,heroY-15,30,33,7,'#1266c9');
    ctx.strokeStyle='#233851';ctx.lineWidth=7;ctx.lineCap='round';ctx.beginPath();ctx.moveTo(heroX+8,heroY+16);ctx.lineTo(heroX+3+(running?Math.sin(world*18)*7:0),heroY+28);ctx.moveTo(heroX+22,heroY+16);ctx.lineTo(heroX+30,heroY+26);ctx.stroke();
    ctx.strokeStyle='#f0b98a';ctx.beginPath();ctx.moveTo(heroX+27,heroY-7);ctx.lineTo(heroX+41,heroY-22);ctx.stroke();
    for(const p of sparks){ctx.globalAlpha=p.life/.7;round(p.x,p.y,6,6,2,'#f5b82e');}ctx.globalAlpha=1;
    if(finished){round(240,28,420,64,16,'#fffef4');label('ИПОТЕКА ПРОЙДЕНА!',450,68,26,'#21735b','center');}
    else if(!running){round(262,35,376,55,14,'#ffffffdf');label(started?'Пауза. Ты уже на пути!':total+' шагов? Легко. По одному!',450,69,21,'#214d6c','center');}
  }
  // Use the current bank schedule, not a hard-coded number of calendar months.

  el('arcadeStart').onclick=()=>{el('arcadeStart').textContent='Заново';if(started)reset();start();};
  el('arcadePause').onclick=pause;el('arcadeJump').onclick=leap;el('arcadeBoost').onclick=turbo;
  canvas.addEventListener('pointerdown',()=>{canvas.focus();if(!started)start();else leap();});
  canvas.addEventListener('keydown',event=>{if(event.code==='Space'||event.code==='ArrowUp'){event.preventDefault();if(!started)start();else leap();}if(event.code==='KeyP'){event.preventDefault();pause();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)pause();});
  new IntersectionObserver(entries=>{if(!entries[0].isIntersecting&&running)pause();},{threshold:0}).observe(root);
  function renderModes(){
    el('arcadeModes').innerHTML=amounts.map(amount=>{const p=scenario(amount);return '<button type="button" data-daily="'+amount+'" aria-pressed="'+(amount===dailyAmount)+'">'+(amount?money(amount)+' / '+unit():'Обычный')+'<small>'+p.monthlyCount+' ежемес. платежей'+(p.stages.at(-1)?.finalExtra?' + финиш':'')+'</small></button>';}).join('');
    document.querySelectorAll('[data-daily]').forEach(button=>button.onclick=()=>{dailyAmount=Number(button.dataset.daily);reset();el('arcadeStart').textContent='Начать путь';});
  }
  el('timelineExpand').onclick=()=>{const all=[...el('arcadeTimeline').querySelectorAll('details')],open=all.some(d=>!d.open);all.forEach(d=>d.open=open);el('timelineExpand').textContent=open?'Свернуть годы':'Развернуть годы';};
  renderModes();
  reset();
})();
