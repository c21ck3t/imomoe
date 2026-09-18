const PLACEHOLDER_V = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="220" viewBox="0 0 160 220">' +
    '<rect width="160" height="220" fill="#e2e2e2"/>' +
    '<text x="80" y="115" fill="#999" font-family="sans-serif" font-size="12" text-anchor="middle">暂无封面</text>' +
    '</svg>'
);
const PLACEHOLDER_H = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="200" viewBox="0 0 320 200">' +
    '<rect width="320" height="200" fill="#e2e2e2"/>' +
    '<text x="160" y="105" fill="#999" font-family="sans-serif" font-size="14" text-anchor="middle">暂无封面</text>' +
    '</svg>'
);

const DM_ICON = '<svg class="ic-dm" width="11" height="11" viewBox="0 0 24 24" fill="#999"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>';

function isHomeAnime(a) { return a.scope === 'home' || a.scope === 'both'; }
function isBangumiAnime(a) { return a.scope === 'bangumi' || a.scope === 'both'; }

const HOME_DATA    = animeData.filter(isHomeAnime);
const BANGUMI_DATA = animeData.filter(isBangumiAnime);

const $ = (s) => document.querySelector(s);
const $$ = (s) => Array.from(document.querySelectorAll(s));
const fmt = (n) => n > 10000 ? (n / 10000).toFixed(1) + '万' : n;
const getAnime = (t) => animeData.find(a => a.title === t);
const supportsHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function getViews(a, forHome) {
    if (forHome && a.homeViews !== undefined) return a.homeViews;
    if (!forHome && a.bangumiViews !== undefined) return a.bangumiViews;
    return a.views;
}
function getDanmu(a, forHome) {
    if (forHome && a.homeDanmu !== undefined) return a.homeDanmu;
    if (!forHome && a.bangumiDanmu !== undefined) return a.bangumiDanmu;
    if (a.danmu !== undefined) return a.danmu;
    return a.comments || 0;
}
function attachFallback(img, isVertical) {
    const ph = isVertical ? PLACEHOLDER_V : PLACEHOLDER_H;
    img.onerror = function () { this.onerror = null; this.src = ph; };
}
function getHomeTitle(a) { return a.homeTitle || a.title; }
function getBangumiTitle(a) { return a.bangumiTitle || a.title; }
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, function (m) {
        return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[m];
    });
}

const LINK_NAME = { a:'A站观看', b:'B站观看', mfuns:'MFuns观看' };
function getLinksForPage(a, page) {
    let keys;
    if (page === 'home') { keys = a.homeLinks || ['b']; }
    else if (page === 'bangumi') { keys = a.bangumiLinks || ['a', 'b', 'mfuns']; }
    else { keys = ['a', 'b', 'mfuns']; }
    const out = [];
    keys.forEach(function (k) {
        if (a.links && a.links[k]) { out.push({ name: LINK_NAME[k], url: a.links[k] }); }
    });
    return out;
}
function getLinks(a) { return getLinksForPage(a, 'all'); }

function cardHTML(a, forHome, forSearch) {
    let page, displayTitle, views, danmu;
    if (forSearch) {
        page = 'all';
        displayTitle = a.homeTitle || a.bangumiTitle || a.title;
        views = a.views; danmu = a.danmu || a.comments || 0;
    } else if (forHome) {
        page = 'home';
        displayTitle = getHomeTitle(a);
        views = getViews(a, true); danmu = getDanmu(a, true);
    } else {
        page = 'bangumi';
        displayTitle = getBangumiTitle(a);
        views = getViews(a, false); danmu = getDanmu(a, false);
    }
    const links = getLinksForPage(a, page);
    const isMulti = links.length > 1;
    const cover = a.coverH || a.coverV;
    let maskHTML = '', linksHTML = '';
    if (isMulti) {
        maskHTML = '<div class="mask"><span>选择观看地址</span></div>';
        linksHTML = '<div class="links-box">' + links.map(l => '<a href="' + l.url + '" target="_blank" rel="noopener" class="watch-link">' + l.name + '</a>').join('') + '</div>';
    }
    return '<li><div class="v' + (isMulti ? ' multi-links' : ' single-link') + '" data-title="' + a.title + '" data-page="' + page + '">' +
        '<div class="preview"><div class="border"></div><img src="' + cover + '" alt="' + escapeHtml(displayTitle) + '" loading="lazy">' +
        '<div class="x"><b class="x2">' + (a.duration || '24:00') + '</b></div>' + maskHTML + '</div>' +
        '<div class="t">' + escapeHtml(displayTitle) + '</div>' +
        '<div class="i"><b class="i1">▶ ' + fmt(views) + '</b><b class="i2 danmu-count">' + DM_ICON + fmt(danmu) + '</b></div>' + linksHTML + '</div></li>';
}

function rankHTML(a, i, withNum, forHome) {
    const displayTitle = forHome ? getHomeTitle(a) : getBangumiTitle(a);
    const cover = a.coverH || a.coverV;
    const views = getViews(a, forHome);
    const danmu = getDanmu(a, forHome);
    const page = forHome ? 'home' : 'bangumi';
    return '<li data-title="' + a.title + '" data-page="' + page + '">' +
        (withNum ? '<span class="rank-num ' + (i < 3 ? 'n' + (i + 1) : '') + '">' + (i + 1) + '</span>' : '') +
        '<img src="' + cover + '" alt=""><div class="rlist-info"><div class="title">' + escapeHtml(displayTitle) + '</div>' +
        '<div class="meta"><span>▶ ' + fmt(views) + '</span><span>' + DM_ICON + fmt(danmu) + '</span></div></div></li>';
}

function idxCardHTML(a) {
    const links = getLinksForPage(a, 'all');
    const isMulti = links.length > 1;
    const epText = a.totalEp ? ('全' + a.totalEp + '话') : '';
    const ymText = (a.year || '') + '年' + (a.month || '');
    let maskHTML = '', linksHTML = '';
    if (isMulti) {
        maskHTML = '<div class="mask"><span>选择观看地址</span></div>';
        linksHTML = '<div class="links-box">' + links.map(l => '<a href="' + l.url + '" target="_blank" rel="noopener" class="watch-link">' + l.name + '</a>').join('') + '</div>';
    }
    return '<div class="idx-card' + (isMulti ? ' multi-links' : ' single-link') + '" data-title="' + a.title + '">' +
        '<div class="idx-cover"><img src="' + a.coverV + '" alt="' + escapeHtml(a.title) + '" loading="lazy">' + maskHTML + '</div>' +
        '<div class="idx-title">' + escapeHtml(a.title) + '</div>' +
        '<div class="idx-meta"><span>' + epText + '</span><span>' + ymText + '</span></div>' + linksHTML + '</div>';
}

/* ============================================================
   判断链接是否可内嵌播放（MFuns）
   ============================================================ */
function getMfunsVideoId(url) {
    if (!url) return null;
    const m = url.match(/mfuns\.net\/video\/(\d+)/);
    return m ? m[1] : null;
}

function tryInlinePlay(url, title) {
    const vid = getMfunsVideoId(url);
    if (vid) {
        location.href = './player.html?id=' + vid + '&title=' + encodeURIComponent(title || '');
        return true;
    }
    return false;
}

function bindVideoCardEvents(scope) {
    scope.querySelectorAll('.v').forEach(function (v) {
        const title = v.getAttribute('data-title');
        const page = v.getAttribute('data-page') || 'bangumi';
        const isMulti = v.classList.contains('multi-links');
        const isSingle = v.classList.contains('single-link');
        const a = getAnime(title); if (!a) return;
        const links = getLinksForPage(a, page);
        const cardTitle = v.querySelector('.t')?.textContent || title;

        if (isMulti) {
            if (supportsHover) {
                v.addEventListener('mouseenter', () => v.classList.add('show-links'));
                v.addEventListener('mouseleave', () => v.classList.remove('show-links'));
            } else {
                v.addEventListener('click', function (e) {
                    if (e.target.closest('.links-box')) return;
                    v.classList.toggle('show-links');
                });
            }
        }
        if (isSingle && links.length === 1) {
            v.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;
                const url = links[0].url;
                if (tryInlinePlay(url, cardTitle)) return;
                window.open(url, '_blank', 'noopener');
            });
        }
    });
    scope.querySelectorAll('.watch-link').forEach(function (a) {
        a.addEventListener('click', function (e) {
            const url = a.getAttribute('href');
            const cardTitle = a.closest('.v')?.querySelector('.t')?.textContent || '';
            if (tryInlinePlay(url, cardTitle)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
        });
    });
    scope.querySelectorAll('.rlist li, .r-list-pmt li').forEach(function (el) {
        el.addEventListener('click', function () {
            const title = el.getAttribute('data-title');
            const page = el.getAttribute('data-page') || 'bangumi';
            const a = getAnime(title); if (!a) return;
            const links = getLinksForPage(a, page);
            if (links.length === 0) { alert('暂无观看地址'); return; }
            if (tryInlinePlay(links[0].url, title)) return;
            window.open(links[0].url, '_blank', 'noopener');
        });
    });
}

function bindIdxCardEvents(scope) {
    scope.querySelectorAll('.idx-card').forEach(function (card) {
        const title = card.getAttribute('data-title');
        const isMulti = card.classList.contains('multi-links');
        const isSingle = card.classList.contains('single-link');
        const a = getAnime(title); if (!a) return;
        const links = getLinksForPage(a, 'all');
        if (isMulti) {
            if (supportsHover) {
                card.addEventListener('mouseenter', () => card.classList.add('show-links'));
                card.addEventListener('mouseleave', () => card.classList.remove('show-links'));
            } else {
                card.addEventListener('click', function (e) {
                    if (e.target.closest('.links-box')) return;
                    card.classList.toggle('show-links');
                });
            }
        }
        if (isSingle && links.length === 1) {
            card.addEventListener('click', function (e) {
                if (e.target.closest('a')) return;
                if (tryInlinePlay(links[0].url, title)) return;
                window.open(links[0].url, '_blank', 'noopener');
            });
        }
    });
    scope.querySelectorAll('.watch-link').forEach(function (a) {
        a.addEventListener('click', function (e) {
            const url = a.getAttribute('href');
            const cardTitle = a.closest('.idx-card')?.querySelector('.idx-title')?.textContent || '';
            if (tryInlinePlay(url, cardTitle)) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
            e.stopPropagation();
        });
    });
}

function renderHome() {
    const homeData = HOME_DATA;
    const hotData = [...HOME_DATA].sort((a, b) => getViews(b, true) - getViews(a, true));
    let html = '';
    html += '<div class="index_online"><span class="web-online">在线:78250</span><span class="online">正在观看:94295</span></div>';
    html += '<div class="container-row">' +
        '<div class="b-l">' +
            '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">精选推荐</span></div><div class="a-link"><a href="#bangumi">更多 &gt;</a></div></div>' +
            '<ul class="vidbox">' + homeData.map(a => cardHTML(a, true, false)).join('') + '</ul>' +
        '</div>' +
        '<div class="b-r">' +
            '<div class="b-head"><div class="left"><span class="b-head-t">最热门</span></div></div>' +
            '<ul class="rlist">' + hotData.map((a, i) => rankHTML(a, i, true, true)).join('') + '</ul>' +
        '</div>' +
    '</div>';
    return html;
}

function renderBangumi() {
    const all = BANGUMI_DATA;
    const sec = (title, data, colCount, moreLink) => {
        return '<div class="container-row">' +
            '<div class="b-l">' +
                '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">' + title + '</span></div>' +
                (moreLink ? '<div class="a-link"><a href="' + moreLink + '">查看更多 &gt;</a></div>' : '') +
                '</div>' +
                '<ul class="vidbox">' + data.slice(0, colCount || 8).map(a => cardHTML(a, false, false)).join('') + '</ul>' +
            '</div>' +
            '<div class="b-r">' +
                '<div class="b-head"><div class="left"><span class="b-head-t">本区热门</span></div></div>' +
                '<ul class="rlist">' + data.slice(0, 6).map((a, i) => rankHTML(a, i, true, false)).join('') + '</ul>' +
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
    html += '<div class="container-row" id="list_bangumi_new">' +
        '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">最近更新</span></div><div class="a-link"><a href="javascript:;">新番放送表&gt;</a></div></div>' +
        '<div class="bgm-calendar bgmbox"><div class="no_more">数据正在加载中</div></div>' +
    '</div>';
    html += sec('连载动画', all.slice(0, 4), 4, '#bangumi-two');
    html += sec('完结动画', all.slice(4, 8), 4, '#part-twoelement');
    return html;
}

function renderBangumiTwo() {
    const all = BANGUMI_DATA;
    const hotData = [...BANGUMI_DATA].sort((a, b) => getViews(b, false) - getViews(a, false));
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li class="on"><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="container-row"><div class="b-l">';
    html += '<ul class="vidbox">' + all.slice(0, 8).map(a => cardHTML(a, false, false)).join('') + '</ul>';
    html += '<div class="pagelistbox"><span>共 83 页/ 1659 个视频</span>' +
        '<strong>1</strong><a href="javascript:;">2</a><a href="javascript:;">3</a><a href="javascript:;">4</a><a href="javascript:;">5</a>' +
        '<a href="javascript:;" class="nextPage">下页</a><a href="javascript:;" class="endPage">末页</a></div>';
    html += '</div><div class="b-r">';
    html += '<div class="b-head"><div class="left"><span class="b-head-t">本区热门</span></div></div>';
    html += '<ul class="rlist">' + hotData.slice(0, 8).map((a, i) => rankHTML(a, i, true, false)).join('') + '</ul>';
    html += '<div class="b-head ranking" style="margin-top:20px;"><div class="left"><span class="b-head-t">热门新番</span></div></div>';
    html += '<ul class="rlist">' + all.slice(0, 5).map((a, i) => rankHTML(a, i, true, false)).join('') + '</ul>';
    html += '</div></div>';
    return html;
}

function renderPartTwoelement() {
    const all = BANGUMI_DATA;
    const hotData = [...BANGUMI_DATA].sort((a, b) => getViews(b, false) - getViews(a, false));
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li class="on"><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="container-row"><div class="b-l">';
    html += '<ul class="vidbox">' + all.slice(0, 8).map(a => cardHTML(a, false, false)).join('') + '</ul>';
    html += '<div class="pagelistbox"><span>共 34 页/ 669 个视频</span>' +
        '<strong>1</strong><a href="javascript:;">2</a><a href="javascript:;">3</a><a href="javascript:;">4</a><a href="javascript:;">5</a>' +
        '<a href="javascript:;" class="nextPage">下页</a><a href="javascript:;" class="endPage">末页</a></div>';
    html += '</div><div class="b-r">';
    html += '<div class="b-head"><div class="left"><span class="b-head-t">完结推荐</span></div></div>';
    html += '<ul class="r-list-pmt simple sub">' +
        all.slice(0, 5).map(a =>
            '<li data-title="' + a.title + '" data-page="bangumi"><img src="' + (a.coverH || a.coverV) + '" alt=""><div class="title">' + escapeHtml(a.title) + '</div></li>'
        ).join('') +
    '</ul>';
    html += '<div class="b-head ranking" style="margin-top:20px;"><div class="left"><span class="b-head-t">本区热门</span></div></div>';
    html += '<ul class="rlist">' + hotData.slice(0, 8).map((a, i) => rankHTML(a, i, true, false)).join('') + '</ul>';
    html += '</div></div>';
    return html;
}

const idxState = { tag:'全部', quality:'全部', year:'全部', month:'全部' };
function filterIdxData() {
    return BANGUMI_DATA.filter(a => {
        if (idxState.tag !== '全部' && !a.tags.includes(idxState.tag)) return false;
        if (idxState.quality !== '全部' && !a.tags.includes(idxState.quality)) return false;
        if (idxState.year !== '全部' && a.year !== idxState.year) return false;
        if (idxState.month !== '全部' && a.month !== idxState.month) return false;
        return true;
    });
}
function renderIdxListOnly() {
    const listBox = $('#idxListBox'); if (!listBox) return;
    const data = filterIdxData();
    const countEl = $('#idxCount'); if (countEl) countEl.textContent = data.length;
    if (data.length === 0) {
        listBox.innerHTML = '<div class="idx-empty">没有找到符合条件的番剧 (´；ω；`)</div>';
    } else {
        listBox.innerHTML = data.map(idxCardHTML).join('');
        listBox.querySelectorAll('img').forEach(img => attachFallback(img, true));
        bindIdxCardEvents(listBox);
    }
}
function renderBangumiIndex() {
    const all = BANGUMI_DATA;
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
    html += '<div class="idx-container"><div class="idx-side">';
    html += '<div class="idx-side-header">分类索引</div>';
    html += '<div class="idx-side-group"><p class="idx-catg">动漫作品</p><ul class="idx-sub">' +
        '<li class="on"><a href="javascript:void(0);">全部</a></li>' +
        '<li><a href="javascript:void(0);">其他</a></li>' +
        '<li><a href="javascript:void(0);">TV版</a></li>' +
        '<li><a href="javascript:void(0);">OVA·OAD版</a></li>' +
        '<li><a href="javascript:void(0);">剧场版</a></li>' +
    '</ul></div></div>';
    html += '<div class="idx-main">';
    html += '<div class="idx-selector">' +
        '<div class="idx-row"><span class="idx-label">标签：</span><div class="idx-opts" data-key="tag">' + optsHTML(typeOpts, 'tag') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">画质：</span><div class="idx-opts" data-key="quality">' + optsHTML(qualityOpts, 'quality') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">年份：</span><div class="idx-opts" data-key="year">' + optsHTML(yearOpts, 'year') + '</div></div>' +
        '<div class="idx-row"><span class="idx-label">月份：</span><div class="idx-opts" data-key="month">' + optsHTML(monthOpts, 'month') + '</div></div>' +
    '</div>';
    html += '<div class="idx-sort"><div class="sort-tabs">' +
        '<a href="javascript:void(0);" class="on">人气排序</a>' +
        '<a href="javascript:void(0);">更新排序</a>' +
        '<a href="javascript:void(0);">最新发布</a>' +
        '<a href="javascript:void(0);">播出日期</a>' +
    '</div><span>共 <em id="idxCount" class="idx-count">' + all.length + '</em> 部</span></div>';
    html += '<div class="idx-list" id="idxListBox">' + filterIdxData().map(idxCardHTML).join('') + '</div>';
    html += '</div></div>';
    return html;
}

function doSearch(kw) {
    kw = (kw || '').trim();
    if (!kw) return;
    location.hash = 'search=' + encodeURIComponent(kw);
}
function searchAnime(kw) {
    const keywords = kw.toLowerCase().split(/\s+/).filter(Boolean);
    if (keywords.length === 0) return [];
    return animeData.filter(function (a) {
        const haystack = [
            a.title, ...(a.alias || []), ...(a.tags || []),
            a.year || '', a.month || '',
            a.totalEp ? ('全' + a.totalEp + '话') : '',
            a.homeTitle || '', a.bangumiTitle || ''
        ].join(' ').toLowerCase();
        return keywords.every(function (k) { return haystack.indexOf(k) > -1; });
    });
}
function renderSearch(kw) {
    const results = searchAnime(kw);
    let html = '<div class="container-top-wrapper"><div class="main-inner">';
    html += '<div class="fcname"><ul class="n_num">' +
        '<li class="on"><a href="javascript:;">搜索</a></li>' +
        '<li><a href="#bangumi">全部</a></li>' +
        '<li><a href="#bangumi-two">连载动画</a></li>' +
        '<li><a href="#part-twoelement">完结动画</a></li>' +
        '<li><a href="#bangumi-index">番剧index</a></li>' +
    '</ul></div></div></div>';
    html += '<div class="search-header">' +
        '<span>搜索关键词：<span class="kw">' + escapeHtml(kw) + '</span></span>' +
        '<span class="cnt">共 ' + results.length + ' 部番剧</span>' +
    '</div>';
    if (results.length === 0) {
        html += '<div class="search-empty"><span class="emoji">(´；ω；`)</span>没有找到匹配「' + escapeHtml(kw) + '」的番剧<div class="hint">试试其他关键词，或检查别名 / 标签 / 年份是否正确</div></div>';
    } else {
        html += '<div class="container-row"><div class="b-l">' +
            '<div class="b-head"><div class="left"><span class="b-head-i"></span><span class="b-head-t">搜索结果</span></div></div>' +
            '<ul class="vidbox">' + results.map(a => cardHTML(a, false, true)).join('') + '</ul>' +
        '</div></div>';
    }
    return html;
}
function renderDuty() {
    return '<div class="wrapper-doc"><div class="subtitle-new">资源免责申明</div><div class="article">' +
        '<div class="bt"><span class="color-alert">所有资源来自网友分享,本站只提供用户交互平台。</span></div>' +
        '<div class="bt">一.本站收录的各类视频与资料，大部分是网友从网上搜集分享而来，其版权均归原作者及其网站所有，本站虽力求保存原有的版权信息，但因很多视频资料经过多次转摘，已无法确定其真实来源，或者已将原有信息丢失，所以敬请原作者原谅。如果您对本站所载视频作品版权的归属存有异议，请立即通知我，我将在第一时间予以删除，同时向你表示歉意！</div>' +
        '<div class="bt">二.本站仅转载网上现成的视频资料，很难对这些视频的可用性，准确性或可靠性作出任何承诺与保证。不论何种情形，本站都不对任何由于使用或无法使用本站提供的视频资料所造成的直接的和间接的损失负任何责任。</div>' +
        '<div class="bt">三.本站提供的所有视频，均为网友私人收藏性质，未经原版权作者许可,任何人不得擅作它用！请在下载24小时内删除！为尊重作者版权，请购买原版作品,支持你喜欢的作者，谢谢！</div>' +
    '</div></div>';
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
        try { searchKw = decodeURIComponent(rawHash.slice(7)); } catch (err) { searchKw = rawHash.slice(7); }
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
                idxState.tag = '全部'; idxState.quality = '全部'; idxState.year = '全部'; idxState.month = '全部';
                html = renderBangumiIndex(); break;
            case 'duty': html = renderDuty(); break;
            case 'bangumi':
            default: html = renderBangumi(); break;
        }
    }
    main.innerHTML = html;
    if (rawHash === 'bangumi-index') {
        main.querySelectorAll('img').forEach(img => attachFallback(img, true));
    } else if (rawHash !== 'duty') {
        main.querySelectorAll('img').forEach(img => attachFallback(img, false));
    }
    document.querySelectorAll('#topArea img').forEach(img => { img.onerror = function () { this.style.display = 'none'; }; });
    bindVideoCardEvents(main);
    if (rawHash === 'bangumi-index') { bindIdxCardEvents(main); bindIdxFilterEvents(main); }
    $$('.m-i').forEach(li => li.classList.remove('on'));
    if (rawHash === 'home') {
        const homeLi = $('.m-i.home'); if (homeLi) homeLi.classList.add('on');
    } else if (rawHash === 'bangumi' || rawHash === 'bangumi-two' || rawHash === 'part-twoelement' || rawHash === 'bangumi-index') {
        const bangumiLi = $('.m-i[data-nav="bangumi"]'); if (bangumiLi) bangumiLi.classList.add('on');
    }
    window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);
window.addEventListener('DOMContentLoaded', render);

$('#searchForm').addEventListener('submit', function (e) { e.preventDefault(); doSearch($('#searchInput').value); });
$('#searchBtn').addEventListener('click', function (e) { e.preventDefault(); doSearch($('#searchInput').value); });
$('#searchInput').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); doSearch($('#searchInput').value); } });

window.addEventListener('scroll', function () { $('#backToTop').style.display = window.scrollY > 300 ? 'block' : 'none'; });
$('#backToTop').addEventListener('click', function (e) { e.preventDefault(); window.scrollTo({ top:0, behavior:'smooth' }); });

/* ============================================================
   用户系统：登录 / 注册 / 登出
   ============================================================ */
const API_BASE = 'https://api.imomoe.dpdns.org';

function getCurrentUser() {
    try {
        const raw = localStorage.getItem('imomoe_user');
        if (!raw) return null;
        return JSON.parse(raw);
    } catch { return null; }
}

function saveUser(user) {
    localStorage.setItem('imomoe_user', JSON.stringify(user));
}

function clearUser() {
    localStorage.removeItem('imomoe_user');
}

function refreshUserArea() {
    const area = document.getElementById('userArea');
    if (!area) return;
    const user = getCurrentUser();
    if (user) {
        area.innerHTML =
            '<span class="username-tag">你好，' + escapeHtml(user.username) + '</span>' +
            '<button class="logout-btn" id="logoutBtn">退出</button>';
        document.getElementById('logoutBtn').addEventListener('click', doLogout);
    } else {
        area.innerHTML = '<button class="login-btn" id="loginBtn">登录 / 注册</button>';
        document.getElementById('loginBtn').addEventListener('click', showLoginModal);
    }
}

function doLogout() {
    clearUser();
    refreshUserArea();
    alert('已退出登录');
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
            '<div class="modal-field">' +
                '<label>用户名</label>' +
                '<input type="text" id="modalUser" placeholder="2-20 位，字母数字下划线" autocomplete="off">' +
            '</div>' +
            '<div class="modal-field">' +
                '<label>密码</label>' +
                '<input type="password" id="modalPass" placeholder="至少 6 位" autocomplete="off">' +
            '</div>' +
            '<button class="modal-submit" id="modalSubmit">登录</button>' +
        '</div>';

    document.body.appendChild(modal);

    let mode = 'login';

    modal.querySelectorAll('.modal-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            modal.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('on'));
            tab.classList.add('on');
            mode = tab.dataset.tab;
            document.getElementById('modalSubmit').textContent = mode === 'login' ? '登录' : '注册';
            document.getElementById('modalMsg').className = 'modal-msg';
        });
    });

    document.getElementById('modalClose').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    document.getElementById('modalSubmit').addEventListener('click', async () => {
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
                setTimeout(() => {
                    modal.remove();
                    refreshUserArea();
                }, 800);
            } else {
                msg.textContent = data.error || '操作失败';
                msg.className = 'modal-msg err';
                btn.disabled = false;
                btn.textContent = mode === 'login' ? '登录' : '注册';
            }
        } catch (err) {
            msg.textContent = '网络错误：' + err.message;
            msg.className = 'modal-msg err';
            btn.disabled = false;
            btn.textContent = mode === 'login' ? '登录' : '注册';
        }
    });

    modal.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') document.getElementById('modalSubmit').click();
        });
    });
}

document.addEventListener('DOMContentLoaded', refreshUserArea);
