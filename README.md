# ElfMap — ELF Binary Inspector

A zero-dependency custom editor for VS Code that parses **ELF32** and **ELF64** firmware binaries (`.elf`, `.axf`) into a human-readable interactive view.

## Features

- **ELF Header & Memory Summary** — architecture, endianness, entry point, file SHA-256, and computed **Flash** (`text + rodata + data`) and **RAM** (`data + bss`) totals.
- **Sections** — all section headers with virtual address, file offset, size, flags (`W`, `A`, `X`), type, and visual size bars.
- **Symbols** — searchable, sortable `.symtab` / `.dynsym` table with address, size, type (`FUNC`, `OBJECT`, etc.), binding (`GLOBAL`, `LOCAL`, `WEAK`), and section.
- **Program Headers** — `PT_LOAD` and other segments with `VAddr`, `PAddr`, `FileSz`, `MemSz`, and `R/W/X` flags.
- **Strings** — printable ASCII strings extracted from allocatable sections with their target virtual address.
- **Auto-reload** — automatically refreshes when the `.elf` file is rebuilt on disk.

## Building from source

```sh
npm install
npm run compile
```

Package an OPC-compliant `.vsix`:

```powershell
.\make_icon.ps1
.\make_vsix.ps1
```

## License

MIT — see [LICENSE](LICENSE).
