document.addEventListener('DOMContentLoaded', () => {
    // ==========================================
    // 1. 基础变量初始化 (解决脚本报错的关键)
    // ==========================================
    let currentLang = 'zh'; // 默认设为中文，防止 initPlayer 里的语言判断出错
    const video = document.getElementById('video-player');
    const urlInput = document.getElementById('stream-url');
    const statStatus = document.getElementById('stat-status');
    const statRes = document.getElementById('stat-res');
    const statBitrate = document.getElementById('stat-bitrate');
    const themeBtn = document.getElementById('theme-toggle');
    const htmlEl = document.documentElement;

    let hls = null;
    let player = null;

    // ==========================================
    // 2. 播放器 UI 初始化
    // ==========================================
    try {
        player = new Plyr(video, { 
            controls: ['play-large', 'play', 'progress', 'current-time', 'mute', 'volume', 'fullscreen'] 
        });
    } catch (e) {
        video.controls = true;
    }

    // 主题切换逻辑
    function updateThemeIcon() { themeBtn.textContent = htmlEl.classList.contains('dark') ? '☀️' : '🌙'; }
    updateThemeIcon();
    themeBtn.addEventListener('click', () => {
        htmlEl.classList.toggle('dark');
        localStorage.setItem('theme', htmlEl.classList.contains('dark') ? 'dark' : 'light');
        updateThemeIcon();
    });

    // ==========================================
    // 3. 核心播放函数 (带代理逻辑)
    // ==========================================
    const hlsConfig = { enableWorker: true, lowLatencyMode: true };

    function initPlayer(url) {
        if (!url) return;
        if (hls) hls.destroy();

        // 核心修复：通过代理解决 HTTPS 下加载 HTTP 视频流的问题[cite: 1, 2]
        const proxiedUrl = `https://corsproxy.io/?${encodeURIComponent(url)}`;
        
        statStatus.textContent = currentLang === 'en' ? 'Loading...' : '加载中...';
        statStatus.className = 'text-yellow-500 font-mono mt-1 font-bold';

        // 逻辑 A: 使用 hls.js (主流浏览器)
        if (typeof Hls !== 'undefined' && Hls.isSupported()) {
            hls = new Hls(hlsConfig);
            hls.loadSource(proxiedUrl); // 使用代理地址[cite: 2]
            hls.attachMedia(video);
            
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                statStatus.textContent = currentLang === 'en' ? 'Playing (HLS.js)' : '播放中 (HLS.js)';
                statStatus.className = 'text-green-500 font-mono mt-1 font-bold';
                video.play().catch(() => console.log("Auto-play blocked"));
            });
            
            hls.on(Hls.Events.ERROR, (e, data) => {
                if (data.fatal) {
                    statStatus.textContent = 'Error / CORS';
                    statStatus.className = 'text-red-500 font-bold mt-1';
                    hls.destroy();
                }
            });
        } 
        // 逻辑 B: 使用原生播放 (如 Safari)[cite: 2]
        else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = proxiedUrl; // 使用代理地址[cite: 2]
            video.play();
        }
    }

    // ==========================================
    // 4. 事件监听器 (确保点击按钮有反应)
    // ==========================================
    const playBtn = document.getElementById('play-btn');
    if (playBtn) {
        playBtn.addEventListener('click', () => {
            const url = urlInput.value.trim();
            console.log("Play button clicked, URL:", url); // 在控制台打印日志，方便调试
            initPlayer(url);
        });
    }

    // 自动处理 URL 参数
    const urlParams = new URLSearchParams(window.location.search);
    const queryUrl = urlParams.get('url');
    if (queryUrl) {
        urlInput.value = queryUrl;
        initPlayer(queryUrl);
    }
});
