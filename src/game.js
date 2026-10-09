(function(){
var TIME=30000;
var KEY='riddleBlocks.v2';
var DEFAULTS=function(){return {coins:100,solved:{},fails:{},streak:0,best:0,daily:'',sound:true,vibe:true};};
var S=DEFAULTS();
try{
  var r=localStorage.getItem(KEY);
  if(r){var p=JSON.parse(r);if(p&&typeof p.coins==='number'&&p.solved){var d=DEFAULTS();for(var k0 in d)if(p[k0]===undefined)p[k0]=d[k0];S=p;}}
}catch(e){}
function save(){try{localStorage.setItem(KEY,JSON.stringify(S));}catch(e){}}
function $(s){return document.querySelector(s);}
var mapView=$('#mapView'),playView=$('#playView'),overlay=$('#overlay'),readyEl=$('#ready'),timeupEl=$('#timeup');
var slotsEl=$('#slots'),poolEl=$('#pool'),msgEl=$('#msg'),timerEl=$('#timer');
var L=null,msgTimer=null,tick=null,lastSec=-1,pendingDaily=0;

/* ---------- sound and haptics ---------- */
var AC=null;
function audio(){
  if(!S.sound)return null;
  try{
    if(!AC){var C=window.AudioContext||window.webkitAudioContext;if(C)AC=new C();}
    if(AC&&AC.state==='suspended')AC.resume();
    return AC;
  }catch(e){return null;}
}
function tone(freq,dur,type,vol,delay){
  var a=audio();if(!a)return;
  try{
    var t=a.currentTime+(delay||0),o=a.createOscillator(),g=a.createGain();
    o.type=type||'sine';o.frequency.value=freq;
    g.gain.setValueAtTime(0.0001,t);
    g.gain.exponentialRampToValueAtTime(vol||0.1,t+0.01);
    g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
    o.connect(g);g.connect(a.destination);o.start(t);o.stop(t+dur+0.02);
  }catch(e){}
}
var SFX={
  tap:function(){tone(620,.05,'triangle',.09);},
  undo:function(){tone(420,.05,'triangle',.07);},
  win:function(){[523,659,784,1047].forEach(function(f,i){tone(f,.2,'triangle',.11,i*.09);});},
  fail:function(){tone(220,.25,'sawtooth',.08);tone(165,.35,'sawtooth',.08,.18);},
  tick:function(){tone(880,.05,'square',.05);},
  coin:function(){tone(988,.08,'triangle',.09);tone(1319,.14,'triangle',.09,.07);}
};
function vibe(p){if(S.vibe&&navigator.vibrate){try{navigator.vibrate(p);}catch(e){}}}

/* ---------- helpers ---------- */
function tierName(n){var t=TIERS[0][0];TIERS.forEach(function(x){if(n>=x[1])t=x[0];});return t;}
function nextLevel(){for(var i=1;i<=TOTAL;i++)if(!S.solved[i])return i;return TOTAL+1;}
function solvedCount(){var c=0;for(var k in S.solved)if(S.solved[k]==='done')c++;return c;}
function shuffle(a){for(var i=a.length-1;i>0;i--){var j=Math.floor(Math.random()*(i+1));var t=a[i];a[i]=a[j];a[j]=t;}return a;}
function updateCoins(){document.querySelectorAll('.coins').forEach(function(e){e.textContent=S.coins;});}
function msg(t){msgEl.textContent=t;clearTimeout(msgTimer);if(t)msgTimer=setTimeout(function(){msgEl.textContent='';},2800);}
function stopTick(){if(tick){clearInterval(tick);tick=null;}}
function hideAll(){overlay.hidden=true;readyEl.hidden=true;timeupEl.hidden=true;}
function today(){var d=new Date();return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();}
function paintToggles(){
  $('#tSound').setAttribute('aria-pressed',S.sound);$('#tSound').querySelector('b').textContent=S.sound?'On':'Off';
  $('#tVibe').setAttribute('aria-pressed',S.vibe);$('#tVibe').querySelector('b').textContent=S.vibe?'On':'Off';
}

/* ---------- map ---------- */
function showMap(){
  stopTick();L=null;hideAll();playView.hidden=true;mapView.hidden=false;
  if(S.daily!==today()){S.daily=today();S.coins+=20;pendingDaily=20;save();}
  var d=$('#daily');
  if(pendingDaily){$('#dailyText').textContent='Daily bonus: +'+pendingDaily+' coins';d.hidden=false;pendingDaily=0;}else d.hidden=true;
  updateCoins();paintToggles();
  var nx=nextLevel(),sc=solvedCount();
  $('#count').textContent=sc+' / '+TOTAL;
  $('#bar').style.width=(sc/TOTAL*100)+'%';
  $('#streak').textContent=S.streak+' (best '+S.best+')';
  $('#go').textContent=nx>TOTAL?'All done. Replay from level 1':'Continue · Level '+nx;
  var html='';
  TIERS.forEach(function(t,ti){
    var from=t[1],to=ti<TIERS.length-1?TIERS[ti+1][1]-1:TOTAL;
    html+='<div class="tier"><h2>'+t[0]+'<span>Levels '+from+'–'+to+'</span></h2><div class="grid">';
    for(var n=from;n<=to;n++){
      var st=S.solved[n],cls='cell'+(st==='done'?' done':st==='skip'?' skip':n===nx?' cur':'');
      html+='<button class="'+cls+'" data-n="'+n+'"'+(n>nx?' disabled':'')+'>'+n+'</button>';
    }
    html+='</div></div>';
  });
  $('#tiers').innerHTML=html;
  var cur=$('#tiers .cur');
  if(cur&&cur.scrollIntoView&&sc>0){try{cur.scrollIntoView({block:'center'});}catch(e){}}
}

/* ---------- level flow ---------- */
/* Build a level and show the start gate. The clock runs only after Start. */
function open(n){
  stopTick();hideAll();
  var ans=WORDS[n-1][0],clue=WORDS[n-1][1];
  var abc=shuffle('ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').filter(function(c){return ans.indexOf(c)<0;}));
  var extra=Math.max(0,Math.min(3+Math.floor(n/10),20-ans.length,abc.length));
  var pool=shuffle(ans.split('').concat(abc.slice(0,extra))).map(function(ch){return {ch:ch,gone:false};});
  L={n:n,ans:ans,clue:clue,pool:pool,slots:ans.split('').map(function(){return null;}),locked:ans.split('').map(function(){return false;}),hinted:false,removed:false,over:false,busy:false,started:false,deadline:0};
  mapView.hidden=true;playView.hidden=false;
  slotsEl.className='slots';msg('');
  window.scrollTo(0,0);
  $('#lvl').textContent='Level '+n;
  $('#tierName').textContent=tierName(n);
  $('#clue').textContent='Hidden until you press Start.';
  $('#len').textContent='';
  setTimer(TIME);
  render();
  $('#readyTitle').textContent='Level '+n+' · '+tierName(n);
  var f=S.fails[n]||0;
  $('#readyNote').textContent=f>=2?'Two misses on this riddle, so the first letter is free.':'The riddle appears when you start. The clock does not stop.';
  readyEl.hidden=false;$('#start').focus();
}
function begin(){
  if(!L||L.started)return;
  audio();SFX.tap();
  L.started=true;readyEl.hidden=true;
  $('#clue').textContent=L.clue;
  $('#len').textContent=L.ans.length+' letters';
  if((S.fails[L.n]||0)>=2){revealAt(0);render();}
  L.deadline=Date.now()+TIME;lastSec=-1;
  stopTick();tick=setInterval(onTick,100);onTick();
}
function setTimer(left){
  var pct=Math.max(0,Math.min(100,left/TIME*100));
  $('#tbar').style.width=pct+'%';
  var s=Math.ceil(left/1000);$('#secs').textContent=s;
  timerEl.className='timer'+(s<=5?' crit':s<=10?' warn':'');
  return s;
}
function onTick(){
  if(!L||L.over){stopTick();return;}
  var left=L.deadline-Date.now();
  if(left<=0){setTimer(0);timeout();return;}
  var s=setTimer(left);
  if(s!==lastSec){lastSec=s;if(s<=5){SFX.tick();vibe(15);}}
}

function render(){
  slotsEl.style.setProperty('--n',L.ans.length);
  slotsEl.innerHTML=L.slots.map(function(p,i){
    return '<button class="slot'+(p!==null?' filled':'')+(L.locked[i]?' locked':'')+'" data-s="'+i+'" aria-label="Letter '+(i+1)+'">'+(p!==null?L.pool[p].ch:'')+'</button>';
  }).join('');
  poolEl.innerHTML=L.pool.map(function(p,i){
    return '<button class="tile'+(L.slots.indexOf(i)>=0?' used':'')+'" data-i="'+i+'"'+(p.gone?' hidden':'')+'>'+p.ch+'</button>';
  }).join('');
  var off=L.over||!L.started;
  $('#hRemove').disabled=L.removed||off;
  $('#hReveal').disabled=off;
  $('#hTime').disabled=off;
  $('#hSkip').disabled=off;
}

function place(i){
  if(!L||!L.started||L.over||L.busy)return;
  var s=L.slots.indexOf(null);
  if(s<0||L.slots.indexOf(i)>=0)return;
  L.slots[s]=i;SFX.tap();vibe(8);render();
  if(L.slots.indexOf(null)<0)check();
}
function unplace(s){
  if(!L||!L.started||L.over||L.busy||L.locked[s]||L.slots[s]===null)return;
  L.slots[s]=null;SFX.undo();render();
}
function check(){
  var guess=L.slots.map(function(i){return L.pool[i].ch;}).join('');
  if(guess===L.ans){win();return;}
  L.busy=true;slotsEl.classList.add('shake');msg('Not quite. The clock is still running.');SFX.fail();vibe([60,40,60]);
  setTimeout(function(){
    if(!L)return;
    L.slots=L.slots.map(function(p,i){return L.locked[i]?p:null;});
    L.busy=false;render();
  },480);
}
function win(){
  L.over=true;stopTick();
  var left=Math.max(0,L.deadline-Date.now());
  var secs=Math.ceil(left/1000);
  var first=S.solved[L.n]!=='done';
  var bonus=L.hinted?0:Math.floor(secs/3);
  var reward=first?10+bonus:0;
  S.streak+=1;if(S.streak>S.best)S.best=S.streak;
  if(first){S.coins+=reward;S.solved[L.n]='done';}
  delete S.fails[L.n];
  save();updateCoins();
  render();slotsEl.classList.add('win');SFX.win();vibe(80);
  setTimeout(function(){
    if(!L||!L.over||!timeupEl.hidden)return;
    $('#winAns').textContent=L.ans;
    $('#winNote').textContent=(first?('+'+reward+' coins'+(bonus?' ('+bonus+' speed bonus)':'')):'Already solved, no coins this time.')+' · '+secs+'s left · streak '+S.streak;
    $('#next').textContent=L.n<TOTAL?'Next level':'Finish';
    overlay.hidden=false;$('#next').focus();
    if(first)SFX.coin();
  },750);
}
function timeout(){
  L.over=true;stopTick();
  S.fails[L.n]=(S.fails[L.n]||0)+1;S.streak=0;save();
  render();SFX.fail();vibe([120,60,120]);
  $('#tuNote').textContent=(S.fails[L.n]>=2)?'Two misses. Your next try starts with the first letter filled in.':'The riddle stays the same. Try again with a fresh clock.';
  timeupEl.hidden=false;$('#retry').focus();
}
function spend(c){
  if(S.coins<c){
    msg('Not enough coins. Solve riddles to earn more.');
    var p=playView.querySelector('.pill');p.classList.remove('bump');void p.offsetWidth;p.classList.add('bump');
    vibe(40);
    return false;
  }
  S.coins-=c;save();updateCoins();return true;
}
function revealAt(s){
  var ch=L.ans[s],cur=L.slots[s];
  if(cur!==null&&L.pool[cur].ch===ch){L.locked[s]=true;return;}
  var t=-1,k;
  for(k=0;k<L.pool.length;k++){if(L.pool[k].ch===ch&&L.slots.indexOf(k)<0){t=k;break;}}
  if(t<0){for(k=0;k<L.pool.length;k++){var j=L.slots.indexOf(k);if(L.pool[k].ch===ch&&j>=0&&!L.locked[j]){t=k;break;}}}
  if(t>=0){var j2=L.slots.indexOf(t);if(j2>=0)L.slots[j2]=null;L.slots[s]=t;L.locked[s]=true;}
}
function reveal(){
  if(!L||!L.started||L.over||L.busy)return;
  var s=-1;for(var i=0;i<L.locked.length;i++){if(!L.locked[i]){s=i;break;}}
  if(s<0)return;
  if(!spend(25))return;
  L.hinted=true;revealAt(s);SFX.tap();render();
  if(L.slots.indexOf(null)<0)check();
}
function removeExtras(){
  if(!L||!L.started||L.over||L.busy||L.removed)return;
  if(!spend(15))return;
  L.removed=true;L.hinted=true;
  L.pool.forEach(function(p,i){
    if(L.ans.indexOf(p.ch)<0){p.gone=true;var j=L.slots.indexOf(i);if(j>=0)L.slots[j]=null;}
  });
  SFX.tap();render();
}
function addTime(){
  if(!L||!L.started||L.over||L.busy)return;
  if(!spend(30))return;
  L.hinted=true;L.deadline+=10000;msg('+10 seconds added.');SFX.coin();onTick();
}
function skip(){
  if(!L||!L.started||L.over||L.busy)return;
  if(!spend(60))return;
  stopTick();S.streak=0;
  if(!S.solved[L.n])S.solved[L.n]='skip';
  save();
  if(L.n<TOTAL)open(L.n+1);else showMap();
}

/* ---------- wiring ---------- */
$('#go').onclick=function(){var nx=nextLevel();open(nx>TOTAL?1:nx);};
$('#tiers').addEventListener('click',function(e){var b=e.target.closest('.cell');if(b&&!b.disabled)open(+b.dataset.n);});
$('#back').onclick=showMap;
$('#readyBack').onclick=showMap;
$('#tuBack').onclick=showMap;
$('#start').onclick=begin;
$('#retry').onclick=function(){if(L)open(L.n);};
poolEl.addEventListener('click',function(e){var b=e.target.closest('.tile');if(b)place(+b.dataset.i);});
slotsEl.addEventListener('click',function(e){var b=e.target.closest('.slot');if(b)unplace(+b.dataset.s);});
$('#hReveal').onclick=reveal;
$('#hRemove').onclick=removeExtras;
$('#hTime').onclick=addTime;
$('#hSkip').onclick=skip;
$('#next').onclick=function(){if(L&&L.n<TOTAL)open(L.n+1);else showMap();};
$('#tSound').onclick=function(){S.sound=!S.sound;save();paintToggles();if(S.sound){audio();SFX.tap();}};
$('#tVibe').onclick=function(){S.vibe=!S.vibe;save();paintToggles();vibe(30);};
var resetTimer=null;
$('#reset').onclick=function(){
  var b=$('#reset');
  if(b.dataset.arm){var snd=S.sound,vb=S.vibe;S=DEFAULTS();S.sound=snd;S.vibe=vb;S.daily=today();save();b.dataset.arm='';b.textContent='Reset progress';clearTimeout(resetTimer);showMap();return;}
  b.dataset.arm='1';b.textContent='Tap again to erase all progress';
  resetTimer=setTimeout(function(){b.dataset.arm='';b.textContent='Reset progress';},3500);
};
document.addEventListener('keydown',function(e){
  if(!L||playView.hidden||e.ctrlKey||e.metaKey||e.altKey)return;
  if(!readyEl.hidden){if(e.key==='Enter')begin();return;}
  if(!timeupEl.hidden){if(e.key==='Enter')$('#retry').click();return;}
  if(!overlay.hidden){if(e.key==='Enter')$('#next').click();return;}
  if(e.key==='Backspace'){
    for(var s=L.slots.length-1;s>=0;s--){if(L.slots[s]!==null&&!L.locked[s]){unplace(s);break;}}
    e.preventDefault();return;
  }
  if(/^[a-zA-Z]$/.test(e.key)){
    var ch=e.key.toUpperCase();
    for(var i=0;i<L.pool.length;i++){if(L.pool[i].ch===ch&&!L.pool[i].gone&&L.slots.indexOf(i)<0){place(i);break;}}
  }
});

/* Android hardware back button (Capacitor App plugin). Leaves a level, otherwise exits the app. */
try{
  var CAP=window.Capacitor;
  if(CAP&&CAP.Plugins&&CAP.Plugins.App){
    CAP.Plugins.App.addListener('backButton',function(){
      if(!playView.hidden){showMap();}else{CAP.Plugins.App.exitApp();}
    });
  }
}catch(e){}

showMap();
})();
