import zlib from 'node:zlib';import fs from 'node:fs';
const W=200,H=56,raw=Buffer.alloc((W*4+1)*H);
// simple 5x7 block letters for CHAS ROBERTS
const F={C:'01110100011000010000100001000101110',H:'10001100011000111111100011000110001',A:'01110100011000111111100011000110001',S:'01111100000111000001000001000011110',R:'11110100011000111110101001001010001',O:'01110100011000110001100011000101110',B:'11110100011000111110100011000111110',E:'11111100001000011110100001000011111',T:'11111001000010000100001000010000100'};
const txt='CHAS ROBERTS',sc=2,cw=6*sc;
const px=(x,y)=>{
 if(y>=H-6) return [224,20,76];
 const lx=x-8,ly=y-14;
 if(ly>=0&&ly<7*sc&&lx>=0){const i=Math.floor(lx/cw),c=txt[i];if(c&&c!==' '&&lx%cw<5*sc){const g=F[c];if(g[Math.floor(ly/sc)*5+Math.floor((lx%cw)/sc)]==='1')return [0,115,187];}}
 return [255,255,255];};
for(let y=0;y<H;y++){raw[y*(W*4+1)]=0;for(let x=0;x<W;x++){const p=px(x,y),o=y*(W*4+1)+1+x*4;raw[o]=p[0];raw[o+1]=p[1];raw[o+2]=p[2];raw[o+3]=255;}}
const crcT=[...Array(256)].map((_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0});
const crc=b=>{let c=~0;for(const x of b)c=crcT[(c^x)&255]^(c>>>8);return ~c>>>0};
const ch=(t,d)=>{const l=Buffer.alloc(4);l.writeUInt32BE(d.length);const td=Buffer.concat([Buffer.from(t),d]);const c=Buffer.alloc(4);c.writeUInt32BE(crc(td));return Buffer.concat([l,td,c])};
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(W,0);ihdr.writeUInt32BE(H,4);ihdr[8]=8;ihdr[9]=6;
fs.writeFileSync('public/chas-roberts-logo.png',Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),ch('IHDR',ihdr),ch('IDAT',zlib.deflateSync(raw)),ch('IEND',Buffer.alloc(0))]));
