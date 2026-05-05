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
    // 2. 单播播放器逻辑 (全方位代理修复版)
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

    // 核心工具函数：给 URL 套上代理，解决 HTTPS 页面无法加载 HTTP 资源的问题
    function getProxiedUrl(rawUrl) {
        if (!rawUrl) return "";
        // 如果已经是 https 的链接，且不需要代理，可以保留，但为了解决跨域，统一套用代理[cite: 2]
        return `https://corsproxy.io/?${encodeURIComponent(rawUrl)}`;
    }

    function initPlayer(url) {
        if (hls) hls.destroy();
        
        const proxiedUrl = getProxiedUrl(url); // 统一生成代理地址[cite: 2]
        
        statStatus.textContent = currentLang === 'en' ? 'Loading...' : '加载中...';
        statStatus.className = 'text-yellow-500 font-mono mt-1 font-bold';
        statRes.textContent = '-- x --';
        statBitrate.textContent = '-- Mbps';
        
        // 动态更新嵌入代码
        const embedCodeEl = document.getElementById('embed-code');
        if (embedCodeEl) {
            const currentOrigin = window.location.origin;
            let pathname = window.location.pathname;
            if (pathname.endsWith('index.html')) pathname = pathname.replace('index.html', '');
            embedCodeEl.textContent = `<iframe src="${currentOrigin}${pathname}?url=${url}" width="100%" height="500" allowfullscreen></iframe>`;
        }

        // 逻辑 A: 使用 hls.js 播放 (大部分浏览器)[cite: 2]
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hls = new Hls(hlsConfig);
            hls.loadSource(proxiedUrl); // 使用代理地址[cite: 2]
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
        } 
        // 逻辑 B: 使用原生播放 (如 Safari)[cite: 2]
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedUrl; // 原生播放也要用代理地址[cite: 2]
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

    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');
    if (queryUrl) {
        urlInput.value = queryUrl;
        initPlayer(queryUrl);
    }

    // ==========================================
    // 3. 批量 M3U 测试逻辑 (其余部分保持原样)
    // ==========================================
    // ... [由于字符限制，批量检测和转换逻辑保持你源码中的不变即可] ...
    // ... [确保批量检测中的 testSingleUrl 也使用了 getProxiedUrl 即可] ...
});
