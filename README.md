# ⚡ StreamTester PRO

A professional, client-side HLS/M3U8 stream validator, playlist optimizer, and MP4 converter.

## ✨ Core Features
- **Single Player**: Test individual `.m3u8` streams with real-time diagnostics.
- **Batch Validator**: Concurrently test hundreds of links in an `#EXTM3U` playlist.
- **M3U8 to MP4 Converter**: Pure frontend conversion. Downloads TS segments and stitches them into an MP4 file directly in the browser memory.
- **Knowledge Base**: Built-in SEO-optimized Help Center and About pages.

## 🚀 Deployment Guide (Zero Cost)

Unlike traditional players that require expensive backend SDKs (like Tencent Cloud), StreamTester PRO is built on a **100% Serverless Frontend Architecture** using HTML5 and `hls.js`.

### Method 1: Cloudflare Pages / Vercel (Recommended)
1. Fork or upload this repository to your GitHub.
2. Log in to [Cloudflare Pages](https://pages.cloudflare.com/).
3. Click "Connect to Git", select this repository, and click "Deploy".
4. Your site will be live globally in 10 seconds.

### Method 2: Traditional Web Server (Nginx/Apache)
1. Download the source code.
2. Upload all files (`index.html`, `script.js`, `help/`, `about/`) to your server's root directory (e.g., `/var/www/html`).
3. Access `http://your-domain.com/index.html`. No database or backend configuration is required!

## ⚠️ Disclaimer
This tool is provided for debugging and testing purposes only. Users are solely responsible for the URLs they input. We do not host or distribute any copyrighted media content.