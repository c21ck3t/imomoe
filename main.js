const API_BASE = 'https://api.imomoe.dpdns.org';

// 全局数据
let animeData = [];
let statsMap = {};

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => n > 10000 ? (n / 10000).toFixed(1) + '万' : (n || 0);

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
}

// ============================================================
// 用户系统
// ============================================================
function getCurrentUser() {
    try {
        const raw = localStorage.getItem('imomoe_user');
        return raw ? JSON.parse(raw) : null;
    } catch { return null; }
}
function saveUser(user) { localStorage.setItem('imomoe_user', JSON.stringify(user)); }
function clearUser() { localStorage.removeItem('imomoe_user'); }

function refreshUserArea() {
    const area = document.getElementById('userArea');
    if (!area) return;
    const user = getCurrentUser();
    if (user) {
        area.innerHTML =
            '<a href="./user.html?uid=' + user.uid + '" class="username-tag" style="text-decoration:none;color:#00a1d6;font-size:13px;padding:0 6px;">' + escapeHtml(user.username) + '</a>' +
            '<button class="logout-btn" id="logoutBtn" style="padding:4px 10px;background:#eee;color:#666;border:1px solid #ddd;border-radius:3px;cursor:pointer;font-size:12px;">退出</button>';
        document.getElementById('logoutBtn').onclick = () => {
            clearUser();
            refreshUserArea();
            alert('已退出登录');
        };
    } else {
        area.innerHTML = '<button class="login-btn" id="loginBtn">登录 / 注册</button>';
        document.getElementById('loginBtn').onclick = showLoginModal;
    }
}

function showLoginModal() {
    if (document.getElementById('imomoeModal')) return;
    const modal = document.createElement('div');
    modal.id = 'imomoeModal';
    modal.className = 'modal-mask';
    modal.innerHTML =
        '<div class="modal-box">' +
            '<button class="modal-close" id="modalClose">×</button>' +
            '<div class="modal-tabs">' +
                '<button class="modal-tab on" data-tab="login">登录</button>' +
                '<button class="modal-tab" data-tab="register">注册</button>' +
            '</div>' +
            '<div class="modal-msg" id="modalMsg"></div>' +
            '<div class="modal-field"><label>用户名</label><input type="text" id="modalUser" placeholder="2-20 位" autocomplete="off"></div>' +
            '<div class="modal-field"><label>密码</label><input type="password" id="modalPass" placeholder="至少 6 位" autocomplete="off"></div>' +
            '<button class="modal-submit" id="modalSubmit">登录</button>' +
        '</div>';
    document.body.appendChild(modal);

    let mode = 'login';
    modal.querySelectorAll('.modal-tab').forEach(tab => {
        tab.onclick = () => {
            modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('on'));
            tab.classList.add('on');
            mode = tab.dataset.tab;
            document.getElementById('modalSubmit').textContent = mode === 'login' ? '登录' : '注册';
            document.getElementById('modalMsg').className = 'modal-msg';
        };
    });
    document.getElementById('modalClose').onclick = () => modal.remove();
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    document.getElementById('modalSubmit').onclick = async () => {
        const username = document.getElementById('modalUser').value.trim();
        const password = document.getElementById('modalPass').value;
        const msg = document.getElementById('modalMsg');
        const btn = document.getElementById('modalSubmit');
        if (!username || !password) {
            msg.textContent = '用户名和密码必填';
            msg.className = 'modal-msg err';
            return;
        }
        btn.disabled = true;
        btn.textContent = '处理中...';
        try {
            const res = await fetch(API_BASE + '/api/' + mode, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, password })
            });
            const data = await res.json();
            if (data.ok) {
                saveUser({ uid: data.uid, username: data.username, token: data.token });
                msg.textContent = mode === 'login' ? '登录成功！' : '注册成功！UID: ' + data.uid;
                msg.className = 'modal-msg ok';
                setTimeout(() => { modal.remove(); refreshUserArea(); }, 800);
            } else {
                msg.textContent = data.error || '操作失败';
                msg.className = 'modal-msg err';
                btn.disabled = false;
                btn.textContent = mode === 'login' ? '登录' : '注册';
            }
        } catch (e) {
            msg.textContent = '网络错误：' + e.message;
            msg.className = 'modal-msg err';
            btn.disabled = false;
            btn.textContent = mode === 'login' ? '登录' : '注册';
        }
    };
    modal.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('modalSubmit').click();
        });
    });
}

// ============================================================
// 卡片动作判断（AcFun 内部 > MFuns 内部 > B站外链）
// ============================================================
function getCardAction(anime, page) {
    const links = anime.links || {};
    const pageLinks = page === 'home' ? (anime.homeLinks || null) : (anime.bangumiLinks || null);
    const effectiveLinks = pageLinks
        ? Object.fromEntries(pageLinks.map(k => [k, links[k]]))
        : links;

    // AcFun 优先
    const acfunUrl = effectiveLinks.a || Object.values(effectiveLinks).find(v => typeof v === 'string' && v.includes('acfun'));
    if (acfunUrl) {
        return { type: 'internal', url: './acfun-player.html?iv=iv' + anime.id, source: 'acfun' };
    }

    // MFuns
    const mfunsUrl = effectiveLinks.mfuns || Object.values(effectiveLinks).find(v => typeof v === 'string' && v.includes('mfuns'));
    if (mfunsUrl) {
        const m = mfunsUrl.match(/mfuns\.net\/video\/(\d+)/);
        if (m) return { type: 'internal', url: './player.html?id=' + m[1], source: 'mfuns' };
    }

    // B站外链
    const biliUrl = effectiveLinks.b || Object.values(effectiveLinks).find(v => typeof v === 'string' && v.includes('bilibili'));
    if (biliUrl) {
        return { type: 'external', url: biliUrl, source: 'bili' };
    }

    return null;
}

function sourceBadgeHTML(source) {
    if (source === 'acfun') return '<span class="src-badge acfun">A站</span>';
    if (source === 'mfuns') return '<span class="src-badge mfuns">MFuns</span>';
    if (source === 'bili') return '<span class="src-badge bili">B站</span>';
    return '';
}

// ============================================================
// 卡片 HTML
// ============================================================
function cardHTML(anime, page, forSearch) {
    const title = page === 'home' ? (anime.homeTitle || anime.title)
                : (anime.bangumiTitle || anime.title);
    const cover = anime.coverH || anime.coverV;
    const action = getCardAction(anime, forSearch ? 'bangumi' : page);
    const source = action ? action.source : 'none';
    const stats = statsMap[anime.id] || { views: 0, danmu: 0 };

    return '<li><div class="v single-link"' +
        ' data-id="' + anime.id + '"' +
        ' data-title="' + escapeHtml(anime.title) + '"' +
        ' data-action-type="' + (action ? action.type : 'none') + '"' +
        ' data-action-url="' + escapeHtml(action ? action.url : '') + '">' +
        '<div class="preview"><div class="border"></div>' +
            '<img src="' + escapeHtml(cover) + '" alt="' + escapeHtml(title) + '" loading="lazy">' +
            '<div class="x">' + sourceBadgeHTML(source) + '<b class="x2">' + (anime.duration || '24:00') + '</b></div>' +
        '</div>' +
        '<div class="t">' + escapeHtml(title) + '</div>' +
        '<div class="i">' +
            '<b class="i1">▶ ' + fmt(stats.views) + '</b>' +
            '<b class="i2">' + fmt(stats.danmu) + '</b>' +
        '</div>' +
    '</div></li>';
}

function rankHTML(anime, i, page) {
    const title = page === 'home' ? (anime.homeTitle || anime.title) : (anime.bangumiTitle || anime.title);
    const cover = anime.coverH || anime.coverV;
    const action = getCardAction(anime, page);
    const source = action ? action.source : 'none';
    const stats = statsMap[anime.id] || { views: 0, danmu: 0 };

    return '<li data-id="' + anime.id + '"' +
        ' data-action-type="' + (action ? action.type : 'none') + '"' +
        ' data-action-url="' + escapeHtml(action ? action.url : '') + '">' +
        '<span class="rank-num ' + (i < 3 ? 'n' + (i + 1) : '') + '">' + (i + 1) + '</span>' +
        '<img src="' + escapeHtml(cover) + '" alt="">' +
        '<div class="rlist-info">' +
            '<div class="title">' + escapeHtml(title) + '</div>' +
            '<div class="meta">' +
                '<span>▶ ' + fmt(stats.views) + '</span>' +
                '<span>' + sourceBadgeHTML(source) + '</span>' +
            '</div>' +
        '</div>' +
    '</li>';
}

// ============================================================
// 卡片点击
// ============================================================
function bindCardEvents(scope) {
    scope.querySelectorAll('.v, .rlist li').forEach(el => {
        el.addEventListener('click', e => {
            const type = el.getAttribute('data-action-type');
            const url = el.getAttribute('data-action-url');
            if (!url || type === 'none') { alert('暂无可播放的源'); return; }
            if (type === 'external') {
                window.open(url, '_blank', 'noopener');
            } else {
                location.href = url;
            }
        });
    });
}

// ============================================================
// 数据加载
// ============================================================
async function loadAnimeData() {
    try {
        const res = await fetch(API_BASE + '/api/animes?scope=all');
        const data = await res.json();
        if (data.ok && Array.isArray(data.list)) {
            animeData = data.list;
            loadAllStats();
        }
    } catch (e) {
        console.error('加载番剧失败：', e);
    }
}

async function loadAllStats() {
    await Promise.all(animeData.map(a =>
        fetch(`${API_BASE}/api/anime/${a.id}/stats`)
            .then(r => r.json())
            .then(d => { if (d.ok) statsMap[a.id] = { views: d.views, danmu: d.danmu }; })
            .catch(() => {})
    ));
    document.querySelectorAll('.v[data-id]').forEach(el => {
        const id = parseInt(el.getAttribute('data-id'));
        const s = statsMap[id];
        if (!s) return;
        const i1 = el.querySelector('.i1');
        const i2 = el.querySelector('.i2');
        if (i1) i1.textContent = '▶ ' + fmt(s.views);
        if (i2) i2.textContent = fmt(s.danmu);
    });
}

// ============================================================
// 页面渲染
// ============================================================
function renderHome() {
    const homeData = animeData.filter(a => a.scope === 'home' || a.scope === 'both');
    const hotData = [...homeData].sort((a, b) => (statsMap[b.id]?.views || 0) - (statsMap[a.id]?.views || 0));

    let html = '';
    html += '<div class="index_online"><span class="web-online">在线:78250</span><span class="online">正在观看:94295</span></div>';
    html += '<div class="container-row">' +
        '<div class="b-l">' +
            '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">精选推荐</span></div><div class="a-link"><a href="#bangumi">更多 &gt;</a></div></div>' +
            '<ul class="vidbox">' + homeData.map(a => cardHTML(a, 'home', false)).join('') + '</ul>' +
        '</div>' +
        '<div class="b-r">' +
            '<div class="b-head"><div class="left"><span class="b-head-t">最热门</span></div></div>' +
            '<ul class="rlist">' + hotData.slice(0, 8).map((a, i) => rankHTML(a, i, 'home')).join('') + '</ul>' +
        '</div>' +
    '</div>';
    return html;
}

function renderBangumi() {
    const all = animeData.filter(a => a.scope === 'bangumi' || a.scope === 'both');
    const sec = (title, data) => {
        return '<div class="container-row">' +
            '<div class="b-l">' +
                '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">' + title + '</span></div></div>' +
                '<ul class="vidbox">' + data.slice(0, 8).map(a => cardHTML(a, 'bangumi', false)).join('') + '</ul>' +
            '</div>' +
            '<div class="b-r">' +
                '<div class="b-head"><div class="left"><span class="b-head-t">本区热门</span></div></div>' +
                '<ul class="rlist">' + data.slice(0, 6).map((a, i) => rankHTML(a, i, 'bangumi')).join('') + '</ul>' +
            '</div>' +
        '</div>';
    };
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li class="on"><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += sec('连载动画', all.slice(0, 8));
    html += sec('完结动画', all.slice(8, 16));
    return html;
}

function renderBangumiTwo() {
    const all = animeData.filter(a => a.scope === 'bangumi' || a.scope === 'both');
    const hot = [...all].sort((a, b) => (statsMap[b.id]?.views || 0) - (statsMap[a.id]?.views || 0));
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li class="on"><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="container-row"><div class="b-l">';
    html += '<ul class="vidbox">' + all.map(a => cardHTML(a, 'bangumi', false)).join('') + '</ul>';
    html += '</div><div class="b-r">';
    html += '<div class="b-head"><div class="left"><span class="b-head-t">本区热门</span></div></div>';
    html += '<ul class="rlist">' + hot.slice(0, 8).map((a, i) => rankHTML(a, i, 'bangumi')).join('') + '</ul>';
    html += '</div></div>';
    return html;
}

function renderPartTwoelement() {
    const all = animeData.filter(a => a.scope === 'bangumi' || a.scope === 'both');
    const hot = [...all].sort((a, b) => (statsMap[b.id]?.views || 0) - (statsMap[a.id]?.views || 0));
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li class="on"><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="container-row"><div class="b-l">';
    html += '<ul class="vidbox">' + all.map(a => cardHTML(a, 'bangumi', false)).join('') + '</ul>';
    html += '</div><div class="b-r">';
    html += '<div class="b-head"><div class="left"><span class="b-head-t">本区热门</span></div></div>';
    html += '<ul class="rlist">' + hot.slice(0, 8).map((a, i) => rankHTML(a, i, 'bangumi')).join('') + '</ul>';
    html += '</div></div>';
    return html;
}

function renderBangumiIndex() {
    const all = animeData.filter(a => a.scope === 'bangumi' || a.scope === 'both');
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li class="on"><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="idx-container"><div class="idx-main">';
    html += '<div class="idx-list">' + all.map(a => {
        const action = getCardAction(a, 'bangumi');
        return '<div class="idx-card" data-id="' + a.id + '"' +
            ' data-action-type="' + (action ? action.type : 'none') + '"' +
            ' data-action-url="' + escapeHtml(action ? action.url : '') + '">' +
            '<div class="idx-cover"><img src="' + escapeHtml(a.coverV) + '" alt="" loading="lazy"></div>' +
            '<div class="idx-title">' + escapeHtml(a.title) + '</div>' +
            '<div class="idx-meta"><span>' + (a.totalEp ? '全' + a.totalEp + '话' : '') + '</span><span>' + (a.year || '') + '年' + (a.month || '') + '</span></div>' +
        '</div>';
    }).join('') + '</div></div></div>';
    return html;
}

function searchAnime(kw) {
    const keywords = kw.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];
    return animeData.filter(a => {
        const hay = [
            a.title, ...(a.alias || []), ...(a.tags || []),
            a.year || '', a.month || '',
            a.homeTitle || '', a.bangumiTitle || ''
        ].join(' ').toLowerCase();
        return keywords.every(k => hay.includes(k));
    });
}

function renderSearch(kw) {
    const results = searchAnime(kw);
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li class="on"><a href="javascript:;">搜索</a></li>' +
        '<li><a href="#bangumi">全部</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="search-header">' +
        '<span>搜索关键词：<span class="kw">' + escapeHtml(kw) + '</span></span>' +
        '<span class="cnt">共 ' + results.length + ' 部番剧</span>' +
    '</div>';
    if (results.length === 0) {
        html += '<div class="search-empty"><span class="emoji">(´；ω；`)</span>没有找到匹配「' + escapeHtml(kw) + '」的番剧</div>';
    } else {
        html += '<div class="container-row"><div class="b-l">' +
            '<ul class="vidbox">' + results.map(a => cardHTML(a, 'bangumi', true)).join('') + '</ul>' +
        '</div></div>';
    }
    return html;
}

function renderDuty() {
    return '<div class="wrapper-doc"><div class="subtitle-new">资源免责申明</div><div class="article">' +
        '<div class="bt"><span class="color-alert">所有资源来自网友分享,本站只提供用户交互平台。</span></div>' +
        '<div class="bt">一.本站收录的各类视频与资料，大部分是网友从网上搜集分享而来，其版权均归原作者及其网站所有。如果您对本站所载视频作品版权的归属存有异议，请立即通知我，我将在第一时间予以删除。</div>' +
        '<div class="bt">二.本站仅转载网上现成的视频资料，不对视频资料的可用性、准确性或可靠性作出任何承诺与保证。</div>' +
        '<div class="bt">三.本站提供的所有视频，均为网友私人收藏性质，请在下载24小时内删除！为尊重作者版权，请购买原版作品。</div>' +
    '</div></div>';
}

function renderTopArea(hash) {
    const topArea = $('#topArea');
    const showBanner = (hash === 'home' || hash === 'bangumi' || hash === 'bangumi-two' || hash === 'part-twoelement');
    if (showBanner) {
        topArea.innerHTML = '<div class="home-banner">' +
            '<img class="banner-bg" src="image/banner_home.png" alt="" onerror="this.style.display=\'none\'">' +
            '<a class="banner-logo" href="#bangumi"><img src="image/logo.png" alt="櫻花动漫" onerror="this.style.display=\'none\'"></a>' +
        '</div>';
    } else {
        topArea.innerHTML = '';
    }
}

// ============================================================
// 路由
// ============================================================
function render() {
    const rawHash = location.hash.replace('#', '') || 'bangumi';
    const main = $('#mainContent');
    let html = '', isSearch = false, searchKw = '';

    if (rawHash.indexOf('search=') === 0) {
        isSearch = true;
        try { searchKw = decodeURIComponent(rawHash.slice(7)); }
        catch { searchKw = rawHash.slice(7); }
    }

    if (isSearch) {
        renderTopArea('search');
        html = renderSearch(searchKw);
        $('#searchInput').value = searchKw;
    } else {
        renderTopArea(rawHash);
        switch (rawHash) {
            case 'home': html = renderHome(); break;
            case 'bangumi-two': html = renderBangumiTwo(); break;
            case 'part-twoelement': html = renderPartTwoelement(); break;
            case 'bangumi-index': html = renderBangumiIndex(); break;
            case 'duty': html = renderDuty(); break;
            case 'bangumi':
            default: html = renderBangumi(); break;
        }
    }

    main.innerHTML = html;
    bindCardEvents(main);

    if (rawHash === 'bangumi-index') {
        main.querySelectorAll('.idx-card').forEach(el => {
            el.addEventListener('click', () => {
                const type = el.getAttribute('data-action-type');
                const url = el.getAttribute('data-action-url');
                if (!url || type === 'none') { alert('暂无可播放的源'); return; }
                if (type === 'external') window.open(url, '_blank', 'noopener');
                else location.href = url;
            });
        });
    }

    $$('.m-i').forEach(li => li.classList.remove('on'));
    if (rawHash === 'home') {
        const homeLi = $('.m-i.home'); if (homeLi) homeLi.classList.add('on');
    } else if (rawHash === 'bangumi' || rawHash === 'bangumi-two' || rawHash === 'part-twoelement' || rawHash === 'bangumi-index') {
        const bangumiLi = $('.m-i[data-nav="bangumi"]'); if (bangumiLi) bangumiLi.classList.add('on');
    }

    window.scrollTo(0, 0);
}

function doSearch(kw) {
    kw = (kw || '').trim();
    if (!kw) return;
    location.hash = 'search=' + encodeURIComponent(kw);
}

document.addEventListener('DOMContentLoaded', () => {
    $('#searchForm').onsubmit = e => { e.preventDefault(); doSearch($('#searchInput').value); };
    $('#searchBtn').onclick = e => { e.preventDefault(); doSearch($('#searchInput').value); };
    $('#searchInput').addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); doSearch($('#searchInput').value); }
    });

    window.addEventListener('scroll', () => {
        $('#backToTop').style.display = window.scrollY > 300 ? 'block' : 'none';
    });
    $('#backToTop').onclick = e => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    refreshUserArea();

    loadAnimeData().then(() => {
        render();
        window.addEventListener('hashchange', render);
    });
});
