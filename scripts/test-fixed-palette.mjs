// Compile the small pure digitizer modules to a temporary folder, then run the
// Node tests against the actual code. No browser or GitHub Actions needed.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const out = mkdtempSync(join(tmpdir(), 'patcher-palette-'));
try {
  const run = spawnSync(process.execPath, [require.resolve('typescript/bin/tsc'), '--target', 'ES2022', '--module', 'commonjs', '--skipLibCheck', '--strict', '--outDir', out, '--rootDir', 'src', 'src/digitize/index.ts', 'src/types.ts'], { encoding: 'utf8' });
  assert.equal(run.status, 0, run.stdout + run.stderr);
  writeFileSync(join(out, 'package.json'), '{"type":"commonjs"}');
  const { quantize, toHex, TRANSPARENT } = require(join(out, 'digitize/quantize.js'));
  const { digitize } = require(join(out, 'digitize/index.js'));
  const { DEFAULT_PARAMS } = require(join(out, 'types.js'));
  const profile = JSON.parse(readFileSync(new URL('../library/profiles.json', import.meta.url), 'utf8'))['S56-O47'];
  const palette = profile.params.fixedPalette;
  const expected = palette.map(c => c.toLowerCase());
  const make = (w,h,fn) => {
    const data = new Uint8ClampedArray(w*h*4);
    for(let y=0;y<h;y++) for(let x=0;x<w;x++) {
      const c=fn(x,y); if(c==null) continue;
      const n=parseInt(c.slice(1),16); data.set([(n>>16)&255,(n>>8)&255,n&255,255],(y*w+x)*4);
    }
    return data;
  };
  // Reproduce the Police College color distribution without a DOM.
  const w=240,h=240;
  const data=make(w,h,(x,y)=>{if(x<8||y<8||x>=232||y>=232)return null;if(x<15||y<15||x>=225||y>=225)return palette[2];if(x<60||x>=180||y<60||y>=180)return palette[0];if(x>=85&&x<115&&y>=85&&y<155)return palette[3];return palette[1];});
  const automatic=quantize(data,w,h,12,30);
  assert.ok(automatic.palette.length<4, 'automatic merging reproduces loss');
  const locked=quantize(data,w,h,2,80,palette);
  assert.deepEqual(locked.palette.map(toHex),expected);
  assert.equal(locked.labels[0],TRANSPARENT);
  assert.equal(locked.labels[100*w+100],3);
  assert.equal(locked.labels[100*w+130],1);
  assert.equal(locked.labels[10*w+10],2);
  const colors=['#010203','#010204','#abcdef'];
  const close=quantize(make(4,1,x=>['#010203','#010204','#010205',null][x]),4,1,1,80,colors);
  assert.deepEqual(close.palette.map(toHex),colors.slice(0,2));
  assert.deepEqual([...close.labels],[0,1,1,TRANSPARENT]);
  assert.deepEqual(quantize(data,w,h,12,30,[]),automatic);
  assert.throws(()=>quantize(data,w,h,12,30,['red']),/#RRGGBB/);
  assert.deepEqual(quantize(make(1,1,()=>null),1,1,12,30,palette).palette,[]);
  assert.deepEqual(quantize(make(2,1,x=>x?'#ABCDEF':'#abcdef'),2,1,12,30,['#ABCDEF','#abcdef']).palette.map(toHex),['#abcdef']);
  for (const ground of ['cloth','stitched']) {
    const result = digitize({width:w,height:h,padPx:8,data}, {...DEFAULT_PARAMS,...profile.params,ground,border:'merrow',pxPerMm:8});
    assert.deepEqual(result.palette,expected);
    const blue=result.palette.indexOf('#8bb9c9');
    assert.ok(result.coverage[blue]>0.02);
    assert.ok(result.blocks.some(b=>b.paletteIndex===blue&&b.kind==='fill'&&b.points.length>4));
    assert.equal(result.clothIndex,ground==='cloth'?0:-1);
    assert.equal(result.borderColor,'#dbd9c0');
  }
  console.log('Fixed palette regression checks passed (automatic/fixed, exact matches, edge colors, transparency, cloth and stitched blocks).');
} finally { rmSync(out,{recursive:true,force:true}); }
