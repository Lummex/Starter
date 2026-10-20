// @ts-nocheck
// Ported from the owner's Arena Editor (factory-design/design/references/arena-editor-source.html): the same shaders,
// particle code and look controls, driven by the owner's layout file. three r147 -> r170: colours are kept raw (no colour
// management) exactly as in the editor, so the pictures look identical.
import * as THREE from 'three';

export function buildArena(layout, bgTex, arTex, pxPerUnit) {
const scene = new THREE.Scene();
const fgScene = new THREE.Scene();
const IW = bgTex.image.width, IH = bgTex.image.height, AW = arTex.image.width, AH = arTex.image.height;
const AX = layout.arena.centerX, AY = layout.arena.centerY, AS = layout.arena.scale;
const LOOK = Object.assign({ brightness: 0, contrast: 1, saturation: 1, hue: 0 }, layout.arenaLook);
const cam = new THREE.OrthographicCamera(0, 1, 0, -1, -10, 10);
const bgU={uTex:{value:bgTex},uBright:{value:0},uContrast:{value:1},uSat:{value:1},uHue:{value:0}};
const bgMat=new THREE.ShaderMaterial({uniforms:bgU,depthTest:false,depthWrite:false,
 vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
 fragmentShader:`varying vec2 vUv;uniform sampler2D uTex;uniform float uBright,uContrast,uSat,uHue;
 void main(){vec4 tx=texture2D(uTex,vUv);vec3 c=tx.rgb;c+=uBright;c=(c-.5)*uContrast+.5;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
 const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
 vec3 y=toY*c;float ch=cos(uHue),sh=sin(uHue);y=vec3(y.x,y.y*ch-y.z*sh,y.y*sh+y.z*ch);gl_FragColor=vec4(clamp(toR*y,0.,1.),tx.a);}`});
const bg=new THREE.Mesh(new THREE.PlaneGeometry(1,1),bgMat);bg.renderOrder=0;scene.add(bg);
const arU=Object.assign({},bgU,{uTex:{value:null}});const arMat=bgMat.clone();arMat.uniforms=arU;arMat.transparent=true;
const arenaMesh=new THREE.Mesh(new THREE.PlaneGeometry(1,1),arMat);arenaMesh.renderOrder=1;scene.add(arenaMesh);
arU.uTex.value = arTex;
bg.scale.set(IW, IH, 1); bg.position.set(IW / 2, -IH / 2, 0);
arenaMesh.scale.set(AW * AS, AH * AS, 1); arenaMesh.position.set(AX, -AY, 0);
bgU.uBright.value = LOOK.brightness; bgU.uContrast.value = LOOK.contrast; bgU.uSat.value = LOOK.saturation; bgU.uHue.value = LOOK.hue * Math.PI / 180;
const A2W=([x,y])=>[AX+(x-AW/2)*AS,AY+(y-AH/2)*AS],W2A=(x,y)=>[(x-AX)/AS+AW/2,(y-AY)/AS+AH/2];
function homog(P){const [[x0,y0],[x1,y1],[x2,y2],[x3,y3]]=P;const dx1=x1-x2,dx2=x3-x2,dy1=y1-y2,dy2=y3-y2,sx=x0-x1+x2-x3,sy=y0-y1+y2-y3;
 const den=dx1*dy2-dx2*dy1;const g=(sx*dy2-dx2*sy)/den,h=(dx1*sy-sx*dy1)/den;
 const a=x1-x0+g*x1,b=x3-x0+h*x3,c=x0,d=y1-y0+g*y1,e=y3-y0+h*y3,f=y0;
 return (u,v)=>{const w=g*u+h*v+1;return[(a*u+b*v+c)/w,(d*u+e*v+f)/w];};}
const glowTex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d');const gr=g.createRadialGradient(32,32,0,32,32,32);
 gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.3,'rgba(255,255,255,.6)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);})();
const PAL={flame:[['cCore','Hot center','#fff6c0'],['cMid','Middle flame','#ffb030'],['cTip','Flame tips','#c0300a']],
 waterfall:[['cDeep','Deep water','#2f7a0c'],['cLight','Bright streaks','#c6ff3a'],['cFoam','Foam / white water','#f2ffc0'],['cMist','Mist at the bottom','#b8ff7a'],['cGlowW','Glow and splash','#9dff3a']],
 glow:[['cGlow','Glow color','#b07aff']],
 lantern:[['cCore','Flame core','#fff1b8'],['cGlow','Light around it','#ff9a2e']],
 eyes:[['cEye','Eye color','#ff3a2a'],['cGlow','Eye glow','#ff7a3a']],
 banner:[['cSheen','Shimmer color','#ffffff']],
 testunit:[],
 plant:[],
 fireflies:[['cCore','Firefly center','#fbffd0'],['cGlow','Firefly glow','#c8ff3a']],
 shimmer:[['cKey','Water color (only this color shimmers)','#58903a'],['cGlint','Sparkle color','#f2ffc0'],['cTint','Water tint','#9dff3a']],
 pool:[['cSurf','Acid glow','#7dff2a'],['cHi','Bright swirls','#e8ff8a'],['cSmoke','Smoke','#a8ff9a']]};
const SLIDERS={flame:[['size','Size',.3,4,.05],['height','Flame height',.3,4,.05]],
 waterfall:[['width','Width',4,200,1],['length','Fall length',10,700,1],['lean','Lean left / right',-120,120,1],['speed','Flow speed',.3,3,.05],['opacity','Opacity',.2,1,.01],['glow','Glow strength',0,1.5,.01],['splash','Splash at the bottom',0,2,.01]],
 glow:[['radius','Size',10,400,1],['strength','Brightness',.1,1.5,.01],['pulse','Flicker',0,1,.01]],
 lantern:[['size','Size',.3,3,.05],['strength','Brightness',.1,1.5,.01],['flicker','Flicker amount',0,1,.01],['speed','Flicker speed',.3,3,.05]],
 eyes:[['spacing','Eye spacing',2,60,1],['size','Eye size',.3,3,.05],['strength','Brightness',.1,1.5,.01],['flicker','Flicker',0,1,.01],['blink','Blinks',0,1,.01]],
 testunit:[['size','Size',.3,4,.05]],
 fireflies:[['width','Area width',20,1600,1],['height','Area height',20,900,1],['count','How many',1,80,1],['size','Size',.3,3,.05],['strength','Brightness',.1,1.5,.01],['wander','Wander distance',0,120,1],['speed','Flying speed',.1,3,.05],['blink','Blinking',0,1,.01],['front','0 = behind arena, 1 = in front',0,1,1]],
 shimmer:[['width','Width',20,1600,1],['height','Height',10,800,1],['ripple','Ripple strength',0,14,.1],['rsize','Ripple size',6,150,1],['speed','Speed',.1,3,.05],['sparkle','Sparkles',0,1,.01],['sheen','Light and dark bands',0,1,.01],['tint','Tint amount',0,1,.01],['match','Water color match (1 = everything)',0,1,.01],['soft','Soft edge',0,1,.01]],
 plant:[['width','Width',10,500,1],['height','Height',10,500,1],['amount','Sway amount',0,30,.1],['speed','Sway speed',.2,3,.05],['gust','Gusts',0,1,.01],['layer','Picture: 0 = arena, 1 = swamp',0,1,1]],
 banner:[['width','Width',10,300,1],['height','Height',20,500,1],['amount','Wave amount',0,14,.1],['speed','Wave speed',.2,3,.05],['shimmer','Shimmer',0,1,.01],['tilt','Tilt',-30,30,1]],
 pool:[['width','Width',20,1200,1],['height','Height',10,600,1],['opacity','Acid glow strength',0,1.2,.01],['speed','Swirl speed',.1,3,.05],['bubbles','Bubbles',0,1,.01],['smoke','Smoke',0,1,.01]]};
const DEF={flame:{size:1,height:1},waterfall:{width:40,length:220,lean:0,speed:1,opacity:.9,glow:.7,splash:1},glow:{radius:90,strength:.6,pulse:.3},lantern:{size:1,strength:.9,flicker:.6,speed:1},eyes:{spacing:16,size:1,strength:1,flicker:.5,blink:.3},testunit:{size:1},plant:{width:80,height:90,amount:4,speed:1,gust:.5,layer:0},fireflies:{width:400,height:200,count:18,size:1,strength:.9,wander:40,speed:1,blink:.7,front:1},shimmer:{width:320,height:90,ripple:3,rsize:30,speed:.6,sparkle:.5,sheen:.5,tint:0,match:.45,soft:.5},banner:{width:60,height:140,amount:4,speed:1,shimmer:.5,tilt:0},pool:{width:260,height:110,opacity:.55,speed:1,bubbles:.5,smoke:.5}};

const effects=[];let nextId=1;
function makeFlame(d){const root=new THREE.Group();const N=60;const geo=new THREE.BufferGeometry();const pos=new Float32Array(N*3),col=new Float32Array(N*3);
 geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('color',new THREE.BufferAttribute(col,3));
 const mat=new THREE.PointsMaterial({size:10,sizeAttenuation:false,map:glowTex,vertexColors:true,transparent:true,depthTest:false,blending:THREE.AdditiveBlending});
 const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;pts.renderOrder=10;root.add(pts);
 const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:THREE.AdditiveBlending,opacity:.35}));halo.renderOrder=9;root.add(halo);
 const seeds=[...Array(N)].map(()=>({t:Math.random(),a:Math.random()*6.28,r:Math.random(),s:.7+Math.random()*.6}));
 const C1=new THREE.Color(),C2=new THREE.Color(),C3=new THREE.Color(),T=new THREE.Color();
 return{root,update(time,dt){C1.set(d.cCore);C2.set(d.cMid);C3.set(d.cTip);const U=12*d.size,Hh=40*d.height;
  seeds.forEach((p,i)=>{p.t+=dt*.9*p.s;if(p.t>1){p.t-=1;p.a=Math.random()*6.28;p.r=Math.random();}const t=p.t;
   pos[i*3]=Math.cos(p.a+time*2)*U*(1-t)*p.r*.8;pos[i*3+1]=t*Hh;pos[i*3+2]=2;
   if(t<.25)T.copy(C1).lerp(C2,t/.25);else T.copy(C2).lerp(C3,(t-.25)/.75);const k=1-t*.85;col[i*3]=k*T.r;col[i*3+1]=k*T.g;col[i*3+2]=k*T.b;});
  geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;mat.size=Math.max(2,14*d.size*pxPerUnit());
  halo.material.color.copy(C2);halo.scale.setScalar(70*d.size*(1+.08*Math.sin(time*13+d.id)));halo.position.set(0,Hh*.3,1);}};}
const waterVS='varying vec2 vUv;uniform float uLean;void main(){vUv=uv;vec3 p=position;float t=-p.y;p.x+=uLean*t*t;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}';
const waterFS=`varying vec2 vUv;uniform float uTime,uSpeed,uW,uL,uOp;uniform vec3 uDeep,uLight,uFoam;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
void main(){float x=vUv.x,y=1.-vUv.y;float s=y*uL/60.-uTime*uSpeed*2.2;
 float a=n(vec2(x*uW/6.,s*2.));float b=n(vec2(x*uW/2.5+3.,s*5.));float st=a*.6+b*.4;
 vec3 c=mix(uDeep,uLight,smoothstep(.35,.85,st));float edge=smoothstep(0.,.2,x)*smoothstep(1.,.8,x);float top=smoothstep(0.,.05,y);float bot=1.-smoothstep(.6,1.,y);
 c=mix(c,uFoam,(1.-bot)*.6+smoothstep(.8,.97,st)*.5);gl_FragColor=vec4(c,edge*top*(.55+.45*st)*(.35+.65*bot)*uOp);}`;
function makeWater(d){const root=new THREE.Group();const geo=new THREE.PlaneGeometry(1,1,1,30);geo.translate(0,-.5,0);
 const U={uTime:{value:0},uSpeed:{value:1},uW:{value:1},uL:{value:1},uOp:{value:1},uLean:{value:0},uDeep:{value:new THREE.Color()},uLight:{value:new THREE.Color()},uFoam:{value:new THREE.Color()}};
 const sheet=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:U,vertexShader:waterVS,fragmentShader:waterFS,transparent:true,depthTest:false,side:THREE.DoubleSide}));sheet.renderOrder=8;root.add(sheet);
 const gl=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:THREE.AdditiveBlending}));gl.renderOrder=7;root.add(gl);
 const sp=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:THREE.AdditiveBlending}));sp.renderOrder=10;root.add(sp);
 const mk=(o,add)=>{const q=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:add?THREE.AdditiveBlending:THREE.NormalBlending}));q.renderOrder=o;root.add(q);return q;};
 const drops=[...Array(30)].map(()=>({s:mk(10,true),t:Math.random(),x:0,y:0,vx:0,vy:0,life:1,sz:1}));
 const bubs=[...Array(18)].map(()=>({s:mk(10,true),t:Math.random(),x:0,sz:.5+Math.random()}));
 const foam=[...Array(7)].map((_,i)=>({s:mk(9,false),ph:Math.random()*6.28,x:(i/6-.5)}));
 const spawnDrop=o=>{o.x=(Math.random()-.5)*d.width*.8;o.y=0;const sp=(40+Math.random()*90)*d.splash;o.vx=(Math.random()-.5)*sp*1.4;o.vy=sp*(.6+Math.random()*.7);o.life=.5+Math.random()*.7;o.t=0;o.sz=.5+Math.random();};
 const M=14,mists=[];for(let i=0;i<M;i++){const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,opacity:.18}));s.renderOrder=9;root.add(s);mists.push({s,t:Math.random(),x:Math.random()-.5});}
 return{root,update(time,dt){sheet.scale.set(d.width,d.length,1);U.uTime.value=time;U.uSpeed.value=d.speed;U.uW.value=d.width;U.uL.value=d.length;U.uOp.value=d.opacity;U.uLean.value=d.lean/d.width;
  U.uDeep.value.set(d.cDeep);U.uLight.value.set(d.cLight);U.uFoam.value.set(d.cFoam);
  const gc=d.cGlowW||'#9dff3a';gl.material.color.set(gc);gl.material.opacity=.35*d.glow;gl.scale.set(d.width*3.2,d.length*1.05,1);gl.position.set(d.lean*.5,-d.length*.5,0);
  sp.material.color.set(gc);sp.material.opacity=Math.min(1,.55*d.splash*(.85+.15*Math.sin(time*9+d.id)));sp.scale.set(d.width*2.6*d.splash,d.width*1.3*d.splash,1);sp.position.set(d.lean,-d.length,1);
  const by=-d.length,bx=d.lean;
  drops.forEach(o=>{o.t+=dt;if(o.t>o.life||o.vy===0)spawnDrop(o);o.vy-=260*dt;o.x+=o.vx*dt;o.y+=o.vy*dt;const k=o.t/o.life;
   o.s.material.color.set(Math.random()<.5?d.cFoam:d.cLight);o.s.material.opacity=d.splash>0?(1-k)*.9:0;const sc=(3+3*o.sz)*Math.max(.4,d.width/40);o.s.scale.setScalar(sc);o.s.position.set(bx+o.x,by+Math.max(-6,o.y),2);});
  bubs.forEach(b=>{b.t+=dt*(.6+b.sz*.5)*d.speed;if(b.t>1){b.t=0;b.x=(Math.random()-.5)*d.width*2.2;}const k=b.t;
   b.s.material.color.set(d.cHi||d.cLight);b.s.material.opacity=d.splash>0?(k<.8?k:(1-k)*4)*.85:0;b.s.scale.setScalar((2.5+7*k)*b.sz*(k>.8?1.7:1)*Math.max(.4,d.width/40));
   b.s.position.set(bx+b.x,by-6+Math.sin(k*9+b.sz*7)*3+k*-4,2);});
  foam.forEach(f=>{const p=.5+.5*Math.sin(time*3.1*d.speed+f.ph);f.s.material.color.set(d.cFoam);f.s.material.opacity=.32*d.splash*(.6+.4*p);
   const sc=d.width*(.7+.5*p);f.s.scale.set(sc*1.3,sc*.55,1);f.s.position.set(bx+f.x*d.width*1.6,by+2+p*4,1);});
  mists.forEach(m=>{m.t+=dt*.12;if(m.t>1)m.t-=1;m.s.material.color.set(d.cMist);m.s.material.opacity=.22*Math.sin(m.t*Math.PI)*d.opacity;
   const sc=d.width*(1.2+m.t*1.6);m.s.scale.set(sc,sc,1);m.s.position.set(d.lean+m.x*d.width*1.4,-d.length*(.85+.1*m.t)+m.t*d.width*.5,1);});}};}
function Candle(){let v=1,target=1,next=0;const ph=Math.random()*100,rate=.7+Math.random()*.8;
 return (dt,amt,speed)=>{next-=dt*speed*rate;if(next<=0){target=1-Math.random()*amt*(Math.random()<.12?1:.55);next=.04+Math.random()*.16;}
  v+=(target-v)*Math.min(1,dt*(14+Math.random()*10)*speed);return v*(1+amt*.06*Math.sin((performance.now()/1000)*9*rate+ph));};}
function makeGlow(d){const root=new THREE.Group();const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:THREE.AdditiveBlending}));s.renderOrder=7;root.add(s);
 const fl=Candle();return{root,update(time,dt){const f=fl(dt,d.pulse,1);s.material.color.set(d.cGlow);s.material.opacity=Math.min(1,d.strength*f);s.scale.setScalar(d.radius*2*(.94+.06*f));}};}
const spr=(o,blend=true)=>{const s=new THREE.Sprite(new THREE.SpriteMaterial({map:glowTex,transparent:true,depthTest:false,blending:blend?THREE.AdditiveBlending:THREE.NormalBlending}));s.renderOrder=o;return s;};
const flick=(t,seed,sp)=>{const a=Math.sin(t*7.3*sp+seed)*.5+Math.sin(t*13.1*sp+seed*2.1)*.3+Math.sin(t*23.7*sp+seed*.7)*.2;return a;};
function makeLantern(d){const root=new THREE.Group();const halo=spr(7),core=spr(9),mid=spr(8);root.add(halo,mid,core);const fl=Candle();
 return{root,update(t,dt){const f=fl(dt,d.flicker,d.speed);const sz=d.size;
  halo.material.color.set(d.cGlow);halo.material.opacity=Math.min(1,.45*d.strength*f);halo.scale.setScalar(110*sz*(.92+.08*f));
  mid.material.color.set(d.cGlow);mid.material.opacity=Math.min(1,.8*d.strength*f);mid.scale.setScalar(34*sz);
  core.material.color.set(d.cCore);core.material.opacity=Math.min(1,d.strength*(.85+.15*f));core.scale.setScalar(14*sz*(.9+.1*f));}};}
function makeEyes(d){const root=new THREE.Group();const fl=Candle();const E=[0,1].map(()=>{const g=spr(8),c=spr(9);root.add(g,c);return{g,c};});let blinkT=2+Math.random()*4,blinkLeft=0;
 return{root,update(t,dt){blinkT-=dt;if(blinkT<=0){blinkLeft=.14;blinkT=(1.5+Math.random()*5)/Math.max(.05,d.blink);}let open=1;if(blinkLeft>0&&d.blink>0){blinkLeft-=dt;open=.05;}
  const f=fl(dt,d.flicker*.8,1)*open;E.forEach((e,i)=>{const x=(i?1:-1)*d.spacing/2;
   e.g.material.color.set(d.cGlow);e.g.material.opacity=Math.min(1,.55*d.strength*f);e.g.scale.setScalar(26*d.size);e.g.position.set(x,0,0);
   e.c.material.color.set(d.cEye);e.c.material.opacity=Math.min(1,d.strength*f);e.c.scale.set(8*d.size,8*d.size*Math.max(.15,open),1);e.c.position.set(x,0,1);});}};}
const poolFS=`varying vec2 vUv;uniform float uTime,uSpeed,uOp;uniform vec3 uSurf,uHi;
float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<4;i++){v+=a*n(p);p*=2.03;a*=.5;}return v;}
void main(){vec2 q=vUv*2.-1.;float r=length(q);float mask=1.-smoothstep(.55,1.,r);float t=uTime*uSpeed*.35;
 vec2 p=vUv*vec2(6.,3.);float w=fbm(p+vec2(t,t*.6)+fbm(p*1.3-vec2(t*.8,0.)));float caust=pow(1.-abs(fbm(p*2.+vec2(-t,t*.7))*2.-1.),6.);
 vec3 c=mix(uSurf,uHi,smoothstep(.45,.85,w)*.7+caust*.8);gl_FragColor=vec4(c,mask*uOp*(.35+.45*w+.4*caust));}`;
function makePool(d){const root=new THREE.Group();const U={uTime:{value:0},uSpeed:{value:1},uOp:{value:.5},uSurf:{value:new THREE.Color()},uHi:{value:new THREE.Color()}};
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:U,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:poolFS,transparent:true,depthTest:false,blending:THREE.AdditiveBlending}));m.renderOrder=6;root.add(m);
 const B=24,bub=[...Array(B)].map(()=>{const s=spr(8);root.add(s);return{s,t:Math.random(),x:0,y:0,sz:.5+Math.random()};});
 const S=10,smk=[...Array(S)].map(()=>{const s=spr(11,false);root.add(s);return{s,t:Math.random(),x:Math.random()-.5,y:Math.random()-.5,dr:(Math.random()-.5)};});
 const place=o=>{const a=Math.random()*6.283,r=Math.sqrt(Math.random())*.42;o.x=Math.cos(a)*r;o.y=Math.sin(a)*r;};bub.forEach(place);
 return{root,update(t,dt){m.scale.set(d.width,d.height,1);U.uTime.value=t;U.uSpeed.value=d.speed;U.uOp.value=d.opacity;U.uSurf.value.set(d.cSurf);U.uHi.value.set(d.cHi);
  bub.forEach((b,i)=>{b.t+=dt*(.5+b.sz*.4)*d.speed;if(b.t>1){b.t=0;place(b);}const on=i<B*d.bubbles;const k=b.t;
   b.s.visible=on;b.s.material.color.set(d.cHi);b.s.material.opacity=on?(k<.85?k*.9:(1-k)*6)*.9:0;const sc=(3+7*k)*b.sz*(k>.85?1.6:1);b.s.scale.setScalar(sc);b.s.position.set(b.x*d.width,b.y*d.height,1);});
  smk.forEach((o,i)=>{o.t+=dt*.06*d.speed;if(o.t>1){o.t-=1;o.x=Math.random()-.5;o.y=Math.random()-.5;o.dr=Math.random()-.5;}const on=i<S*d.smoke;const k=o.t;
   o.s.visible=on;o.s.material.color.set(d.cSmoke);o.s.material.opacity=on?Math.sin(k*Math.PI)*.16:0;const sc=(.35+k*.9)*Math.min(d.width,d.height*2.2);o.s.scale.set(sc,sc*.7,1);
   o.s.position.set(o.x*d.width*.7+o.dr*k*60,o.y*d.height*.6+k*d.height*1.4,2);});}};}
const bannerFS=`varying vec2 vUv;uniform sampler2D uTex;uniform vec4 uRect;uniform vec3 uAr;uniform vec2 uAS;uniform float uTime,uAmt,uSpeed,uShim,uTilt,uBright,uContrast,uSat,uHue;uniform vec3 uSheen;
vec3 adj(vec3 c){c+=uBright;c=(c-.5)*uContrast+.5;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
 const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
 vec3 y=toY*c;float ch=cos(uHue),sh=sin(uHue);y=vec3(y.x,y.y*ch-y.z*sh,y.y*sh+y.z*ch);return clamp(toR*y,0.,1.);}
void main(){float k=1.-vUv.y;float wx=uRect.x+vUv.x*uRect.z,wy=uRect.y+k*uRect.w;
 float ph=k*6.2-uTime*uSpeed*3.+vUv.x*2.;float dx=uAmt*k*sin(ph),dy=uAmt*.25*k*cos(ph*1.3);
 float sx=wx-dx-uTilt*k*k,sy=wy-dy;vec2 a=vec2((sx-uAr.x)/uAr.z+uAS.x*.5,(sy-uAr.y)/uAr.z+uAS.y*.5);vec2 uv=vec2(a.x/uAS.x,1.-a.y/uAS.y);
 vec4 t=texture2D(uTex,uv);float shade=cos(ph)*k*uShim;vec3 c=adj(t.rgb)*(1.+shade*.28);c=mix(c,uSheen,max(0.,shade)*.18);
 float ex=min(vUv.x,1.-vUv.x)*uRect.z;float edge=smoothstep(0.,5.,ex)*smoothstep(0.,4.,(1.-vUv.y)*uRect.w)*smoothstep(0.,6.,vUv.y*uRect.w);
 gl_FragColor=vec4(c,t.a*edge);}`;
function makeBanner(d){const root=new THREE.Group();const U={uTex:arU.uTex,uRect:{value:new THREE.Vector4()},uAr:{value:new THREE.Vector3()},uAS:{value:new THREE.Vector2()},uTime:{value:0},uAmt:{value:4},uSpeed:{value:1},uShim:{value:.5},uTilt:{value:0},uSheen:{value:new THREE.Color()},uBright:bgU.uBright,uContrast:bgU.uContrast,uSat:bgU.uSat,uHue:bgU.uHue};
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1,1,1),new THREE.ShaderMaterial({uniforms:U,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:bannerFS,transparent:true,depthTest:false}));m.renderOrder=2;
 const og=new THREE.BufferGeometry();og.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,3,.5,0,3,.5,-1,3,-.5,-1,3],3));const ol=new THREE.LineLoop(og,new THREE.LineDashedMaterial({color:0xd79bff,dashSize:6,gapSize:5,depthTest:false,transparent:true,opacity:.8}));ol.renderOrder=20;
 scene.add(m);root.add(ol);
 return{root,dispose(){scene.remove(m);},update(t){m.visible=arenaMesh.visible;const x0=d.x-d.width/2,y0=d.y;m.scale.set(d.width,d.height,1);m.position.set(d.x,-(d.y+d.height/2),0);
  U.uRect.value.set(x0,y0,d.width,d.height);U.uAr.value.set(AX,AY,AS);U.uAS.value.set(AW,AH);U.uTime.value=t;U.uAmt.value=d.amount;U.uSpeed.value=d.speed;U.uShim.value=d.shimmer;U.uTilt.value=d.tilt;U.uSheen.value.set(d.cSheen);
  ol.scale.set(d.width,d.height,1);ol.computeLineDistances();ol.visible=false;}};}
const unitTex=(()=>{const c=document.createElement('canvas');c.width=128;c.height=160;const g=c.getContext('2d');
 g.fillStyle='rgba(0,0,0,.35)';g.beginPath();g.ellipse(64,150,40,9,0,0,7);g.fill();
 g.fillStyle='#5b8a2e';g.beginPath();g.ellipse(64,108,30,36,0,0,7);g.fill();g.fillStyle='#6fa83a';g.beginPath();g.ellipse(64,58,30,27,0,0,7);g.fill();
 g.beginPath();g.moveTo(36,52);g.lineTo(6,38);g.lineTo(38,64);g.fill();g.beginPath();g.moveTo(92,52);g.lineTo(122,38);g.lineTo(90,64);g.fill();
 g.fillStyle='#ffe14a';g.beginPath();g.arc(53,56,5,0,7);g.arc(75,56,5,0,7);g.fill();g.fillStyle='#fff';g.fillRect(52,70,24,5);
 g.fillStyle='#7a4a22';g.fillRect(28,92,8,52);g.fillRect(92,92,8,52);return new THREE.CanvasTexture(c);})();
function makeUnit(d){const root=new THREE.Group();const s=new THREE.Sprite(new THREE.SpriteMaterial({map:unitTex,transparent:true,depthTest:false}));s.renderOrder=25;s.center.set(.5,.06);root.add(s);
 return{root,update(t){s.scale.set(64*d.size,80*d.size,1);s.position.y=Math.abs(Math.sin(t*2.5+d.id))*2;}};}
const plantFS=`varying vec2 vUv;uniform sampler2D uTex;uniform vec4 uRect;uniform vec3 uAr;uniform vec2 uAS;uniform float uTime,uAmt,uSpeed,uGust,uSeed,uLayer,uIW,uIH,uBright,uContrast,uSat,uHue;
vec3 adj(vec3 c){c+=uBright;c=(c-.5)*uContrast+.5;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
 const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
 vec3 y=toY*c;float ch=cos(uHue),sh=sin(uHue);y=vec3(y.x,y.y*ch-y.z*sh,y.y*sh+y.z*ch);return clamp(toR*y,0.,1.);}
void main(){float k=vUv.y;float wx=uRect.x+vUv.x*uRect.z,wy=uRect.y+(1.-vUv.y)*uRect.w;float t=uTime*uSpeed;
 float g=1.+uGust*(.6*sin(t*.37+uSeed)+.4*sin(t*.91+uSeed*2.));float ph=t*1.7+uSeed+wx*.035;
 float kk=pow(k,1.3)*3.;float dx=uAmt*kk*(sin(ph)+.35*sin(ph*2.3+wy*.05))*g,dy=uAmt*.2*kk*abs(sin(ph));
 float sx=wx-dx,sy=wy-dy;vec2 uv;if(uLayer>.5){uv=vec2(sx/uIW,1.-sy/uIH);}else{vec2 a=vec2((sx-uAr.x)/uAr.z+uAS.x*.5,(sy-uAr.y)/uAr.z+uAS.y*.5);uv=vec2(a.x/uAS.x,1.-a.y/uAS.y);}
 vec4 tx=texture2D(uTex,uv);vec2 q=vUv*2.-1.;float m=(1.-smoothstep(.7,1.,abs(q.x)))*smoothstep(0.,.12,vUv.y)*(1.-smoothstep(.93,1.,vUv.y));
 gl_FragColor=vec4(adj(tx.rgb),(uLayer>.5?1.:tx.a)*m);}`;
function makePlant(d){const root=new THREE.Group();const U={uTex:{value:null},uRect:{value:new THREE.Vector4()},uAr:{value:new THREE.Vector3()},uAS:{value:new THREE.Vector2()},uTime:{value:0},uAmt:{value:4},uSpeed:{value:1},uGust:{value:.5},uSeed:{value:Math.random()*100},uLayer:{value:0},uIW:{value:1},uIH:{value:1},uBright:bgU.uBright,uContrast:bgU.uContrast,uSat:bgU.uSat,uHue:bgU.uHue};
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:U,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:plantFS,transparent:true,depthTest:false}));scene.add(m);
 const og=new THREE.BufferGeometry();og.setAttribute('position',new THREE.Float32BufferAttribute([-.5,0,3,.5,0,3,.5,1,3,-.5,1,3],3));const ol=new THREE.LineLoop(og,new THREE.LineDashedMaterial({color:0x7ee06a,dashSize:6,gapSize:5,depthTest:false,transparent:true,opacity:.85}));ol.renderOrder=20;root.add(ol);
 return{root,dispose(){scene.remove(m);},update(t){const sw=d.layer>.5;U.uTex.value=sw?bgU.uTex.value:arU.uTex.value;m.renderOrder=sw?.5:2;m.visible=sw||arenaMesh.visible;
  m.scale.set(d.width,d.height,1);m.position.set(d.x,-(d.y-d.height/2),0);U.uRect.value.set(d.x-d.width/2,d.y-d.height,d.width,d.height);U.uAr.value.set(AX,AY,AS);U.uAS.value.set(AW,AH);U.uIW.value=IW;U.uIH.value=IH;
  U.uTime.value=t;U.uAmt.value=d.amount;U.uSpeed.value=d.speed;U.uGust.value=d.gust;U.uLayer.value=d.layer;
  ol.scale.set(d.width,d.height,1);ol.computeLineDistances();ol.visible=false;}};}
const shimFS=`varying vec2 vUv;uniform sampler2D uTex;uniform vec4 uRect;uniform vec3 uGlint,uTint,uKey;uniform float uMatch,uTime,uRip,uSize,uSpeed,uSpark,uSheen,uTintA,uSoft,uSeed,uIW,uIH,uBright,uContrast,uSat,uHue;
vec3 adj(vec3 c){c+=uBright;c=(c-.5)*uContrast+.5;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
 const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
 vec3 y=toY*c;float ch=cos(uHue),sh=sin(uHue);y=vec3(y.x,y.y*ch-y.z*sh,y.y*sh+y.z*ch);return clamp(toR*y,0.,1.);}
float hs(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float nz(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hs(i),hs(i+vec2(1.,0.)),f.x),mix(hs(i+vec2(0.,1.)),hs(i+1.),f.x),f.y);}
void main(){vec2 w=vec2(uRect.x+vUv.x*uRect.z,uRect.y+(1.-vUv.y)*uRect.w);float t=uTime*uSpeed+uSeed;vec2 p=w/uSize;
 float a=nz(p*vec2(1.,2.6)+vec2(t*.6,t*.22)),b=nz(p*vec2(1.7,4.2)-vec2(t*.45,-t*.3));
 vec3 o0=texture2D(uTex,vec2(w.x/uIW,1.-w.y/uIH)).rgb;float s0=o0.r+o0.g+o0.b+.001,sk=uKey.r+uKey.g+uKey.b+.001;
 float kd=length(o0/s0-uKey/sk)*4.+abs(s0-sk)*.35;float km=uMatch>.99?1.:1.-smoothstep(uMatch*.85,uMatch*.85+.28,kd);
 vec2 off=vec2(a-.5,(b-.5)*.55)*2.*uRip*km;
 vec3 c=adj(texture2D(uTex,vec2((w.x+off.x)/uIW,1.-(w.y+off.y)/uIH)).rgb);
 c*=1.+(a+b-1.)*uSheen*.45;c=mix(c,c*uTint*1.4,uTintA*.6);
 float g=nz(p*vec2(3.,10.)+vec2(t*1.3,t*.2))*nz(p*vec2(5.,15.)-vec2(t*.8,-t*.5));float tw=.5+.5*sin(t*6.+hs(floor(p*vec2(3.,10.)))*40.);
 g=smoothstep(.5-.2*uSpark,.72,g)*uSpark*tw;float lum=dot(c,vec3(.3,.59,.11));c+=uGlint*g*(.6+lum);
 vec2 q=vUv*2.-1.;float m=1.-smoothstep(1.-max(uSoft,.02),1.,length(q));gl_FragColor=vec4(c,m*km);}`;
function makeShimmer(d){const root=new THREE.Group();const U={uTex:{value:null},uRect:{value:new THREE.Vector4()},uGlint:{value:new THREE.Color()},uKey:{value:new THREE.Color()},uMatch:{value:.45},uTint:{value:new THREE.Color()},uTime:{value:0},uRip:{value:3},uSize:{value:30},uSpeed:{value:1},uSpark:{value:.5},uSheen:{value:.5},uTintA:{value:0},uSoft:{value:.5},uSeed:{value:Math.random()*100},uIW:{value:1},uIH:{value:1},uBright:bgU.uBright,uContrast:bgU.uContrast,uSat:bgU.uSat,uHue:bgU.uHue};
 const m=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShaderMaterial({uniforms:U,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:shimFS,transparent:true,depthTest:false}));m.renderOrder=.5;scene.add(m);
 const P=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;P.push(Math.cos(a)*.5,Math.sin(a)*.5,3);}const og=new THREE.BufferGeometry();og.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
 const ol=new THREE.LineLoop(og,new THREE.LineDashedMaterial({color:0x8fe8ff,dashSize:6,gapSize:5,depthTest:false,transparent:true,opacity:.85}));ol.renderOrder=20;root.add(ol);
 return{root,dispose(){scene.remove(m);},update(t){U.uTex.value=bgU.uTex.value;m.scale.set(d.width,d.height,1);m.position.set(d.x,-d.y,0);U.uRect.value.set(d.x-d.width/2,d.y-d.height/2,d.width,d.height);U.uIW.value=IW;U.uIH.value=IH;
  U.uTime.value=t;U.uRip.value=d.ripple;U.uSize.value=d.rsize;U.uSpeed.value=d.speed;U.uSpark.value=d.sparkle;U.uSheen.value=d.sheen;U.uTintA.value=d.tint;U.uSoft.value=d.soft;U.uGlint.value.set(d.cGlint);U.uKey.value.set(d.cKey);U.uMatch.value=d.match;U.uTint.value.set(d.cTint);
  ol.scale.set(d.width,d.height,1);ol.computeLineDistances();ol.visible=false;}};}
function makeFireflies(d){const root=new THREE.Group();const N=80,F=[];
 for(let i=0;i<N;i++){const h=spr(12),c=spr(13);root.add(h,c);F.push({h,c,bx:Math.random()-.5,by:Math.random()-.5,f1:.2+Math.random()*.5,f2:.15+Math.random()*.4,p1:Math.random()*99,p2:Math.random()*99,br:.25+Math.random()*.6,bp:Math.random()*99,sz:.7+Math.random()*.6});}
 const P=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;P.push(Math.cos(a)*.5,Math.sin(a)*.5,3);}const og=new THREE.BufferGeometry();og.setAttribute('position',new THREE.Float32BufferAttribute(P,3));
 const ol=new THREE.LineLoop(og,new THREE.LineDashedMaterial({color:0xe6ff6a,dashSize:6,gapSize:5,depthTest:false,transparent:true,opacity:.7}));ol.renderOrder=20;root.add(ol);
 return{root,update(t){const ro=d.front>.5?12:.6,T=t*d.speed;
  F.forEach((q,i)=>{const on=i<d.count;q.h.visible=q.c.visible=on;if(!on)return;
   const x=q.bx*d.width+d.wander*(Math.sin(T*q.f1+q.p1)+.5*Math.sin(T*q.f1*2.3+q.p2)),y=q.by*d.height+d.wander*.7*(Math.sin(T*q.f2+q.p2)+.5*Math.cos(T*q.f2*1.9+q.p1))+3*Math.sin(T*3+q.p1);
   const bl=Math.pow(Math.max(0,Math.sin(t*q.br*2+q.bp)),3),k=(1-d.blink)+d.blink*bl;
   q.h.position.set(x,-y,0);q.c.position.set(x,-y,0);q.h.renderOrder=ro;q.c.renderOrder=ro+.1;
   q.h.material.color.set(d.cGlow);q.c.material.color.set(d.cCore);q.h.material.opacity=Math.min(1,d.strength*k*.7);q.c.material.opacity=Math.min(1,d.strength*k);
   q.h.scale.setScalar(22*d.size*q.sz);q.c.scale.setScalar(6*d.size*q.sz);});
  ol.scale.set(d.width+2*d.wander,d.height+1.4*d.wander,1);ol.computeLineDistances();ol.visible=false;}};}
const MAKERS={fireflies:makeFireflies,shimmer:makeShimmer,plant:makePlant,testunit:makeUnit,banner:makeBanner,flame:makeFlame,waterfall:makeWater,glow:makeGlow,lantern:makeLantern,eyes:makeEyes,pool:makePool};
function addEffect(d){d=Object.assign({},DEF[d.type],d);PAL[d.type].forEach(([k,,v])=>{if(!d[k])d[k]=v;});d.id=d.id||nextId++;nextId=Math.max(nextId,d.id+1);
 const fx=MAKERS[d.type](d);fx.d=d;fx.root.position.set(d.x,-d.y,0);scene.add(fx.root);effects.push(fx);return fx;}
THREE.ColorManagement.enabled = false;
layout.effects.forEach((d) => addEffect(Object.assign({}, d)));
const cutVS='varying vec2 vW;void main(){vW=position.xy;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}';
const cutFS=`varying vec2 vW;uniform sampler2D uTex;uniform vec3 uAr;uniform vec2 uAS;uniform float uBright,uContrast,uSat,uHue;
vec3 adj(vec3 c){c+=uBright;c=(c-.5)*uContrast+.5;float l=dot(c,vec3(.299,.587,.114));c=mix(vec3(l),c,uSat);
 const mat3 toY=mat3(.299,.596,.211,.587,-.274,-.523,.114,-.322,.312);const mat3 toR=mat3(1.,1.,1.,.956,-.272,-1.106,.621,-.647,1.703);
 vec3 y=toY*c;float ch=cos(uHue),sh=sin(uHue);y=vec3(y.x,y.y*ch-y.z*sh,y.y*sh+y.z*ch);return clamp(toR*y,0.,1.);}
void main(){vec2 w=vec2(vW.x,-vW.y);vec2 a=vec2((w.x-uAr.x)/uAr.z+uAS.x*.5,(w.y-uAr.y)/uAr.z+uAS.y*.5);vec4 t=texture2D(uTex,vec2(a.x/uAS.x,1.-a.y/uAS.y));gl_FragColor=vec4(adj(t.rgb),t.a);}`;
const cutU={uTex:arU.uTex,uAr:{value:new THREE.Vector3()},uAS:{value:new THREE.Vector2()},uBright:bgU.uBright,uContrast:bgU.uContrast,uSat:bgU.uSat,uHue:bgU.uHue};
const cutMat=new THREE.ShaderMaterial({uniforms:cutU,vertexShader:cutVS,fragmentShader:cutFS,transparent:true,depthTest:false});
cutU.uAr.value.set(AX, AY, AS); cutU.uAS.value.set(AW, AH);
const cuts = layout.foregroundCutouts.map((pts) => {
  const W = pts.map(A2W);
  const mesh = new THREE.Mesh(new THREE.ShapeGeometry(new THREE.Shape(W.map(([x, y]) => new THREE.Vector2(x, -y)))), cutMat);
  mesh.renderOrder = 30; fgScene.add(mesh); return mesh;
});
THREE.ColorManagement.enabled = true;
const H = homog(layout.boardCorners.map(A2W));
return {
  scene, fgScene, cam, IW, IH, effects, cuts, homography: H,
  setView(x0, y0, w, h) { cam.left = x0; cam.right = x0 + w; cam.top = -y0; cam.bottom = -(y0 + h); cam.updateProjectionMatrix(); },
  update(t, dt) { const cm = THREE.ColorManagement.enabled; THREE.ColorManagement.enabled = false; effects.forEach((f) => f.update(t, dt)); THREE.ColorManagement.enabled = cm; },
};
}
