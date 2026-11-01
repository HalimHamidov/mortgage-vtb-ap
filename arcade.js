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
  let player=null;const keys={left:false,right:false,run:false};
  function releaseControls(){keys.left=false;keys.right=false;keys.run=false;}
  function calendarState(){
    const previous=route[passed-1],next=route[passed];
    const from=previous?.date||now,to=next?.date||projection.end;
    const fromTime=Date.parse(from+'T00:00:00Z'),toTime=Date.parse(to+'T00:00:00Z');
    currentDay=player.won?projection.end:new Date(fromTime+Math.floor((toTime-fromTime)/86400000*Math.min(progress,1))*86400000).toISOString().slice(0,10);
    dayState=dailyStates.get(currentDay)||{balance:previous?.balance??projection.initial,extra:previous?.extra||0,extraPaid:0,payment:0};
    if(player.won&&previous)dayState={...dayState,balance:previous.balance,extra:previous.extra||0};
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
    el('arcadeBoost').disabled=!running;el('arcadeLeft').disabled=!running;el('arcadeRight').disabled=!running;
    el('arcadeCoins').textContent=player?player.coins.size+' / '+total:'0';
    el('arcadeRetries').textContent=player?String(player.retries):'0';
    el('arcadeLives').textContent='♥'.repeat(player.lives)+'♡'.repeat(3-player.lives);
    el('arcadeLives').setAttribute('aria-label','Осталось жизней: '+player.lives+' из 3');
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
    const costs=window.summarizePayoff(source,projection,scenario(0));
    el('arcadeSavings').textContent=money(costs.savings/100);
    el('arcadeCostRows').innerHTML=[['Основной долг','principal'],['Проценты','interest'],['Всего выплат','total']].map(([title,key])=>'<tr><th scope="row">'+title+'</th>'+['past','future','lifetime'].map(period=>'<td>'+money(costs[period][key]/100)+'</td>').join('')+'</tr>').join('');
    el('arcadeCashSplit').textContent='Будущие выплаты: по ежемесячному графику '+money(costs.regular/100)+' + дополнительные ежедневные взносы '+money(costs.extra/100)+'. Дополнительные взносы уже включены в итог; они покрывают проценты и основной долг по модели.';
    el('timelineScenario').textContent=dailyAmount?'Расчетный сценарий: +'+money(dailyAmount)+' в '+unit():'Банковский график без новых досрочных взносов';
    el('arcadeTimeline').innerHTML=[...years].map(([year,entries],i)=>'<details'+(i===0?' open':'')+'><summary>'+year+' год <span>'+entries.length+' дат</span></summary><div class="table-wrap"><table><caption class="sr-only">Хронология погашения за '+year+' год</caption><thead><tr><th scope="col">Месяц / дата</th><th scope="col">Плановый взнос</th><th scope="col">Досрочно за интервал</th><th scope="col">Погашено тела за интервал</th><th scope="col">Остаток</th></tr></thead><tbody>'+entries.join('')+'</tbody></table></div></details>').join('');
    el('timelineExpand').textContent='Развернуть годы';
  }
  function reset(){
    projection=scenario(dailyAmount);route=projection.stages;total=route.length;
    dailyStates=new Map((projection.history||[]).map(day=>[day.date,day]));markedStep=-1;
    player=new window.PayoffPlatformer(total);releaseControls();
    document.querySelectorAll('[data-daily]').forEach(button=>{const active=Number(button.dataset.daily)===dailyAmount;button.setAttribute('aria-pressed',String(active));button.classList.toggle('selected',active);});
    el('arcadeComparison').textContent=dailyAmount?money(dailyAmount)+' в '+unit()+': примерно '+projection.monthlyCount+' ежемесячных платежей'+(projection.stages.at(-1)?.finalExtra?' и отдельное досрочное закрытие':'')+' до '+displayDate(projection.end)+'. Без досрочных — '+baseline.length+' платежей.':'Без новых досрочных взносов: '+baseline.length+' платежей до '+displayDate(projection.end)+'.';
    el('arcadeIntro').textContent=dailyAmount?'Дополнительные '+money(dailyAmount)+' в '+unit()+' сокращают расчетный путь: '+total+' препятствий вместо '+baseline.length+'.':'Обычный режим: банковский график без новых досрочных взносов.';
    renderTimeline();
    running=false;started=false;finished=false;passed=0;progress=0;jump=0;boost=0;world=0;sparks=[];last=0;cancelAnimationFrame(frame);stats();message('Платежи — ступеньки. Впереди твой свободный дом!');draw();}
  function start(){if(finished||!started){reset();started=true;}if(!total){win();return;}running=true;last=0;message('Управляй сам: ← → или A/D — ходьба, пробел — прыжок, Shift — бег.');stats();canvas.focus({preventScroll:true});cancelAnimationFrame(frame);frame=requestAnimationFrame(tick);}
  function pause(){if(!started||finished)return;if(running){running=false;releaseControls();cancelAnimationFrame(frame);message('Пауза. Продолжи, когда будешь готов.');stats();draw();}else start();}
  function leap(){if(running)player.jump();}
  function win(){running=false;finished=true;passed=total;releaseControls();cancelAnimationFrame(frame);stats();message('Финиш '+displayDate(projection.end)+'! Долг 0 ₽. Монет собрано: '+player.coins.size+'.');el('arcadeStart').textContent='Еще раз';draw();}
  function tick(time){if(!running)return;const dt=Math.min((time-(last||time))/1000,.05);last=time;
    const previousPassed=passed,previousRetries=player.retries;
    // Substeps keep wall and platform collisions stable at low frame rates.
    let remaining=dt;while(remaining>0){const step=Math.min(remaining,.0125);player.update(step,keys);remaining-=step;}
    passed=player.passed;progress=player.won?0:(player.farthest-passed*300)/300;
    world=player.x/100;
    if(player.retries!==previousRetries)message('Потеряно сердечко. Осталось жизней: '+player.lives+'. Возвращаемся к последнему пройденному платежу.');
    if(player.gameOver){running=false;finished=true;releaseControls();cancelAnimationFrame(frame);stats();message('Жизни закончились. Нажми «Еще раз», чтобы начать с тремя сердечками.');el('arcadeStart').textContent='Еще раз';draw();return;}
    if(player.won){win();return;}
    if(passed!==previousPassed){const completed=route[passed-1];message(displayDate(completed.date)+': этап пройден. Остаток '+money(completed.balance/100)+'.');}
    stats();draw();frame=requestAnimationFrame(tick);
  }
  function round(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
  function label(text,x,y,size=16,color='#173451',align='left'){ctx.fillStyle=color;ctx.font='700 '+size+'px Arial';ctx.textAlign=align;ctx.fillText(text,x,y);}
  function draw(){
    const w=900,h=300,ratio=Math.min(window.devicePixelRatio||1,2);if(canvas.width!==w*ratio){canvas.width=w*ratio;canvas.height=h*ratio;}ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,w,h);
    ctx.fillStyle='#8ed7ff';ctx.fillRect(0,0,w,h);
    const camera=Math.max(0,Math.min(player.x-200,Math.max(0,total*300-680)));
    for(let i=0;i<6;i++){const x=i*210-(camera*.2%210);round(x,80+(i%2)*25,90,24,12,'#fff');}
    ctx.fillStyle='#64bf70';for(let i=0;i<6;i++){const x=i*250-(camera*.4%250);ctx.beginPath();ctx.ellipse(x,250,135,75,0,Math.PI,0);ctx.fill();}
    const first=Math.max(0,Math.floor(camera/300)-1),last=Math.min(total-1,Math.ceil((camera+w)/300));
    for(let i=first;i<=last;i++){
      const pit=player.pit(i),left=i*300-camera;
      const ground=(x,width)=>{ctx.fillStyle='#b6683b';ctx.fillRect(x,250,width,50);ctx.fillStyle='#359a49';ctx.fillRect(x,246,width,7);ctx.strokeStyle='#87472b';for(let xx=x;xx<x+width;xx+=30){ctx.strokeRect(xx,257,Math.min(28,x+width-xx),18);ctx.strokeRect(xx,279,Math.min(28,x+width-xx),18);}};
      if(pit){ground(left,pit.left-i*300);ground(pit.right-camera,(i+1)*300-pit.right);}else ground(left,300);
      const b=player.block(i),x=b.x-camera;round(x,b.y,b.w,b.h,3,i<passed?'#75b77d':'#d99337');ctx.strokeStyle='#814d24';ctx.strokeRect(x+3,b.y+3,b.w-6,b.h-6);label(i<passed?'✓':String(i+1),x+24,b.y+25,18,'#fff','center');
      label(displayDate(route[i].date),x+24,b.y-13,11,'#244d70','center');
      const c=player.coin(i);if(!player.coins.has(i)){ctx.fillStyle='#ffd44a';ctx.beginPath();ctx.ellipse(c.x-camera,c.y,8,12,0,0,Math.PI*2);ctx.fill();label('₽',c.x-camera,c.y+5,13,'#8a5914','center');}
    }
    const goal=total*300-camera;round(goal,250,220,50,0,'#b6683b');round(goal+34,150,4,100,0,'#fff');ctx.fillStyle='#ee6474';ctx.beginPath();ctx.moveTo(goal+38,150);ctx.lineTo(goal+85,165);ctx.lineTo(goal+38,180);ctx.fill();
    round(goal+92,176,76,74,0,'#fff0d1');ctx.fillStyle='#cc6543';ctx.beginPath();ctx.moveTo(goal+83,176);ctx.lineTo(goal+130,135);ctx.lineTo(goal+177,176);ctx.fill();round(goal+121,213,20,37,0,'#3b5479');
    const x=player.x-camera,y=player.y;ctx.fillStyle='#e65346';ctx.fillRect(x+3,y+13,22,16);ctx.fillStyle='#2367bd';ctx.fillRect(x+3,y+26,22,9);ctx.fillStyle='#253b57';ctx.fillRect(x,y+34,12,6);ctx.fillRect(x+17,y+34,12,6);ctx.fillStyle='#f4be8d';ctx.fillRect(x+5,y+1,20,14);ctx.fillRect(x-2,y+18,7,11);ctx.fillRect(x+25,y+18,6,11);ctx.fillStyle='#1768ad';ctx.fillRect(x+2,y-3,23,7);ctx.fillRect(x+2,y+3,30,4);ctx.fillStyle='#263a4d';ctx.fillRect(x+20,y+9,3,3);
    round(12,10,440,45,9,'#ffffffed');label(displayDate(currentDay)+' · '+passed+'/'+total+' платежей · '+player.coins.size+' монет',25,39,17,'#234566');
    label('Финиш '+displayDate(projection.end),884,27,14,'#234566','right');
    label('♥'.repeat(player.lives)+'♡'.repeat(3-player.lives),884,53,24,'#c93154','right');
    if(player.won){
      round(225,64,450,226,16,'#fffaf0');label('ДОМ ТВОЙ. ИПОТЕКА ПРОЙДЕНА!',450,92,19,'#21735b','center');
      round(330,238,80,42,3,'#c5d2e2');round(410,210,80,70,3,'#f4c54b');round(490,249,80,31,3,'#dca17b');
      label('2',370,269,23,'#34516c','center');label('1',450,254,32,'#765013','center');label('3',530,274,21,'#765013','center');
      // Champion on the first-place podium, arms raised around the trophy.
      round(438,184,24,18,0,'#e65346');round(438,199,24,8,0,'#2367bd');round(435,207,13,3,0,'#253b57');round(453,207,13,3,0,'#253b57');
      round(440,172,20,14,0,'#f4be8d');round(436,168,27,6,0,'#1768ad');round(436,174,32,4,0,'#1768ad');
      round(430,159,7,30,0,'#f4be8d');round(463,159,7,30,0,'#f4be8d');
      ctx.strokeStyle='#d69a14';ctx.lineWidth=4;ctx.beginPath();ctx.arc(436,135,9,0,Math.PI*2);ctx.arc(464,135,9,0,Math.PI*2);ctx.stroke();ctx.lineWidth=1;
      round(438,121,24,25,5,'#f4c431');round(447,145,6,12,0,'#d69a14');round(436,157,28,6,2,'#f4c431');label('★',450,139,15,'#fff9d7','center');
    }
    else if(player.gameOver){round(245,72,410,75,12,'#fffaf0');label('Жизни закончились',450,103,24,'#b02b47','center');label('Нажми «Еще раз» — у тебя будет 3 жизни',450,129,15,'#47657c','center');}
    else if(!running){round(245,72,410,65,12,'#ffffffed');label(started?'Пауза':'Твой ход: беги и прыгай!',450,103,22,'#234566','center');label('← →  ·  ПРОБЕЛ  ·  SHIFT',450,124,13,'#47657c','center');}
  }
  // Use the current bank schedule, not a hard-coded number of calendar months.

  el('arcadeStart').onclick=()=>{el('arcadeStart').textContent='Заново';if(started)reset();start();};
  el('arcadePause').onclick=pause;
  function hold(button,key){const node=el(button);node.addEventListener('pointerdown',event=>{event.preventDefault();if(!running)return;node.setPointerCapture(event.pointerId);keys[key]=true;canvas.focus({preventScroll:true});});for(const type of ['pointerup','pointercancel','lostpointercapture'])node.addEventListener(type,()=>keys[key]=false);}
  hold('arcadeLeft','left');hold('arcadeRight','right');hold('arcadeBoost','run');
  el('arcadeJump').addEventListener('pointerdown',event=>{event.preventDefault();canvas.focus({preventScroll:true});leap();});
  el('arcadeJump').addEventListener('click',event=>{if(event.detail===0)leap();});
  canvas.addEventListener('pointerdown',()=>canvas.focus({preventScroll:true}));
  canvas.addEventListener('keydown',event=>{
    const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'run',ShiftRight:'run'};
    if(map[event.code]){event.preventDefault();if(running)keys[map[event.code]]=true;}
    if(['Space','ArrowUp','KeyW'].includes(event.code)){event.preventDefault();if(!event.repeat)leap();}
    if(event.code==='KeyP'&&!event.repeat){event.preventDefault();pause();}
  });
  canvas.addEventListener('keyup',event=>{const map={ArrowLeft:'left',KeyA:'left',ArrowRight:'right',KeyD:'right',ShiftLeft:'run',ShiftRight:'run'};if(map[event.code]){event.preventDefault();keys[map[event.code]]=false;}});
  canvas.addEventListener('blur',releaseControls);window.addEventListener('blur',()=>{releaseControls();if(running)pause();});
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
