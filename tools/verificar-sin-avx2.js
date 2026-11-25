// Verifica que un .exe/.dll pueda correr en un CPU sin AVX2 (ej. Xeon E5-2620 v2, Ivy Bridge).
// Desensambla el código (iced-x86) y busca instrucciones AVX2 / FMA / AVX-512 / BMI.
// Las librerías de Microsoft (CRT/STL) traen versiones AVX2 de memcpy, memchr, etc. que solo se usan
// tras comprobar el CPU (variable global __isa_available / __favor). Por eso cada hallazgo se clasifica:
//   "protegida"    = antes, en la misma zona de código, hay una comprobación de una variable global (cmp/test/bt)
//   "SIN PROTEGER" = no se encontró comprobación cerca: revisar a mano.
// Uso: node tools/verificar-sin-avx2.js archivo.dll [...]
const fs = require('fs');
const { Decoder, DecoderOptions, CpuidFeature, Mnemonic, Register, OpKind, FlowControl, Formatter, FormatterSyntax } = require('iced-x86');
const BAD = /^(AVX2|FMA|FMA4|AVX512|BMI1|BMI2|AVX_VNNI|ADX|AMX|AVX_IFMA|GFNI|VAES|VPCLMULQDQ)/;
const names = {}; Object.keys(CpuidFeature).forEach((k) => { if (isNaN(+k)) names[CpuidFeature[k]] = k; });
const fmt = new Formatter(FormatterSyntax.Intel);
const WINDOW = +process.env.VENTANA || 400;
const FAM = [[Register.AL, Register.AX, Register.EAX, Register.RAX], [Register.CL, Register.CX, Register.ECX, Register.RCX],
             [Register.DL, Register.DX, Register.EDX, Register.RDX], [Register.R8L, Register.R8W, Register.R8D, Register.R8],
             [Register.R9L, Register.R9W, Register.R9D, Register.R9], [Register.R10L, Register.R10W, Register.R10D, Register.R10],
             [Register.R11L, Register.R11W, Register.R11D, Register.R11]];

function isGuard(ins, live) {
  const m = ins.mnemonic;
  if (m !== Mnemonic.Cmp && m !== Mnemonic.Test && m !== Mnemonic.Bt) return false;
  for (let i = 0; i < ins.opCount; i++) {
    const k = ins.opKind(i);
    if (k === OpKind.Memory && ins.memoryBase === Register.RIP) return true;          // cmp [__isa_available], N
    if (k === OpKind.Register && live.has(ins.opRegister(i))) return true;           // mov eax,[__favor] ; test al,20h
  }
  return false;
}

let anyUnguarded = false;
for (const file of process.argv.slice(2)) {
  const b = fs.readFileSync(file);
  const pe = b.readUInt32LE(0x3c), nsec = b.readUInt16LE(pe + 6), optSz = b.readUInt16LE(pe + 20);
  let off = pe + 24 + optSz; const counts = {}; let total = 0, guarded = 0, n = 0; const unguarded = [];
  for (let s = 0; s < nsec; s++, off += 40) {
    if (!(b.readUInt32LE(off + 36) & 0x20)) continue; // solo secciones de código
    const va = b.readUInt32LE(off + 12), rsz = b.readUInt32LE(off + 16), rp = b.readUInt32LE(off + 20);
    const dec = new Decoder(64, b.subarray(rp, rp + rsz), DecoderOptions.None);
    dec.ip = BigInt(va);
    const all = dec.decodeAll(); n += all.length;
    let lastGuard = -1e9; const loaded = new Map(); // registro -> índice donde se cargó desde una variable global
    const guardAt = new Uint8Array(all.length), pending = [];
    all.forEach((ins, k) => {
      const live = new Set(); loaded.forEach((i, r) => { if (k - i < 200) live.add(r); });
      if (isGuard(ins, live)) lastGuard = k;
      guardAt[k] = k - lastGuard <= 24 ? 1 : 0;
      if ((ins.mnemonic === Mnemonic.Mov || ins.mnemonic === Mnemonic.Movzx) && ins.opCount === 2 &&
          ins.opKind(0) === OpKind.Register && ins.opKind(1) === OpKind.Memory && ins.memoryBase === Register.RIP) {
        const r = ins.opRegister(0), fam = FAM.find((f) => f.includes(r)) || [r];
        fam.forEach((x) => loaded.set(x, k));
      }
      let bad = false;
      for (const f of ins.cpuidFeatures()) { const nm = names[f]; if (nm && BAD.test(nm)) { counts[nm] = (counts[nm] || 0) + 1; bad = true; } }
      if (bad) { total++; if (k - lastGuard <= WINDOW) guarded++; else pending.push(k); }
    });
    // sin comprobación cerca: ¿la función solo se llama desde sitios que comprueban el CPU justo antes?
    const fnStart = (k) => { while (k > 0 && all[k - 1].mnemonic !== Mnemonic.Int3 && all[k - 1].mnemonic !== Mnemonic.Ret) k--; return k; };
    const callers = new Map();
    all.forEach((ins, k) => { if (ins.flowControl === FlowControl.Call || ins.flowControl === FlowControl.UnconditionalBranch) { const t = Number(ins.nearBranchTarget); if (t) { if (!callers.has(t)) callers.set(t, []); callers.get(t).push(k); } } });
    pending.forEach((k) => {
      const st = Number(all[fnStart(k)].ip), cs = callers.get(st) || [];
      if (cs.length && cs.every((c) => guardAt[c])) guarded++;
      else unguarded.push(all[k].ip.toString(16) + '  ' + fmt.format(all[k]));
    });
    all.forEach((ins) => ins.free());
    dec.free();
  }
  const nm = file.split(/[\\/]/).pop().padEnd(28);
  if (!total) console.log(nm, 'OK · ninguna instrucción AVX2/FMA/AVX-512 (' + n + ' instrucciones revisadas)');
  else {
    console.log(nm, total + ' instr. AVX2+ ' + JSON.stringify(counts) + ' · protegidas: ' + guarded + ' · SIN PROTEGER: ' + unguarded.length);
    unguarded.slice(0, 6).forEach((u) => console.log('      ' + u));
    if (unguarded.length) anyUnguarded = true;
  }
}
process.exitCode = anyUnguarded ? 1 : 0;
