(() => {
"use strict";
const W=720,H=1080,TAU=Math.PI*2,KEY="luckyReelsSpaceArcadeV1";
const $=id=>document.getElementById(id);
const canvas=$("screen"),ctx=canvas.getContext("2d");
if(!ctx){$("status").textContent="This browser does not support the game canvas.";return;}
const rand=(a,b)=>a+Math.random()*(b-a);
const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
const distance2=(a,b)=>{const x=a.x-b.x,y=a.y-b.y;return x*x+y*y;};
const keys={left:false,right:false,thrust:false,fire:false};
let game="asteroids",data={},running=false,paused=false,last=0,clock=0,frame=0,raf=0,shots=[],rocks=[],enemies=[],enemyShots=[],particles=[],stars=[],ship={},enemyDir=1,enemyFire=0,shootCooldown=0,screenFlash=0,soundOn=true;
let highScores={asteroids:0,galaxy:0},audio=null;
try{const stored=JSON.parse(localStorage.getItem(KEY)||"{}");if(stored.highScores){for(const name of ["asteroids","galaxy"]){const n=Number(stored.highScores[name]);if(Number.isFinite(n)&&n>0)highScores[name]=Math.floor(n);}}soundOn=stored.soundOn!==false;}catch{}
function save(){try{localStorage.setItem(KEY,JSON.stringify({highScores,soundOn}));}catch{}}
function sound(freq=460,duration=.06,type="sine",volume=.025){if(!soundOn)return;try{const C=window.AudioContext||window.webkitAudioContext;if(!C)return;audio=audio||new C();if(audio.state==="suspended")audio.resume();const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime;osc.type=type;osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(volume,t);gain.gain.exponentialRampToValueAtTime(.0001,t+duration);osc.connect(gain);gain.connect(audio.destination);osc.start(t);osc.stop(t+duration+.01);}catch{}}
const limit2=(a,b,r)=>distance2(a,b)<r*r;
function clearControls(){for(const k in keys)keys[k]=false;document.querySelectorAll(".ctrl").forEach(x=>x.classList.remove("pressed"));}
function status(s){$("status").textContent=s;}
function score(n){data.score+=n;if(data.score>highScores[game]){highScores[game]=data.score;save();}$("score").textContent=data.score.toLocaleString("en-US");$("best").textContent=highScores[game].toLocaleString("en-US");}
function updateHUD(){$("score").textContent=(data.score||0).toLocaleString("en-US");$("best").textContent=highScores[game].toLocaleString("en-US");$("lives").textContent="♥ ".repeat(data.lives||0).trim()||"—";$("wave").textContent=String(data.wave||1);}
function overlay(icon,title,text,button){$("overlayIcon").textContent=icon;$("overlayTitle").textContent=title;$("overlayText").textContent=text;$("startBtn").textContent=button;$("overlay").hidden=false;}
function hideOverlay(){$("overlay").hidden=true;}
function resetWorld(){
 document.body.classList.remove("game-active");
 running=false;paused=false;clearControls();data={score:0,lives:game==="asteroids"?6:3,wave:1};shots=[];rocks=[];enemyShots=[];enemies=[];particles=[];ship={x:W/2,y:H*.75,vx:0,vy:0,angle:-Math.PI/2,invuln:0};enemyDir=1;enemyFire=1;shootCooldown=0;screenFlash=0;
 $("pauseBtn").disabled=true;$("pauseBtn").textContent="Pause";$("helpText").textContent=game==="asteroids"?"Hold ◀ / ▶ to rotate, THRUST to fly, and FIRE to shoot. Keyboard: ← → ↑ Space.":"Hold ◀ / ▶ to dodge the aliens. Hold FIRE to blast them. Keyboard: ← → and Space.";
 $("launchBar").hidden=false;
 $("quickStartBtn").textContent=game==="galaxy"?"▶ PLAY GALAXY DEFENDER":"▶ PLAY ASTEROID RUN";
 $("thrustBtn").hidden=game==="galaxy";
 document.querySelector(".controls").classList.toggle("galaxy-controls",game==="galaxy");
 $("asteroidsMode").classList.toggle("active",game==="asteroids");$("galaxyMode").classList.toggle("active",game==="galaxy");
 $("asteroidsMode").setAttribute("aria-pressed",String(game==="asteroids"));$("galaxyMode").setAttribute("aria-pressed",String(game==="galaxy"));
 updateHUD();status("Ready for launch.");
 overlay(game==="asteroids"?"☄️":"👾",game==="asteroids"?"ASTEROID RUN":"GALAXY DEFENDER",game==="asteroids"?"Survive asteroid waves. Rotate, thrust, and blast rocks into pieces. Watch out for collisions!":"Dodge alien fire, shoot down the invaders, and survive faster waves.","▶ START GAME");
}
function setGame(next){if(next!=="asteroids"&&next!=="galaxy")return;game=next;try{history.replaceState(null,"",location.pathname+"?game="+game+location.hash);}catch{}resetWorld();sound(480,.07);}
function burst(x,y,color,count=13,power=120){
 for(let i=0;i<count;i++){const a=rand(0,TAU),v=rand(25,power);particles.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rand(.2,.8),max:.8,color,r:rand(2,5)});}
 if(particles.length>210)particles.splice(0,particles.length-210);
}
function newRock(size,x,y){
 const r=size===3?65:size===2?39:21;
 let pos={x:x??rand(40,W-40),y:y??rand(60,H-60)};
 if(x===undefined){for(let t=0;t<30&&limit2(pos,ship,215+r);t++)pos={x:rand(r,W-r),y:rand(r,H-r)};}
 // Relaxed asteroid movement, with a gentle increase on later waves.
 const a=rand(0,TAU),speed=rand(9,17)+Math.min(8,data.wave-1)*1.5+(3-size)*3;
 const edges=Array.from({length:11},()=>rand(.72,1.16));
 rocks.push({...pos,size,r,vx:Math.cos(a)*speed,vy:Math.sin(a)*speed,angle:rand(0,TAU),spin:rand(-.38,.38),edges});
}
function startAsteroidsWave(){for(let n=0;n<Math.min(6,1+data.wave);n++)newRock(3);status("Wave "+data.wave+" — easy pace. Take your time!");}
function startGalaxyWave(){
 enemies=[];enemyShots=[];shots=[];enemyDir=1;enemyFire=1.1;
 const cols=7,rows=4,dx=82,dy=67,offset=(W-(cols-1)*dx)/2;
 for(let row=0;row<rows;row++)for(let col=0;col<cols;col++)enemies.push({x:offset+col*dx,y:115+row*dy,row,col,alive:true,phase:rand(0,TAU)});
 status("Wave "+data.wave+" — defend the galaxy!");
}
function startGame(){
 running=true;paused=false;data={score:0,lives:game==="asteroids"?6:3,wave:1};shots=[];rocks=[];enemyShots=[];particles=[];
 ship={x:W/2,y:H-140,vx:0,vy:0,angle:-Math.PI/2,invuln:game==="asteroids"?6:2};
 shootCooldown=0;screenFlash=0;clearControls();$("pauseBtn").disabled=false;$("pauseBtn").textContent="Pause";
 if(game==="asteroids")startAsteroidsWave();else startGalaxyWave();
 $("launchBar").hidden=true;
 document.body.classList.add("game-active");
 updateHUD();hideOverlay();canvas.focus({preventScroll:true});sound(750,.19,"sawtooth",.013);
}
function endGame(){
 running=false;paused=false;clearControls();$("pauseBtn").disabled=true;updateHUD();sound(170,.45,"sawtooth",.03);
 $("launchBar").hidden=false;$("quickStartBtn").textContent="↻ PLAY AGAIN";
 overlay("🏁","MISSION OVER","You scored "+data.score.toLocaleString("en-US")+" points across "+data.wave+" wave(s). Best: "+highScores[game].toLocaleString("en-US")+".","↻ PLAY AGAIN");status("Game over — go for a new high score!");
}
function pauseGame(){
 if(!running)return;paused=true;clearControls();$("pauseBtn").textContent="Resume";
 $("launchBar").hidden=false;$("quickStartBtn").textContent="▶ RESUME GAME";
 overlay("⏸️","PAUSED","Your mission is paused. Resume whenever you're ready.","▶ RESUME GAME");status("Paused");
}
function resumeGame(){paused=false;document.body.classList.add("game-active");$("launchBar").hidden=true;last=performance.now();$("pauseBtn").textContent="Pause";hideOverlay();canvas.focus({preventScroll:true});status("Mission resumed!");}
function loseLife(){
 if(ship.invuln>0||!running)return;
 data.lives--;screenFlash=.35;burst(ship.x,ship.y,"#ff7d9d",27,210);sound(165,.3,"triangle",.05);updateHUD();
 if(data.lives<=0){endGame();return;}
 ship.x=W/2;ship.y=game==="asteroids"?H*.73:H-140;ship.vx=0;ship.vy=0;ship.invuln=game==="asteroids"?5:2.6;status(data.lives+" lives left — keep fighting!");
}
function fire(){
 if(!running||paused||shootCooldown>0)return;
 shootCooldown=game==="asteroids"?.20:.21;
 if(game==="asteroids"){
   const fx=Math.cos(ship.angle),fy=Math.sin(ship.angle);
   shots.push({x:ship.x+fx*25,y:ship.y+fy*25,vx:fx*500+ship.vx*.4,vy:fy*500+ship.vy*.4,ttl:1.25,r:4});
 }else shots.push({x:ship.x,y:ship.y-27,vx:0,vy:-810,ttl:1.5,r:5});
 sound(game==="asteroids"?650:930,.048,"square",.018);
}
function updateAsteroids(dt){
 if(keys.left)ship.angle-=1.6*dt;if(keys.right)ship.angle+=1.6*dt;
 if(keys.thrust){ship.vx+=Math.cos(ship.angle)*105*dt;ship.vy+=Math.sin(ship.angle)*105*dt;if(Math.random()<.55)burst(ship.x-Math.cos(ship.angle)*19,ship.y-Math.sin(ship.angle)*19,"#51efff",1,70);}
 const drag=Math.pow(.974,dt*60);ship.vx*=drag;ship.vy*=drag;const v=Math.hypot(ship.vx,ship.vy);if(v>130){ship.vx*=130/v;ship.vy*=130/v;}
 ship.x=(ship.x+ship.vx*dt+W)%W;ship.y=(ship.y+ship.vy*dt+H)%H;
 for(const r of rocks){r.x=(r.x+r.vx*dt+W+r.r)%(W+2*r.r)-r.r;r.y=(r.y+r.vy*dt+H+r.r)%(H+2*r.r)-r.r;r.angle+=r.spin*dt;if(ship.invuln<=0&&limit2(ship,r,r.r+15))loseLife();}
 for(let i=shots.length-1;i>=0;i--){
   const b=shots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt;
   if(b.ttl<=0||b.x<0||b.x>W||b.y<0||b.y>H){shots.splice(i,1);continue;}
   const hit=rocks.findIndex(r=>limit2(b,r,r.r+b.r));
   if(hit<0)continue;
   const r=rocks.splice(hit,1)[0];shots.splice(i,1);score(r.size===3?25:r.size===2?60:115);burst(r.x,r.y,r.size===1?"#ffe590":"#8bdeff",r.size===3?14:9,170);sound(140+60*r.size,.1,"sawtooth",.018);
   if(r.size>1)for(let j=0;j<2;j++)newRock(r.size-1,r.x+rand(-10,10),r.y+rand(-10,10));
 }
 if(running&&rocks.length===0){data.wave++;if(data.wave%2===1&&data.lives<8){data.lives++;status("Bonus life awarded!");}updateHUD();startAsteroidsWave();ship.invuln=Math.max(ship.invuln,3);sound(1100,.18);}
}
function updateGalaxy(dt){
 if(keys.left)ship.x-=460*dt;if(keys.right)ship.x+=460*dt;ship.x=clamp(ship.x,32,W-32);
 let bounce=false;const moving=enemies.filter(e=>e.alive);const speed=clamp(44+data.wave*16,55,200);
 for(const e of moving){if(e.x+enemyDir*speed*dt>W-40||e.x+enemyDir*speed*dt<40){bounce=true;break;}}
 if(bounce){enemyDir*=-1;moving.forEach(e=>e.y+=25);}
 for(const e of moving){e.x+=enemyDir*speed*dt;e.phase+=dt*3;}
 if(moving.some(e=>e.y>H-180)){status("Aliens breached your defenses!");endGame();return;}
 enemyFire-=dt;
 if(enemyFire<=0&&moving.length){
   const low=moving.filter(e=>!moving.some(other=>other.col===e.col&&other.alive&&other.y>e.y));
   const e=low[Math.floor(Math.random()*low.length)];
   if(e)enemyShots.push({x:e.x,y:e.y+20,vx:rand(-35,35),vy:clamp(235+data.wave*30,250,440),r:7,ttl:3.7});
   enemyFire=clamp(rand(.8,1.6)-data.wave*.055,.36,1.6);
 }
 for(let i=enemyShots.length-1;i>=0;i--){const b=enemyShots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt;
   if(b.ttl<=0||b.y>H+10){enemyShots.splice(i,1);continue;}
   if(ship.invuln<=0&&limit2(b,ship,22)){enemyShots.splice(i,1);loseLife();}
 }
 for(let i=shots.length-1;i>=0;i--){const b=shots[i];b.x+=b.vx*dt;b.y+=b.vy*dt;b.ttl-=dt;if(b.ttl<=0||b.y<-20){shots.splice(i,1);continue;}
   const target=enemies.find(e=>e.alive&&Math.abs(b.x-e.x)<28&&Math.abs(b.y-e.y)<23);
   if(!target)continue;
   target.alive=false;shots.splice(i,1);score(50+(3-target.row)*20);burst(target.x,target.y,["#f18dff","#85dfff","#ffde8a","#7fffc4"][target.row],15,160);sound(550,.09,"triangle",.025);
 }
 if(running&&!enemies.some(e=>e.alive)){data.wave++;ship.invuln=Math.max(ship.invuln,1.7);updateHUD();startGalaxyWave();sound(1150,.19,"square",.025);}
}
function update(dt){
 clock+=dt;shootCooldown=Math.max(0,shootCooldown-dt);ship.invuln=Math.max(0,ship.invuln-dt);screenFlash=Math.max(0,screenFlash-dt);
 if(keys.fire)fire();
 if(game==="asteroids")updateAsteroids(dt);else updateGalaxy(dt);
 for(let i=particles.length-1;i>=0;i--){const p=particles[i];p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.97;p.vy*=.97;p.life-=dt;if(p.life<=0)particles.splice(i,1);}
}
function shipPath(){
 ctx.beginPath();ctx.moveTo(24,0);ctx.lineTo(-16,-13);ctx.lineTo(-9,0);ctx.lineTo(-16,13);ctx.closePath();ctx.lineJoin="round";ctx.lineWidth=3;ctx.strokeStyle="#b8faff";ctx.shadowColor="#39cfff";ctx.shadowBlur=16;ctx.stroke();ctx.shadowBlur=0;
 ctx.beginPath();ctx.moveTo(13,0);ctx.lineTo(-9,-5);ctx.lineTo(-6,5);ctx.closePath();ctx.fillStyle="#5dd8f4";ctx.fill();
 if(keys.thrust&&running&&!paused){ctx.beginPath();ctx.moveTo(-14,-8);ctx.lineTo(-28-rand(0,22),0);ctx.lineTo(-14,8);ctx.strokeStyle="#ffa757";ctx.lineWidth=4;ctx.stroke();}
}
function drawRock(r){
 ctx.save();ctx.translate(r.x,r.y);ctx.rotate(r.angle);ctx.beginPath();
 for(let i=0;i<r.edges.length;i++){const a=i/r.edges.length*TAU,n=r.r*r.edges[i],x=Math.cos(a)*n,y=Math.sin(a)*n;if(!i)ctx.moveTo(x,y);else ctx.lineTo(x,y);}
 ctx.closePath();ctx.fillStyle="#21324c";ctx.strokeStyle=r.size===3?"#a7b9d7":r.size===2?"#c7a9df":"#ffda9c";ctx.lineWidth=2.8;ctx.shadowColor="#6bbfff";ctx.shadowBlur=6;ctx.fill();ctx.stroke();ctx.shadowBlur=0;
 ctx.strokeStyle="rgba(255,255,255,.17)";ctx.lineWidth=2;ctx.beginPath();ctx.arc(-r.r*.2,-r.r*.1,r.r*.18,0,TAU);ctx.arc(r.r*.25,r.r*.22,r.r*.12,0,TAU);ctx.stroke();ctx.restore();
}
function drawAlien(e){
 ctx.save();ctx.translate(e.x,e.y+Math.sin(e.phase)*2);const colors=["#db8dff","#95b6ff","#ffc87a","#72f5bb"],col=colors[e.row];ctx.shadowColor=col;ctx.shadowBlur=13;ctx.fillStyle=col;
 ctx.beginPath();ctx.moveTo(-25,0);ctx.lineTo(-20,-15);ctx.lineTo(-13,-15);ctx.lineTo(-8,-24);ctx.lineTo(8,-24);ctx.lineTo(13,-15);ctx.lineTo(20,-15);ctx.lineTo(25,0);ctx.lineTo(21,16);ctx.lineTo(13,16);ctx.lineTo(13,9);ctx.lineTo(-13,9);ctx.lineTo(-13,16);ctx.lineTo(-21,16);ctx.closePath();ctx.fill();ctx.shadowBlur=0;
 ctx.fillStyle="#10152e";ctx.fillRect(-14,-6,7,8);ctx.fillRect(7,-6,7,8);ctx.fillRect(-5,8,10,3);ctx.restore();
}
function drawBackdrop(t){
 const bg=ctx.createLinearGradient(0,0,0,H);bg.addColorStop(0,"#061026");bg.addColorStop(.55,"#0a1435");bg.addColorStop(1,"#0b081f");ctx.fillStyle=bg;ctx.fillRect(0,0,W,H);
 const nebula=ctx.createRadialGradient(W*.7,H*.33,20,W*.7,H*.33,410);nebula.addColorStop(0,"rgba(64,58,160,.19)");nebula.addColorStop(1,"rgba(64,58,160,0)");ctx.fillStyle=nebula;ctx.fillRect(0,0,W,H);
 for(let i=0;i<stars.length;i++){const s=stars[i],tw=.56+.4*Math.sin(t*(.7+s.speed)+i);ctx.fillStyle="rgba(209,231,255,"+clamp(tw,.1,.95)+")";ctx.fillRect(s.x,s.y,s.size,s.size);}
 ctx.save();ctx.font="bold 17px ui-rounded, system-ui, sans-serif";ctx.letterSpacing="3px";ctx.fillStyle="rgba(147,247,251,.55)";ctx.fillText(game==="asteroids"?"ASTEROID FIELD":"GALAXY DEFENDER",23,35);ctx.textAlign="right";ctx.fillStyle="rgba(255,229,157,.55)";ctx.fillText("WAVE "+data.wave,W-23,35);ctx.restore();
}
function draw(){
 const t=performance.now()/1000;drawBackdrop(t);
 if(game==="asteroids"){
   rocks.forEach(drawRock);
   if(running||paused){if(ship.invuln<=0||Math.floor(t*10)%2===0){ctx.save();ctx.translate(ship.x,ship.y);ctx.rotate(ship.angle);shipPath();ctx.restore();}}
 }else{
   enemies.filter(e=>e.alive).forEach(drawAlien);
   for(const b of enemyShots){ctx.fillStyle="#ff669e";ctx.shadowColor="#ff659e";ctx.shadowBlur=14;ctx.fillRect(b.x-4,b.y-12,8,24);ctx.shadowBlur=0;}
   if(running||paused){if(ship.invuln<=0||Math.floor(t*10)%2===0){
     ctx.save();ctx.translate(ship.x,ship.y);ctx.shadowColor="#8ffef4";ctx.shadowBlur=15;ctx.fillStyle="#65f6e0";ctx.beginPath();ctx.moveTo(0,-30);ctx.lineTo(18,-12);ctx.lineTo(29,18);ctx.lineTo(-29,18);ctx.lineTo(-18,-12);ctx.closePath();ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#143253";ctx.fillRect(-10,-2,20,14);ctx.restore();
   }}
 }
 ctx.shadowColor="#74efff";ctx.shadowBlur=14;for(const b of shots){ctx.fillStyle="#b3faff";ctx.beginPath();ctx.arc(b.x,b.y,b.r,0,TAU);ctx.fill();}ctx.shadowBlur=0;
 for(const p of particles){ctx.globalAlpha=clamp(p.life/p.max,0,1);ctx.fillStyle=p.color;ctx.fillRect(p.x,p.y,p.r,p.r);}ctx.globalAlpha=1;
 if(screenFlash>0){ctx.fillStyle="rgba(255,83,133,"+(screenFlash*.55)+")";ctx.fillRect(0,0,W,H);}
}
function loop(now){raf=requestAnimationFrame(loop);const dt=clamp((now-last)/1000||0,0,.034);last=now;if(running&&!paused)update(dt);draw();}
function bindControl(btn){
 const name=btn.dataset.control;
 const press=e=>{e.preventDefault();if(!running||paused)return;keys[name]=true;btn.classList.add("pressed");try{btn.setPointerCapture(e.pointerId);}catch{}if(name==="fire")fire();};
 const release=e=>{if(e)e.preventDefault();keys[name]=false;btn.classList.remove("pressed");};
 btn.addEventListener("pointerdown",press);btn.addEventListener("pointerup",release);btn.addEventListener("pointercancel",release);btn.addEventListener("lostpointercapture",release);
}
document.querySelectorAll(".ctrl").forEach(bindControl);
const keyMap={ArrowLeft:"left",KeyA:"left",ArrowRight:"right",KeyD:"right",ArrowUp:"thrust",KeyW:"thrust",Space:"fire",KeyJ:"fire"};
document.addEventListener("keydown",e=>{const name=keyMap[e.code];if(!name)return;if(["BUTTON","INPUT"].includes(document.activeElement?.tagName))return;e.preventDefault();if(!running||paused)return;keys[name]=true;if(name==="fire"&&!e.repeat)fire();});
document.addEventListener("keyup",e=>{const name=keyMap[e.code];if(!name)return;keys[name]=false;});
$("startBtn").addEventListener("click",()=>{if(running&&paused)resumeGame();else startGame();});
$("quickStartBtn").addEventListener("click",()=>{if(running&&paused)resumeGame();else startGame();});
$("menuBtn").addEventListener("click",()=>{resetWorld();if(typeof window.scrollTo==="function")window.scrollTo(0,0);});
$("pauseBtn").addEventListener("click",()=>{if(!running)return;if(paused)resumeGame();else pauseGame();});
$("asteroidsMode").addEventListener("click",()=>setGame("asteroids"));
$("galaxyMode").addEventListener("click",()=>setGame("galaxy"));
$("soundBtn").addEventListener("click",()=>{soundOn=!soundOn;save();$("soundBtn").textContent=soundOn?"🔊":"🔇";$("soundBtn").setAttribute("aria-pressed",String(soundOn));$("soundBtn").setAttribute("aria-label",soundOn?"Mute game sound":"Enable game sound");if(soundOn)sound(610,.07);});
document.addEventListener("visibilitychange",()=>{if(document.hidden&&running&&!paused)pauseGame();});
window.addEventListener("blur",()=>{if(running&&!paused)pauseGame();});
window.addEventListener("pagehide",()=>{cancelAnimationFrame(raf);clearControls();save();});
stars=Array.from({length:125},()=>({x:rand(0,W),y:rand(0,H),size:rand(.8,3),speed:rand(.2,1.8)}));
$("soundBtn").textContent=soundOn?"🔊":"🔇";$("soundBtn").setAttribute("aria-pressed",String(soundOn));
setGame(new URLSearchParams(location.search).get("game")==="galaxy"?"galaxy":"asteroids");
last=performance.now();raf=requestAnimationFrame(loop);
})();