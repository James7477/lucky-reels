(() => {
  "use strict";

  // Entirely separate from Lucky Reels' casino save/credit balance.
  const KEY = "luckyReelsSkillArcadeV1";
  const $ = id => document.getElementById(id);
  const q = sel => [...document.querySelectorAll(sel)];
  const icons = ["🍉","🍒","🍋","🍍","🍇","🥑","🍓","🍑","🌶️","🦄","🚀","🌈","🎸","⚡","🍀","🐸","🦋","🐙","🦕","💎","🔥","🛸","🐬","🧁"];
  const memoryIcons = ["🦊","🐼","🐯","🐸","🐧","🦉","🐬","🦋"];

  const emptyRecords = () => ({twins:0,memory:0,speed:0,reaction:0});
  const load = () => {
    try {
      const p = JSON.parse(localStorage.getItem(KEY) || "{}");
      const highs = emptyRecords();
      Object.keys(highs).forEach(k => {
        if (Number.isFinite(p.highs && p.highs[k]) && p.highs[k] > 0) highs[k] = Math.floor(p.highs[k]);
      });
      return {highs,sound:p.sound !== false};
    } catch { return {highs:emptyRecords(),sound:true}; }
  };
  const saved = load();
  let highs = saved.highs;
  let soundEnabled = saved.sound;
  let mode = "twins";
  let audio = null;
  const timers = new Set();

  function schedule(fn, ms) {
    const id = setTimeout(() => {timers.delete(id);fn();}, ms);
    timers.add(id);
    return id;
  }
  function repeat(fn, ms) {
    const id = setInterval(fn, ms);
    timers.add(id);
    return id;
  }
  function clearTimers() {
    for (const id of timers) {clearInterval(id);clearTimeout(id);}
    timers.clear();
  }
  function randomInt(max) {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] % max;
    }
    return Math.floor(Math.random() * max);
  }
  function shuffle(items) {
    const a = items.slice();
    for (let i=a.length-1;i>0;i--) {
      const j = randomInt(i+1);
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }
  function persist() {
    try {localStorage.setItem(KEY,JSON.stringify({highs,sound:soundEnabled}));} catch {}
  }
  function high(modeName, score, lowest=false) {
    if (!(score > 0)) return false;
    const old = highs[modeName];
    if (!old || (lowest ? score < old : score > old)) {
      highs[modeName] = score;
      persist();
      displayHighs();
      return true;
    }
    return false;
  }
  function displayHighs() {
    $("bestTwins").textContent = highs.twins.toLocaleString("en-US");
    $("bestMemory").textContent = highs.memory.toLocaleString("en-US");
    $("bestSpeed").textContent = highs.speed.toLocaleString("en-US");
    $("bestReaction").textContent = highs.reaction ? highs.reaction + "ms" : "—";
  }
  function message(id, text, tone="") {
    const el = $(id);
    el.textContent = text;
    el.className = "message" + (tone ? " " + tone : "");
  }
  function beep(freq=610,duration=0.06,type="sine") {
    if (!soundEnabled) return;
    try {
      audio = audio || new (window.AudioContext || window.webkitAudioContext)();
      if (audio.state === "suspended") audio.resume();
      const osc = audio.createOscillator(), gain = audio.createGain(), now=audio.currentTime;
      osc.type=type;osc.frequency.value=freq;
      gain.gain.setValueAtTime(0.04,now);
      gain.gain.exponentialRampToValueAtTime(0.001,now+duration);
      osc.connect(gain).connect(audio.destination);
      osc.start(now);osc.stop(now+duration+0.02);
    } catch {}
  }
  function setSound() {
    $("soundBtn").textContent = soundEnabled ? "🔊" : "🔇";
    $("soundBtn").setAttribute("aria-pressed", String(soundEnabled));
    $("soundBtn").setAttribute("aria-label",soundEnabled ? "Mute arcade sound" : "Turn on arcade sound");
  }
  $("soundBtn").addEventListener("click",() => {
    soundEnabled=!soundEnabled;persist();setSound();beep();
  });

  let twins, memory, speed, reaction;
  function makeButton(text,label) {
    const btn = document.createElement("button");
    btn.type="button";btn.textContent=text;btn.setAttribute("aria-label",label);
    return btn;
  }
  function idleBoard(boardId, count, text, cls="") {
    const board=$(boardId);
    board.replaceChildren();
    for (let i=0;i<count;i++) {
      const btn=makeButton(text,"Start the game to activate tile " + (i+1));
      if (cls) btn.className=cls;
      btn.disabled=true;board.append(btn);
    }
  }

  // Find exactly one identical pair among twelve symbols.
  function resetTwins() {
    twins = {running:false,score:0,streak:0,round:0,chosen:null,locked:false,end:0,values:[]};
    $("twinScore").textContent="0";
    $("twinTime").textContent="45s";
    $("twinStreak").textContent="0";
    $("startTwins").textContent="▶ Start Twin Finder";
    idleBoard("twinBoard",12,"❔");
    message("twinMsg","Find the only two identical symbols in each round.");
  }
  function twinRound() {
    if (!twins.running) return;
    twins.chosen=null;twins.locked=false;twins.round++;
    const opts=shuffle(icons).slice(0,11);
    const pair=opts[0];
    twins.values=shuffle([pair,pair,...opts.slice(1)]);
    const board=$("twinBoard");board.replaceChildren();
    twins.values.forEach((symbol,i) => {
      const btn=makeButton(symbol,"Symbol " + (i+1) + ": " + symbol);
      btn.addEventListener("click",()=>pickTwin(i));
      board.append(btn);
    });
    message("twinMsg","Round " + twins.round + ": tap the matching two!");
  }
  function twinTick() {
    if (!twins.running) return;
    const remaining=Math.max(0,Math.ceil((twins.end-performance.now())/1000));
    $("twinTime").textContent=remaining+"s";
    if (remaining<=0) endTwins();
  }
  function endTwins() {
    if (!twins.running) return;
    twins.running=false;clearTimers();
    q("#twinBoard button").forEach(b=>b.disabled=true);
    $("twinTime").textContent="0s";
    const record=high("twins",twins.score);
    message("twinMsg",(record?"🏆 New personal best! ":"Time up! ") + twins.score + " points in " + (twins.round - (twins.chosen!==null?1:0)) + " rounds.","good");
    $("startTwins").textContent="↻ Play Again";
    beep(850,0.17);
  }
  function pickTwin(index) {
    if (!twins.running || twins.locked) return;
    if (performance.now()>=twins.end){endTwins();return;}
    if (twins.chosen===index) return;
    const buttons=q("#twinBoard button");
    if (twins.chosen===null) {
      twins.chosen=index;buttons[index].classList.add("selected");beep(490);
      return;
    }
    const first=twins.chosen;
    twins.locked=true;
    if (twins.values[first]===twins.values[index]) {
      twins.streak++;
      twins.score+=100+Math.min(100,twins.streak*10);
      $("twinScore").textContent=twins.score.toLocaleString("en-US");
      $("twinStreak").textContent=twins.streak;
      [buttons[first],buttons[index]].forEach(b=>b.classList.add("correct"));
      message("twinMsg","🎯 Perfect match! +"+(100+Math.min(100,twins.streak*10))+" points","good");
      beep(920,0.1);
      schedule(()=>{if (twins.running && performance.now()<twins.end) twinRound();else if(twins.running)endTwins();},420);
    } else {
      twins.streak=0;$("twinStreak").textContent="0";
      buttons[first].classList.add("wrong");buttons[index].classList.add("wrong");
      message("twinMsg","Those two are different. Try again!","bad");
      beep(230,0.11,"triangle");
      schedule(()=>{
        if (!twins.running) return;
        [buttons[first],buttons[index]].forEach(b=>b.classList.remove("wrong","selected"));
        twins.chosen=null;twins.locked=false;
      },460);
    }
  }
  $("startTwins").addEventListener("click",()=>{
    clearTimers();resetTwins();twins.running=true;twins.end=performance.now()+45000;
    $("startTwins").textContent="↻ Restart Twin Finder";
    twinRound();repeat(twinTick,100);beep(670,0.1);
  });

  // Classic 4x4 memory game. Scoring is based on moves and elapsed seconds.
  function resetMemory() {
    memory={running:false,values:[],matched:new Set(),first:null,locked:false,moves:0,start:0};
    $("memPairs").textContent="0 / 8";
    $("memMoves").textContent="0";
    $("memTime").textContent="0s";
    $("startMemory").textContent="▶ Start Memory Flip";
    idleBoard("memoryBoard",16,"★","memory-tile");
    message("memMsg","Flip two cards, remember the symbols and find eight pairs.");
  }
  function drawMemory() {
    const board=$("memoryBoard");board.replaceChildren();
    memory.values.forEach((symbol,index)=>{
      const btn=makeButton("★","Face-down memory card " + (index+1));
      btn.className="memory-tile";
      btn.addEventListener("click",()=>flipMemory(index));
      board.append(btn);
    });
  }
  function revealMemory(index) {
    const btn=$("memoryBoard").children[index];
    btn.textContent=memory.values[index];btn.classList.add("face-up");
    btn.setAttribute("aria-label","Revealed: "+memory.values[index]);
  }
  function concealMemory(index) {
    const btn=$("memoryBoard").children[index];
    btn.textContent="★";btn.classList.remove("face-up");
    btn.setAttribute("aria-label","Face-down memory card "+(index+1));
  }
  function flipMemory(index) {
    if (!memory.running || memory.locked || memory.matched.has(index) || memory.first===index) return;
    const btn=$("memoryBoard").children[index];
    if (!btn || btn.disabled) return;
    revealMemory(index);beep(580,0.07);
    if (memory.first===null){memory.first=index;return;}
    const first=memory.first;memory.first=null;
    memory.moves++;$("memMoves").textContent=memory.moves;
    if (memory.values[first]===memory.values[index]){
      memory.matched.add(first);memory.matched.add(index);
      [$("memoryBoard").children[first],btn].forEach(b=>{b.classList.add("matched");b.disabled=true;});
      const pairs=memory.matched.size/2;
      $("memPairs").textContent=pairs+" / 8";beep(900,0.14);
      message("memMsg","Nice memory! "+pairs+" pairs found.","good");
      if(pairs===8)finishMemory();
    } else {
      memory.locked=true;message("memMsg","Not a match. Remember both positions.");
      schedule(()=>{
        if(!memory.running)return;
        concealMemory(first);concealMemory(index);memory.locked=false;
      },800);
    }
  }
  function finishMemory() {
    memory.running=false;clearTimers();
    const seconds=Math.max(0,Math.floor((performance.now()-memory.start)/1000));
    const score=Math.max(100,2000-Math.max(0,memory.moves-8)*65-seconds*12);
    const record=high("memory",score);
    message("memMsg",(record?"🏆 New high score! ":"Board cleared! ")+memory.moves+" moves · "+seconds+"s · "+score+" points.","good");
    $("startMemory").textContent="↻ Play Again";
    beep(1000,0.2);
  }
  $("startMemory").addEventListener("click",()=>{
    clearTimers();resetMemory();
    memory.running=true;
    memory.values=shuffle([...memoryIcons,...memoryIcons]);
    memory.start=performance.now();drawMemory();
    $("startMemory").textContent="↻ Restart Memory Flip";
    repeat(()=>{if(memory.running)$("memTime").textContent=Math.floor((performance.now()-memory.start)/1000)+"s";},200);
    message("memMsg","Find the eight pairs. Fewer moves = more points!");
  });

  // Nine illuminated buttons, one moving target, thirty-second limit.
  function resetSpeed() {
    speed={running:false,score:0,combo:0,target:-1,end:0};
    $("speedScore").textContent="0";
    $("speedTime").textContent="30s";
    $("speedCombo").textContent="0";
    $("startSpeed").textContent="▶ Start Speed Tap";
    idleBoard("speedBoard",9,"·");
    message("speedMsg","Only the glowing star earns points.");
  }
  function newSpeedTarget() {
    if(!speed.running)return;
    let next=randomInt(8);
    if(speed.target>=0 && next>=speed.target)next++;
    speed.target=next;
    q("#speedBoard button").forEach((b,i)=>{
      b.textContent=i===next?"★":"·";
      b.classList.toggle("target",i===next);
      b.setAttribute("aria-label",i===next?"Tap the glowing star":"Empty tile");
    });
  }
  function tapSpeed(index) {
    if(!speed.running)return;
    if(performance.now()>=speed.end){endSpeed();return;}
    if(index===speed.target){
      speed.combo++;
      speed.score+=10+Math.min(20,speed.combo*2);
      $("speedScore").textContent=speed.score.toLocaleString("en-US");
      $("speedCombo").textContent=speed.combo;
      beep(620+Math.min(360,speed.combo*15),0.06);
      message("speedMsg",speed.combo>=5?"⚡ Hot streak! "+speed.combo+" hits!":"Great hit! Keep going.","good");
      newSpeedTarget();
    }else{
      speed.combo=0;$("speedCombo").textContent="0";
      message("speedMsg","Miss! Aim for the glowing star.","bad");beep(240,0.06);
    }
  }
  function speedTick() {
    if(!speed.running)return;
    const remaining=Math.max(0,Math.ceil((speed.end-performance.now())/1000));
    $("speedTime").textContent=remaining+"s";
    if(remaining<=0)endSpeed();
  }
  function endSpeed() {
    if(!speed.running)return;
    speed.running=false;clearTimers();
    q("#speedBoard button").forEach(b=>b.disabled=true);
    $("speedTime").textContent="0s";
    const record=high("speed",speed.score);
    message("speedMsg",(record?"🏆 New high score! ":"Time up! ")+speed.score+" points.","good");
    $("startSpeed").textContent="↻ Play Again";
    beep(880,0.16);
  }
  $("startSpeed").addEventListener("click",()=>{
    clearTimers();resetSpeed();
    speed.running=true;speed.end=performance.now()+30000;
    const board=$("speedBoard");board.replaceChildren();
    for(let i=0;i<9;i++){
      const btn=makeButton("·","Empty tile");
      btn.addEventListener("click",()=>tapSpeed(i));
      board.append(btn);
    }
    $("startSpeed").textContent="↻ Restart Speed Tap";
    newSpeedTarget();repeat(speedTick,100);beep(660);
  });

  // Five timed reaction attempts. A premature tap never earns a time.
  function resetReaction() {
    reaction={running:false,phase:"idle",round:0,last:0,fastest:0,started:0};
    $("reactionRound").textContent="0 / 5";
    $("reactionLast").textContent="—";
    $("reactionFastest").textContent="—";
    $("startReaction").textContent="▶ Start Reaction Lab";
    setReactionZone("idle","🚦","Start your reaction test","Wait for green before tapping",false);
    message("reactionMsg","Five rounds. Tap only after the light turns green.");
  }
  function setReactionZone(phase,icon,title,hint,enabled=true) {
    const zone=$("reactionZone");
    zone.className="reaction-zone"+(phase!=="idle"?" "+phase:"");
    zone.disabled=!enabled;
    $("reactionIcon").textContent=icon;
    $("reactionText").textContent=title;
    $("reactionHint").textContent=hint;
  }
  function prepareReaction() {
    if(!reaction.running)return;
    reaction.phase="wait";
    $("reactionRound").textContent=(reaction.round+1)+" / 5";
    setReactionZone("wait","🔴","WAIT FOR GREEN…","Don't tap yet!");
    message("reactionMsg","Stay ready…");
    schedule(()=>{
      if(!reaction.running||reaction.phase!=="wait")return;
      reaction.phase="go";
      reaction.started=performance.now();
      setReactionZone("go","🟢","TAP NOW!","Touch anywhere in this green box");
      beep(840,0.1);
    },1300+randomInt(2400));
  }
  function finishReaction() {
    reaction.running=false;reaction.phase="done";clearTimers();
    const record=high("reaction",reaction.fastest,true);
    setReactionZone("result","🏁","Test complete!",reaction.fastest+"ms was your fastest time",false);
    message("reactionMsg",(record?"🏆 New fastest record! ":"Nice reflexes! ")+"Fastest: "+reaction.fastest+"ms.","good");
    $("startReaction").textContent="↻ Play Again";
    beep(920,0.2);
  }
  $("reactionZone").addEventListener("click",()=>{
    if(!reaction.running)return;
    if(reaction.phase==="wait"){
      reaction.phase="early";
      clearTimers();
      setReactionZone("wait","⛔","TOO EARLY!","Watch for the green signal",false);
      message("reactionMsg","False start! This round will restart.","bad");beep(220,0.15);
      schedule(prepareReaction,950);
    } else if(reaction.phase==="go"){
      reaction.phase="result";
      const ms=Math.max(1,Math.round(performance.now()-reaction.started));
      reaction.last=ms;
      if(!reaction.fastest||ms<reaction.fastest)reaction.fastest=ms;
      reaction.round++;
      $("reactionLast").textContent=ms+"ms";
      $("reactionFastest").textContent=reaction.fastest+"ms";
      setReactionZone("result","⚡",ms+" milliseconds","Nice tap! Next signal coming…",false);
      message("reactionMsg","Round "+reaction.round+" of 5: "+ms+"ms","good");beep(730,0.08);
      if(reaction.round===5){
        schedule(finishReaction,900);
      } else {
        schedule(prepareReaction,1000);
      }
    }
  });
  $("startReaction").addEventListener("click",()=>{
    clearTimers();resetReaction();
    reaction.running=true;$("startReaction").textContent="↻ Restart Reaction Lab";
    prepareReaction();
  });

  function switchMode(next) {
    if(!["twins","memory","speed","reaction"].includes(next))return;
    clearTimers();mode=next;
    ["twins","memory","speed","reaction"].forEach(name=>{
      $("panel-"+name).hidden=name!==mode;
    });
    q(".mode-tile").forEach(b=>{
      const selected=b.dataset.mode===mode;
      b.classList.toggle("active",selected);
      b.setAttribute("aria-pressed",String(selected));
    });
    if(mode==="twins")resetTwins();
    if(mode==="memory")resetMemory();
    if(mode==="speed")resetSpeed();
    if(mode==="reaction")resetReaction();
    beep(480,0.06);
  }
  q(".mode-tile").forEach(btn=>btn.addEventListener("click",()=>switchMode(btn.dataset.mode)));
  $("clearScores").addEventListener("click",()=>{
    if(!window.confirm("Clear all four personal arcade records? Casino credits and game progress will not be affected."))return;
    highs=emptyRecords();persist();displayHighs();
    message(({twins:"twinMsg",memory:"memMsg",speed:"speedMsg",reaction:"reactionMsg"})[mode],"Arcade records cleared. Casino credits were not changed.");
  });
  window.addEventListener("pagehide",clearTimers);
  setSound();displayHighs();switchMode("twins");
})();