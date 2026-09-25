/**
 * Write a duration into a fragmented MP4 that has none.
 *
 * Safari's MediaRecorder emits fragmented MP4 with every duration field left
 * at zero, because it doesn't know the length until you stop. Played back
 * from a blob, Safari reads that as a live stream: the controls say "Live
 * Broadcast", the scrubber is dead, and seeking lands on a live edge with no
 * frames behind it. The recorder knows exactly how long the take was, so this
 * writes that number into the boxes that carry it — `mvhd` (movie), each
 * track's `tkhd` and `mdhd`, and `mehd` when present — and the player then
 * treats it as the ordinary file it is.
 *
 * Pure, and defensive: any box it doesn't recognise is skipped, any malformed
 * length aborts the walk, and the caller keeps the untouched bytes if this
 * throws. Only ever applied to the playback copy; the upload is unchanged.
 */

const readU32 = (v: DataView, o: number) => v.getUint32(o);
const boxType = (v: DataView, o: number) =>
  String.fromCharCode(v.getUint8(o + 4), v.getUint8(o + 5), v.getUint8(o + 6), v.getUint8(o + 7));

/** Write a 32- or 64-bit big-endian duration. Sane lengths never exceed 32 bits. */
function writeDuration(v: DataView, offset: number, bytes: 4 | 8, value: number) {
  const n = Math.max(0, Math.round(value));
  if (bytes === 4) {
    v.setUint32(offset, Math.min(n, 0xffffffff));
  } else {
    v.setUint32(offset, 0);
    v.setUint32(offset + 4, Math.min(n, 0xffffffff));
  }
}

/** Iterate the boxes inside [start, end), yielding [offset, type, size]. */
function* boxes(v: DataView, start: number, end: number): Generator<[number, string, number]> {
  let o = start;
  while (o + 8 <= end) {
    let size = readU32(v, o);
    const type = boxType(v, o);
    let header = 8;
    if (size === 1) {
      // 64-bit largesize; we only support lengths that fit in 32 bits.
      if (o + 16 > end) return;
      if (readU32(v, o + 8) !== 0) return;
      size = readU32(v, o + 12);
      header = 16;
    } else if (size === 0) {
      size = end - o; // to end of enclosing box
    }
    if (size < header || o + size > end) return;
    yield [o + header, type, o + size];
    o += size;
  }
}

export type PatchReport = { mvhd: boolean; tracks: number; mehd: boolean; timescale: number | null };

export function patchMp4Duration(buffer: ArrayBuffer, seconds: number): PatchReport {
  const v = new DataView(buffer);
  const report: PatchReport = { mvhd: false, tracks: 0, mehd: false, timescale: null };
  if (!(seconds > 0)) return report;

  for (const [moovBody, moovType, moovEnd] of boxes(v, 0, buffer.byteLength)) {
    if (moovType !== "moov") continue;
    let movieTimescale = 0;

    // mvhd first: everything else in movie timescale depends on it.
    for (const [body, type] of boxes(v, moovBody, moovEnd)) {
      if (type !== "mvhd") continue;
      const version = v.getUint8(body);
      if (version === 0) {
        movieTimescale = readU32(v, body + 12);
        writeDuration(v, body + 16, 4, seconds * movieTimescale);
      } else {
        movieTimescale = readU32(v, body + 20);
        writeDuration(v, body + 24, 8, seconds * movieTimescale);
      }
      report.mvhd = true;
      report.timescale = movieTimescale;
    }
    if (!movieTimescale) return report;

    for (const [body, type, end] of boxes(v, moovBody, moovEnd)) {
      if (type === "trak") {
        report.tracks += 1;
        for (const [tBody, tType, tEnd] of boxes(v, body, end)) {
          if (tType === "tkhd") {
            const version = v.getUint8(tBody);
            if (version === 0) writeDuration(v, tBody + 20, 4, seconds * movieTimescale);
            else writeDuration(v, tBody + 28, 8, seconds * movieTimescale);
          } else if (tType === "mdia") {
            for (const [mBody, mType] of boxes(v, tBody, tEnd)) {
              if (mType !== "mdhd") continue;
              const version = v.getUint8(mBody);
              if (version === 0) {
                const ts = readU32(v, mBody + 12);
                writeDuration(v, mBody + 16, 4, seconds * ts);
              } else {
                const ts = readU32(v, mBody + 20);
                writeDuration(v, mBody + 24, 8, seconds * ts);
              }
            }
          }
        }
      } else if (type === "mvex") {
        for (const [xBody, xType] of boxes(v, body, end)) {
          if (xType !== "mehd") continue;
          const version = v.getUint8(xBody);
          writeDuration(v, xBody + 4, version === 0 ? 4 : 8, seconds * movieTimescale);
          report.mehd = true;
        }
      }
    }
  }
  return report;
}

/**
 * A copy of `blob` with the duration written in, for playback. Falls back to
 * the original bytes on any failure, so the review screen always has
 * something to show.
 */
export async function withMp4Duration(blob: Blob, seconds: number): Promise<{ blob: Blob; report: PatchReport | null }> {
  try {
    const buf = await blob.arrayBuffer();
    const report = patchMp4Duration(buf, seconds);
    if (!report.mvhd) return { blob, report };
    return { blob: new Blob([buf], { type: blob.type }), report };
  } catch {
    return { blob, report: null };
  }
}
