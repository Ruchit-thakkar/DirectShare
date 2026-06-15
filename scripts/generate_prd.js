const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  HeadingLevel, AlignmentType, BorderStyle, WidthType, ShadingType,
  PageBreak, TableOfContents
} = require('docx');
const fs = require('fs');

// ── Color palette ──────────────────────────────────────────────────────────
const C = {
  brand:    "1A56DB",   // deep blue – headings, accents
  brandDk:  "1E3A5F",   // navy – title, H1 text
  accent:   "0EA5E9",   // sky blue – table headers
  accentLt: "E0F2FE",   // pale sky – H2 shading / alt rows
  gray1:    "F1F5F9",   // lightest – body bg tint
  gray2:    "CBD5E1",   // border
  gray3:    "64748B",   // muted text
  white:    "FFFFFF",
  code:     "1E293B",   // dark for inline code
  codeBg:   "F8FAFC",
  warn:     "FEF3C7",   // note background
  warnBdr:  "F59E0B",
};

const border = (color = C.gray2) => ({ style: BorderStyle.SINGLE, size: 1, color });
const borders = (color = C.gray2) => ({ top: border(color), bottom: border(color), left: border(color), right: border(color) });
const noBorder = () => ({ style: BorderStyle.NONE, size: 0, color: C.white });
const noBorders = () => ({ top: noBorder(), bottom: noBorder(), left: noBorder(), right: noBorder() });

// ── Helpers ────────────────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 400, after: 160 },
    children: [new TextRun({ text, font: "Arial", size: 32, bold: true, color: C.brandDk })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 320, after: 120 },
    shading: { fill: C.accentLt, type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Arial", size: 26, bold: true, color: C.brand })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 240, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, bold: true, color: C.brandDk })],
  });
}
function h4(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_4,
    spacing: { before: 160, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 20, bold: true, color: C.gray3 })],
  });
}
function body(text, opts = {}) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 22, color: "000000", ...opts })],
  });
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 60, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 22 })],
  });
}
function code(text) {
  return new Paragraph({
    spacing: { before: 80, after: 80 },
    shading: { fill: C.codeBg, type: ShadingType.CLEAR },
    children: [new TextRun({ text, font: "Courier New", size: 18, color: C.code })],
  });
}
function note(text) {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    shading: { fill: C.warn, type: ShadingType.CLEAR },
    border: { left: { style: BorderStyle.SINGLE, size: 12, color: C.warnBdr } },
    indent: { left: 280 },
    children: [
      new TextRun({ text: "NOTE  ", font: "Arial", size: 20, bold: true, color: C.warnBdr }),
      new TextRun({ text, font: "Arial", size: 20, color: "000000" }),
    ],
  });
}
function divider() {
  return new Paragraph({
    spacing: { before: 160, after: 160 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: C.brand } },
    children: [new TextRun("")],
  });
}
function blank(before = 80) {
  return new Paragraph({ spacing: { before, after: 0 }, children: [new TextRun("")] });
}

// ── 2-col key/value table ─────────────────────────────────────────────────
function kvTable(rows, colWidths = [3120, 6240]) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: rows.map(([key, val], i) => new TableRow({
      children: [
        new TableCell({
          borders: borders(C.gray2),
          width: { size: colWidths[0], type: WidthType.DXA },
          shading: { fill: i === 0 ? C.accent : C.gray1, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: key, font: "Arial", size: 20, bold: true, color: i === 0 ? C.white : C.brandDk })] })],
        }),
        new TableCell({
          borders: borders(C.gray2),
          width: { size: colWidths[1], type: WidthType.DXA },
          shading: { fill: i % 2 === 0 ? C.white : C.gray1, type: ShadingType.CLEAR },
          margins: { top: 80, bottom: 80, left: 120, right: 120 },
          children: [new Paragraph({ children: [new TextRun({ text: val, font: "Arial", size: 20 })] })],
        }),
      ],
    })),
  });
}

// ── Header table with colored band ────────────────────────────────────────
function sectionHeaderTable(title) {
  return new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders(),
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: C.brand, type: ShadingType.CLEAR },
        margins: { top: 120, bottom: 120, left: 200, right: 200 },
        children: [new Paragraph({
          alignment: AlignmentType.LEFT,
          children: [new TextRun({ text: title.toUpperCase(), font: "Arial", size: 28, bold: true, color: C.white })],
        })],
      })],
    })],
  });
}

// ── TypeScript interface block ─────────────────────────────────────────────
function tsBlock(lines) {
  return lines.map(l => code(l));
}

// ── Page break ────────────────────────────────────────────────────────────
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ══════════════════════════════════════════════════════════════════════════
//  DOCUMENT CONTENT
// ══════════════════════════════════════════════════════════════════════════

const children = [

  // ── Cover / Title ────────────────────────────────────────────────────────
  blank(1200),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 200 },
    children: [new TextRun({ text: "DIRECTSHARE", font: "Arial", size: 72, bold: true, color: C.brand })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 120 },
    children: [new TextRun({ text: "Product Requirements Document", font: "Arial", size: 40, color: C.gray3 })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: "High-Speed Peer-to-Peer File Transfer Platform", font: "Arial", size: 28, italics: true, color: C.brandDk })],
  }),
  new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 0, after: 80 },
    children: [new TextRun({ text: "Version 1.0  |  June 2026", font: "Arial", size: 22, color: C.gray3 })],
  }),
  blank(800),
  new Table({
    width: { size: 9360, type: WidthType.DXA },
    columnWidths: [9360],
    rows: [new TableRow({
      children: [new TableCell({
        borders: noBorders(),
        width: { size: 9360, type: WidthType.DXA },
        shading: { fill: C.gray1, type: ShadingType.CLEAR },
        margins: { top: 200, bottom: 200, left: 360, right: 360 },
        children: [
          new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "Stack", font: "Arial", size: 22, bold: true, color: C.brand })] }),
          new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80, after: 0 }, children: [new TextRun({ text: "Next.js  +  TypeScript  +  Tailwind CSS  +  WebSocket / WebRTC", font: "Arial", size: 20, color: "000000" })] }),
        ],
      })],
    })],
  }),
  pageBreak(),

  // ── Table of Contents ────────────────────────────────────────────────────
  h1("Table of Contents"),
  new TableOfContents("Table of Contents", {
    hyperlink: true,
    headingStyleRange: "1-3",
    stylesWithLevels: [
      { styleId: "Heading1", level: 1 },
      { styleId: "Heading2", level: 2 },
      { styleId: "Heading3", level: 3 },
    ],
  }),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 1. PROJECT OVERVIEW
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("1. Project Overview"),
  blank(),

  h2("1.1 Purpose"),
  body("DirectShare is a browser-based, peer-to-peer file transfer application that allows users to send and receive files of any size directly between devices without routing data through a central server. By keeping file bytes on the edge, DirectShare achieves high throughput, low latency, and strong user privacy."),
  blank(),

  h2("1.2 Main Goals"),
  bullet("Zero-server file routing — signalling only, never file bytes"),
  bullet("High-speed, reliable transfer with automatic error recovery"),
  bullet("Support for large files (up to multiple gigabytes)"),
  bullet("Pause, resume, and retry without losing progress"),
  bullet("Simple, intuitive UI requiring no installation"),
  bullet("Extensible architecture ready for encryption, multi-file, and mobile"),
  blank(),

  h2("1.3 Key Requirements"),
  kvTable([
    ["Category", "Requirement"],
    ["Reliability", "Zero data loss; every byte must be verified before delivery"],
    ["Performance", "Saturate available bandwidth; parallel chunk pipeline"],
    ["Scalability", "Files up to 10 GB in a single transfer session"],
    ["Resumability", "Transfers survive connection drops and browser refreshes"],
    ["Integrity", "SHA-256 checksum per chunk and per whole file"],
    ["UX", "Real-time progress, speed, ETA displayed to both peers"],
  ]),
  blank(),

  h2("1.4 Technology Decisions"),
  body("WebRTC Data Channels are the primary transport. They provide:", { bold: false }),
  bullet("UDP-like speed with optional ordered/reliable modes per channel"),
  bullet("Native browser P2P — no server proxy needed for data"),
  bullet("SCTP-based framing with built-in backpressure signalling"),
  blank(),
  body("WebSocket is used exclusively for signalling (SDP offer/answer, ICE candidates, session metadata). Once the peer connection is established, WebSocket traffic drops to heartbeats only."),
  blank(),
  note("Design decision: Use unordered, unreliable Data Channels and implement reliability at the application layer. This gives full control over retransmission, window size, and timeout policies."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 2. SYSTEM ARCHITECTURE
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("2. System Architecture"),
  blank(),

  h2("2.1 High-Level Architecture"),
  body("DirectShare consists of three logical layers:"),
  blank(),
  kvTable([
    ["Layer", "Responsibility"],
    ["Signalling Server", "WebSocket relay for session codes, SDP, ICE; never sees file data"],
    ["Sender Client", "File selection, chunking, sequencing, transmission, retransmission"],
    ["Receiver Client", "Chunk buffering, validation, reassembly, integrity check, download"],
  ]),
  blank(),

  h2("2.2 Frontend Structure"),
  body("The Next.js application is a single Page Router (or App Router) project. Pages are thin wrappers over composable hooks and services:"),
  bullet("pages/index.tsx — landing, generate session code"),
  bullet("pages/send.tsx — sender workflow (file picker, progress)"),
  bullet("pages/receive/[code].tsx — receiver workflow (waiting, progress, download)"),
  blank(),
  body("State is managed with Zustand stores, keeping UI and transfer logic decoupled. All WebRTC and chunking logic lives in service classes under lib/ and services/, never inline in components."),
  blank(),

  h2("2.3 Backend / Signalling Server"),
  body("A lightweight Node.js + ws server handles only session lifecycle:"),
  numbered("Sender opens a WebSocket; server assigns a 6-character alphanumeric session code"),
  numbered("Receiver connects with that code; server pairs the two sockets"),
  numbered("Server relays SDP and ICE messages verbatim between the pair"),
  numbered("Server sends heartbeat pings every 15 s; cleans up sessions after 60 s silence"),
  numbered("After the WebRTC connection is established, server role is purely keepalive"),
  blank(),
  note("The signalling server stores no file data and no persistent state. It can be horizontally scaled with a Redis pub/sub adapter for the pairing map."),
  blank(),

  h2("2.4 Communication Flow"),
  body("End-to-end flow from file selection to download:"),
  numbered("Sender selects file(s) — metadata computed locally"),
  numbered("Sender connects to signalling server — receives session code"),
  numbered("Receiver navigates to /receive/[code] — connects to signalling server"),
  numbered("Server pairs them — SDP offer/answer exchange begins"),
  numbered("ICE candidate gathering — NAT traversal via STUN/TURN"),
  numbered("WebRTC Data Channel opens — signalling server demoted to heartbeat"),
  numbered("Sender sends FileMetadata packet — Receiver ACKs"),
  numbered("Sender opens sliding window — begins streaming ChunkPackets"),
  numbered("Receiver validates and buffers chunks — sends ACKs and NACKs"),
  numbered("On completion — Receiver sends FileComplete, verifies SHA-256"),
  numbered("Receiver triggers browser download — cleanup"),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 3. SENDER SIDE
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("3. Sender Side"),
  blank(),

  h2("3.1 File Selection"),
  body("Users select files via a standard HTML file input or drag-and-drop zone. Both single and multiple files are supported (multi-file is a future milestone; architecture must not preclude it). The selected File object (or FileList) is passed directly to the TransferService."),
  bullet("Accept all MIME types — never filter by extension at selection time"),
  bullet("Display file name, size, and type immediately after selection"),
  bullet("Warn (but do not block) on files over 5 GB"),
  blank(),

  h2("3.2 File Metadata Generation"),
  body("Before transfer begins, the sender computes and stores a FileMetadata record:"),
  bullet("fileName — original file name including extension"),
  bullet("fileSize — byte length from File.size"),
  bullet("mimeType — File.type, falling back to 'application/octet-stream'"),
  bullet("fileId — UUID v4 generated per transfer session"),
  bullet("totalChunks — Math.ceil(fileSize / chunkSize)"),
  bullet("chunkSize — chosen adaptively (see 3.4)"),
  bullet("checksum — SHA-256 of the entire file, computed via Web Crypto API in a Web Worker to avoid blocking the main thread"),
  blank(),
  note("SHA-256 of a large file is CPU-intensive. Always offload to a Worker. Show a 'Computing checksum...' spinner before allowing transfer to start."),
  blank(),

  h2("3.3 File Chunking Strategy"),
  body("The File object is sliced into chunks using File.slice(start, end). Slicing is lazy — no memory is allocated until a chunk is about to be sent. The slice is read as an ArrayBuffer via FileReader or file.arrayBuffer() (modern browsers)."),
  bullet("Sequential slicing: chunk index i spans bytes [i * chunkSize, min((i+1)*chunkSize, fileSize)]"),
  bullet("Each chunk is a plain ArrayBuffer — no encoding overhead"),
  bullet("Chunk checksum is computed immediately after slice, before queuing"),
  bullet("Chunks are not all pre-buffered; only window-size chunks are in memory at once"),
  blank(),

  h2("3.4 Chunk Size Recommendations"),
  kvTable([
    ["File Size", "Recommended Chunk Size", "Rationale"],
    ["< 10 MB", "64 KB", "Minimise overhead for tiny files"],
    ["10 MB – 100 MB", "256 KB", "Good throughput / memory balance"],
    ["100 MB – 1 GB", "512 KB", "Reduces total chunk count"],
    ["> 1 GB", "1 MB", "Maximises throughput, manageable window"],
  ], [3120, 3120, 3120]),
  blank(),
  body("Adaptive sizing: measure round-trip time of the first 8 ACKs and adjust chunk size up or down by 2x within the bounds 64 KB – 2 MB. Expose the current effective chunk size in the debug panel."),
  blank(),

  h2("3.5 Sequence Numbers"),
  body("Every ChunkPacket carries a zero-based sequenceNumber (0 to totalChunks-1). The receiver uses sequence numbers to:"),
  bullet("Detect missing chunks (gap in the received set)"),
  bullet("Detect duplicates (already seen this sequence number)"),
  bullet("Reconstruct file in correct order regardless of arrival order"),
  blank(),

  h2("3.6 Checksums"),
  body("Two levels of checksum protect integrity:"),
  kvTable([
    ["Level", "Algorithm", "Computed By", "Verified By"],
    ["Per-chunk", "CRC-32 (fast, 4 bytes)", "Sender at slice time", "Receiver on receipt"],
    ["Whole-file", "SHA-256 (strong, 32 bytes)", "Sender pre-transfer (Worker)", "Receiver post-assembly"],
  ]),
  blank(),
  body("CRC-32 is chosen for chunk-level verification because it is fast enough to not throttle throughput. SHA-256 is reserved for final file integrity because speed is less critical at that stage."),
  blank(),

  h2("3.7 Progress Tracking"),
  body("The sender tracks progress in TransferState:"),
  bullet("bytesSent — incremented by chunkSize after each ACK (not on send)"),
  bullet("chunksAcked — count of ACK'd chunks"),
  bullet("currentSpeed — exponential moving average of bytes/s over last 2 s"),
  bullet("eta — (totalBytes - bytesSent) / currentSpeed"),
  bullet("progress — bytesSent / fileSize as a fraction 0.0–1.0"),
  blank(),

  h2("3.8 Pause and Resume Support"),
  body("Pause is implemented by stopping the sliding window advancement. In-flight chunks (sent but not yet ACK'd) are allowed to complete normally. On resume, the window continues from the last unACK'd sequence number."),
  bullet("isPaused flag in TransferState halts new chunk sends"),
  bullet("On connection drop, TransferState is serialised to IndexedDB"),
  bullet("On reconnect, sender re-sends FileMetadata with resumeFromChunk set"),
  bullet("Receiver discards already-written chunks and ACKs them immediately"),
  blank(),

  h2("3.9 Error Handling"),
  body("Sender-side error categories and responses:"),
  kvTable([
    ["Error", "Detection", "Response"],
    ["Chunk NACK received", "Explicit NACK packet with sequenceNumber", "Re-queue chunk for retransmission"],
    ["ACK timeout", "Per-chunk timer expires (default 3 s)", "Retransmit; increment retry count"],
    ["Max retries exceeded (5)", "retry count === MAX_RETRIES", "Abort transfer, surface error to user"],
    ["Data Channel buffered amount high", "bufferedAmount > 16 MB", "Pause sends until drain event"],
    ["File read error", "FileReader onerror", "Abort and notify user"],
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 4. RECEIVER SIDE
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("4. Receiver Side"),
  blank(),

  h2("4.1 Session Creation"),
  body("The receiver creates a session upon navigating to /receive/[code]:"),
  numbered("Parse session code from URL"),
  numbered("Connect to signalling server WebSocket with the code"),
  numbered("Server confirms sender is waiting; receiver sends SDP answer"),
  numbered("ICE negotiation completes; Data Channel opens"),
  numbered("Receiver enters WAITING_METADATA state"),
  blank(),

  h2("4.2 Receiving Chunks"),
  body("Each incoming binary message on the Data Channel is deserialized into a ChunkPacket. The receiver:"),
  numbered("Reads the packet header (fileId, sequenceNumber, totalChunks, checksum, payload length)"),
  numbered("Validates header fields are within expected ranges"),
  numbered("Computes CRC-32 of the payload and compares to packet checksum field"),
  numbered("If valid, writes to the chunk buffer and sends ACK"),
  numbered("If invalid, sends NACK for retransmission"),
  blank(),

  h2("4.3 Buffering Out-of-Order Chunks"),
  body("Chunks may arrive out of order because the Data Channel is unordered. The receiver maintains:"),
  bullet("A Map<sequenceNumber, ArrayBuffer> as the chunk store"),
  bullet("A SortedSet (or bit-array) of received sequence numbers for gap detection"),
  bullet("A nextExpected pointer — the lowest sequence number not yet written to disk"),
  blank(),
  body("When a chunk arrives for sequenceNumber > nextExpected, it is stored in the map. When the chunk for nextExpected arrives, the receiver flushes all consecutive chunks from the map to disk (via a streaming FileSystemWritableFileStream) and advances nextExpected."),
  blank(),

  h2("4.4 Chunk Validation"),
  body("Validation steps on every received chunk:"),
  numbered("fileId matches the active transfer session"),
  numbered("sequenceNumber is in range [0, totalChunks-1]"),
  numbered("payload.byteLength equals the expected chunk size (or remainder for last chunk)"),
  numbered("CRC-32 of payload matches chunkChecksum in packet header"),
  blank(),
  body("Any validation failure triggers an immediate NACK. The receiver does not attempt to repair the payload."),
  blank(),

  h2("4.5 Duplicate Detection"),
  body("The received bit-array (one bit per sequence number) doubles as a duplicate detector. On receiving a chunk:"),
  bullet("Check bit at sequenceNumber — if set, this is a duplicate"),
  bullet("Duplicates are silently discarded; an ACK is still sent (sender may not have received the original ACK)"),
  bullet("No duplicate is written to the chunk store"),
  blank(),

  h2("4.6 Missing Chunk Detection"),
  body("The receiver runs a periodic scan (every 500 ms) comparing:"),
  bullet("The set of received sequence numbers"),
  bullet("The expected full set [0, totalChunks-1]"),
  blank(),
  body("Gaps older than 2 * RTT are reported to the sender via selective NACK (SNACK) packets listing the missing sequence numbers. This supplements the sender-side timeout mechanism."),
  blank(),

  h2("4.7 File Reconstruction"),
  body("File reconstruction is streaming — chunks are written to disk progressively rather than held entirely in memory:"),
  numbered("On first FileMetadata receipt, open a FileSystemWritableFileStream (File System Access API)"),
  numbered("As consecutive chunks become available (flush loop), seek to sequenceNumber * chunkSize and write"),
  numbered("Memory usage is bounded by the sliding window size, not the file size"),
  numbered("For browsers without File System Access API, fall back to in-memory Uint8Array (limit ~2 GB)"),
  blank(),
  note("Use the File System Access API where available for large-file support. Detect with 'showSaveFilePicker' in window and fall back gracefully."),
  blank(),

  h2("4.8 Integrity Verification"),
  body("After the final chunk is written and the FileComplete packet is received:"),
  numbered("Compute SHA-256 of the completed file (or assembled buffer) in a Web Worker"),
  numbered("Compare against fileChecksum from the original FileMetadata packet"),
  numbered("If match: transition to COMPLETE, trigger browser download / show success UI"),
  numbered("If mismatch: transition to CORRUPT, surface error with option to retry"),
  blank(),

  h2("4.9 Progress Tracking"),
  body("ReceiverState tracks:"),
  bullet("bytesReceived — sum of valid, non-duplicate chunk payload sizes"),
  bullet("chunksReceived — count of valid unique chunks"),
  bullet("progress — chunksReceived / totalChunks"),
  bullet("currentSpeed — bytes received per second (EMA)"),
  bullet("eta — estimated seconds to completion"),
  bullet("missingChunks — count of detected gaps (shown as warning)"),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 5. TRANSFER PROTOCOL
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("5. Transfer Protocol"),
  blank(),

  h2("5.1 Packet Types"),
  kvTable([
    ["Packet Type", "Direction", "Description"],
    ["FILE_METADATA", "Sender → Receiver", "Initiates transfer; contains file info and SHA-256"],
    ["CHUNK", "Sender → Receiver", "One file chunk with sequence number and CRC-32"],
    ["ACK", "Receiver → Sender", "Acknowledges receipt of a specific chunk"],
    ["NACK", "Receiver → Sender", "Requests retransmission of a specific chunk"],
    ["SNACK", "Receiver → Sender", "Selective NACK; lists multiple missing sequence numbers"],
    ["PAUSE", "Either → Either", "Requests pause of transmission"],
    ["RESUME", "Either → Either", "Requests resumption of transmission"],
    ["HEARTBEAT", "Either → Either", "Keepalive; carries timestamp for RTT measurement"],
    ["HEARTBEAT_ACK", "Either → Either", "Response to heartbeat"],
    ["FILE_COMPLETE", "Receiver → Sender", "All chunks received; integrity check passed"],
    ["ABORT", "Either → Either", "Terminates transfer with error code"],
  ]),
  blank(),

  h2("5.2 Packet Binary Layout"),
  body("All packets share a common binary header followed by a type-specific payload. Using a compact binary format minimizes overhead:"),
  blank(),
  body("Common Header (20 bytes):"),
  code("Offset  Size  Field"),
  code("0       1     packetType  (uint8)"),
  code("1       1     version     (uint8, currently 0x01)"),
  code("2       2     flags       (uint16 — bitmask: 0x01=compressed, 0x02=encrypted, 0x04=last)"),
  code("4       16    fileId      (UUID bytes)"),
  blank(),
  body("CHUNK payload header (12 bytes, follows common header):"),
  code("Offset  Size  Field"),
  code("0       4     sequenceNumber   (uint32)"),
  code("4       4     totalChunks      (uint32)"),
  code("8       4     chunkChecksum    (CRC-32, uint32)"),
  code("12+     N     payload          (raw bytes)"),
  blank(),
  body("ACK / NACK payload (4 bytes):"),
  code("0       4     sequenceNumber   (uint32)"),
  blank(),

  h2("5.3 Sliding Window"),
  body("The sender maintains a sliding window to pipeline chunk transmission:"),
  bullet("windowSize starts at 16 chunks and adjusts based on ACK rate"),
  bullet("At any time, at most windowSize chunks are 'in flight' (sent, not yet ACK'd)"),
  bullet("Window advances when the lowest unACK'd chunk receives its ACK"),
  bullet("On sustained loss (>5% of window), window halves (TCP-like congestion control)"),
  bullet("On clean run (all ACKs within RTT), window grows by 1 per RTT (additive increase)"),
  blank(),

  h2("5.4 Acknowledgement Strategy"),
  body("Cumulative ACK is not used. Each chunk is ACK'd individually, enabling fine-grained retransmission:"),
  bullet("Receiver ACKs each valid chunk immediately on receipt"),
  bullet("Receiver sends NACK immediately on CRC failure"),
  bullet("Receiver sends SNACK for gaps detected by the periodic scan"),
  bullet("Duplicate ACKs (3 in a row for same sequence number) trigger fast retransmit"),
  blank(),

  h2("5.5 Retransmission Mechanism"),
  body("Two triggers for retransmission:"),
  bullet("Sender-side timeout: per-chunk timer of max(200ms, 2*RTT); on expiry, retransmit and double the timer (exponential backoff)"),
  bullet("Receiver-side NACK/SNACK: immediate retransmit bypasses timeout"),
  blank(),
  body("A chunk is retransmitted up to MAX_RETRIES = 5 times. After 5 failures, the transfer is aborted and an ABORT packet is sent."),
  blank(),

  h2("5.6 Timeout Handling"),
  kvTable([
    ["Timeout", "Default", "Action on Expiry"],
    ["Per-chunk ACK timeout", "max(200ms, 2*RTT)", "Retransmit chunk"],
    ["Heartbeat interval", "5 seconds", "Send HEARTBEAT packet"],
    ["Heartbeat response timeout", "10 seconds", "Declare connection lost"],
    ["Session idle timeout", "60 seconds no data", "Close Data Channel"],
    ["Metadata ACK timeout", "5 seconds", "Resend FileMetadata (up to 3x)"],
  ]),
  blank(),

  h2("5.7 Heartbeat Packets"),
  body("Heartbeats serve two purposes: keepalive and RTT measurement."),
  numbered("Sender sends HEARTBEAT with timestamp every 5 s during active transfer"),
  numbered("Receiver responds with HEARTBEAT_ACK carrying the same timestamp"),
  numbered("Sender computes RTT = now - sentTimestamp and updates smoothed RTT (SRTT) with EWMA"),
  numbered("SRTT drives timeout calculations and window sizing"),
  blank(),

  h2("5.8 Completion Verification"),
  numbered("Receiver sends FILE_COMPLETE after SHA-256 match"),
  numbered("Sender marks transfer DONE; stops retransmission timers"),
  numbered("If sender does not receive FILE_COMPLETE within 30 s of last chunk ACK, it re-sends the last chunk to prompt completion"),
  numbered("Sender shows success UI; optionally offers to send another file on the same channel"),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 6. DATA STRUCTURES
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("6. TypeScript Data Structures"),
  blank(),

  h2("6.1 FileMetadata"),
  ...tsBlock([
    "interface FileMetadata {",
    "  fileId:        string;          // UUID v4",
    "  fileName:      string;          // original file name",
    "  fileSize:      number;          // bytes",
    "  mimeType:      string;          // MIME type or 'application/octet-stream'",
    "  totalChunks:   number;          // ceil(fileSize / chunkSize)",
    "  chunkSize:     number;          // bytes per chunk (adaptive)",
    "  checksum:      string;          // SHA-256 hex of full file",
    "  createdAt:     number;          // Unix timestamp ms",
    "  resumeFromChunk?: number;       // set on reconnect resume",
    "}",
  ]),
  blank(),

  h2("6.2 ChunkPacket"),
  ...tsBlock([
    "interface ChunkPacket {",
    "  packetType:     PacketType.CHUNK;",
    "  fileId:         string;",
    "  sequenceNumber: number;         // 0-based",
    "  totalChunks:    number;",
    "  chunkChecksum:  number;         // CRC-32 of payload",
    "  payload:        ArrayBuffer;    // raw bytes",
    "  flags:          ChunkFlags;     // compressed | encrypted | last",
    "}",
    "",
    "const enum ChunkFlags {",
    "  NONE       = 0b000,",
    "  COMPRESSED = 0b001,",
    "  ENCRYPTED  = 0b010,",
    "  LAST       = 0b100,",
    "}",
  ]),
  blank(),

  h2("6.3 AckPacket"),
  ...tsBlock([
    "interface AckPacket {",
    "  packetType:     PacketType.ACK | PacketType.NACK;",
    "  fileId:         string;",
    "  sequenceNumber: number;",
    "}",
    "",
    "interface SnackPacket {",
    "  packetType:      PacketType.SNACK;",
    "  fileId:          string;",
    "  missingSequences: number[];     // list of missing seq nums",
    "}",
  ]),
  blank(),

  h2("6.4 TransferState (Sender)"),
  ...tsBlock([
    "type TransferStatus =",
    "  | 'idle' | 'connecting' | 'hashing'",
    "  | 'transferring' | 'paused'",
    "  | 'complete' | 'error' | 'aborted';",
    "",
    "interface TransferState {",
    "  status:          TransferStatus;",
    "  metadata:        FileMetadata | null;",
    "  windowSize:      number;         // current sliding window size",
    "  nextToSend:      number;         // next sequenceNumber to enqueue",
    "  inFlight:        Map<number, InFlightChunk>; // seq -> timer/retries",
    "  bytesSent:       number;",
    "  chunksAcked:     number;",
    "  currentSpeedBps: number;",
    "  etaSeconds:      number;",
    "  smoothedRTT:     number;         // ms",
    "  errorMessage:    string | null;",
    "}",
    "",
    "interface InFlightChunk {",
    "  sequenceNumber: number;",
    "  sentAt:         number;          // timestamp",
    "  retries:        number;",
    "  timeoutHandle:  ReturnType<typeof setTimeout>;",
    "}",
  ]),
  blank(),

  h2("6.5 ReceiverState"),
  ...tsBlock([
    "type ReceiverStatus =",
    "  | 'idle' | 'connecting' | 'waiting_metadata'",
    "  | 'receiving' | 'paused' | 'verifying'",
    "  | 'complete' | 'corrupt' | 'error';",
    "",
    "interface ReceiverState {",
    "  status:           ReceiverStatus;",
    "  metadata:         FileMetadata | null;",
    "  receivedBits:     Uint8Array;    // bit-array for dup detection",
    "  chunkBuffer:      Map<number, ArrayBuffer>; // out-of-order store",
    "  nextExpected:     number;        // lowest un-written seq num",
    "  bytesReceived:    number;",
    "  chunksReceived:   number;",
    "  currentSpeedBps:  number;",
    "  etaSeconds:       number;",
    "  missingChunks:    number;",
    "  writableStream:   FileSystemWritableFileStream | null;",
    "  errorMessage:     string | null;",
    "}",
  ]),
  blank(),

  h2("6.6 Packet Type Enum"),
  ...tsBlock([
    "const enum PacketType {",
    "  FILE_METADATA  = 0x01,",
    "  CHUNK          = 0x02,",
    "  ACK            = 0x03,",
    "  NACK           = 0x04,",
    "  SNACK          = 0x05,",
    "  PAUSE          = 0x06,",
    "  RESUME         = 0x07,",
    "  HEARTBEAT      = 0x08,",
    "  HEARTBEAT_ACK  = 0x09,",
    "  FILE_COMPLETE  = 0x0A,",
    "  ABORT          = 0x0B,",
    "}",
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 7. FOLDER STRUCTURE
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("7. Recommended Folder Structure"),
  blank(),

  body("The following structure separates concerns cleanly for a Next.js TypeScript project:"),
  blank(),
  ...tsBlock([
    "directshare/",
    "├── public/                         # static assets",
    "│",
    "├── src/",
    "│   ├── components/                 # presentational UI",
    "│   │   ├── FilePicker/",
    "│   │   │   ├── FilePicker.tsx",
    "│   │   │   └── FilePicker.test.tsx",
    "│   │   ├── ProgressBar/",
    "│   │   ├── TransferStats/",
    "│   │   ├── QrCode/",
    "│   │   └── common/                 # Button, Badge, Modal...",
    "│   │",
    "│   ├── hooks/                      # React hooks (thin wrappers)",
    "│   │   ├── useTransfer.ts          # sender hook",
    "│   │   ├── useReceive.ts           # receiver hook",
    "│   │   ├── useSession.ts           # session code + signalling",
    "│   │   └── useRTT.ts               # RTT + speed metrics",
    "│   │",
    "│   ├── lib/                        # pure logic (no React)",
    "│   │   ├── chunker.ts              # file slicing + adaptive sizing",
    "│   │   ├── checksum.ts             # CRC-32 + SHA-256 helpers",
    "│   │   ├── serializer.ts           # packet encode / decode",
    "│   │   ├── slidingWindow.ts        # window controller",
    "│   │   └── crc32.ts               # fast CRC-32 table lookup",
    "│   │",
    "│   ├── services/                   # stateful service classes",
    "│   │   ├── WebRTCService.ts        # peer connection lifecycle",
    "│   │   ├── SignallingService.ts    # WebSocket signalling",
    "│   │   ├── SenderService.ts        # orchestrates sender protocol",
    "│   │   ├── ReceiverService.ts      # orchestrates receiver protocol",
    "│   │   └── PersistenceService.ts   # IndexedDB resume state",
    "│   │",
    "│   ├── store/                      # Zustand state",
    "│   │   ├── transferStore.ts        # TransferState",
    "│   │   ├── receiverStore.ts        # ReceiverState",
    "│   │   └── sessionStore.ts         # session code, peer status",
    "│   │",
    "│   ├── types/                      # shared TypeScript types",
    "│   │   ├── packets.ts              # ChunkPacket, AckPacket...",
    "│   │   ├── transfer.ts             # FileMetadata, TransferState...",
    "│   │   └── session.ts              # SessionInfo, PeerStatus",
    "│   │",
    "│   ├── utils/                      # pure utility functions",
    "│   │   ├── formatBytes.ts",
    "│   │   ├── formatSpeed.ts",
    "│   │   ├── formatEta.ts",
    "│   │   └── generateCode.ts",
    "│   │",
    "│   ├── workers/                    # Web Workers",
    "│   │   ├── checksumWorker.ts       # SHA-256 on large files",
    "│   │   └── compressionWorker.ts    # optional deflate",
    "│   │",
    "│   └── pages/                      # Next.js pages",
    "│       ├── index.tsx",
    "│       ├── send.tsx",
    "│       └── receive/",
    "│           └── [code].tsx",
    "│",
    "├── server/                         # signalling server (Node.js)",
    "│   ├── index.ts",
    "│   ├── sessionManager.ts",
    "│   └── heartbeat.ts",
    "│",
    "└── tests/",
    "    ├── unit/",
    "    └── integration/",
  ]),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 8. STATE MANAGEMENT
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("8. State Management"),
  blank(),

  h2("8.1 Rationale for Zustand"),
  body("Zustand is chosen over Redux or Context API for:"),
  bullet("Minimal boilerplate — stores are plain objects with setters"),
  bullet("Direct access outside React (service classes can call store.getState())"),
  bullet("No provider wrapping — cleaner architecture for service/hook separation"),
  bullet("Built-in middleware for devtools, persistence, and immer"),
  blank(),

  h2("8.2 Store Design Principles"),
  bullet("Stores hold UI-visible state only — large buffers (chunk maps, ArrayBuffers) live in service class instances"),
  bullet("Services emit events; hooks subscribe and update stores"),
  bullet("Stores are never directly mutated by components — only through actions"),
  bullet("Derived values (progress %, speed display) are selectors, not stored state"),
  blank(),

  h2("8.3 Transfer State Machine"),
  body("TransferState.status follows a strict state machine:"),
  kvTable([
    ["From State", "Event", "To State"],
    ["idle", "User selects file", "hashing"],
    ["hashing", "SHA-256 complete", "connecting"],
    ["connecting", "Data Channel open", "transferring"],
    ["transferring", "User clicks pause", "paused"],
    ["paused", "User clicks resume", "transferring"],
    ["transferring", "FILE_COMPLETE received", "complete"],
    ["transferring", "Fatal error", "error"],
    ["any", "ABORT packet", "aborted"],
  ]),
  blank(),

  h2("8.4 Persistence"),
  body("TransferState and ReceiverState are serialised to IndexedDB (via idb-keyval or a thin wrapper) after every significant state transition. This enables transfer resumption after a browser refresh or crash. ArrayBuffers and Maps are excluded from serialisation — only the indices and counts are stored."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 9. ERROR RECOVERY
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("9. Error Recovery"),
  blank(),

  h2("9.1 Lost Packets"),
  numbered("Per-chunk ACK timeout fires (max(200ms, 2*RTT))"),
  numbered("Sender re-queues chunk at front of send queue"),
  numbered("Chunk is retransmitted with same sequence number and payload"),
  numbered("Timeout is doubled (exponential backoff) for subsequent retries"),
  numbered("After MAX_RETRIES failures, ABORT is sent and transfer ends"),
  blank(),
  body("Additionally, receiver SNACK covers gaps the sender might not detect if its timer hasn't fired yet."),
  blank(),

  h2("9.2 Duplicate Packets"),
  bullet("Receiver's receivedBits bit-array catches all duplicates in O(1)"),
  bullet("Duplicate payload is discarded immediately — not written to buffer"),
  bullet("An ACK is still sent for the duplicate (sender may not have received the original)"),
  bullet("No side effects on progress counters or write position"),
  blank(),

  h2("9.3 Interrupted Transfers"),
  body("On abnormal disconnect (Data Channel close or ICE failure):"),
  numbered("Both sides transition to PAUSED and serialise state to IndexedDB"),
  numbered("UI shows 'Connection lost — waiting to reconnect' with elapsed timer"),
  numbered("A reconnection attempt uses the same session code (if within 5 min window)"),
  numbered("Sender re-sends FileMetadata with resumeFromChunk = nextToSend"),
  numbered("Receiver fast-ACKs all chunks below nextExpected immediately"),
  numbered("Transfer resumes from the interruption point"),
  blank(),

  h2("9.4 Connection Failures"),
  body("ICE failure recovery strategy:"),
  numbered("On ICE disconnected state, wait 5 s for automatic recovery"),
  numbered("On ICE failed state, attempt ICE restart (RTCPeerConnection.restartIce())"),
  numbered("If ICE restart fails after 15 s, fall back to TURN relay"),
  numbered("If TURN relay fails, present user with 'Reconnect' option that re-runs full signalling"),
  numbered("If all recovery fails, recommend user try on the same network or use a hotspot"),
  blank(),

  h2("9.5 Data Corruption"),
  body("Two-stage corruption defence:"),
  bullet("CRC-32 per chunk — catches bit flips in transit; triggers NACK + retransmit"),
  bullet("SHA-256 of full file post-assembly — catches any systematic error that slipped through"),
  blank(),
  body("If final SHA-256 fails, the user is shown a clear error with the option to retry the entire transfer. The corrupted partial file is not offered for download."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 10. PERFORMANCE OPTIMIZATIONS
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("10. Performance Optimizations"),
  blank(),

  h2("10.1 Parallel Chunk Transfer (Pipelining)"),
  body("The sliding window is the primary throughput mechanism. Key tuning:"),
  bullet("Default window: 16 chunks. At 256 KB/chunk, this is 4 MB in flight"),
  bullet("Maximum window: 64 chunks (to prevent memory pressure)"),
  bullet("Grow window by 1 per clean RTT; halve on >5% loss rate"),
  bullet("Multiple Data Channels (2–4) can be opened for parallel streams — partition chunks by channel using sequenceNumber % numChannels"),
  blank(),

  h2("10.2 Adaptive Chunk Size"),
  body("Chunk size adapts to observed conditions:"),
  kvTable([
    ["Condition", "Action", "Effect"],
    ["RTT < 20ms and loss = 0%", "Increase chunk size by 2x (up to 2 MB)", "Fewer packets, lower overhead"],
    ["RTT > 200ms", "Decrease chunk size by 50% (down to 64 KB)", "Quicker retransmit if lost"],
    ["Loss rate > 5%", "Decrease chunk size by 50%", "Smaller retransmit penalty"],
    ["Stable for 10 RTTs", "No change", "Avoid thrashing"],
  ]),
  blank(),

  h2("10.3 Compression"),
  body("Optional per-chunk deflate compression (CompressionStream API):"),
  bullet("Only compress if payload is compressible — sample first 4 KB and compare compressed/raw sizes"),
  bullet("Skip compression for already-compressed formats: JPEG, PNG, MP4, ZIP, PDF"),
  bullet("Compression runs in a Worker to avoid main-thread stalls"),
  bullet("ChunkFlags.COMPRESSED bit signals receiver to decompress before CRC verification"),
  blank(),

  h2("10.4 Memory Optimization"),
  body("Without care, a large file transfer can exhaust browser memory:"),
  bullet("Sender: only windowSize chunks (max 64 MB at 1 MB chunks) held in memory at any time"),
  bullet("Receiver: chunkBuffer holds out-of-order chunks only; consecutive chunks are flushed to disk immediately"),
  bullet("SHA-256 worker streams the file using File.stream() — never loads the whole file"),
  bullet("ArrayBuffers are explicitly dereferenced after ACK/write to allow GC"),
  blank(),

  h2("10.5 Large File Handling"),
  bullet("Mandatory 1 MB chunk size (reduces chunk count and overhead)"),
  bullet("File System Access API for disk-backed writes (avoids RAM pressure)"),
  bullet("Progress is checkpointed to IndexedDB every 100 chunks"),
  bullet("SHA-256 is computed incrementally via SubtleCrypto streaming digest, not in one pass"),
  bullet("UI warns if free disk space is low (using StorageManager API)"),
  bullet("Disable UI animations/transitions during high-speed transfer to save CPU cycles"),
  bullet("Stream direct disk writes to avoid DOM thread blocks"),
  bullet("Explicitly clear object URLs and ArrayBuffers immediately after completion"),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 11. SECURITY & PRIVACY
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("11. Security & Privacy"),
  blank(),

  h2("11.1 Local Routing & Metadata Privacy"),
  body("DirectShare does not route file bytes through any cloud or external servers. Data flows directly via RTCDataChannel over local Wi-Fi or local network subnets. Metadata is stored purely in memory on the signalling server and is discarded as soon as the session closes."),
  blank(),

  h2("11.2 End-to-End Encryption (E2EE)"),
  body("DTLS-SRTP encryption native to WebRTC secures all direct channel data. Signalling messages will be encrypted in future milestones using public-private key pairs exchanged out-of-band (e.g. via QR code scans) to prevent man-in-the-middle attacks."),
  blank(),
  note("The WebRTC standard mandates encryption for data channels, meaning all transfer data is encrypted in transit by default."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 12. DEPLOYMENT & INFRASTRUCTURE
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("12. Deployment & Infrastructure"),
  blank(),

  h2("12.1 Client Deployment"),
  body("The Next.js frontend is fully static and can be deployed to Vercel, Netlify, or any CDN (e.g. Cloudflare Pages). Since it runs entirely in the browser, edge caching is highly effective."),
  blank(),

  h2("12.2 Signalling Server Deployment"),
  body("The Node.js signalling server runs as a stateful containerized service (Docker) on cloud platforms like Fly.io, Render, or AWS ECS. It requires WebSocket support and low latency to pair devices quickly."),
  pageBreak(),

  // ══════════════════════════════════════════════════════════════════════════
  // 13. ROADMAP & MILESTONES
  // ══════════════════════════════════════════════════════════════════════════
  sectionHeaderTable("13. Roadmap & Milestones"),
  blank(),

  h2("13.1 Phase 1: MVP (Completed)"),
  bullet("Basic peer connection via 6-character room codes"),
  bullet("Chunk-based file transmission over RTCDataChannel"),
  bullet("Basic speed, progress, and ETA metrics on UI"),
  blank(),

  h2("13.2 Phase 2: Reliable Sliding Window and Resume (Current)"),
  bullet("TCP-like selective repeat ARQ sliding window protocol"),
  bullet("IndexedDB-backed partial transfer metadata and resume capabilities"),
  bullet("CRC-32 chunk integrity verification and overall SHA-256 validation"),
  blank(),

  h2("13.3 Phase 3: Mobile PWA and Advanced UX (Next)"),
  bullet("Mobile browser responsive layouts and Web Share Target API"),
  bullet("QR code scanning for zero-typing pairing"),
  bullet("Direct local file system streaming API integrations"),
  blank()
];

// ══════════════════════════════════════════════════════════════════════════
//  INITIALIZE AND EXPORT DOCUMENT
// ══════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      {
        reference: "bullets",
        levels: [
          {
            level: 0,
            format: "bullet",
            text: "•",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
              },
            },
          },
          {
            level: 1,
            format: "bullet",
            text: "◦",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 1440, hanging: 360 },
              },
            },
          },
        ],
      },
      {
        reference: "numbers",
        levels: [
          {
            level: 0,
            format: "decimal",
            text: "%1.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 720, hanging: 360 },
              },
            },
          },
          {
            level: 1,
            format: "decimal",
            text: "%2.",
            alignment: AlignmentType.LEFT,
            style: {
              paragraph: {
                indent: { left: 1440, hanging: 360 },
              },
            },
          },
        ],
      },
    ],
  },
  sections: [{
    properties: {},
    children: children,
  }],
});

Packer.toBuffer(doc).then((buffer) => {
  fs.writeFileSync('DirectShare_PRD.docx', buffer);
  console.log('Document DirectShare_PRD.docx created successfully!');
}).catch(err => {
  console.error('Error generating document:', err);
});
