import { createHash } from 'crypto';

export interface ElfHeaderInfo {
  elfClass: 'ELF32' | 'ELF64';
  endian: 'little' | 'big';
  osAbi: string;
  type: string;
  machine: string;
  entry: number;
  phoff: number;
  shoff: number;
  flags: number;
  phnum: number;
  shnum: number;
}

export interface ProgramHeader {
  index: number;
  type: string;
  flags: string;
  offset: number;
  vaddr: number;
  paddr: number;
  filesz: number;
  memsz: number;
  align: number;
}

export interface ElfSection {
  index: number;
  name: string;
  type: string;
  flags: string;
  rawFlags: number;
  rawType: number;
  addr: number;
  offset: number;
  size: number;
  link: number;
  align: number;
  entsize: number;
}

export interface ElfSymbol {
  name: string;
  value: number;
  size: number;
  type: string;
  bind: string;
  visibility: string;
  section: string;
}

export interface ElfStringItem {
  addr: number;
  section: string;
  value: string;
}

export interface ParsedElf {
  fileSize: number;
  sha256: string;
  header: ElfHeaderInfo;
  programHeaders: ProgramHeader[];
  sections: ElfSection[];
  symbols: ElfSymbol[];
  strings: ElfStringItem[];
  totals: {
    text: number;
    rodata: number;
    data: number;
    bss: number;
    flash: number;
    ram: number;
  };
}

const E_TYPE: Record<number, string> = {
  0: 'ET_NONE',
  1: 'ET_REL (Relocatable)',
  2: 'ET_EXEC (Executable)',
  3: 'ET_DYN (Shared/PIE)',
  4: 'ET_CORE',
};

const E_MACHINE: Record<number, string> = {
  0: 'None',
  3: 'x86',
  8: 'MIPS',
  20: 'PowerPC',
  40: 'ARM',
  50: 'IA-64',
  62: 'x86-64',
  83: 'AVR',
  94: 'Xtensa',
  183: 'AArch64',
  243: 'RISC-V',
};

const PT_TYPE: Record<number, string> = {
  0: 'NULL',
  1: 'LOAD',
  2: 'DYNAMIC',
  3: 'INTERP',
  4: 'NOTE',
  5: 'SHLIB',
  6: 'PHDR',
  7: 'TLS',
  0x6474e550: 'GNU_EH_FRAME',
  0x6474e551: 'GNU_STACK',
  0x6474e552: 'GNU_RELRO',
  0x70000001: 'ARM_EXIDX',
};

const SH_TYPE: Record<number, string> = {
  0: 'NULL',
  1: 'PROGBITS',
  2: 'SYMTAB',
  3: 'STRTAB',
  4: 'RELA',
  5: 'HASH',
  6: 'DYNAMIC',
  7: 'NOTE',
  8: 'NOBITS',
  9: 'REL',
  11: 'DYNSYM',
  14: 'INIT_ARRAY',
  15: 'FINI_ARRAY',
  16: 'PREINIT_ARRAY',
  17: 'GROUP',
  18: 'SYMTAB_SHNDX',
  0x70000001: 'ARM_EXIDX',
  0x70000002: 'ARM_PREEMPTMAP',
  0x70000003: 'ARM_ATTRIBUTES',
};

const STT_TYPE: Record<number, string> = {
  0: 'NOTYPE',
  1: 'OBJECT',
  2: 'FUNC',
  3: 'SECTION',
  4: 'FILE',
  5: 'COMMON',
  6: 'TLS',
};

const STB_BIND: Record<number, string> = {
  0: 'LOCAL',
  1: 'GLOBAL',
  2: 'WEAK',
};

const STV_VIS: Record<number, string> = {
  0: 'DEFAULT',
  1: 'INTERNAL',
  2: 'HIDDEN',
  3: 'PROTECTED',
};

function readCString(buf: Buffer, offset: number): string {
  if (offset < 0 || offset >= buf.length) return '';
  let end = offset;
  while (end < buf.length && buf[end] !== 0) end++;
  return buf.subarray(offset, end).toString('utf8');
}

function fmtShFlags(f: number): string {
  let s = '';
  if (f & 0x1) s += 'W';
  if (f & 0x2) s += 'A';
  if (f & 0x4) s += 'X';
  if (f & 0x10) s += 'M';
  if (f & 0x20) s += 'S';
  if (f & 0x40) s += 'I';
  if (f & 0x400) s += 'T';
  return s || '-';
}

function fmtPhFlags(f: number): string {
  return `${f & 0x4 ? 'R' : '-'}${f & 0x2 ? 'W' : '-'}${f & 0x1 ? 'X' : '-'}`;
}

export function parseElf(buf: Buffer): ParsedElf {
  if (buf.length < 52 || buf[0] !== 0x7f || buf[1] !== 0x45 || buf[2] !== 0x4c || buf[3] !== 0x46) {
    throw new Error('Not a valid ELF file (missing 0x7F ELF magic header).');
  }

  const eiClass = buf[4];
  if (eiClass !== 1 && eiClass !== 2) {
    throw new Error(`Unsupported ELF class: ${eiClass}`);
  }
  const is64 = eiClass === 2;
  const eiData = buf[5];
  if (eiData !== 1 && eiData !== 2) {
    throw new Error(`Unsupported ELF endianness: ${eiData}`);
  }
  const le = eiData === 1;

  const u16 = (o: number) => (le ? buf.readUInt16LE(o) : buf.readUInt16BE(o));
  const u32 = (o: number) => (le ? buf.readUInt32LE(o) : buf.readUInt32BE(o));
  const u64 = (o: number) => Number(le ? buf.readBigUInt64LE(o) : buf.readBigUInt64BE(o));
  const addr = (o: number) => (is64 ? u64(o) : u32(o));

  if (is64 && buf.length < 64) {
    throw new Error('Truncated ELF64 header.');
  }

  const eType = u16(16);
  const eMachine = u16(18);
  const eEntry = is64 ? u64(24) : u32(24);
  const ePhoff = is64 ? u64(32) : u32(28);
  const eShoff = is64 ? u64(40) : u32(32);
  const eFlags = is64 ? u32(48) : u32(36);
  const ePhentsize = is64 ? u16(54) : u16(42);
  const ePhnum = is64 ? u16(56) : u16(44);
  const eShentsize = is64 ? u16(58) : u16(46);
  const eShnum = is64 ? u16(60) : u16(48);
  const eShstrndx = is64 ? u16(62) : u16(50);

  const header: ElfHeaderInfo = {
    elfClass: is64 ? 'ELF64' : 'ELF32',
    endian: le ? 'little' : 'big',
    osAbi: buf[7] === 0 ? 'System V' : `OSABI(${buf[7]})`,
    type: E_TYPE[eType] ?? `0x${eType.toString(16)}`,
    machine: E_MACHINE[eMachine] ?? `Machine(${eMachine})`,
    entry: eEntry,
    phoff: ePhoff,
    shoff: eShoff,
    flags: eFlags,
    phnum: ePhnum,
    shnum: eShnum,
  };

  // Program headers
  const programHeaders: ProgramHeader[] = [];
  for (let i = 0; i < ePhnum; i++) {
    const off = ePhoff + i * ePhentsize;
    if (off + ePhentsize > buf.length) break;
    const pType = u32(off);
    if (is64) {
      const pFlags = u32(off + 4);
      programHeaders.push({
        index: i,
        type: PT_TYPE[pType] ?? `0x${pType.toString(16)}`,
        flags: fmtPhFlags(pFlags),
        offset: u64(off + 8),
        vaddr: u64(off + 16),
        paddr: u64(off + 24),
        filesz: u64(off + 32),
        memsz: u64(off + 40),
        align: u64(off + 48),
      });
    } else {
      const pFlags = u32(off + 24);
      programHeaders.push({
        index: i,
        type: PT_TYPE[pType] ?? `0x${pType.toString(16)}`,
        flags: fmtPhFlags(pFlags),
        offset: u32(off + 4),
        vaddr: u32(off + 8),
        paddr: u32(off + 12),
        filesz: u32(off + 16),
        memsz: u32(off + 20),
        align: u32(off + 28),
      });
    }
  }

  // Section headers
  const rawSections: { nameOff: number; rawType: number; rawFlags: number; addr: number; offset: number; size: number; link: number; align: number; entsize: number }[] = [];
  for (let i = 0; i < eShnum; i++) {
    const off = eShoff + i * eShentsize;
    if (off + eShentsize > buf.length) break;
    if (is64) {
      rawSections.push({
        nameOff: u32(off),
        rawType: u32(off + 4),
        rawFlags: u64(off + 8),
        addr: u64(off + 16),
        offset: u64(off + 24),
        size: u64(off + 32),
        link: u32(off + 40),
        align: u64(off + 48),
        entsize: u64(off + 56),
      });
    } else {
      rawSections.push({
        nameOff: u32(off),
        rawType: u32(off + 4),
        rawFlags: u32(off + 8),
        addr: u32(off + 12),
        offset: u32(off + 16),
        size: u32(off + 20),
        link: u32(off + 24),
        align: u32(off + 32),
        entsize: u32(off + 36),
      });
    }
  }

  const shstr = eShstrndx < rawSections.length ? rawSections[eShstrndx] : undefined;
  const sections: ElfSection[] = rawSections.map((s, index) => ({
    index,
    name: shstr ? readCString(buf, shstr.offset + s.nameOff) : '',
    type: SH_TYPE[s.rawType] ?? `0x${s.rawType.toString(16)}`,
    flags: fmtShFlags(s.rawFlags),
    rawFlags: s.rawFlags,
    rawType: s.rawType,
    addr: s.addr,
    offset: s.offset,
    size: s.size,
    link: s.link,
    align: s.align,
    entsize: s.entsize,
  }));

  // Compute Flash / RAM totals from SHF_ALLOC sections
  let text = 0, rodata = 0, data = 0, bss = 0;
  for (const s of sections) {
    const isAlloc = (s.rawFlags & 0x2) !== 0;
    if (!isAlloc || s.size === 0) continue;
    if (s.rawType === 8) { // SHT_NOBITS
      bss += s.size;
    } else if ((s.rawFlags & 0x4) !== 0) { // SHF_EXECINSTR
      text += s.size;
    } else if ((s.rawFlags & 0x1) !== 0) { // SHF_WRITE
      data += s.size;
    } else {
      rodata += s.size;
    }
  }

  // Parse symbols from SHT_SYMTAB (2) and SHT_DYNSYM (11)
  const symbols: ElfSymbol[] = [];
  for (const s of sections) {
    if (s.rawType !== 2 && s.rawType !== 11) continue;
    const strSec = s.link < sections.length ? sections[s.link] : undefined;
    if (!strSec) continue;
    const entSize = s.entsize || (is64 ? 24 : 16);
    const count = Math.floor(s.size / entSize);
    for (let i = 0; i < count; i++) {
      const off = s.offset + i * entSize;
      if (off + entSize > buf.length) break;
      const stName = u32(off);
      const name = readCString(buf, strSec.offset + stName);
      if (!name) continue;
      let stInfo: number, stOther: number, stShndx: number, stValue: number, stSize: number;
      if (is64) {
        stInfo = buf[off + 4];
        stOther = buf[off + 5];
        stShndx = u16(off + 6);
        stValue = u64(off + 8);
        stSize = u64(off + 16);
      } else {
        stValue = u32(off + 4);
        stSize = u32(off + 8);
        stInfo = buf[off + 12];
        stOther = buf[off + 13];
        stShndx = u16(off + 14);
      }
      const symType = stInfo & 0xf;
      const symBind = stInfo >> 4;
      const symVis = stOther & 0x3;
      const secName =
        stShndx === 0 ? 'UNDEF' :
        stShndx === 0xfff1 ? 'ABS' :
        stShndx === 0xfff2 ? 'COMMON' :
        stShndx < sections.length ? sections[stShndx].name : `0x${stShndx.toString(16)}`;
      symbols.push({
        name,
        value: stValue,
        size: stSize,
        type: STT_TYPE[symType] ?? `${symType}`,
        bind: STB_BIND[symBind] ?? `${symBind}`,
        visibility: STV_VIS[symVis] ?? `${symVis}`,
        section: secName,
      });
    }
  }

  // Extract printable ASCII strings (min length 4) from allocatable PROGBITS non-exec sections (or .rodata/.data)
  const strings: ElfStringItem[] = [];
  for (const s of sections) {
    if (strings.length >= 2000) break;
    const isAlloc = (s.rawFlags & 0x2) !== 0;
    const isExec = (s.rawFlags & 0x4) !== 0;
    if (!isAlloc || s.rawType === 8 || isExec || s.size === 0) continue;
    const end = Math.min(buf.length, s.offset + s.size);
    let runStart = -1;
    let cur = '';
    for (let p = s.offset; p < end; p++) {
      const b = buf[p];
      if (b >= 0x20 && b < 0x7f) {
        if (runStart < 0) runStart = p;
        cur += String.fromCharCode(b);
      } else {
        if (runStart >= 0 && cur.length >= 4) {
          strings.push({
            addr: s.addr + (runStart - s.offset),
            section: s.name,
            value: cur,
          });
          if (strings.length >= 2000) break;
        }
        runStart = -1;
        cur = '';
      }
    }
    if (runStart >= 0 && cur.length >= 4 && strings.length < 2000) {
      strings.push({
        addr: s.addr + (runStart - s.offset),
        section: s.name,
        value: cur,
      });
    }
  }

  return {
    fileSize: buf.length,
    sha256: createHash('sha256').update(buf).digest('hex'),
    header,
    programHeaders,
    sections,
    symbols,
    strings,
    totals: {
      text,
      rodata,
      data,
      bss,
      flash: text + rodata + data,
      ram: data + bss,
    },
  };
}
