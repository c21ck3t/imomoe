const API_BASE = 'https://api.imomoe.dpdns.org';
const TURNSTILE_SITE_KEY = '0x4AAAAAAFCmsfXtjAYGzUTa';

let animeData = [];
let statsMap = {};
let turnstileWidgetId = null;

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => n > 10000 ? (n / 10000).toFixed(1) + '万' : (n || 0);

function escapeHtml(str) {
    return String(str || '').replace(/[&<>"']/g, m => ({
        '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
}

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
        const name = user.nickname || user.username;
        area.innerHTML =
            '<a href="./user.html?uid=' + user.uid + '" class="username-tag" style="text-decoration:none;color:#00a1d6;font-size:13px;padding:0 6px;">' + escapeHtml(name) + '</a>' +
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

function ensureTurnstile(cb) {
    if (window.turnstile) { cb(); return; }
    let tries = 0;
    const timer = setInterval(() => {
        if (window.turnstile) {
            clearInterval(timer);
            cb();
        } else if (++tries > 100) {
            clearInterval(timer);
        }
    }, 100);
}

function renderTurnstileWidget() {
    const container = document.getElementById('turnstileContainer');
    if (!container) return;
    ensureTurnstile(() => {
        if (turnstileWidgetId === null) {
            turnstileWidgetId = window.turnstile.render(container, {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'light'
            });
        } else {
            window.turnstile.reset(turnstileWidgetId);
        }
    });
}

function getTurnstileToken() {
    if (window.turnstile && turnstileWidgetId !== null) {
        return window.turnstile.getResponse(turnstileWidgetId) || '';
    }
    return '';
}

function resetTurnstile() {
    if (window.turnstile && turnstileWidgetId !== null) {
        window.turnstile.reset(turnstileWidgetId);
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
            '<div class="modal-field" id="turnstileField" style="display:none;"><div id="turnstileContainer"></div></div>' +
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

            const tsField = document.getElementById('turnstileField');
            if (mode === 'register') {
                tsField.style.display = 'block';
                renderTurnstileWidget();
            } else {
                tsField.style.display = 'none';
            }
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

        let tsToken = '';
        if (mode === 'register') {
            tsToken = getTurnstileToken();
            if (!tsToken) {
                msg.textContent = '请先完成人机验证';
                msg.className = 'modal-msg err';
                return;
            }
        }

        btn.disabled = true;
        btn.textContent = '处理中...';
        try {
            const payload = { username, password };
            if (mode === 'register') payload.turnstileToken = tsToken;

            const res = await fetch(API_BASE + '/api/' + mode, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            const data = await res.json();
            if (data.ok) {
                saveUser({ uid: data.uid, username: data.username, nickname: data.nickname || '', token: data.token });
                msg.textContent = mode === 'login' ? '登录成功！' : '注册成功！UID: ' + data.uid;
                msg.className = 'modal-msg ok';
                setTimeout(() => { modal.remove(); refreshUserArea(); }, 800);
            } else {
                msg.textContent = data.error || '操作失败';
                msg.className = 'modal-msg err';
                btn.disabled = false;
                btn.textContent = mode === 'login' ? '登录' : '注册';
                if (mode === 'register') resetTurnstile();
            }
        } catch (e) {
            msg.textContent = '网络错误：' + e.message;
            msg.className = 'modal-msg err';
            btn.disabled = false;
            btn.textContent = mode === 'login' ? '登录' : '注册';
            if (mode === 'register') resetTurnstile();
        }
    };
    modal.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('modalSubmit').click();
        });
    });
}

function getCardAction(anime, page) {
    const links = anime.links || {};
    const pageLinks = page === 'home' ? (anime.homeLinks || null) : (anime.bangumiLinks || null);
    const effectiveLinks = pageLinks
        ? Object.fromEntries(pageLinks.map(k => [k, links[k]]))
        : links;

    const acfunUrl = effectiveLinks.a || Object.values(effectiveLinks).find(v => typeof v === 'string' && v.includes('acfun'));
    if (acfunUrl) {
        return { type: 'internal', url: './acfun-player.html?iv=iv' + anime.id, source: 'acfun' };
    }

    const mfunsUrl = effectiveLinks.mfuns || Object.values(effectiveLinks).find(v => typeof v === 'string' && v.includes('mfuns'));
    if (mfunsUrl) {
        const m = mfunsUrl.match(/mfuns\.net\/video\/(\d+)/);
        if (m) return { type: 'internal', url: './player.html?id=' + m[1], source: 'mfuns' };
    }

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

function idxCardHTML(anime) {
    const action = getCardAction(anime, 'bangumi');
    const source = action ? action.source : 'none';
    const epText = anime.totalEp ? ('全' + anime.totalEp + '话') : '';
    const ymText = (anime.year || '') + '年' + (anime.month || '');

    return '<div class="idx-card" data-id="' + anime.id + '"' +
        ' data-action-type="' + (action ? action.type : 'none') + '"' +
        ' data-action-url="' + escapeHtml(action ? action.url : '') + '">' +
        '<div class="idx-cover">' +
            '<img src="' + escapeHtml(anime.coverV) + '" alt="' + escapeHtml(anime.title) + '" loading="lazy">' +
            '<div class="x" style="position:absolute;right:3px;bottom:3px;background:rgba(0,0,0,.6);color:#fff;padding:0 4px;font-size:11px;line-height:16px;border-radius:2px;">' +
                sourceBadgeHTML(source) +
            '</div>' +
        '</div>' +
        '<div class="idx-title">' + escapeHtml(anime.title) + '</div>' +
        '<div class="idx-meta"><span>' + epText + '</span><span>' + ymText + '</span></div>' +
    '</div>';
}

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

function bindIdxCardEvents(scope) {
    scope.querySelectorAll('.idx-card').forEach(el => {
        el.addEventListener('click', () => {
            const type = el.getAttribute('data-action-type');
            const url = el.getAttribute('data-action-url');
            if (!url || type === 'none') { alert('暂无可播放的源'); return; }
            if (type === 'external') window.open(url, '_blank', 'noopener');
            else location.href = url;
        });
    });
}

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
    const ongoing = all.filter(a => a.airStatus === 'ongoing');
    const finished = all.filter(a => !a.airStatus || a.airStatus === 'finished');

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
    html += sec('连载动画', ongoing.slice(0, 8));
    html += sec('完结动画', finished.slice(0, 8));
    return html;
}

function renderBangumiTwo() {
    const all = animeData.filter(a => (a.scope === 'bangumi' || a.scope === 'both') && a.airStatus === 'ongoing');
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
    const all = animeData.filter(a => (a.scope === 'bangumi' || a.scope === 'both') && (!a.airStatus || a.airStatus === 'finished'));
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

const idxState = { tag: '全部', quality: '全部', year: '全部', month: '全部' };

function filterIdxData() {
    return animeData.filter(a => {
        const tags = a.tags || [];
        if (idxState.tag !== '全部' && !tags.includes(idxState.tag)) return false;
        if (idxState.quality !== '全部' && !tags.includes(idxState.quality)) return false;
        if (idxState.year !== '全部' && a.year !== idxState.year) return false;
        if (idxState.month !== '全部' && a.month !== idxState.month) return false;
        return true;
    });
}

function renderIdxListOnly() {
    const listBox = $('#idxListBox');
    if (!listBox) return;
    const data = filterIdxData();
    const countEl = $('#idxCount');
    if (countEl) countEl.textContent = data.length;
    if (data.length === 0) {
        listBox.innerHTML = '<div class="idx-empty">没有找到符合条件的番剧 (´；ω；`)</div>';
    } else {
        listBox.innerHTML = data.map(idxCardHTML).join('');
        bindIdxCardEvents(listBox);
    }
}

function renderBangumiIndex() {
    const all = animeData.filter(a => a.scope === 'bangumi' || a.scope === 'both');

    const typeOpts = ['全部','禁','校园','恋爱','日常','科幻','悬疑','经典','音乐','搞笑','百合','战斗','奇幻','后宫','历史','战争','机战','运动','热血','漫画改','游戏改','美食','泡面','治愈','欧美','女性向'];
    const qualityOpts = ['全部','4K','60帧'];
    const yearOpts  = ['全部','2026','2024','2021','2011','2009','2008','2006','1998'];
    const monthOpts = ['全部','1月','4月','7月','10月'];

    function optsHTML(arr, key) {
        return arr.map(v =>
            '<a href="javascript:void(0);" data-key="' + key + '" data-val="' + v + '" class="' + (v === '全部' ? 'on' : '') + '">' + v + '</a>'
        ).join('');
    }

    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li class="on"><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';

    html += '<div class="idx-container">';
    html += '<div class="idx-side">';
    html += '<div class="idx-side-header">分类索引</div>';
    html += '<div class="idx-side-group">' +
        '<p class="idx-catg">动漫作品</p>' +
        '<ul class="idx-sub">' +
            '<li class="on"><a href="javascript:void(0);">全部</a></li>' +
            '<li><a href="javascript:void(0);">其他</a></li>' +
            '<li><a href="javascript:void(0);">TV版</a></li>' +
            '<li><a href="javascript:void(0);">OVA·OAD版</a></li>' +
            '<li><a href="javascript:void(0);">剧场版</a></li>' +
        '</ul>' +
    '</div>';
    html += '</div>';

    html += '<div class="idx-main">';
    html += '<div class="idx-selector">' +
        '<div class="idx-row"><span class="idx-label">标签：</span><div class="idx-opts" data-key="tag">' + optsHTML(typeOpts, 'tag') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">画质：</span><div class="idx-opts" data-key="quality">' + optsHTML(qualityOpts, 'quality') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">年份：</span><div class="idx-opts" data-key="year">' + optsHTML(yearOpts, 'year') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">月份：</span><div class="idx-opts" data-key="month">' + optsHTML(monthOpts, 'month') + '</div></div>' +
    '</div>';

    html += '<div class="idx-sort">' +
        '<div class="sort-tabs">' +
            '<a href="javascript:void(0);" class="on">人气排序</a>' +
            '<a href="javascript:void(0);">更新排序</a>' +
            '<a href="javascript:void(0);">最新发布</a>' +
            '<a href="javascript:void(0);">播出日期</a>' +
        '</div>' +
        '<span>共 <em id="idxCount" class="idx-count">' + all.length + '</em> 部</span>' +
    '</div>';

    html += '<div class="idx-list" id="idxListBox">' + filterIdxData().map(idxCardHTML).join('') + '</div>';
    html += '</div>';
    html += '</div>';
    return html;
}

function bindIdxFilterEvents(main) {
    main.querySelectorAll('.idx-opts').forEach(function (group) {
        group.addEventListener('click', function (e) {
            const link = e.target.closest('a'); if (!link) return;
            e.preventDefault();
            const key = group.getAttribute('data-key');
            const val = link.getAttribute('data-val');
            group.querySelectorAll('a').forEach(a => a.classList.remove('on'));
            link.classList.add('on');
            idxState[key] = val;
            renderIdxListOnly();
        });
    });
    main.querySelectorAll('.idx-sort .sort-tabs').forEach(function (group) {
        group.addEventListener('click', function (e) {
            const link = e.target.closest('a'); if (!link) return;
            e.preventDefault();
            group.querySelectorAll('a').forEach(a => a.classList.remove('on'));
            link.classList.add('on');
        });
    });
    main.querySelectorAll('.idx-sub').forEach(function (group) {
        group.addEventListener('click', function (e) {
            const link = e.target.closest('a'); if (!link) return;
            e.preventDefault();
            group.querySelectorAll('li').forEach(li => li.classList.remove('on'));
            link.parentElement.classList.add('on');
        });
    });
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
            case 'bangumi-index':
                idxState.tag = '全部';
                idxState.quality = '全部';
                idxState.year = '全部';
                idxState.month = '全部';
                html = renderBangumiIndex();
                break;
            case 'duty': html = renderDuty(); break;
            case 'bangumi':
            default: html = renderBangumi(); break;
        }
    }

    main.innerHTML = html;
    bindCardEvents(main);

    if (rawHash === 'bangumi-index') {
        bindIdxCardEvents(main);
        bindIdxFilterEvents(main);
    }

    $$('.m-i').forEach(li => li.classList.remove('on'));
    if (rawHash === 'home') {
        const homeLi = $('.m-i.home'); if (homeLi) homeLi.classList.add('on');
    } else if (rawHash === 'bangumi' || rawHash === 'bangumi-two' || rawHash === 'part-twoelement' || rawHash === 'bangumi-index') {
        const bangumiLi = $('.m-i[data-key="bangumi"], .m-i[data-nav="bangumi"]'); if (bangumiLi) bangumiLi.classList.add('on');
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
