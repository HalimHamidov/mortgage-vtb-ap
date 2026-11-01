'use strict';
// Deterministic side-scrolling physics; the financial projection stays read-only.
window.PayoffPlatformer=class {
  constructor(count){this.count=count;this.ground=250;this.width=28;this.height=40;this.x=24;this.y=210;this.vy=0;this.onGround=true;this.farthest=0;this.passed=0;this.coins=new Set();this.retries=0;this.won=count===0;this.stepWidth=300;}
  block(i){return {x:i*300+155,y:this.ground-(38+(i%3)*12),w:48,h:38+(i%3)*12};}
  pit(i){return i%7===6&&i%3!==2?{left:i*300+230,right:i*300+272}:null;}
  coin(i){const b=this.block(i);return {x:b.x+b.w/2,y:b.y-30};}
  lives=3;
  gameOver=false;
  jump(){if(this.onGround&&!this.won&&!this.gameOver){this.vy=-490;this.onGround=false;return true;}return false;}
  update(dt,keys){
    if(this.won||this.gameOver)return;
    dt=Math.max(0,Math.min(dt,.025));const oldX=this.x,oldY=this.y;
    const direction=(keys.right?1:0)-(keys.left?1:0),speed=keys.run?300:220;
    this.x=Math.max(0,Math.min(this.count*300+24,this.x+direction*speed*dt));
    const first=Math.max(0,Math.floor(Math.min(oldX,this.x)/300)-1),last=Math.min(this.count-1,Math.floor(Math.max(oldX,this.x)/300)+1);
    for(let i=first;i<=last;i++){const b=this.block(i);if(this.y+this.height>b.y+.1&&this.y<b.y+b.h&&this.x+this.width>b.x&&this.x<b.x+b.w){if(direction>0)this.x=b.x-this.width;else if(direction<0)this.x=b.x+b.w;}}
    this.vy+=1300*dt;this.y+=this.vy*dt;this.onGround=false;
    for(let i=first;i<=last;i++){const b=this.block(i);if(this.x+this.width>b.x&&this.x<b.x+b.w){if(this.vy>=0&&oldY+this.height<=b.y+.5&&this.y+this.height>=b.y){this.y=b.y-this.height;this.vy=0;this.onGround=true;}else if(this.vy<0&&oldY>=b.y+b.h&&this.y<=b.y+b.h){this.y=b.y+b.h;this.vy=0;}}}
    const center=this.x+this.width/2,stage=Math.min(this.count-1,Math.floor(center/300)),pit=this.pit(stage),inPit=pit&&center>pit.left&&center<pit.right;
    if(!inPit&&this.y+this.height>=this.ground&&oldY+this.height<=this.ground+.5){this.y=this.ground-this.height;this.vy=0;this.onGround=true;}
    if(this.y>360){this.retries++;this.lives--;this.gameOver=this.lives===0;this.x=this.passed*300+24;this.y=this.ground-this.height;this.vy=0;this.onGround=true;return;}
    for(let i=first;i<=last;i++){const c=this.coin(i);if(!this.coins.has(i)&&this.x<c.x+11&&this.x+this.width>c.x-11&&this.y<c.y+11&&this.y+this.height>c.y-11)this.coins.add(i);}
    if(this.y+this.height<=this.ground+1){this.farthest=Math.max(this.farthest,this.x-24);this.passed=Math.min(this.count,Math.floor(this.farthest/300));}
    if(this.passed===this.count)this.won=true;
  }
};
