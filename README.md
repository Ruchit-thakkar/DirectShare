# 🚀 DirectShare

DirectShare is a modern, fast, and privacy-focused peer-to-peer (P2P) file-sharing web application. It enables direct device-to-device transfers over Local Area Networks (LAN), Wi-Fi, or Mobile Hotspots using WebRTC Data Channels, with zero cloud storage or intermediate servers.

---

## ✨ Features

- **Direct P2P Transfers**: Direct connection between sender and receiver via WebRTC Data Channels.
- **Privacy First**: Files are never uploaded to the cloud or third-party servers.
- **Large File Support (10GB+)**: Uses a high-performance binary chunking protocol (256KB chunks) combined with client-side **IndexedDB** to avoid browser heap exhaustion.
- **WebRTC Backpressure Control**: Monitored via `bufferedAmount` checks to guarantee high-throughput, loss-free transmission.
- **History Logs**: Detailed IndexedDB-based logs to keep track of all sent and received files.
- **Modern Responsive UI**: Built with a sleek dark-themed Vercel/Linear-like design using Tailwind CSS and Framer Motion. Works seamlessly on mobile, tablet, and desktop screens.

---

## 🛠️ Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Framer Motion
- **State Management**: Zustand
- **P2P Engine**: WebRTC Data Channels (with custom Signaling relays)
- **Client Storage**: IndexedDB (for chunk assembly and history logging)

---

## 🚀 Getting Started

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to start sharing.

---

## 🔒 Protocol & Architecture

1. **File Hashing & Slicing**: Slices files synchronously inside a dedicated Web Worker to calculate Adler-32 checksums and slice payload data.
2. **Backpressure Buffer**: Monitors WebRTC's `bufferedAmount` to throttle sender chunks and prevent browser crash or connection dropped packets.
3. **Compound Chunks Storage**: Writes chunks to IndexedDB as they arrive, and reassembles them upon completion to support huge transfers.
