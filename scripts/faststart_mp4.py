from __future__ import annotations

import struct
import sys
from pathlib import Path


CONTAINERS = {
    b"dinf",
    b"edts",
    b"mdia",
    b"meta",
    b"minf",
    b"moov",
    b"mvex",
    b"stbl",
    b"trak",
    b"udta",
}


def atoms(data: bytes | bytearray, start: int, end: int):
    position = start
    while position + 8 <= end:
        size = struct.unpack_from(">I", data, position)[0]
        kind = bytes(data[position + 4 : position + 8])
        header_size = 8

        if size == 1:
            if position + 16 > end:
                raise ValueError("Invalid extended MP4 atom")
            size = struct.unpack_from(">Q", data, position + 8)[0]
            header_size = 16
        elif size == 0:
            size = end - position

        if size < header_size or position + size > end:
            raise ValueError(f"Invalid MP4 atom {kind!r} at {position}")

        yield position, size, kind, header_size
        position += size

    if position != end:
        raise ValueError(f"Trailing MP4 data at {position}")


def patch_chunk_offsets(
    data: bytearray,
    start: int,
    end: int,
    shift: int,
) -> None:
    for position, size, kind, header_size in atoms(data, start, end):
        payload_start = position + header_size
        atom_end = position + size

        if kind in {b"stco", b"co64"}:
            if payload_start + 8 > atom_end:
                raise ValueError(f"Invalid {kind.decode()} atom")
            count = struct.unpack_from(">I", data, payload_start + 4)[0]
            width = 4 if kind == b"stco" else 8
            entries_start = payload_start + 8
            if entries_start + count * width > atom_end:
                raise ValueError(f"Invalid {kind.decode()} entries")

            format_code = ">I" if width == 4 else ">Q"
            maximum = (1 << (width * 8)) - 1
            for index in range(count):
                offset_position = entries_start + index * width
                offset = struct.unpack_from(format_code, data, offset_position)[0]
                shifted = offset + shift
                if shifted > maximum:
                    raise OverflowError(f"{kind.decode()} offset overflow")
                struct.pack_into(format_code, data, offset_position, shifted)
            continue

        if kind in CONTAINERS:
            child_start = payload_start + (4 if kind == b"meta" else 0)
            if child_start < atom_end:
                patch_chunk_offsets(data, child_start, atom_end, shift)


def faststart(source_path: Path, output_path: Path) -> None:
    source = source_path.read_bytes()
    top_level = list(atoms(source, 0, len(source)))
    moov = next((atom for atom in top_level if atom[2] == b"moov"), None)
    mdat = next((atom for atom in top_level if atom[2] == b"mdat"), None)
    ftyp = next((atom for atom in top_level if atom[2] == b"ftyp"), None)

    if not moov or not mdat or not ftyp:
        raise ValueError("MP4 must contain ftyp, mdat and moov atoms")
    if moov[0] < mdat[0]:
        output_path.write_bytes(source)
        return

    moov_start, moov_size, _, moov_header = moov
    moov_data = bytearray(source[moov_start : moov_start + moov_size])
    patch_chunk_offsets(moov_data, moov_header, len(moov_data), moov_size)

    ftyp_end = ftyp[0] + ftyp[1]
    without_moov = source[:moov_start] + source[moov_start + moov_size :]
    output = without_moov[:ftyp_end] + moov_data + without_moov[ftyp_end:]
    output_path.write_bytes(output)


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("usage: faststart_mp4.py SOURCE OUTPUT")
    faststart(Path(sys.argv[1]), Path(sys.argv[2]))
