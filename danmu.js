/* ============================================================
   弹幕讨论功能
   依赖 main.js 的：API_BASE, getCurrentUser, escapeHtml, showLoginModal
   ============================================================ */

(function () {
    document.addEventListener('click', function (e) {
        const target = e.target.closest('.danmu-count');
        if (!target) return;

        e.preventDefault();
        e.stopPropagation();

        const card = target.closest('.v');
        if (!card) return;

        const title = card.getAttribute('data-title');
        if (!title) return;

        openDanmuModal(title);
    });

    function openDanmuModal(title) {
        const old = document.getElementById('danmuModal');
        if (old) old.remove();

        const modal = document.createElement('div');
        modal.id = 'danmuModal';
        modal.className = 'modal-mask';
        modal.innerHTML =
            '<div class="modal-box danmu-modal-box">' +
                '<button class="modal-close" id="danmuClose">×</button>' +
                '<h3 class="danmu-title">💬 ' + escapeHtml(title) + '</h3>' +
                '<div class="danmu-list" id="danmuList">加载中...</div>' +
                '<div class="danmu-input-area" id="danmuInputArea"></div>' +
            '</div>';

        document.body.appendChild(modal);

        document.getElementById('danmuClose').onclick = () => modal.remove();
        modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

        loadDanmu(title);
        renderInput(title);
    }

    async function loadDanmu(videoKey) {
        const listBox = document.getElementById('danmuList');
        if (!listBox) return;
        try {
            const res = await fetch(API_BASE + '/api/danmu/' + encodeURIComponent(videoKey));
            const data = await res.json();

            if (!Array.isArray(data) || data.length === 0) {
                listBox.innerHTML = '<div class="danmu-empty">还没有人讨论，来抢沙发吧~</div>';
                return;
            }

            listBox.innerHTML = data.map(d =>
                '<div class="danmu-item">' +
                    '<span class="danmu-user">' + escapeHtml(d.username || '匿名') + '</span>' +
                    '<span class="danmu-content">' + escapeHtml(d.content) + '</span>' +
                    '<span class="danmu-time">' + formatTime(d.created_at) + '</span>' +
                '</div>'
            ).join('');
        } catch (err) {
            listBox.innerHTML = '<div class="danmu-empty">加载失败：' + escapeHtml(err.message) + '</div>';
        }
    }

    function renderInput(videoKey) {
        const area = document.getElementById('danmuInputArea');
        if (!area) return;
        const user = getCurrentUser();

        if (!user) {
            area.innerHTML =
                '<div class="danmu-login-tip">请先登录才能发弹幕 ' +
                '<button class="login-btn" id="danmuLoginBtn">登录 / 注册</button></div>';
            document.getElementById('danmuLoginBtn').onclick = () => {
                const m = document.getElementById('danmuModal');
                if (m) m.remove();
                showLoginModal();
            };
            return;
        }

        area.innerHTML =
            '<div class="danmu-input-row">' +
                '<input type="text" id="danmuInput" placeholder="说点什么..." maxlength="100">' +
                '<button id="danmuSendBtn">发送</button>' +
            '</div>';

        const input = document.getElementById('danmuInput');
        const btn = document.getElementById('danmuSendBtn');

        btn.onclick = () => sendDanmu(videoKey, input.value);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') sendDanmu(videoKey, input.value);
        });
    }

    async function sendDanmu(videoKey, content) {
        content = (content || '').trim();
        if (!content) return;

        const user = getCurrentUser();
        if (!user) return;

        const btn = document.getElementById('danmuSendBtn');
        btn.disabled = true;
        btn.textContent = '发送中...';

        try {
            const res = await fetch(API_BASE + '/api/danmu', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + user.token
                },
                body: JSON.stringify({
                    videoKey: videoKey,
                    content: content,
                    timeInVideo: 0
                })
            });

            const data = await res.json();

            if (data.ok) {
                document.getElementById('danmuInput').value = '';
                await loadDanmu(videoKey);
            } else {
                alert(data.error || '发送失败');
            }
        } catch (err) {
            alert('网络错误：' + err.message);
        } finally {
            btn.disabled = false;
            btn.textContent = '发送';
        }
    }

    function formatTime(str) {
        if (!str) return '';
        const d = new Date(str.replace(' ', 'T') + 'Z');
        if (isNaN(d.getTime())) return str;

        const now = new Date();
        const diff = (now - d) / 1000;

        if (diff < 60) return '刚刚';
        if (diff < 3600) return Math.floor(diff / 60) + ' 分钟前';
        if (diff < 86400) return Math.floor(diff / 3600) + ' 小时前';
        if (diff < 86400 * 7) return Math.floor(diff / 86400) + ' 天前';

        return d.getFullYear() + '-' +
               String(d.getMonth() + 1).padStart(2, '0') + '-' +
               String(d.getDate()).padStart(2, '0');
    }
})();
