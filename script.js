document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 主题与导航切换
    // ==========================================
    const themeBtn = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;

    function updateThemeIcon() { themeBtn.textContent = htmlEl.classList.contains('dark') ? '☀️' : '🌙'; }
    updateThemeIcon();

    themeBtn.addEventListener('click', () => {
        htmlEl.classList.toggle('dark');
        localStorage.setItem('theme', htmlEl.classList.contains('dark') ? 'dark' : 'light');
        updateThemeIcon();
    });

    window.switchTab = function(tab) {
        document.getElementById('tab-single').classList.toggle('hidden', tab !== 'single');
        document.getElementById('tab-batch').classList.toggle('hidden', tab !== 'batch');
        document.getElementById('tab-convert').classList.toggle('hidden', tab !== 'convert');
        
        document.getElementById('nav-single').className = tab === 'single' ? 'text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap' : 'text-gray-500 hover:text-blue-500 whitespace-nowrap';
        document.getElementById('nav-batch').className = tab === 'batch' ? 'text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap' : 'text-gray-500 hover:text-blue-500 whitespace-nowrap';
        document.getElementById('nav-convert').className = tab === 'convert' ? 'text-blue-600 dark:text-blue-400 font-bold whitespace-nowrap' : 'text-gray-500 hover:text-blue-500 whitespace-nowrap';
    };

    // ==========================================
    // 2. 单播播放器逻辑 (防崩溃版 + 动态嵌入代码)
    // ==========================================
    const video = document.getElementById('video-player');
    const urlInput = document.getElementById('stream-url');
    const statStatus = document.getElementById('stat-status');
    const statRes = document.getElementById('stat-res');
    const statBitrate = document.getElementById('stat-bitrate');
    
    let hls = null;
    let player = null;
    
    try {
        player = new Plyr(video, { controls:['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'] });
    } catch (e) {
        console.warn("Plyr failed to load, using native video controls.", e);
        video.controls = true;
    }

    const hlsConfig = { enableWorker: true, lowLatencyMode: true, maxBufferLength: 30, maxMaxBufferLength: 60, liveSyncDurationCount: 2, startLevel: -1 };

    function initPlayer(url) {
        if (hls) hls.destroy();
        statStatus.textContent = currentLang === 'en' ? 'Loading...' : '加载中...';
        statStatus.className = 'text-yellow-500 font-mono mt-1 font-bold';
        statRes.textContent = '-- x --';
        statBitrate.textContent = '-- Mbps';
        
        // 【核心修改】：动态更新嵌入代码 (自动识别当前域名和当前播放的 URL)
        const embedCodeEl = document.getElementById('embed-code');
        if (embedCodeEl) {
            const currentOrigin = window.location.origin; // 自动获取 http://localhost 或 https://www.m3u8player.eu.cc
            let pathname = window.location.pathname;
            if (pathname.endsWith('index.html')) pathname = pathname.replace('index.html', ''); // 保持路径干净
            
            embedCodeEl.textContent = `<iframe src="${currentOrigin}${pathname}?url=${url}" width="100%" height="500" allowfullscreen></iframe>`;
        }

        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hls = new Hls(hlsConfig);
            hls.loadSource(url);
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                statStatus.textContent = currentLang === 'en' ? 'Playing (HLS.js)' : '播放中 (HLS.js)';
                statStatus.className = 'text-green-500 font-mono mt-1 font-bold';
                video.play().catch(e => console.log("Auto-play prevented"));
            });
            
            hls.on(Hls.Events.LEVEL_SWITCHED, (e, data) => {
                const level = hls.levels[data.level];
                if(level) {
                    statRes.textContent = `${level.width}x${level.height}`;
                    statBitrate.textContent = `${(level.bitrate / 1000000).toFixed(2)} Mbps`;
                }
            });
            
            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    statStatus.textContent = currentLang === 'en' ? 'Error / CORS' : '错误 / 跨域拦截';
                    statStatus.className = 'text-red-500 font-bold mt-1';
                    hls.destroy();
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = url;
            video.addEventListener('loadedmetadata', () => {
                statStatus.textContent = currentLang === 'en' ? 'Playing (Native)' : '播放中 (原生)';
                statStatus.className = 'text-green-500 font-mono mt-1 font-bold';
                video.play();
            });
        }
    }

    document.getElementById('play-btn').addEventListener('click', () => {
        const url = urlInput.value.trim();
        if(url) initPlayer(url);
    });

    // 自动读取 URL 参数并播放 (实现 Iframe 嵌入功能)
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');
    if (queryUrl) {
        urlInput.value = queryUrl;
        initPlayer(queryUrl);
    }

    // ==========================================
    // 3. 批量 M3U 测试、解析与高级导出
    // ==========================================
    let batchResults =[];
    let globalHeader = ""; 
    const maxConcurrent = 5; 

    function parseM3U(text) {
        const lines = text.split('\n');
        const items =[];
        let currentName = 'Unknown Channel';
        let currentBlock =[];
        let isHeader = true;
        let headerLines =[];

        for (let line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;

            if (isHeader && trimmed.startsWith('#EXTM3U')) {
                headerLines.push(trimmed);
                continue;
            }

            if (trimmed.startsWith('#EXTINF:')) {
                isHeader = false;
                currentBlock.push(line); 
                const parts = trimmed.split(',');
                if (parts.length > 1) currentName = parts.slice(1).join(',').trim();
            } else if (!trimmed.startsWith('#') && trimmed.startsWith('http')) {
                isHeader = false;
                currentBlock.push(line);
                items.push({ name: currentName, url: trimmed, status: 'Pending', latency: 0, bitrate: 0, rawBlock: currentBlock.join('\n') });
                currentName = 'Unknown Channel'; 
                currentBlock =[];
            } else {
                if (!isHeader) currentBlock.push(line);
                else headerLines.push(line);
            }
        }
        globalHeader = headerLines.join('\n');
        if (!globalHeader.includes('#EXTM3U')) globalHeader = '#EXTM3U\n' + globalHeader;
        return items;
    }

    async function testSingleUrl(url) {
        const start = performance.now();
        try {
            const controller = new AbortController();
            const id = setTimeout(() => controller.abort(), 5000);
            const res = await fetch(url, { method: 'GET', signal: controller.signal });
            const lat = Math.round(performance.now() - start);
            let bitrate = 0;
            
            if (res.ok) {
                const contentType = res.headers.get('content-type') || '';
                if (contentType.includes('mpegurl') || contentType.includes('text') || url.includes('.m3u')) {
                    try {
                        const text = await res.text();
                        const bwMatch = text.match(/BANDWIDTH=(\d+)/g);
                        if (bwMatch) {
                            const bws = bwMatch.map(b => parseInt(b.split('=')[1]));
                            bitrate = Math.max(...bws);
                        }
                    } catch(e) {} 
                }
                clearTimeout(id);
                return { status: 'OK', lat, bitrate };
            } else {
                clearTimeout(id);
                return { status: `HTTP ${res.status}`, lat: -1, bitrate: 0 };
            }
        } catch (error) {
            return { status: error.name === 'AbortError' ? 'Timeout' : 'Error', lat: -1, bitrate: 0 };
        }
    }

    document.getElementById('batch-start-btn').addEventListener('click', async () => {
        const text = document.getElementById('m3u-input').value;
        const items = parseM3U(text);
        if (items.length === 0) return alert(currentLang === 'en' ? 'No valid HTTP links found!' : '未找到有效的视频链接！');
        
        batchResults = items;
        const tbody = document.getElementById('batch-results-body');
        tbody.innerHTML = '';
        
        batchResults.forEach((item, idx) => {
            const tr = document.createElement('tr');
            tr.id = `row-${idx}`;
            tr.innerHTML = `
                <td class="p-3 border-b border-gray-200 dark:border-gray-700 text-gray-500">${idx + 1}</td>
                <td class="p-3 border-b border-gray-200 dark:border-gray-700 font-medium">${item.name}</td>
                <td class="p-3 border-b border-gray-200 dark:border-gray-700 text-gray-400 text-xs truncate max-w-[200px]" title="${item.url}">${item.url}</td>
                <td id="status-${idx}" class="p-3 border-b border-gray-200 dark:border-gray-700 text-yellow-500">Testing...</td>
                <td id="lat-${idx}" class="p-3 border-b border-gray-200 dark:border-gray-700">--</td>
                <td id="bit-${idx}" class="p-3 border-b border-gray-200 dark:border-gray-700">--</td>
            `;
            tbody.appendChild(tr);
        });

        document.getElementById('batch-start-btn').disabled = true;
        document.getElementById('export-panel').classList.add('hidden');
        
        let completed = 0;
        document.getElementById('batch-progress').textContent = `0 / ${batchResults.length}`;

        async function runQueue(queue) {
            const execute = async (idx) => {
                const res = await testSingleUrl(batchResults[idx].url);
                batchResults[idx].status = res.status;
                batchResults[idx].latency = res.lat;
                batchResults[idx].bitrate = res.bitrate;
                
                const statusTd = document.getElementById(`status-${idx}`);
                const latTd = document.getElementById(`lat-${idx}`);
                const bitTd = document.getElementById(`bit-${idx}`);
                
                if (res.status === 'OK') {
                    statusTd.textContent = 'Active';
                    statusTd.className = 'p-3 border-b border-gray-200 dark:border-gray-700 text-green-500 font-bold';
                    latTd.textContent = `${res.lat} ms`;
                    bitTd.textContent = res.bitrate > 0 ? `${(res.bitrate / 1000000).toFixed(2)} Mbps` : 'Unknown';
                } else {
                    statusTd.textContent = res.status;
                    statusTd.className = 'p-3 border-b border-gray-200 dark:border-gray-700 text-red-500';
                    latTd.textContent = '--';
                    bitTd.textContent = '--';
                }
                
                completed++;
                document.getElementById('batch-progress').textContent = `${completed} / ${batchResults.length}`;
            };

            while (queue.length > 0) {
                const batch = queue.splice(0, maxConcurrent);
                await Promise.all(batch.map(execute));
            }
        }

        const indices = batchResults.map((_, i) => i);
        await runQueue(indices);

        document.getElementById('batch-start-btn').disabled = false;
        document.getElementById('export-panel').classList.remove('hidden'); 
    });

    document.getElementById('btn-export-csv').addEventListener('click', () => {
        let csvContent = "data:text/csv;charset=utf-8,\uFEFFChannel Name,URL,Status,Latency(ms),Bitrate(bps)\n";
        batchResults.forEach(item => {
            const name = `"${item.name.replace(/"/g, '""')}"`;
            csvContent += `${name},${item.url},${item.status},${item.latency},${item.bitrate}\n`;
        });
        const link = document.createElement("a");
        link.href = encodeURI(csvContent);
        link.download = "stream_results.csv";
        link.click();
    });

    document.getElementById('btn-export-m3u').addEventListener('click', () => {
        const sortType = document.getElementById('m3u-sort-type').value;
        let sorted =[...batchResults];
        
        sorted.sort((a, b) => {
            const aOk = a.status === 'OK';
            const bOk = b.status === 'OK';
            if (aOk && !bOk) return -1;
            if (!aOk && bOk) return 1;
            if (aOk && bOk) {
                if (sortType === 'latency') return a.latency - b.latency; 
                else if (sortType === 'bitrate') return b.bitrate - a.bitrate; 
            }
            return 0; 
        });

        let m3uContent = globalHeader + '\n';
        sorted.forEach(item => { m3uContent += item.rawBlock + '\n'; });

        const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'optimized_playlist.m3u8';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    });

    // ==========================================
    // 4. M3U8 转 MP4 (带 CORS 代理加速)
    // ==========================================
    const cvBtn = document.getElementById('convert-btn');
    const cvUrlInput = document.getElementById('convert-url');
    const cvProgressArea = document.getElementById('convert-progress-area');
    const cvProgressBar = document.getElementById('cv-progress-bar');
    const cvPercent = document.getElementById('cv-percent');
    const cvStatusText = document.getElementById('cv-status-text');
    const cvLog = document.getElementById('cv-log');
    const useProxyCheckbox = document.getElementById('use-cors-proxy');

    function logMsg(msg) {
        const p = document.createElement('div');
        p.textContent = `> ${msg}`;
        cvLog.appendChild(p);
        cvLog.scrollTop = cvLog.scrollHeight;
    }

    function getFetchUrl(targetUrl) {
        if (useProxyCheckbox.checked) {
            return `https://corsproxy.io/?${encodeURIComponent(targetUrl)}`;
        }
        return targetUrl;
    }

    cvBtn.addEventListener('click', async () => {
        const m3u8Url = cvUrlInput.value.trim();
        if (!m3u8Url) return alert(currentLang === 'en' ? 'Please enter a valid M3U8 URL.' : '请输入有效的 M3U8 链接。');

        cvBtn.disabled = true;
        cvProgressArea.classList.remove('hidden');
        cvLog.innerHTML = '';
        cvProgressBar.style.width = '0%';
        cvPercent.textContent = '0%';
        
        try {
            logMsg('Fetching M3U8 manifest...');
            cvStatusText.textContent = currentLang === 'en' ? 'Parsing Manifest...' : '正在解析文件...';
            
            const res = await fetch(getFetchUrl(m3u8Url));
            if (!res.ok) throw new Error(`HTTP Error ${res.status}. CORS might be blocking the request.`);
            const text = await res.text();
            
            const lines = text.split('\n');
            const tsUrls =[];
            for (let line of lines) {
                line = line.trim();
                if (line && !line.startsWith('#')) {
                    const absoluteUrl = new URL(line, m3u8Url).href;
                    tsUrls.push(absoluteUrl);
                }
            }

            if (tsUrls.length === 0) throw new Error('No video segments (.ts) found in the manifest.');
            logMsg(`Found ${tsUrls.length} segments. Starting download...`);
            cvStatusText.textContent = currentLang === 'en' ? 'Downloading Segments...' : '正在下载分片...';

            let buffers =[];
            let downloaded = 0;

            for (let i = 0; i < tsUrls.length; i++) {
                logMsg(`Downloading segment ${i + 1}/${tsUrls.length}...`);
                const tsRes = await fetch(getFetchUrl(tsUrls[i]));
                if (!tsRes.ok) throw new Error(`Failed to download segment ${i + 1}`);
                
                const arrayBuffer = await tsRes.arrayBuffer();
                buffers.push(new Uint8Array(arrayBuffer));
                
                downloaded++;
                const percent = Math.round((downloaded / tsUrls.length) * 100);
                cvProgressBar.style.width = `${percent}%`;
                cvPercent.textContent = `${percent}%`;
            }

            logMsg('All segments downloaded. Stitching file...');
            cvStatusText.textContent = currentLang === 'en' ? 'Processing MP4...' : '正在合成 MP4...';

            let totalLength = buffers.reduce((acc, val) => acc + val.length, 0);
            let mergedArray = new Uint8Array(totalLength);
            let offset = 0;
            for (let buffer of buffers) {
                mergedArray.set(buffer, offset);
                offset += buffer.length;
            }

            const blob = new Blob([mergedArray], { type: 'video/mp4' });
            const downloadUrl = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = downloadUrl;
            a.download = `video_${Date.now()}.mp4`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(downloadUrl);

            logMsg('Conversion complete! File downloaded.');
            cvStatusText.textContent = currentLang === 'en' ? 'Complete!' : '转换完成！';
            cvStatusText.className = 'text-green-500 font-bold';

        } catch (error) {
            logMsg(`ERROR: ${error.message}`);
            cvStatusText.textContent = currentLang === 'en' ? 'Error Occurred' : '发生错误';
            cvStatusText.className = 'text-red-500 font-bold';
        } finally {
            cvBtn.disabled = false;
        }
    });

    // ==========================================
    // 5. i18n 语言切换
    // ==========================================
    let currentLang = 'en'; 
    const dict = {
        en: {
            navLogo: "StreamTester PRO", navSingle: "Player", navBatch: "Batch Validator", navConvert: "M3U8 to MP4", navHelp: "Help Center", navAbout: "About Us",
            btnTest: "Play", diagTitle: "Diagnostics", diagStatus: "Status", diagRes: "Resolution", diagBitrate: "Bitrate",
            embedTitle: "Share & Embed", embedSub: "Copy this code to embed the player on your own website:", seoH1: "What is an M3U8 file?", seoP1: "An M3U8 file is a playlist file used by various audio and video playback programs. It is the basis for HTTP Live Streaming (HLS) format originally developed by Apple. Our tool allows you to test and play these streams directly in your browser without installing any software.",
            batchTitle: "M3U Playlist Optimizer", batchSub: "Paste `#EXTM3U` content. We will test latency, fetch bitrate, and let you export a sorted playlist.",
            batchStart: "▶ Start Test", expTitle: "Export Options:", optLat: "Sort by Latency (Fastest first)", optBit: "Sort by Bitrate (Highest first)", optOrig: "Original Order (Dead links at bottom)",
            thName: "Channel Name", thURL: "Stream URL", thStatus: "Status", thLat: "Latency", thBit: "Max Bitrate",
            cvTitle: "M3U8 to MP4 Converter", cvSub: "Client-side conversion. Downloads and stitches TS segments directly in your browser.", cvBtn: "Start Convert", cvProxy: "Use CORS Proxy (Check this if download fails due to cross-origin errors)",
            cvStepTitle: "How it works:", cvStep1: "Enter the M3U8 video link and click 'Start Convert'.", cvStep2: "The tool automatically downloads and parses the M3U8 manifest.", cvStep3: "It fetches all `.ts` video segments sequentially (CORS must be enabled on the server).", cvStep4: "Segments are stitched together inside your browser's memory.", cvStep5: "The final MP4 file is automatically downloaded to your device.", cvWarn: "Note: Suitable for short videos only. Large videos may crash your browser's memory. The target server must allow Cross-Origin Resource Sharing (CORS)."
        },
        zh: {
            navLogo: "StreamTester 尊享版", navSingle: "单播播放器", navBatch: "批量测速与优化", navConvert: "M3U8 转 MP4", navHelp: "帮助中心", navAbout: "关于我们",
            btnTest: "开始播放", diagTitle: "诊断面板", diagStatus: "连接状态", diagRes: "视频分辨率", diagBitrate: "实时码率",
            embedTitle: "嵌入网站 (分享代码)", embedSub: "复制下方代码，将播放器嵌入到你的网站或博客中：", seoH1: "什么是 M3U8 文件？", seoP1: "M3U8 是一种基于纯文本的播放列表格式，是苹果公司开发的 HLS (HTTP Live Streaming) 流媒体协议的基础。我们的在线工具允许您无需安装任何软件，直接在浏览器中测试和播放这些视频流。",
            batchTitle: "M3U 播放列表测速与优化器", batchSub: "粘贴带有 #EXTINF 的 M3U 内容。我们将并发测速、抓取码率，并允许您按延迟或画质重新排序导出。",
            batchStart: "▶ 开始批量测速", expTitle: "导出选项：", optLat: "按延迟排序 (速度最快优先)", optBit: "按码率排序 (画质最高优先)", optOrig: "保持原顺序 (失效链接沉底)",
            thName: "频道名称", thURL: "流媒体地址", thStatus: "测试状态", thLat: "延迟(ms)", thBit: "最高码率",
            cvTitle: "M3U8 转 MP4 下载器", cvSub: "纯前端转换工具。直接在您的浏览器内存中下载并拼接 TS 切片。", cvBtn: "开始转换", cvProxy: "启用 CORS 代理加速 (如果下载报错或被拦截，请勾选此项)",
            cvStepTitle: "工作原理：", cvStep1: "输入 M3U8 视频链接，点击“开始转换”。", cvStep2: "工具会自动下载并解析 M3U8 索引文件。", cvStep3: "依次下载所有的 .ts 视频分片（目标服务器必须允许 CORS 跨域）。", cvStep4: "在您的浏览器内存中将所有分片无缝拼接。", cvStep5: "最终的 MP4 文件将自动下载到您的设备中。", cvWarn: "注意：仅适用于短视频。超长视频可能会导致浏览器内存溢出崩溃。且目标视频服务器必须允许跨域访问 (CORS)。"
        }
    };

    document.getElementById('lang-toggle').addEventListener('click', () => {
        currentLang = currentLang === 'en' ? 'zh' : 'en';
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const key = el.getAttribute('data-i18n');
            if (dict[currentLang][key]) el.innerHTML = dict[currentLang][key];
        });
        const urlInput = document.getElementById('stream-url');
        if(urlInput) urlInput.placeholder = currentLang === 'en' ? "https://example.com/stream.m3u8" : "请输入 .m3u8 视频流地址";
        const cvInput = document.getElementById('convert-url');
        if(cvInput) cvInput.placeholder = currentLang === 'en' ? "https://example.com/video.m3u8" : "请输入 .m3u8 视频流地址";
    });
});