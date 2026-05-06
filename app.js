/** 1. CONFIGURATION **/
const SUPABASE_URL = 'https://keshhlhhqsarswkrogaj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_lx8TAyYqgseeVkkL6g0y0Q_YzYs0FmU';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let currentUser = JSON.parse(localStorage.getItem('finder_user'));
let currentCommentPostId = null;
let currentChatInfo = { receiverId: null, itemId: null };
let chatChannel = null;
let allItems = [];

/** 2. FUNCTIONS DECLARATION (Объявляем до вызова) **/

async function createNotification(recipientId, commentData) {
    if (!recipientId || recipientId === currentUser.id) return;

    try {
        await supabaseClient.from('notifications').insert([{
            user_id: recipientId,
            from_user_name: currentUser.name,
            from_user_avatar: currentUser.avatar_url,
            content: commentData.content,
            post_title: commentData.post_title
        }]);
    } catch (e) {
        console.error("Ошибка при создании уведомления:", e);
    }
}

async function loadInbox() {
    if (!currentUser) return;

    const { data, error } = await supabaseClient
        .from('notifications')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });

    const list = document.getElementById('inbox-list');
    const dot = document.getElementById('inbox-dot');

    if (data && data.length > 0) {
        if (dot) dot.classList.remove('hidden');
        if (list) {
            list.innerHTML = data.map(n => `
                <div class="px-5 py-4 hover:bg-slate-50 transition-colors flex gap-3 cursor-pointer border-b border-slate-50 last:border-0">
                    <div class="w-10 h-10 rounded-full bg-indigo-100 shrink-0 overflow-hidden border border-white shadow-sm">
                        ${n.from_user_avatar ? `<img src="${n.from_user_avatar}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center font-bold text-indigo-600">${n.from_user_name ? n.from_user_name[0] : '?'}</div>`}
                    </div>
                    <div class="overflow-hidden">
                        <p class="text-xs text-slate-900 leading-tight">
                            <span class="font-extrabold">${n.from_user_name}</span> 
                            пікір қалдырды: "${n.content}"
                        </p>
                        <p class="text-[9px] font-bold text-indigo-500 uppercase mt-1 opacity-70">${new Date(n.created_at).toLocaleTimeString()}</p>
                    </div>
                </div>
            `).join('');
        }
    } else if (list) {
        list.innerHTML = `<div class="p-5 text-center text-xs text-slate-400">Хабарламалар жоқ</div>`;
    }
}

function initNotifications() {
    if (!currentUser || !currentUser.id) return;
    console.log("System: Инциализация уведомлений...");

    // Подписка на уведомления конкретно для текущего пользователя
    supabaseClient
        .channel('my-notifications')
        .on('postgres_changes', {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${currentUser.id}`
        }, (payload) => {
            console.log("Новое уведомление в Realtime!", payload);
            if (document.getElementById('inbox-dot')) {
                document.getElementById('inbox-dot').classList.remove('hidden');
            }
            loadInbox();
        })
        .subscribe();
}

/** 3. INITIALIZATION **/
document.addEventListener('DOMContentLoaded', () => {
    if (!currentUser) {
        console.warn("Пользователь не авторизован");
        return;
    }

    updateUI();

    if (document.getElementById('itemsGrid')) {
        loadItems();
        initSearchAndFilters();
        initNotifications();
        loadInbox();
    }
});

function updateUI() {
    const avatarContainer = document.getElementById('user-avatar');
    if (avatarContainer && currentUser) {
        const initial = currentUser.name ? currentUser.name[0].toUpperCase() : '?';
        avatarContainer.innerHTML = currentUser.avatar_url
            ? `<img src="${currentUser.avatar_url}" class="w-full h-full object-cover rounded-full">`
            : `<div class="w-full h-full flex items-center justify-center bg-indigo-600 text-white font-bold rounded-full">${initial}</div>`;
    }
}

/** 4. POST & COMMENT LOGIC **/
window.submitComment = async function () {
    const input = document.getElementById('commentInput');
    const fileInput = document.getElementById('commentFile');
    const fName = `comm_${currentUser.id.slice(0, 5)}_${Date.now()}_${Math.floor(Math.random() * 1000)}.jpg`;
    if (!input || (!input.value && !fileInput.files[0])) return;

    try {
        let imgUrl = null;
        if (fileInput.files[0]) {
            const f = fileInput.files[0];
            const fName = `comm_${Date.now()}.jpg`;
            await supabaseClient.storage.from('item-images').upload(fName, f);
            imgUrl = supabaseClient.storage.from('item-images').getPublicUrl(fName).data.publicUrl;
        }

        // 1. Получаем инфо о посте (чтобы знать кому слать уведомление)
        const { data: post } = await supabaseClient
            .from('items')
            .select('user_id, title')
            .eq('id', currentCommentPostId)
            .single();

        // 2. Сохраняем комментарий
        await supabaseClient.from('comments').insert([{
            item_id: currentCommentPostId,
            user_id: currentUser.id,
            user_name: currentUser.name,
            user_avatar_url: currentUser.avatar_url,
            content: input.value,
            comment_image: imgUrl
        }]);

        // 3. Создаем уведомление
        if (post && post.user_id !== currentUser.id) {
            await createNotification(post.user_id, {
                content: input.value,
                post_title: post.title
            });
        }

        input.value = '';
        if (window.clearCommentImage) window.clearCommentImage();
        loadComments(currentCommentPostId);
    } catch (e) {
        console.error("Қате кетті:", e);
    }
};

window.createPost = async function() {
    const title = document.getElementById('itemTitle').value;
    const locationInput = document.getElementById('itemLocation').value;
    const description = document.getElementById('userDesc').value;
    const type = document.querySelector('input[name="itemType"]:checked').value;
    const fileInput = document.getElementById('fileInput');
    const isAnonymous = document.getElementById('isAnonymous').checked;

    if (!title || !fileInput.files[0]) {
        alert("Пожалуйста, введите название и добавьте фото");
        return;
    }

    const btn = document.getElementById('submitBtn');
    btn.disabled = true;
    btn.innerText = "Загрузка...";

    try {
        const file = fileInput.files[0];
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random()}.${fileExt}`;
        const filePath = `items/${fileName}`;

        // 1. Загрузка изображения в Storage
        let { error: uploadError } = await supabaseClient.storage
            .from('item-images')
            .upload(filePath, file);

        if (uploadError) throw uploadError;

        const { data: imgData } = supabaseClient.storage
            .from('item-images')
            .getPublicUrl(filePath);

        // 2. Запись в таблицу items
        const { error: insertError } = await supabaseClient.from('items').insert([{
            title: title,
            location: locationInput,
            description: description,
            type: type,
            image_url: imgData.publicUrl,
            user_id: currentUser.id,
            author_name: isAnonymous ? "Аноним" : currentUser.name
        }]);

        if (insertError) throw insertError;

        window.location.reload(); // Перезагрузка для обновления списка
    } catch (error) {
        console.error("Ошибка при создании поста:", error.message);
        alert("Произошла ошибка при публикации");
    } finally {
        btn.disabled = false;
        btn.innerText = "Жариялау";
    }
};
window.openCreateModal = () => {
    const modal = document.getElementById('createModalWrapper');
    if (modal) modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden'; // Запрет прокрутки фона
};

window.closeCreateModal = () => {
    const modal = document.getElementById('createModalWrapper');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = 'auto';
};

// Переопределяем toggleModal, чтобы он работал корректно с вашими ID
window.toggleModal = (mId, show) => {
    // Проверяем, передан ли ID с Wrapper или без, и находим нужный элемент
    const targetId = mId.endsWith('Wrapper') ? mId : mId + 'Wrapper';
    const el = document.getElementById(targetId);
    
    if (el) {
        show ? el.classList.remove('hidden') : el.classList.add('hidden');
        document.body.style.overflow = show ? 'hidden' : 'auto';
    }
};
window.previewCommentImage = (input) => {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        reader.onload = function(e) {
            const preview = document.getElementById('commentImagePreview');
            const img = document.getElementById('prevImg');
            img.src = e.target.result;
            preview.classList.remove('hidden');
        }
        reader.readAsDataURL(input.files[0]);
    }
};
function initSearchAndFilters() {
    // Поиск по тексту
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const query = e.target.value.toLowerCase();
            const filtered = allItems.filter(i => 
                i.title.toLowerCase().includes(query) || 
                i.location.toLowerCase().includes(query)
            );
            renderGrid(filtered, 'itemsGrid');
        });
    }

    // Фильтр по кнопкам
    const buttons = document.querySelectorAll('.cat-btn');
    buttons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Визуальное переключение активной кнопки
            buttons.forEach(b => b.classList.remove('active-cat'));
            btn.classList.add('active-cat');

            const type = btn.getAttribute('data-type');
            const filtered = type === 'all' 
                ? allItems 
                : allItems.filter(i => i.type === type);
            
            renderGrid(filtered, 'itemsGrid');
        });
    });
}

async function loadComments(postId) {
    const { data } = await supabaseClient.from('comments').select('*').eq('item_id', postId).order('created_at', { ascending: true });
    const list = document.getElementById('commentsList');
    if (!list) return;

    list.innerHTML = (data || []).map(c => {
        const initial = c.user_name ? c.user_name[0].toUpperCase() : '?';
        return `
        <div class="flex gap-3 mb-4 max-w-[95%]">
            <div class="w-9 h-9 rounded-full shrink-0 border shadow-sm overflow-hidden bg-slate-200">
                ${c.user_avatar_url ? `<img src="${c.user_avatar_url}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center bg-indigo-100 text-indigo-600 text-[10px] font-bold">${initial}</div>`}
            </div>
            <div class="bg-slate-50 p-4 rounded-2xl rounded-tl-none border border-slate-100 flex-1">
                <p class="text-[10px] font-black text-indigo-600 uppercase mb-1">${c.user_name}</p>
                <p class="text-sm font-semibold text-slate-700">${c.content}</p>
                ${c.comment_image ? `<img src="${c.comment_image}" class="mt-3 rounded-xl w-full max-h-48 object-cover border-2 border-white">` : ''}
            </div>
        </div>`;
    }).join('');
    list.scrollTop = list.scrollHeight;
}

/** Остальные функции (модалки, загрузка айтемов и т.д.) **/
window.toggleInbox = () => {
    const dropdown = document.getElementById('inbox-dropdown');
    if (!dropdown) return;
    const isHidden = dropdown.classList.contains('hidden');

    if (isHidden) {
        dropdown.classList.remove('hidden');
        loadInbox();
        const dot = document.getElementById('inbox-dot');
        if (dot) dot.classList.add('hidden');
    } else {
        dropdown.classList.add('hidden');
    }
};

async function loadItems() {
    try {
        const { data, error } = await supabaseClient.from('items').select('*').order('created_at', { ascending: false });
        if (error) throw error;
        allItems = data || [];
        renderGrid(allItems, 'itemsGrid');
    } catch (err) { console.error(err.message); }
}

function renderGrid(items, elementId) {
    const grid = document.getElementById(elementId);
    if (!grid) return;
    if (items.length === 0) {
        grid.innerHTML = `<div class="col-span-full text-center py-20 text-slate-400 font-bold uppercase text-xs tracking-widest">Ештеңе табылмады...</div>`;
        return;
    }
    grid.innerHTML = items.map(item => {
        const isLost = item.type === 'lost';
        return `
        <div class="item-card p-4 flex flex-col relative bg-white rounded-[24px] border border-slate-100 shadow-sm transition-all hover:shadow-md">
            <div class="absolute top-6 left-6 z-10">
                <span class="px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider text-white ${isLost ? 'bg-red-500' : 'bg-emerald-500'}">
                    ${isLost ? 'Жоғалды' : 'Табылды'}
                </span>
            </div>
            <div class="w-full h-64 bg-slate-100 rounded-[20px] mb-4 overflow-hidden relative group">
                <img src="${item.image_url}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110">
                <button onclick="toggleFavorite('${item.id}')" class="absolute top-3 right-3 bg-white/90 backdrop-blur p-3 rounded-xl hover:bg-white transition-all">
                    <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"></path></svg>
                </button>
            </div>
            <h3 class="font-extrabold text-xl mb-1 text-slate-900 truncate">${item.title}</h3>
            <p class="text-slate-500 text-sm mb-4 flex items-center gap-1 font-medium italic">${item.location || 'Белгісіз жер'}</p>
            <div class="mt-auto flex items-center gap-2 pt-4 border-t border-slate-50">
                <button onclick="openChat('${item.user_id}', '${item.id}', '${item.author_name}')" class="flex-1 bg-slate-900 text-white py-3 rounded-xl font-bold text-xs hover:bg-indigo-600 transition-all uppercase tracking-wider">Байланысу</button>
                <button onclick="openCommentModal('${item.id}')" class="w-12 h-12 flex items-center justify-center bg-slate-100 rounded-xl hover:bg-slate-200 transition-all text-slate-600">💬</button>
            </div>
        </div>
    `}).join('');
}

// Вспомогательные функции для модалок
window.toggleModal = (mId, show) => {
    const el = document.getElementById(mId.includes('Wrapper') ? mId : mId + 'Wrapper');
    if (el) show ? el.classList.remove('hidden') : el.classList.add('hidden');
};
window.openCommentModal = (postId) => {
    currentCommentPostId = postId;
    window.toggleModal('commentModal', true);
    loadComments(postId);
};
window.closeCommentModal = () => window.toggleModal('commentModal', false);



window.clearCommentImage = () => {
    const fileEl = document.getElementById('commentFile');
    if (fileEl) fileEl.value = '';
    const prev = document.getElementById('commentImagePreview');
    if (prev) prev.classList.add('hidden');
};

window.logout = () => {
    localStorage.removeItem('finder_user');
    window.location.href = 'login.html';
};