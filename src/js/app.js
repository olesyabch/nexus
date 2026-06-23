const profilesCache = {
    data: {},
    timestamp: {}
};

async function getProfileCached(userId, maxAge = 60000) {
    const now = Date.now();
    
    if (profilesCache.data[userId] && (now - profilesCache.timestamp[userId]) < maxAge) {
        return profilesCache.data[userId];
    }
    
    const { data } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name, user_type, universities(name)')
        .eq('id', userId)
        .single();
    
    if (data) {
        profilesCache.data[userId] = data;
        profilesCache.timestamp[userId] = now;
    }
    
    return data;
}

let currentPhase = 'want';
let selectedSubcategories = [];
let currentCategory = null;
let allSelectedSkillsWant = [];
let allSelectedSkillsCan = [];
let selectedCategoryNames = new Set();
let registrationPreviousStep = null;

let searchFilters = {
    isUniversityUser: null,
    selectedSkills: [],
    sortByRating: true
};

let selectedRating = 0;
let reviewRecipientId = null;
let reviewRequestId = null;
let editCurrentSkillTab = 'can';
let editSelectedSkillsCan = [];
let editSelectedSkillsWant = [];
let editExpandedCategory = null;

const notifCache = {
    pendingRequests: null,
    unreadMessages: null,
    timestamp: 0
};

const chatCache = {
    chats: null,
    timestamp: 0
};
const lessonsCache = {
    data: null,
    timestamp: 0
};

let statsSelection = {
    instituteId: null,
    instituteName: '',
    eduType: null,
    course: null,
    groupId: null
};

function clearLessonsCache() {
    lessonsCache.data = null;
    lessonsCache.timestamp = 0;
}

const CACHE_DURATION = 30000; // 30 секунд

function isCacheValid(cache) {
    return cache.timestamp && (Date.now() - cache.timestamp) < CACHE_DURATION;
}

function clearNotifCache() {
    notifCache.pendingRequests = null;
    notifCache.unreadMessages = null;
    notifCache.timestamp = 0;
}

function clearChatCache() {
    chatCache.chats = null;
    chatCache.timestamp = 0;
}

function clearAllCaches() {
    clearNotifCache();
    clearChatCache();
}

window.goBackToSearch = function() {
    const searchNav = document.querySelector('.nav-item[data-tab="search"]');
    if (searchNav) {
        switchTab('search', searchNav);
    }
};

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(m => { 
        m.classList.remove('active'); 
        setTimeout(() => m.style.display = 'none', 300); 
    });
}

function openModal(id) { 
    document.getElementById(id).style.display = 'flex'; 
    setTimeout(() => document.getElementById(id).classList.add('active'), 10); 
}

function closeModal(id) { 
    const modal = document.getElementById(id);
    if (modal) {
        modal.classList.remove('active'); 
        setTimeout(() => modal.style.display = 'none', 300); 
    }
}

window.goBackToRegister = function() {
    closeModal('aboutModal');
    setTimeout(() => openModal('registerModal'), 300);
};

window.studentGo = function(target) {
    ['studentUnivModal','studentCourseModal','studentFacultyModal','studentGroupModal'].forEach(id => {
        const m = document.getElementById(id);
        if (id === target) { 
            m.style.display = 'flex'; 
            setTimeout(() => m.classList.add('active'), 10); 
        } else {
            m.classList.remove('active'); 
            m.style.display = 'none'; 
        }
    });
};

function showError(message) {
    const existingError = document.querySelector('.error-message');
    if (existingError) existingError.remove();
    
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => errorDiv.remove(), 3000);
}

function showSuccess(message) {
    const existingSuccess = document.querySelector('.success-message');
    if (existingSuccess) existingSuccess.remove();
    
    const successDiv = document.createElement('div');
    successDiv.className = 'success-message';
    successDiv.textContent = message;
    document.body.appendChild(successDiv);
    
    setTimeout(() => successDiv.remove(), 3000);
}

function clearCache() {
    dataCache.currentUser = null;
    dataCache.currentProfile = null;
}

window.handleLogin = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    
    if (!email || !password) {
        showError('Заполните все поля');
        return;
    }
    
    btn.disabled = true; 
    btn.innerHTML = '<span class="loading"></span>';
    
    try {
        const result = await loginUser(email, password);
        
        if (result.success) {
            clearCache();
            closeAllModals();
            document.getElementById('welcomeScreen').style.display = 'none';
            document.querySelector('.logo-small').style.display = 'none';
            document.getElementById('studentApp').classList.add('active');
            
            if (typeof startLastSeenTracker === 'function') {
                startLastSeenTracker();
            }
            
            switchTab('notif', document.querySelector('.nav-item[data-tab="notif"]'));

            if (typeof startLessonConfirmationChecker === 'function') {
                startLessonConfirmationChecker();
            }
        } else {
            showError(result.error || 'Неверный email или пароль');
            btn.disabled = false; 
            btn.textContent = 'Продолжить';
        }
    } catch (error) {
        showError('Произошла ошибка при входе');
        btn.disabled = false; 
        btn.textContent = 'Продолжить';
    }
};

window.handleRegisterStep1 = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('regBtn1');
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPassword').value;
    const passwordConfirm = document.getElementById('regPasswordConfirm').value;
    const nickname = document.getElementById('regNickname').value;
    const firstName = document.getElementById('regFirstName').value;
    const lastName = document.getElementById('regLastName').value;
    
    if (password !== passwordConfirm) { 
        showError('Пароли не совпадают!'); 
        return; 
    }

    if (password.length < 6) {
        showError('Пароль должен быть не менее 6 символов');
        return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
        showError('Введите корректный email');
        return;
    }
    
    if (!firstName || !lastName) {
        showError('Введите имя и фамилию');
        return;
    }
    
    btn.disabled = true; 
    btn.innerHTML = '<span class="loading"></span>';
    
    try {
        const result = await registerUser(email, password, nickname, 'student', firstName, lastName);
        
        if (result.success) {
            closeModal('registerModal'); 
            setTimeout(() => openModal('aboutModal'), 350);
        } else {
            showError(result.error);
            btn.disabled = false; 
            btn.textContent = 'Продолжить';
        }
    } catch (error) {
        showError('Произошла ошибка при регистрации');
        btn.disabled = false; 
        btn.textContent = 'Продолжить';
    }
};

window.handleRegisterStep2 = async function(e) {
    e.preventDefault();
    const btn = document.getElementById('regBtn2');
    const aboutText = document.getElementById('regAbout').value.trim();
    
    btn.disabled = true; 
    btn.innerHTML = '<span class="loading"></span>';
    
    
    if (!aboutText) {
        registrationPreviousStep = 'aboutModal';
        closeModal('aboutModal'); 
        setTimeout(() => openModal('uniModal'), 350);
        btn.disabled = false; 
        btn.textContent = 'Продолжить';
        return;
    }
    
    
    updateProfile({ bio: aboutText })
        .then(success => {
            if (success) {
                registrationPreviousStep = 'aboutModal';
                closeModal('aboutModal'); 
                setTimeout(() => openModal('uniModal'), 350); 
            } else {
                showError('Ошибка сохранения данных "О себе"');
                btn.disabled = false; 
                btn.textContent = 'Продолжить';
            }
        })
        .catch(error => {
            showError('Произошла ошибка');
            btn.disabled = false; 
            btn.textContent = 'Продолжить';
        });
};

window.selectUni = async function(isConnected) {
    document.getElementById('uniYes').classList.remove('selected');
    document.getElementById('uniNo').classList.remove('selected');
    (isConnected ? document.getElementById('uniYes') : document.getElementById('uniNo')).classList.add('selected');
    
    const profile = await getCurrentProfile();
    const isAdmin = profile && profile.user_type === 'admin';
    
    updateProfile({ 
        is_connected_to_university: isConnected,
        skill_coins: isAdmin ? null : (isConnected ? 1000 : 3)
    }).catch(error => {});
    
    setTimeout(() => {
        if (isConnected) { 
            registrationPreviousStep = 'uniModal';
            closeModal('uniModal'); 
            setTimeout(() => openModal('roleModal'), 350); 
        } else { 
            updateProfile({ user_type: 'private' }).catch(err => {});
            registrationPreviousStep = 'uniModal';
            closeModal('uniModal'); 
            setTimeout(() => showCategories('want'), 350);
        }
    }, 500);
};

window.selectRole = function(role) {
    document.getElementById('roleStudent').classList.remove('selected');
    document.getElementById('roleAdmin').classList.remove('selected');
    (role === 'student' ? document.getElementById('roleStudent') : document.getElementById('roleAdmin')).classList.add('selected');
    
    updateProfile({ user_type: role }).catch(error => {});
    
    setTimeout(() => {
        registrationPreviousStep = 'roleModal';
        closeModal('roleModal');
        setTimeout(() => openModal('studentUnivModal'), 350);
    }, 500);
};

window.selectTeacherRole = function() {
    updateProfile({ user_type: 'teacher' }).catch(error => {});
    
    registrationPreviousStep = 'studentCourseModal';
    closeModal('studentCourseModal');
    setTimeout(() => showCategories('want'), 350);
};

window.completeStudentRegistration = async function() {
    const currentSkillsWant = allSelectedSkillsWant;
    const currentSkillsCan = allSelectedSkillsCan;
    
    if (currentSkillsWant.length === 0) {
        showError('Выберите хотя бы один навык который хотите изучить');
        return;
    }
    
    const user = await getCurrentUser();
    if (!user) {
        showError('Сессия истекла. Пожалуйста, войдите снова.');
        setTimeout(() => {
            closeAllModals();
            document.getElementById('categoryApp').classList.remove('active');
            document.getElementById('subApp').classList.remove('active');
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.querySelector('.logo-small').style.display = 'block';
        }, 2000);
        return;
    }
    
    try {
        showLoading('Завершаем регистрацию...');
        const success = await saveSkillsToProfile(currentSkillsWant, currentSkillsCan);
        hideLoading();
        
        if (!success) {
            showError('Ошибка сохранения навыков');
            return;
        }
        
        showSuccess('Регистрация завершена!');
        
        allSelectedSkillsWant = [];
        allSelectedSkillsCan = [];
        selectedCategoryNames.clear();
        
        setTimeout(() => {
            document.getElementById('categoryApp').classList.remove('active');
            document.getElementById('subApp').classList.remove('active');
            document.getElementById('categoryApp').style.display = 'none';
            document.getElementById('subApp').style.display = 'none';
            
            closeAllModals();
            document.getElementById('welcomeScreen').style.display = 'none';
            document.querySelector('.logo-small').style.display = 'none';
            document.getElementById('studentApp').classList.add('active');
            
            clearCache();
            switchTab('notif', document.querySelector('.nav-item[data-tab="notif"]'));

            if (typeof startLessonConfirmationChecker === 'function') {
                startLessonConfirmationChecker();
            }
        }, 1000);
    } catch (error) {
        hideLoading();
        showError('Ошибка сохранения данных');
    }
};

async function showCategories(phase) {
    if (!window.skillsFromDB || Object.keys(window.skillsFromDB).length === 0) {
        if (typeof showLoading === 'function') showLoading('Загружаем навыки...');
        await loadSkillsFromDB();
        if (typeof hideLoading === 'function') hideLoading();
        
        if (!window.skillsFromDB || Object.keys(window.skillsFromDB).length === 0) {
            showError('Не удалось загрузить навыки. Попробуйте обновить страницу.');
            return;
        }
    }
    
    currentPhase = phase;
    selectedSubcategories = [];
    const content = document.getElementById('categoryContent');
    const title = phase === 'want' ? 'Чему вы хотите научиться?' : 'Чему вы можете научить?';
    
    const categoryList = Object.keys(skillsFromDB);
    const currentSkills = phase === 'want' ? allSelectedSkillsWant : allSelectedSkillsCan;
    
    let html = `
        <div style="padding:30px 20px;">
            <h2 class="category-title">${title}</h2>
            <div class="skill-selection-header">
                <span>Выбрано навыков: <strong>${currentSkills.length}</strong></span>
                ${currentSkills.length > 0 ? `<button class="clear-btn" onclick="clearAllSkills()">Очистить всё</button>` : ''}
            </div>
            <div class="category-list">
                ${categoryList.map(cat => {
                    const isSelected = selectedCategoryNames.has(cat);
                    return `<button class="category-item ${isSelected ? 'selected' : ''}" onclick="toggleCategory(this,'${cat}')">${cat}</button>`;
                }).join('')}
            </div>
    `;
    
    if (currentSkills.length > 0) {
        html += `
            <div class="selected-skills-list">
                ${currentSkills.map(skill => `
                    <span class="selected-skill-tag">
                        ${skill}
                        <span class="remove-skill" onclick="removeSkill('${skill.replace(/'/g, "\\'")}')">×</span>
                    </span>
                `).join('')}
            </div>
        `;
    }
    
    html += `<button class="category-next-btn" id="catNextBtn" onclick="nextFromCategories()" ${currentSkills.length === 0 ? 'disabled' : ''}>Далее</button></div>`;
    
    content.innerHTML = html;
    document.getElementById('categoryApp').classList.add('active');
    document.getElementById('categoryApp').scrollTop = 0;
}

window.toggleCategory = function(btn, catName) {
    currentCategory = catName;
    showSubcategories(catName);
};

window.nextFromCategories = function() {
    const currentSkills = currentPhase === 'want' ? allSelectedSkillsWant : allSelectedSkillsCan;
    if (currentSkills.length === 0) {
        showError('Выберите хотя бы один навык');
        return;
    }
    
    if (currentPhase === 'want') {
        showCategories('can');
    } else {
        document.getElementById('categoryApp').classList.remove('active');
        completeStudentRegistration();
    }
};

window.goBackFromCategories = function() {
    document.getElementById('categoryApp').classList.remove('active');
    
    if (registrationPreviousStep) {
        setTimeout(() => openModal(registrationPreviousStep), 300);
        registrationPreviousStep = null;
    } else {
        if (document.getElementById('welcomeScreen').style.display === 'none' && 
            !document.getElementById('studentApp').classList.contains('active')) {
            document.getElementById('welcomeScreen').style.display = 'flex';
            document.querySelector('.logo-small').style.display = 'block';
        }
    }
};

window.goBackToCategories = function() {
    document.getElementById('subApp').classList.remove('active');
    showCategories(currentPhase);
};

function showSubcategories(catName) {
    currentCategory = catName;
    selectedSubcategories = [];
    const skills = skillsFromDB[catName] || [];
    const content = document.getElementById('subContent');
    const currentSkills = currentPhase === 'want' ? allSelectedSkillsWant : allSelectedSkillsCan;
    
    let html = `
        <div style="display:flex;align-items:center;padding:15px 20px;border-bottom:1px solid rgba(100,141,229,0.2);position:sticky;top:0;background:rgba(255,255,255,0.9);backdrop-filter:blur(10px);z-index:10;">
            <span class="sub-back" onclick="goBackToCategories()" style="font-size:24px;cursor:pointer;margin-right:15px;color:var(--text);">←</span>
            <div class="sub-logo" style="color:var(--primary);font-weight:700;font-size:20px;">НЕКСУС</div>
        </div>
        <div style="padding:30px 20px;">
            <h2 class="sub-title">${catName}</h2>
            <div class="skill-selection-header">
                <span>Выберите навыки</span>
                <span class="skill-counter">Выбрано: ${currentSkills.filter(s => skills.includes(s)).length}</span>
            </div>
            <div class="sub-list">
                ${skills.map(skill => {
                    const isSelected = currentSkills.includes(skill);
                    return `<button class="sub-item ${isSelected ? 'selected' : ''}" onclick="toggleSub(this,'${skill.replace(/'/g, "\\'")}')">${skill}</button>`;
                }).join('')}
            </div>
    `;
    
    const selectedFromCategory = currentSkills.filter(s => skills.includes(s));
    if (selectedFromCategory.length > 0) {
        html += `
            <div class="selected-skills-list">
                ${selectedFromCategory.map(skill => `
                    <span class="selected-skill-tag">
                        ${skill}
                        <span class="remove-skill" onclick="removeSkill('${skill.replace(/'/g, "\\'")}')">×</span>
                    </span>
                `).join('')}
            </div>
        `;
    }
    
    html += `<button class="category-next-btn" onclick="goBackToCategories()">Назад к категориям</button></div>`;
    
    content.innerHTML = html;
    document.getElementById('subApp').classList.add('active');
    document.getElementById('subApp').scrollTop = 0;
}

window.toggleSub = function(btn, name) {
    const currentSkills = currentPhase === 'want' ? allSelectedSkillsWant : allSelectedSkillsCan;
    
    if (currentSkills.includes(name)) {
        if (currentPhase === 'want') {
            allSelectedSkillsWant = allSelectedSkillsWant.filter(s => s !== name);
        } else {
            allSelectedSkillsCan = allSelectedSkillsCan.filter(s => s !== name);
        }
        btn.classList.remove('selected');
    } else {
        if (currentPhase === 'want') {
            allSelectedSkillsWant.push(name);
        } else {
            allSelectedSkillsCan.push(name);
        }
        btn.classList.add('selected');
    }
    
    showSubcategories(currentCategory);
};

window.removeSkill = function(skillName) {
    allSelectedSkillsWant = allSelectedSkillsWant.filter(s => s !== skillName);
    allSelectedSkillsCan = allSelectedSkillsCan.filter(s => s !== skillName);
    selectedCategoryNames.clear();
    
    allSelectedSkillsWant.forEach(s => {
        Object.keys(skillsFromDB).forEach(cat => {
            if (skillsFromDB[cat].includes(s)) {
                selectedCategoryNames.add(cat);
            }
        });
    });
    allSelectedSkillsCan.forEach(s => {
        Object.keys(skillsFromDB).forEach(cat => {
            if (skillsFromDB[cat].includes(s)) {
                selectedCategoryNames.add(cat);
            }
        });
    });
    
    showCategories(currentPhase);
};

window.clearAllSkills = function() {
    if (confirm('Очистить все выбранные навыки?')) {
        allSelectedSkillsWant = [];
        allSelectedSkillsCan = [];
        selectedCategoryNames.clear();
        showCategories(currentPhase);
    }
};

window.selectCourse = async function(btn, eduType, courseNum) {
    document.querySelectorAll('.course-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
    
    updateProfile({
        education_type: eduType,
        course: courseNum
    }).catch(error => {});
    
    await loadGroupsForSelection(eduType, courseNum);
};

async function loadGroupsForSelection(eduType, course) {
    const groups = await getGroupsByTypeAndCourse(eduType, course);
    const container = document.getElementById('groupListContainer');
    
    if (!container) {
        showError('Ошибка загрузки групп');
        return;
    }
    
    if (groups.length > 0) {
        container.innerHTML = groups.map(g => `
            <div class="faculty-item" onclick="selectGroupFromDB(${g.id}, '${g.name.replace(/'/g, "\\'")}')">
                ${g.name}
            </div>
        `).join('');
    } else {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Группы не найдены</div>';
    }
    
    closeModal('studentCourseModal');
    setTimeout(() => openModal('studentGroupModal'), 300);
}

window.selectGroupFromDB = async function(groupId, groupName) {
    await selectGroupInDB(groupId);
    
    const profile = await getCurrentProfile();
    
    if (profile && profile.user_type === 'admin') {
        await loadGroupStudents(groupId);
    } else {
        registrationPreviousStep = 'studentGroupModal';
        closeModal('studentGroupModal');
        setTimeout(() => showCategories('want'), 350);
    }
};

window.switchTab = async function(tab, navBtn) {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    if (navBtn) navBtn.classList.add('active');
    else document.querySelector(`.nav-item[data-tab="${tab}"]`)?.classList.add('active');

    const header = document.getElementById('appHeader');
    const content = document.getElementById('appContent');
    header.innerHTML = `<div class="app-logo">НЕКСУС</div><div class="app-settings" onclick="openSettingsApp()">⚙️</div>`;
    
    
    if (tab === 'notif') {
        await renderNotif(content);
    } else if (tab === 'chat') {
        await renderChatsList(content);
    } else if (tab === 'search') {
        await renderSearch(content);
    } else if (tab === 'profile') {
        await renderProfile(content);
    }
};

async function renderSearch(container) {
    try {
        container.innerHTML = `
            <div style="padding:60px 20px;text-align:center;">
                <div class="loading" style="width:40px;height:40px;margin:0 auto 20px;"></div>
                <div style="color:var(--text-secondary);font-size:16px;">Загружаем пользователей...</div>
            </div>
        `;
        
        const [users, universities] = await Promise.all([
            getAllUsersForSearch(),
            getUniversities()
        ]);
        
        if (!window.skillsFromDB) {
            await loadSkillsFromDB();
        }
        
        let filteredUsers = [...users];
        
        if (searchFilters.isUniversityUser === true) {
            filteredUsers = filteredUsers.filter(u => u.is_connected_to_university);
        } else if (searchFilters.isUniversityUser === false) {
            filteredUsers = filteredUsers.filter(u => !u.is_connected_to_university);
        }
        
        if (searchFilters.selectedSkills.length > 0) {
            filteredUsers = filteredUsers.filter(user => {
                const userSkills = user.skills_can_teach || [];
                return searchFilters.selectedSkills.some(skill => 
                    userSkills.includes(skill)
                );
            });
        }
        
        if (searchFilters.sortByRating) {
            filteredUsers.sort((a, b) => {
                const ratingA = parseFloat(a.rating) || 0;
                const ratingB = parseFloat(b.rating) || 0;
                return ratingB - ratingA;
            });
        }
        
        if (filteredUsers.length === 0) {
            container.innerHTML = `
                <div style="padding:20px;">
                    <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
                        <div class="search-main" style="flex:1;margin-bottom:0;" onclick="openSearchFilters()">
                            <input type="text" placeholder="Найти пользователя..." readonly>
                            <span class="search-icon">🔍</span>
                        </div>
                        <span class="search-menu-dots" onclick="openSearchFilters()"></span>
                    </div>
                    <div style="padding:60px 20px;text-align:center;color:#999;">
                        <div style="font-size:48px;margin-bottom:15px;">🔍</div>
                        <div>Пользователи не найдены</div>
                        <div style="font-size:14px;margin-top:8px;">Попробуйте изменить фильтры</div>
                    </div>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div style="padding:20px;">
                <div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">
                    <div class="search-main" style="flex:1;margin-bottom:0;" onclick="openSearchFilters()">
                        <input type="text" placeholder="Найти пользователя..." readonly>
                        <span class="search-icon">🔍</span>
                    </div>
                    <span class="search-menu-dots" onclick="openSearchFilters()"></span>
                </div>
                
                ${searchFilters.selectedSkills.length > 0 ? `
                    <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:15px;">
                        ${searchFilters.selectedSkills.map(skill => `
                            <span style="background:var(--primary);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:flex;align-items:center;gap:6px;">
                                ${skill}
                                <span onclick="removeSkillFilter('${skill.replace(/'/g, "\\'")}'); renderSearch(document.getElementById('appContent'));" style="cursor:pointer;font-size:14px;">×</span>
                            </span>
                        `).join('')}
                    </div>
                ` : ''}
                
                <div style="font-size:13px;color:#727272;margin-bottom:15px;">
                    Найдено: ${filteredUsers.length}
                </div>
                
                <div class="profile-cards-container">
                    ${filteredUsers.map(user => {
                        const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.nickname;
                        const roleText = user.user_type === 'teacher' ? 'Преподаватель' : user.user_type === 'private' ? 'Частное лицо' : 'Студент';
                        const uniName = dataCache.uniMap?.[user.university_id] || '';
                        const roleWithUni = uniName ? `${roleText} ${uniName}` : roleText;
                        const isOnline = isUserOnline(user.last_seen);
                        
                        return `
                            <div class="profile-card" onclick="openUserProfile('${user.nickname}')">
                                <div class="profile-card-content">
                                    <div class="profile-card-avatar-wrapper">
                                        <div class="profile-card-avatar">👤</div>
                                        ${isOnline ? '<div class="online-dot"></div>' : ''}
                                    </div>
                                    <div style="font-size:15px;font-weight:700;margin-bottom:4px;color:var(--text);">${fullName}</div>
                                    <div style="font-size:12px;color:var(--text-secondary);margin-bottom:8px;">${roleWithUni}</div>
                                    <div style="font-size:12px;color:#555;margin-bottom:10px;">★ ${user.rating || '0.0'} (${user.review_count || 0})</div>
                                    <div class="profile-card-skills-container">
                                        <div style="font-size:11px;color:var(--text-secondary);margin-bottom:4px;text-align:left;width:100%;">
                                            <strong>Могу обучить:</strong> ${(user.skills_can_teach || []).join(', ') || '—'}
                                        </div>
                                        <div style="font-size:11px;color:var(--text-secondary);text-align:left;width:100%;">
                                            <strong>Хочу освоить:</strong> ${(user.skills_want_learn || []).join(', ') || '—'}
                                        </div>
                                    </div>
                                </div>
                                <button class="request-btn" onclick="event.stopPropagation(); openSendRequestModal('${user.id}', '${user.nickname}')">
                                    <div style="font-size:14px;font-weight:700;">Отправить запрос</div>
                                    <div style="font-size:11px;opacity:0.9;">(стоимость 5 коинсов)</div>
                                </button>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
    } catch (err) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#f44336;">Ошибка загрузки пользователей</div>';
    }
}

window.openUserProfile = async function(nickname) {
    const user = await getUserByNickname(nickname);
    
    if (!user) {
        showError('Пользователь не найден');
        return;
    }
    
    let roleText = 'Студент';
    if (user.user_type === 'teacher') roleText = 'Преподаватель';
    else if (user.user_type === 'admin') roleText = 'Администратор';
    else if (user.user_type === 'private') roleText = 'Частное лицо';
    
    const onlineStatus = isUserOnline(user.last_seen) ? 'В Нексусе' : 'Не в Нексусе';
    const onlineColor = isUserOnline(user.last_seen) ? '#fff' : '#999';
    
    const fullName = `${user.last_name || ''} ${user.first_name || ''}`.trim() || user.nickname;
    
    const content = document.getElementById('appContent');
    
    content.innerHTML = `
        <div style="padding:20px;">
            <div style="margin-bottom:15px;">
                <span onclick="window.goBackToSearchFromProfile()" style="cursor:pointer;font-size:24px;color:var(--text);">←</span>
            </div>
            
            <div style="max-width:500px;margin-left:auto;margin-right:auto;">
                
                <div style="display:flex;gap:20px;margin-bottom:25px;">
                    <div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#E8EEF8,#d0d8e8);display:flex;align-items:center;justify-content:center;font-size:48px;flex-shrink:0;">👤</div>
                    <div style="flex:1;">
                        <div style="font-size:22px;font-weight:700;margin-bottom:4px;">${fullName}</div>
                        <div style="font-size:15px;color:var(--text-secondary);margin-bottom:8px;">@${user.nickname}</div>
                        <div style="font-size:13px;color:${onlineColor};font-weight:600;">${onlineStatus}</div>
                    </div>
                </div>
                
                ${user.user_type !== 'admin' ? `
                    <div style="font-weight:700;margin-bottom:8px;font-size:16px;">Рейтинг: ${user.rating || '0.0'} (${user.review_count || 0} отзывов)</div>
                ` : ''}
                
                ${user.user_type !== 'admin' ? `
                    <button class="send-request-btn" style="width:260px;text-align:center;margin:0 auto 16px;display:block;" onclick="openSendRequestModal('${user.id}', '${user.nickname}')">
                        <div style="font-size:18px;font-weight:700;">Отправить запрос</div>
                        <div style="font-size:14px;opacity:0.8;margin-top:4px;">(стоимость 5 коинсов)</div>
                    </button>
                ` : ''}

                ${user.user_type !== 'admin' ? `
                    <button class="send-request-btn" style="width:260px;text-align:center;margin:0 auto 16px;display:block;background:rgba(100,141,229,0.2);color:var(--primary);" onclick="openReviewModal('${user.id}', '${user.nickname}')">
                        <div style="font-size:18px;font-weight:700;">Оставить отзыв</div>
                        <div style="font-size:14px;opacity:0.8;margin-top:4px;">После завершённого урока</div>
                    </button>
                ` : ''}
                
                <button class="info-btn" style="width:100%;text-align:center;margin-bottom:20px;" onclick="openOtherUserInfo('${user.nickname}')">Информация о пользователе</button>
                
                ${user.user_type !== 'admin' ? `
                    <div style="background:rgba(255,255,255,0.85);border-radius:16px;padding:20px;margin-bottom:16px;">
                        <div style="font-size:18px;font-weight:600;margin-bottom:15px;text-align:center;">Могу обучить</div>
                        <div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;">
                            ${(user.skills_can_teach || []).map(s => `<span style="background:rgba(100,141,229,0.3);padding:10px 20px;border-radius:20px;font-weight:500;">${s}</span>`).join('') || '<span style="color:#999;">Не указано</span>'}
                        </div>
                    </div>
                    
                    <div style="background:rgba(255,255,255,0.85);border-radius:16px;padding:20px;margin-bottom:20px;">
                        <div style="font-size:18px;font-weight:600;margin-bottom:15px;text-align:center;">Хочу освоить</div>
                        <div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;">
                            ${(user.skills_want_learn || []).map(s => `<span style="background:rgba(100,141,229,0.3);padding:10px 20px;border-radius:20px;font-weight:500;">${s}</span>`).join('') || '<span style="color:#999;">Не указано</span>'}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:20px;">
                        <div class="reviews-header">Отзывы</div>
                        <div id="otherUserReviewsContainer" class="reviews-container"></div>
                    </div>
                ` : ''}
                
            </div>
        </div>
    `;
    
    if (user.user_type !== 'admin') {
        const reviews = await getUserReviews(user.id, 1);
        const reviewsContainer = document.getElementById('otherUserReviewsContainer');
        
        if (reviewsContainer) {
            if (reviews.length === 0) {
                reviewsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Пока нет отзывов</div>';
            } else {
                const review = reviews[0];
                const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                
                reviewsContainer.innerHTML = `
                    <div class="review-item">
                        <div class="review-item-header">
                            <div>
                                <div class="review-item-author">@${review.reviewer.nickname}</div>
                                <div class="review-item-role">${review.reviewer.user_type === 'teacher' ? 'Преподаватель' : 'Студент'} ${review.reviewer.universities?.name || ''}</div>
                            </div>
                            <div class="review-item-stars">${stars}</div>
                        </div>
                        <div class="review-item-text">${review.comment || 'Нет комментария'}</div>
                    </div>
                    ${user.review_count > 1 ? `<div class="view-all-reviews"><span onclick="showAllOtherUserReviews('${user.nickname}')">Смотреть все отзывы (${user.review_count})</span></div>` : ''}
                `;
            }
        }
    }
};

window.openOtherUserInfo = async function(nickname) {
    const user = await getUserByNickname(nickname);
    
    if (!user) {
        showError('Пользователь не найден');
        return;
    }
    
    let roleText = 'Студент';
    if (user.user_type === 'teacher') roleText = 'Преподаватель';
    else if (user.user_type === 'admin') roleText = 'Администратор';
    else if (user.user_type === 'private') roleText = 'Частное лицо';
    
    let eduType = user.education_type || '';
    
    let courseInfo = '';
    if (user.course) {
        if (user.education_type === 'Бакалавриат') {
            courseInfo = `${user.course} курс`;
        } else {
            courseInfo = `${user.course} год`;
        }
    }
    
    const content = document.getElementById('appContent');
    
    if (user.user_type === 'admin') {
        content.innerHTML = `
            <div style="padding:20px;">
                <div style="background:rgba(255,255,255,0.85);border-radius:20px;padding:25px;max-width:45px;margin-left:auto;margin-right:auto;">
                    <div style="display:flex;align-items:center;margin-bottom:20px;">
                        <span class="nav-back" onclick="openUserProfile('${user.nickname}')" style="cursor:pointer;font-size:24px;">←</span>
                        <h1 style="font-size:22px;font-weight:800;color:var(--primary);margin-left:15px;">Информация о пользователе</h1>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Роль</div>
                        <div style="font-size:16px;font-weight:600;">${roleText}</div>
                    </div>
                    
                    <div style="background:rgba(100,141,229,0.08);border-radius:12px;padding:15px;margin-top:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:6px;">Обо мне</div>
                        <div style="font-size:15px;line-height:1.5;color:var(--text);word-wrap:break-word;overflow-wrap:break-word;">${user.bio || 'Не заполнено'}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div style="padding:20px;">
                <div style="background:rgba(255,255,255,0.85);border-radius:20px;padding:25px;max-width:450px;margin-left:auto;margin-right:auto;">
                    <div style="display:flex;align-items:center;margin-bottom:20px;">
                        <span class="nav-back" onclick="openUserProfile('${user.nickname}')" style="cursor:pointer;font-size:24px;">←</span>
                        <h1 style="font-size:22px;font-weight:800;color:var(--primary);margin-left:15px;">Информация о пользователе</h1>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Университет</div>
                        <div style="font-size:16px;font-weight:600;word-wrap:break-word;overflow-wrap:break-word;">${user.universities?.name || 'Не указан'}</div>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Факультет</div>
                        <div style="font-size:16px;font-weight:600;word-wrap:break-word;overflow-wrap:break-word;">${user.institutes?.name || 'Не указан'}</div>
                    </div>
                    
                    ${eduType ? `
                        <div style="margin-bottom:15px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Форма обучения</div>
                            <div style="font-size:16px;font-weight:600;">${eduType}</div>
                        </div>
                    ` : ''}
                    
                    ${courseInfo ? `
                        <div style="margin-bottom:15px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Курс обучения</div>
                            <div style="font-size:16px;font-weight:600;">${courseInfo}</div>
                        </div>
                    ` : ''}
                    
                    <div style="background:rgba(100,141,229,0.08);border-radius:12px;padding:15px;margin-top:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:6px;">Обо мне</div>
                        <div style="font-size:15px;line-height:1.5;color:var(--text);word-wrap:break-word;overflow-wrap:break-word;white-space:normal;">${user.bio || 'Не заполнено'}</div>
                    </div>
                </div>
            </div>
        `;
    }
};

window.showAllOtherUserReviews = async function(nickname) {
    const user = await getUserByNickname(nickname);
    if (!user) return;
    
    const reviews = await getAllUserReviews(user.id);
    
    const content = document.getElementById('appContent');
    content.innerHTML = `
        <div style="padding:20px;max-width:400px;margin:0 auto;">
            <div class="all-reviews-header">
                <span class="nav-back" onclick="openUserProfile('${user.nickname}')" style="cursor:pointer;">←</span>
                <div class="all-reviews-title">Все отзывы (${reviews.length})</div>
            </div>
            <div class="all-reviews-list">
                ${reviews.length === 0 ? '<div class="all-reviews-empty">Пока нет отзывов</div>' : ''}
                ${reviews.map(review => {
                    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                    const date = new Date(review.created_at).toLocaleDateString('ru-RU');
                    
                    return `
                        <div class="review-item">
                            <div class="review-item-header">
                                <div>
                                    <div class="review-item-author">@${review.reviewer.nickname}</div>
                                    <div class="review-item-role">${review.reviewer.user_type === 'teacher' ? 'Преподаватель' : 'Студент'} ${review.reviewer.universities?.name || ''}</div>
                                    <div class="review-item-date">${date}</div>
                                </div>
                                <div class="review-item-stars">${stars}</div>
                            </div>
                            <div class="review-item-text">${review.comment || 'Нет комментария'}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

window.openSearchFilters = function() {
    const content = document.getElementById('appContent');
    
    content.innerHTML = `
        <div style="display:flex;align-items:center;padding:15px 20px;border-bottom:1px solid #e8e8e8;">
            <span class="nav-back" onclick="goBackToSearch()" style="cursor:pointer;font-size:24px;">←</span>
            <h2 style="font-size:20px;font-weight:700;color:var(--primary);margin-left:15px;">Фильтры</h2>
        </div>
        <div style="padding:20px;">
            <div class="filter-item">
                <span>Университетский пользователь?</span>
                <div class="toggle ${searchFilters.isUniversityUser === true ? 'active' : ''}" 
                     onclick="toggleUniversityFilter(this)"></div>
            </div>
            
            <div class="filter-item" onclick="openSkillsFilter()">
                <span>Навыки</span>
                <span style="color:#999;">›</span>
            </div>
            ${searchFilters.selectedSkills.length > 0 ? `
                <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;padding:10px;background:rgba(100,141,229,0.08);border-radius:12px;">
                    ${searchFilters.selectedSkills.map(skill => `
                        <span style="background:var(--primary);color:#fff;padding:6px 12px;border-radius:15px;font-size:12px;display:flex;align-items:center;gap:6px;">
                            ${skill}
                            <span onclick="removeSkillFilter('${skill.replace(/'/g, "\\'")}')" style="cursor:pointer;font-size:14px;">×</span>
                        </span>
                    `).join('')}
                </div>
            ` : ''}
            
            <div class="filter-item">
                <span>Сортировать по рейтингу?</span>
                <div class="toggle ${searchFilters.sortByRating ? 'active' : ''}" 
                     onclick="toggleRatingSort(this)"></div>
            </div>
            
            <button onclick="resetSearchFilters()" 
                    style="width:100%;padding:14px;background:rgba(100,141,229,0.15);color:var(--primary);border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;font-family:var(--font);">
                Сбросить все фильтры
            </button>
            
            <button onclick="applySearchFilters()" 
                    style="width:100%;padding:16px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:16px;font-weight:700;cursor:pointer;margin-top:15px;font-family:var(--font);box-shadow:0 4px 15px rgba(100,141,229,0.3);">
                Показать
            </button>
        </div>
    `;
};

window.toggleUniversityFilter = function(el) {
    if (searchFilters.isUniversityUser === true) {
        searchFilters.isUniversityUser = false;
    } else if (searchFilters.isUniversityUser === false) {
        searchFilters.isUniversityUser = null;
    } else {
        searchFilters.isUniversityUser = true;
    }
    el.classList.toggle('active');
    openSearchFilters();
};

window.toggleRatingSort = function(el) {
    searchFilters.sortByRating = !searchFilters.sortByRating;
    el.classList.toggle('active');
};

window.removeSkillFilter = function(skill) {
    searchFilters.selectedSkills = searchFilters.selectedSkills.filter(s => s !== skill);
    openSearchFilters();
};

window.resetSearchFilters = function() {
    searchFilters = {
        isUniversityUser: null,
        selectedSkills: [],
        sortByRating: true
    };
    openSearchFilters();
    showSuccess('Фильтры сброшены');
};

window.applySearchFilters = function() {
    renderSearch(document.getElementById('appContent'));
};

async function getFilteredCount() {
    const users = dataCache.allUsers || await getAllUsersForSearch();
    let filtered = [...users];
    
    if (searchFilters.isUniversityUser === true) {
        filtered = filtered.filter(u => u.is_connected_to_university);
    } else if (searchFilters.isUniversityUser === false) {
        filtered = filtered.filter(u => !u.is_connected_to_university);
    }
    
    if (searchFilters.selectedSkills.length > 0) {
        filtered = filtered.filter(user => {
            const userSkills = user.skills_can_teach || [];
            return searchFilters.selectedSkills.some(skill => userSkills.includes(skill));
        });
    }
    
    return filtered.length;
}

window.openSkillsFilter = async function() {
    const content = document.getElementById('appContent');
    
    if (!window.skillsFromDB || Object.keys(window.skillsFromDB).length === 0) {
        await loadSkillsFromDB();
    }
    
    const categoryList = Object.keys(window.skillsFromDB || {});
    
    content.innerHTML = `
        <div style="display:flex;align-items:center;padding:15px 20px;border-bottom:1px solid #e8e8e8;">
            <span class="nav-back" onclick="goBackToSearch()" style="cursor:pointer;font-size:24px;">←</span>
            <h2 style="font-size:20px;font-weight:700;color:var(--primary);margin-left:15px;">Навыки</h2>
        </div>
        <div style="padding:20px;">
            <div style="font-size:14px;color:#727272;margin-bottom:15px;">
                Выбрано навыков: ${searchFilters.selectedSkills.length}
            </div>
            <div class="category-list">
                ${categoryList.map(cat => {
                    const skillsInCat = window.skillsFromDB[cat] || [];
                    const selectedInCat = searchFilters.selectedSkills.filter(skill => 
                        skillsInCat.includes(skill)
                    ).length;
                    const isSelected = selectedInCat > 0;
                    
                    return `
                        <button class="category-item ${isSelected ? 'selected' : ''}" 
                                onclick="showSkillSubcategories('${cat}')">
                            ${cat}
                            ${selectedInCat > 0 ? `<span style="float:right;font-size:12px;color:var(--primary);font-weight:600;">✓ ${selectedInCat}</span>` : ''}
                        </button>
                    `;
                }).join('')}
            </div>
            
            <button onclick="openSearchFilters()" 
                    style="width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;font-family:var(--font);">
                Назад к фильтрам
            </button>
        </div>
    `;
};

function getSkillsWord(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return 'навыков';
    if (lastOne === 1) return 'навык';
    if (lastOne >= 2 && lastOne <= 4) return 'навыка';
    return 'навыков';
}

window.showSkillSubcategories = async function(catName) {
    const content = document.getElementById('appContent');
    const skills = window.skillsFromDB[catName] || [];
    
    const users = dataCache.allUsers || await getAllUsersForSearch();
    
    const skillCounts = {};
    skills.forEach(skill => {
        const count = users.filter(user => 
            (user.skills_can_teach || []).includes(skill)
        ).length;
        skillCounts[skill] = count;
    });
    
    const selectedFromCategory = searchFilters.selectedSkills.filter(skill => 
        skills.includes(skill)
    ).length;
    
    content.innerHTML = `
        <div style="display:flex;align-items:center;padding:15px 20px;border-bottom:1px solid #e8e8e8;">
            <span class="nav-back" onclick="openSkillsFilter()" style="cursor:pointer;font-size:24px;">←</span>
            <h2 style="font-size:20px;font-weight:700;color:var(--primary);margin-left:15px;">${catName}</h2>
        </div>
        <div style="padding:20px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;padding:12px 20px;background:rgba(100,141,229,0.15);border-radius:12px;">
                <span style="font-size:14px;color:var(--primary);font-weight:600;">
                    Выбрано из категории:
                </span>
                <span style="font-size:14px;color:var(--primary);font-weight:700;">
                    ${selectedFromCategory}
                </span>
            </div>
            <div class="sub-list">
                ${skills.map(skill => {
                    const isSelected = searchFilters.selectedSkills.includes(skill);
                    const count = skillCounts[skill] || 0;
                    
                    return `
                        <button class="sub-item ${isSelected ? 'selected' : ''}" 
                                onclick="toggleSkillFilter('${skill.replace(/'/g, "\\'")}')">
                            <span style="flex:1;text-align:left;">${skill}</span>
                            <span style="font-size:11px;color:#999;margin-left:10px;white-space:nowrap;">
                                ${count} ${getUsersWord(count)}
                            </span>
                        </button>
                    `;
                }).join('')}
            </div>
            
            <button onclick="openSkillsFilter()" 
                    style="width:100%;padding:14px;background:var(--primary);color:#fff;border:none;border-radius:12px;font-size:15px;font-weight:600;cursor:pointer;margin-top:20px;font-family:var(--font);">
                Назад к категориям
            </button>
        </div>
    `;
};

function getUsersWord(count) {
    const lastTwo = count % 100;
    const lastOne = count % 10;
    
    if (lastTwo >= 11 && lastTwo <= 19) return 'пользователей';
    if (lastOne === 1) return 'пользователь';
    if (lastOne >= 2 && lastOne <= 4) return 'пользователя';
    return 'пользователей';
}

window.toggleSkillFilter = async function(skill) {
    if (searchFilters.selectedSkills.includes(skill)) {
        searchFilters.selectedSkills = searchFilters.selectedSkills.filter(s => s !== skill);
    } else {
        searchFilters.selectedSkills.push(skill);
    }
    
    const currentTitle = document.querySelector('h2');
    if (currentTitle && currentTitle.textContent !== 'Навыки' && currentTitle.textContent !== 'Фильтры') {
        const catName = currentTitle.textContent.trim();
        await showSkillSubcategories(catName);
    } else {
        await openSkillsFilter();
    }
};

window.showAllReviews = async function() {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    if (!profile) return;
    
    const user = await getCurrentUser();
    if (!user) return;
    
    const reviews = await getAllUserReviews(user.id);
    
    const content = document.getElementById('appContent');
    content.innerHTML = `
        <div style="padding:20px;max-width:400px;margin:0 auto;">
            <div class="all-reviews-header">
                <span class="nav-back" onclick="window.goBackToProfile()" style="cursor:pointer;">←</span>
                <div class="all-reviews-title">Все отзывы (${reviews.length})</div>
            </div>
            <div class="all-reviews-list">
                ${reviews.length === 0 ? '<div class="all-reviews-empty">Пока нет отзывов</div>' : ''}
                ${reviews.map(review => {
                    const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                    const date = new Date(review.created_at).toLocaleDateString('ru-RU');
                    
                    return `
                        <div class="review-item">
                            <div class="review-item-header">
                                <div>
                                    <div class="review-item-author">@${review.reviewer.nickname}</div>
                                    <div class="review-item-role">${review.reviewer.user_type === 'teacher' ? 'Преподаватель' : 'Студент'} ${review.reviewer.universities?.name || ''}</div>
                                    <div class="review-item-date">${date}</div>
                                </div>
                                <div class="review-item-stars">${stars}</div>
                            </div>
                            <div class="review-item-text">${review.comment || 'Нет комментария'}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

let currentRequestRecipient = null;

window.openSendRequestModal = async function(userId, nickname) {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile) {
        showError('Профиль не загружен');
        return;
    }
    
    if (!profile.skill_coins || profile.skill_coins < 5) {
        showError('Недостаточно коинсов. Нужно минимум 5. У вас: ' + (profile.skill_coins || 0));
        return;
    }
    
    currentRequestRecipient = { userId, nickname };
    
    const mentorProfile = await getUserByNickname(nickname);
    const skillsSelect = document.getElementById('requestSkill');
    
    if (!mentorProfile || !mentorProfile.skills_can_teach || mentorProfile.skills_can_teach.length === 0) {
        showError('У ментора нет навыков для обучения');
        return;
    }
    
    skillsSelect.innerHTML = '<option value="">Выберите навык</option>' + 
        mentorProfile.skills_can_teach.map(skill => 
            `<option value="${skill.replace(/"/g, '&quot;')}">${skill}</option>`
        ).join('');
    
    const modal = document.getElementById('sendRequestModal');
    
    if (!modal) {
        showError('Модалка не найдена. Проверь HTML.');
        return;
    }
    
    const nickElement = document.getElementById('requestRecipientNick');
    if (nickElement) {
        nickElement.textContent = nickname;
    }
    
    const today = new Date().toISOString().split('T')[0];
    const dateInput = document.getElementById('requestDate');
    if (dateInput) {
        dateInput.setAttribute('min', today);
    }

    openModal('sendRequestModal');
};

window.openReviewModal = async function(userId, nickname) {
    const { canReview, requestId } = await canLeaveReview(userId);
    
    if (!canReview) {
        showError('Вы не можете оставить отзыв этому пользователю');
        return;
    }
    
    reviewRecipientId = userId;
    reviewRequestId = requestId;
    selectedRating = 0;
    
    document.getElementById('reviewRecipientNick').textContent = nickname;
    document.getElementById('reviewComment').value = '';
    
    document.querySelectorAll('.star').forEach(star => {
        star.classList.remove('active');
        star.style.color = '#ddd';
    });
    
    openModal('reviewModal');
};

window.selectRating = function(rating) {
    selectedRating = rating;
    
    document.querySelectorAll('.star').forEach((star, index) => {
        if (index < rating) {
            star.classList.add('active');
            star.style.color = 'var(--primary)';
        } else {
            star.classList.remove('active');
            star.style.color = '#ddd';
        }
    });
};

window.submitReviewForm = async function(e) {
    e.preventDefault();
    
    if (selectedRating === 0) {
        showError('Выберите оценку');
        return;
    }
    
    const comment = document.getElementById('reviewComment').value.trim();
    if (!comment) {
        showError('Напишите комментарий');
        return;
    }
    
    const btn = document.getElementById('submitReviewBtn');
    btn.disabled = true;
    btn.textContent = 'Отправка...';
    
    try {
        await submitReview(reviewRequestId, reviewRecipientId, selectedRating, comment);
        
        showSuccess('Отзыв отправлен!');
        closeModal('reviewModal');
        
        clearCache();
        switchTab('profile', document.querySelector('.nav-item[data-tab="profile"]'));
        
    } catch (error) {
        showError('Ошибка: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Отправить отзыв';
    }
};

window.submitRequest = async function(e) {
    e.preventDefault();
    
    const btn = document.getElementById('sendRequestBtn');
    const skill = document.getElementById('requestSkill').value.trim();
    const date = document.getElementById('requestDate').value;
    const time = document.getElementById('requestTime').value;
    const message = document.getElementById('requestMessage').value.trim();
    
    if (!skill || !date || !time || !message) {
        showError('Заполните все поля');
        return;
    }
    
    btn.disabled = true;
    btn.innerHTML = '<span class="loading"></span> Отправка...';
    
    try {
        const currentUser = await getCurrentUser();
        
        const { data, error } = await supabaseClient
            .from('requests')
            .insert({
                sender_id: currentUser.id,
                receiver_id: currentRequestRecipient.userId,
                skill: skill,
                scheduled_date: date,
                scheduled_time: time,
                message: message,
                status: 'pending'
            })
            .select();
        
        if (error) {
            showError('Ошибка при отправке запроса: ' + error.message);
            btn.disabled = false;
            btn.textContent = 'Отправить запрос';
            return;
        }
        
        showSuccess('Запрос отправлен! Ментор получит уведомление.');
        clearNotifCache();
        closeModal('sendRequestModal');
        
        document.getElementById('sendRequestForm').reset();
        
    } catch (err) {
        showError('Произошла ошибка');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Отправить запрос';
    }
};

async function getUserProfileById(userId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name, user_type, skill_coins, universities(name)')
        .eq('id', userId)
        .single();
    
    if (error) {
        return null;
    }
    
    return data;
}

window.loadMyRequests = async function() {
    const currentUser = await getCurrentUser();
    
    const { data, error } = await supabaseClient
        .from('requests')
        .select(`
            *,
            sender:sender_id(
                id,
                nickname,
                first_name,
                last_name,
                user_type
            )
        `)
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    if (error) {
        return [];
    }
    
    return data;
};

window.goBackToProfile = function() {
    switchTab('profile', document.querySelector('.nav-item[data-tab="profile"]'));
};

window.goBackToSearchFromProfile = function() {
    switchTab('search', document.querySelector('.nav-item[data-tab="search"]'));
};

window.openUserInfo = async function() {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile) {
        showError('Профиль не загружен');
        return;
    }
    
    const isAdmin = profile.user_type === 'admin';
    
    let roleText = 'Студент';
    if (profile.user_type === 'teacher') roleText = 'Преподаватель';
    else if (profile.user_type === 'admin') roleText = 'Администратор';
    else if (profile.user_type === 'private') roleText = 'Частное лицо';
    
    let eduType = '';
    if (profile.education_type) {
        eduType = profile.education_type;
    }
    
    let courseInfo = '';
    if (profile.course) {
        if (profile.education_type === 'Бакалавриат') {
            courseInfo = `${profile.course} курс`;
        } else {
            courseInfo = `${profile.course} год`;
        }
    }
    
    const content = document.getElementById('appContent');
    
    if (isAdmin) {
        content.innerHTML = `
            <div style="padding:20px;">
                <div style="background:rgba(255,255,255,0.85);border-radius:20px;padding:25px;max-width:450px;margin-left:auto;margin-right:auto;">
                    <div style="display:flex;align-items:center;margin-bottom:20px;">
                        <span class="nav-back" onclick="window.goBackToProfile()" style="cursor:pointer;font-size:24px;">←</span>
                        <h1 style="font-size:22px;font-weight:800;color:var(--primary);margin-left:15px;">Информация о пользователе</h1>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Роль</div>
                        <div style="font-size:16px;font-weight:600;">${roleText}</div>
                    </div>
                    
                    <div style="background:rgba(100,141,229,0.08);border-radius:12px;padding:15px;margin-top:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:6px;">Обо мне</div>
                        <div style="font-size:15px;line-height:1.5;color:var(--text);word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;">${profile.bio || 'Не заполнено'}</div>
                    </div>
                </div>
            </div>
        `;
    } else {
        content.innerHTML = `
            <div style="padding:20px;">
                <div style="background:rgba(255,255,255,0.85);border-radius:20px;padding:25px;max-width:450px;margin-left:auto;margin-right:auto;">
                    <div style="display:flex;align-items:center;margin-bottom:20px;">
                        <span class="nav-back" onclick="window.goBackToProfile()" style="cursor:pointer;font-size:24px;">←</span>
                        <h1 style="font-size:22px;font-weight:800;color:var(--primary);margin-left:15px;">Информация о пользователе</h1>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Университет</div>
                        <div style="font-size:16px;font-weight:600;word-wrap:break-word;overflow-wrap:break-word;">${profile.universities?.name || 'Не указан'}</div>
                    </div>
                    
                    <div style="margin-bottom:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:4px;">Факультет</div>
                        <div style="font-size:16px;font-weight:600;word-wrap:break-word;overflow-wrap:break-word;">${profile.institutes?.name || 'Не указан'}</div>
                    </div>
                    
                    ${eduType ? `
                        <div style="margin-bottom:15px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Форма обучения</div>
                            <div style="font-size:16px;font-weight:600;">${eduType}</div>
                        </div>
                    ` : ''}
                    
                    ${courseInfo ? `
                        <div style="margin-bottom:15px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Курс обучения</div>
                            <div style="font-size:16px;font-weight:600;">${courseInfo}</div>
                        </div>
                    ` : ''}
                    
                    <div style="background:rgba(100,141,229,0.08);border-radius:12px;padding:15px;margin-top:15px;">
                        <div style="font-size:13px;color:#727272;margin-bottom:6px;">Обо мне</div>
                        <div style="font-size:15px;line-height:1.5;color:var(--text);word-wrap:break-word;overflow-wrap:break-word;word-break:break-word;white-space:normal;">${profile.bio || 'Не заполнено'}</div>
                    </div>
                </div>
            </div>
        `;
    }
};

window.saveUserInfoBio = async function() {
    const bio = document.getElementById('userInfoBio').value;
    
    const success = await updateProfile({ bio: bio });
    
    if (success) {
        showSuccess('Информация обновлена!');
        if (dataCache.currentProfile) {
            dataCache.currentProfile.bio = bio;
        }
        setTimeout(() => {
            switchTab('profile', document.querySelector('.nav-item[data-tab="profile"]'));
        }, 1000);
    } else {
        showError('Ошибка сохранения');
    }
};

async function renderNotif(container) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return;
    
    let pendingRequestsCount, unreadMessagesCount;
    
    if (isCacheValid(notifCache)) {
        pendingRequestsCount = notifCache.pendingRequests;
        unreadMessagesCount = notifCache.unreadMessages;
    } else {
        [pendingRequestsCount, unreadMessagesCount] = await Promise.all([
            getPendingRequestsCount(),
            getUnreadMessagesCount()
        ]);
        
        notifCache.pendingRequests = pendingRequestsCount;
        notifCache.unreadMessages = unreadMessagesCount;
        notifCache.timestamp = Date.now();
    }
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div style="max-width:700px;margin-left:40px;">
                <div class="notif-card">
                    <div class="notif-title">Нексус</div>
                    <div class="notif-text">Добро пожаловать в Нексус! Заполните профиль, чтобы найти наставника.</div>
                </div>
                
                ${pendingRequestsCount > 0 ? `
                    <div class="notif-card" style="cursor:pointer;" onclick="renderRequestsList(document.getElementById('appContent'))">
                        <button class="notif-close" onclick="event.stopPropagation()">×</button>
                        <div class="notif-title">📨 Входящие запросы (${pendingRequestsCount})</div>
                        <div class="notif-text">У вас <span class="notif-bold">${pendingRequestsCount}</span> новых запросов на обучение. Нажмите чтобы просмотреть.</div>
                        <div class="notif-actions">
                            <button class="notif-btn notif-btn-primary" onclick="event.stopPropagation(); renderRequestsList(document.getElementById('appContent'))">Посмотреть</button>
                        </div>
                    </div>
                ` : ''}
                
                ${unreadMessagesCount > 0 ? `
                    <div class="notif-card" style="cursor:pointer;" onclick="renderChatsList(document.getElementById('appContent'))">
                        <button class="notif-close" onclick="event.stopPropagation()">×</button>
                        <div class="notif-title">💬 Новые сообщения (${unreadMessagesCount})</div>
                        <div class="notif-text">У вас <span class="notif-bold">${unreadMessagesCount}</span> непрочитанных сообщений.</div>
                        <div class="notif-actions">
                            <button class="notif-btn notif-btn-primary" onclick="event.stopPropagation(); renderChatsList(document.getElementById('appContent'))">Читать</button>
                        </div>
                    </div>
                ` : ''}
            </div>
        </div>
    `;
}

async function renderChatsList(container) {
    let chats;
    
    if (isCacheValid(chatCache)) {
        chats = chatCache.chats;
    } else {
        chats = await getUserChats();
        chatCache.chats = chats;
        chatCache.timestamp = Date.now();
    }
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex;align-items:center;margin-bottom:20px;">
                <h2 style="font-size:22px;font-weight:700;color:var(--primary);">Чаты</h2>
            </div>
            
            ${chats.length === 0 ? '<div style="padding:40px;text-align:center;color:#999;">У вас пока нет чатов</div>' : ''}
            
            ${chats.map(chat => {
                const otherName = `${chat.otherUser.first_name || ''} ${chat.otherUser.last_name || ''}`.trim() || chat.otherUser.nickname;
                const statusText = chat.request.status === 'pending' ? '⏳ Ожидает' : 
                                   chat.request.status === 'accepted' ? '✓ Принят' : 
                                   chat.request.status === 'rejected' ? '✗ Отклонён' : '✓ Завершён';
                const lastMsgText = chat.lastMessage ? chat.lastMessage.content.substring(0, 50) + (chat.lastMessage.content.length > 50 ? '...' : '') : 'Нет сообщений';
                const canWriteBadge = chat.canWrite ? '' : ' <span style="font-size:11px;color:#999;">(только чтение)</span>';
                
                return `
                    <div class="chat-list-item" onclick="renderChatRoom('${chat.request.id}', '${chat.otherUser.id}')">
                        <div class="chat-list-avatar"></div>
                        <div class="chat-list-content">
                            <div class="chat-list-header">
                                <div class="chat-list-name">@${chat.otherUser.nickname} ${canWriteBadge}</div>
                                <div style="font-size:11px;color:var(--primary);font-weight:600;">${statusText}</div>
                            </div>
                            <div style="font-size:12px;color:#727272;margin-bottom:4px;">${chat.request.skill}</div>
                            <div class="chat-list-message">${lastMsgText}</div>
                        </div>
                        ${chat.unreadCount > 0 ? `<div style="background:var(--primary);color:#fff;border-radius:50%;width:24px;height:24px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;">${chat.unreadCount}</div>` : ''}
                    </div>
                `;
            }).join('')}
        </div>
    `;
}

async function renderChatRoom(requestId, otherUserId) {
    const container = document.getElementById('appContent');
    const currentUser = await getCurrentUser();
    
    const [messages, otherProfile, request] = await Promise.all([
        getChatMessages(requestId),
        getProfileCached(otherUserId),
        supabaseClient.from('requests').select('*').eq('id', requestId).single()
    ]);
    
    const isMentor = request.data.receiver_id === currentUser.id;
    let canWrite = isMentor;
    
    if (!isMentor) {
        if (request.data.status === 'accepted') {
            canWrite = true;
        } else if (messages.length > 0) {
            const firstMsg = await supabaseClient
                .from('messages')
                .select('sender_id')
                .eq('request_id', requestId)
                .order('created_at', { ascending: true })
                .limit(1);
            
            if (firstMsg.data && firstMsg.data.length > 0) {
                canWrite = firstMsg.data[0].sender_id === request.data.receiver_id;
            }
        }
    }
    
    await markMessagesAsRead(requestId, currentUser.id);
    
    const otherName = `${otherProfile.first_name || ''} ${otherProfile.last_name || ''}`.trim() || otherProfile.nickname;
    const statusText = request.data.status === 'pending' ? ' Ожидает принятия' : 
                       request.data.status === 'accepted' ? '✓ Принят' : 
                       request.data.status === 'rejected' ? ' Отклонён' : '✓ Завершён';
    
    container.innerHTML = `
        <div class="chat-room-container">
            <div style="display:flex;align-items:center;padding:15px 20px;border-bottom:1px solid #e8e8e8;background:#fff;">
                <span class="nav-back" onclick="renderChatsList(document.getElementById('appContent'))" style="cursor:pointer;font-size:24px;margin-right:15px;">←</span>
                <div style="flex:1;">
                    <div style="font-size:16px;font-weight:700;color:var(--text);cursor:pointer;" onclick="openUserProfile('${otherProfile.nickname}')">@${otherProfile.nickname}</div>
                    <div style="font-size:12px;color:#727272;">${otherName} • ${request.data.skill} • ${statusText}</div>
                </div>
            </div>
            
            <div id="chatMessagesContainer" style="flex:1;overflow-y:auto;padding:20px;background:#f5f7fa;">
                ${messages.length === 0 ? '<div style="text-align:center;color:#999;padding:40px;">Начните разговор!</div>' : ''}
                ${messages.map(msg => {
                    const isOwn = msg.sender_id === currentUser.id;
                    const time = new Date(msg.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
                    
                    return `
                        <div style="display:flex;justify-content:${isOwn ? 'flex-end' : 'flex-start'};margin-bottom:12px;">
                            <div style="max-width:70%;background:${isOwn ? 'var(--primary)' : '#fff'};color:${isOwn ? '#fff' : 'var(--text)'};padding:12px 16px;border-radius:18px;${isOwn ? 'border-bottom-right-radius:4px;' : 'border-bottom-left-radius:4px;'}box-shadow:0 1px 2px rgba(0,0,0,0.1);">
                                <div style="font-size:14px;line-height:1.4;">${msg.content}</div>
                                <div style="font-size:10px;${isOwn ? 'color:rgba(255,255,255,0.7);' : 'color:#999;'}margin-top:4px;text-align:right;">${time}</div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
            
            ${canWrite ? `
                <div style="padding:15px 20px;border-top:1px solid #e8e8e8;background:#fff;">
                    <form id="chatForm" onsubmit="sendChatMessage(event, '${requestId}', '${otherUserId}')" style="display:flex;gap:10px;">
                        <input type="text" id="chatInput" class="input" placeholder="Написать сообщение..." style="flex:1;margin-bottom:0;" required>
                        <button type="submit" style="background:var(--primary);color:#fff;border:none;border-radius:12px;padding:12px 20px;font-weight:700;cursor:pointer;font-family:var(--font);">➤</button>
                    </form>
                </div>
            ` : `
                <div style="padding:15px 20px;border-top:1px solid #e8e8e8;background:#f5f7fa;text-align:center;color:#999;font-size:13px;">
                    ${isMentor ? 'Вы можете написать ученику' : 'Ожидание ответа от ментора...'}
                </div>
            `}
        </div>
    `;
    
    const messagesContainer = document.getElementById('chatMessagesContainer');
    if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
}

window.sendChatMessage = async function(e, requestId, receiverId) {
    e.preventDefault();
    
    const input = document.getElementById('chatInput');
    const content = input.value.trim();
    
    if (!content) return;
    
    input.value = '';
    input.disabled = true;
    
    try {
        await sendMessage(requestId, receiverId, content);
        clearChatCache(); // ← ДОБАВИТЬ
        await renderChatRoom(requestId, receiverId);
    } catch (err) {
        showError('Ошибка отправки сообщения');
        input.disabled = false;
    }
};

window.renderRequestsList = async function(container) {
    const requests = await getIncomingRequests();
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div style="display:flex;align-items:center;margin-bottom:20px;">
                <span class="nav-back" onclick="switchTab('notif', document.querySelector('.nav-item[data-tab=\\"notif\\"]'))" style="cursor:pointer;font-size:24px;margin-right:15px;">←</span>
                <h2 style="font-size:22px;font-weight:700;color:var(--primary);">Входящие запросы</h2>
            </div>
            
            ${requests.length === 0 ? '<div style="padding:40px;text-align:center;color:#999;">Нет входящих запросов</div>' : ''}
            
            ${requests.map(req => {
                const senderName = `${req.sender.first_name || ''} ${req.sender.last_name || ''}`.trim() || req.sender.nickname;
                const date = new Date(req.scheduled_date).toLocaleDateString('ru-RU');
                const time = req.scheduled_time ? req.scheduled_time.substring(0, 5) : '';
                
                return `
                    <div class="notif-card" style="margin-bottom:16px;max-width:600px;margin-left:auto;margin-right:auto;">
                        <div style="margin-bottom:12px;">
                            <div style="font-size:16px;font-weight:700;color:var(--primary);margin-bottom:4px;">@${req.sender.nickname}</div>
                            <div style="font-size:14px;color:#555;">${senderName}</div>
                        </div>
                        
                        <div style="background:rgba(100,141,229,0.15);border-radius:12px;padding:12px 16px;margin-bottom:12px;">
                            <div style="font-size:16px;color:var(--primary);font-weight:700;display:flex;align-items:center;gap:8px;">
                                <span style="font-size:20px;">📅</span>
                                <span>${date}</span>
                                <span style="margin:0 8px;color:rgba(100,141,229,0.5);">•</span>
                                <span style="font-size:20px;">🕐</span>
                                <span>${time || 'Не указано'}</span>
                            </div>
                        </div>
                        
                        <div style="background:rgba(100,141,229,0.1);border-radius:12px;padding:12px;margin-bottom:12px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Навык:</div>
                            <div style="font-size:15px;font-weight:600;color:var(--text);">${req.skill}</div>
                        </div>
                        
                        <div style="background:rgba(100,141,229,0.05);border-radius:12px;padding:12px;margin-bottom:16px;">
                            <div style="font-size:13px;color:#727272;margin-bottom:4px;">Сообщение:</div>
                            <div style="font-size:14px;line-height:1.5;color:var(--text);">${req.message}</div>
                        </div>
                        
                        <div style="display:flex;gap:10px;">
                            <button class="notif-btn notif-btn-primary" onclick="acceptRequest('${req.id}', '${req.sender_id}', '${req.sender.nickname}')" style="flex:1;">
                                ✓ Принять
                            </button>
                            <button class="notif-btn notif-btn-secondary" onclick="rejectRequest('${req.id}')" style="flex:1;">
                                ✗ Отклонить
                            </button>
                            <button class="notif-btn" style="background:rgba(100,141,229,0.2);color:var(--primary);" onclick="openChatFromRequest('${req.id}', '${req.sender_id}')">
                                💬 Написать
                            </button>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
};

window.acceptRequest = async function(requestId, senderId, senderNickname) {
    if (!confirm(`Принять запрос от @${senderNickname}? С пользователя будет списано 5 коинсов.`)) {
        return;
    }
    
    try {
        const result = await acceptRequestInDB(requestId, senderId);
        
        if (result) {
            showSuccess('Запрос принят! Коинсы списаны.');
            clearNotifCache(); // ← ДОБАВИТЬ
            clearChatCache(); // ← ДОБАВИТЬ
            clearLessonsCache();
            
            if (typeof renderRequestsList === 'function') {
                await renderRequestsList(document.getElementById('appContent'));
            }
            
            if (typeof clearCache === 'function') {
                clearCache();
            }
        } else {
            showError('Ошибка при принятии запроса');
        }
        
    } catch (err) {
        showError('Ошибка при принятии запроса: ' + err.message);
    }
};

window.rejectRequest = async function(requestId) {
    if (!confirm('Отклонить запрос?')) {
        return;
    }
    
    try {
        await rejectRequestInDB(requestId);
        clearNotifCache();
        clearLessonsCache();
        showSuccess('Запрос отклонён');
        renderRequestsList(document.getElementById('appContent'));
    } catch (err) {
        showError('Ошибка при отклонении запроса');
    }
};

async function checkLessonConfirmations() {
    const confirmations = await getPendingLessonConfirmations();
    
    if (confirmations.length === 0) return;
    
    const confirmation = confirmations[0];
    const otherName = confirmation.otherUser.nickname;
    
    let modal = document.getElementById('lessonConfirmModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'lessonConfirmModal';
        modal.className = 'modal-overlay';
        modal.style.zIndex = '10000';
        document.body.appendChild(modal);
    }
    
    modal.innerHTML = `
        <div class="modal-card" style="max-width:400px;padding:30px;">
            <h2 style="font-size:20px;font-weight:700;color:var(--primary);margin-bottom:20px;text-align:center;">
                Урок прошёл успешно?
            </h2>
            <div style="text-align:center;margin-bottom:20px;">
                <div style="font-size:16px;color:var(--text);margin-bottom:8px;">
                    Урок с <strong>@${otherName}</strong>
                </div>
                <div style="font-size:14px;color:#727272;">
                    Навык: ${confirmation.skill}
                </div>
            </div>
            <div style="display:flex;gap:15px;justify-content:center;">
                <button onclick="submitLessonConfirmation('${confirmation.id}', 'positive')" 
                        style="width:80px;height:80px;border-radius:50%;border:2px solid var(--primary);background:#fff;cursor:pointer;font-size:42px;font-weight:700;color:var(--primary);transition:all 0.3s;"
                        onmouseover="this.style.background='var(--primary)';this.style.color='#fff'"
                        onmouseout="this.style.background='#fff';this.style.color='var(--primary)'">
                    +
                </button>
                <button onclick="submitLessonConfirmation('${confirmation.id}', 'negative')" 
                        style="width:80px;height:80px;border-radius:50%;border:2px solid var(--primary);background:#fff;cursor:pointer;font-size:42px;font-weight:700;color:var(--primary);transition:all 0.3s;"
                        onmouseover="this.style.background='var(--primary)';this.style.color='#fff'"
                        onmouseout="this.style.background='#fff';this.style.color='var(--primary)'">
                    −
                </button>
            </div>
        </div>
    `;
    
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
}

window.submitLessonConfirmation = async function(requestId, rating) {
    try {
        const result = await confirmLesson(requestId, rating);
        
        closeModal('lessonConfirmModal');
        
        if (result.completed) {
            showSuccess('Урок завершён!');
        } else {
            showSuccess('Ваш отзыв сохранён. Ожидание подтверждения от второй стороны.');
        }
        
        clearCache();
        
    } catch (error) {
        showError('Ошибка: ' + error.message);
    }
};

let lessonConfirmationInterval;
function startLessonConfirmationChecker() {
    checkLessonConfirmations();
    lessonConfirmationInterval = setInterval(checkLessonConfirmations, 30000);
}

window.openChatFromRequest = function(requestId, otherUserId) {
    renderChatRoom(requestId, otherUserId);
};

async function renderProfile(container) {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile) {
        container.innerHTML = '<div style="padding:20px;text-align:center;">Профиль не загружен</div>';
        return;
    }
    
    let roleText = 'Студент';
    if (profile.user_type === 'teacher') roleText = 'Преподаватель';
    else if (profile.user_type === 'admin') roleText = 'Администратор';
    else if (profile.user_type === 'private') roleText = 'Частное лицо';
    
    const onlineStatus = isUserOnline(profile.last_seen) ? 'В Нексусе' : 'Не в Нексусе';
    const onlineColor = isUserOnline(profile.last_seen) ? '#ffffff' : '#999';
    
    const fullName = `${profile.last_name || ''} ${profile.first_name || ''}`.trim() || profile.nickname;
    
    const isAdmin = profile.user_type === 'admin';
    
    let scheduledLessons = [];
    if (!isAdmin) {
        if (lessonsCache.data && (Date.now() - lessonsCache.timestamp) < 30000) {
            scheduledLessons = lessonsCache.data;
        } else {
            scheduledLessons = await getMyScheduledLessons();
            lessonsCache.data = scheduledLessons;
            lessonsCache.timestamp = Date.now();
        }
    }
    
    container.innerHTML = `
        <div style="padding:20px;">
            <div style="max-width:500px;margin-left:auto;margin-right:auto;">
                
                <div style="display:flex;gap:20px;margin-bottom:25px;">
                    <div style="width:100px;height:100px;border-radius:50%;background:linear-gradient(135deg,#E8EEF8,#d0d8e8);display:flex;align-items:center;justify-content:center;font-size:48px;flex-shrink:0;">👤</div>
                    <div style="flex:1;">
                        <div style="font-size:22px;font-weight:700;margin-bottom:4px;">${fullName}</div>
                        <div style="font-size:15px;color:var(--text-secondary);margin-bottom:8px;">@${profile.nickname}</div>
                        <div style="font-size:13px;color:${onlineColor};font-weight:600;">${onlineStatus}</div>
                    </div>
                </div>
                
                ${!isAdmin ? `
                    <div style="font-weight:700;margin-bottom:8px;font-size:16px;">Рейтинг: ${profile.rating || '0.0'} (${profile.review_count || 0} отзывов)</div>
                    <div style="font-weight:700;margin-bottom:25px;font-size:16px;">Скилл коинс: ${profile.skill_coins || 0}</div>
                ` : ''}
                
                <button class="info-btn" style="width:100%;text-align:center;margin-bottom:20px;" onclick="openUserInfo()">Информация о пользователе</button>
                
                ${!isAdmin ? `
                    ${scheduledLessons.length > 0 ? `
                        <div style="margin-bottom:20px;">
                            <div class="reviews-header">Запланированные уроки</div>
                            <div style="background:rgba(255,255,255,0.35);border-radius:0 0 14px 14px;padding:15px;">
                                ${scheduledLessons.map(lesson => {
                                    const mentorName = `${lesson.receiver?.first_name || ''} ${lesson.receiver?.last_name || ''}`.trim() || lesson.receiver?.nickname || 'Неизвестно';
                                    const date = lesson.scheduled_date ? new Date(lesson.scheduled_date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
                                    const time = lesson.scheduled_time ? lesson.scheduled_time.substring(0, 5) : '';
                                    
                                    return `
                                        <div style="background:rgba(100,141,229,0.1);border-radius:12px;padding:14px;margin-bottom:10px;">
                                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                                                <div style="font-size:15px;font-weight:700;color:var(--primary);">${lesson.skill}</div>
                                                <div style="font-size:12px;color:#727272;">
                                                    📅 ${date} • 🕐 ${time}
                                                </div>
                                            </div>
                                            <div style="font-size:13px;color:#555;">
                                                Ментор: <strong>@${lesson.receiver?.nickname || 'Неизвестно'}</strong> (${mentorName})
                                            </div>
                                            <div style="display:flex;gap:8px;margin-top:10px;">
                                                <button onclick="openChatFromRequest('${lesson.id}', '${lesson.receiver?.id}')" 
                                                        style="flex:1;padding:10px;background:var(--primary);color:#fff;border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">
                                                    💬 Написать ментору
                                                </button>
                                                <button onclick="openUserProfile('${lesson.receiver?.nickname}')" 
                                                        style="flex:1;padding:10px;background:rgba(100,141,229,0.2);color:var(--primary);border:none;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;font-family:var(--font);">
                                                    👤 Профиль
                                                </button>
                                            </div>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    ` : ''}
                ` : ''}
                
                ${!isAdmin ? `
                    <div style="background:rgba(255, 255, 255, 0.35);border-radius:16px;padding:20px;margin-bottom:16px;">
                        <div style="font-size:18px;font-weight:600;margin-bottom:15px;text-align:center;">Могу обучить</div>
                        <div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;">
                            ${(profile.skills_can_teach || []).map(s => `<span style="background:rgba(100,141,229,0.3);padding:10px 20px;border-radius:20px;font-weight:500;">${s}</span>`).join('') || '<span style="color:#999;">Не указано</span>'}
                        </div>
                    </div>
                    
                    <div style="background:rgba(255, 255, 255, 0.35);border-radius:16px;padding:20px;margin-bottom:20px;">
                        <div style="font-size:18px;font-weight:600;margin-bottom:15px;text-align:center;">Хочу освоить</div>
                        <div style="display:flex;gap:10px;justify-content:flex-start;flex-wrap:wrap;">
                            ${(profile.skills_want_learn || []).map(s => `<span style="background:rgba(100,141,229,0.3);padding:10px 20px;border-radius:20px;font-weight:500;">${s}</span>`).join('') || '<span style="color:#999;">Не указано</span>'}
                        </div>
                    </div>
                    
                    <div style="margin-bottom:20px;">
                        <div class="reviews-header">Отзывы</div>
                        <div id="profileReviewsContainer" class="reviews-container"></div>
                    </div>
                ` : ''}
                
                ${isAdmin ? `
                    <button class="info-btn" style="width:100%;margin-bottom:10px;" onclick="openAdminStats()"> Посмотреть статистику</button>
                ` : ''}
                
            </div>
        </div>
    `;
    
    if (!isAdmin) {
        const currentUser = await getCurrentUser();
        if (currentUser) {
            const reviews = await getUserReviews(currentUser.id, 1);
            const reviewsContainer = document.getElementById('profileReviewsContainer');
            
            if (!reviewsContainer) return;
            
            if (reviews.length === 0) {
                reviewsContainer.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">Пока нет отзывов</div>';
            } else {
                const review = reviews[0];
                const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                
                reviewsContainer.innerHTML = `
                    <div class="review-item">
                        <div class="review-item-header">
                            <div>
                                <div class="review-item-author">@${review.reviewer.nickname}</div>
                                <div class="review-item-role">${review.reviewer.user_type === 'teacher' ? 'Преподаватель' : 'Студент'} ${review.reviewer.universities?.name || ''}</div>
                            </div>
                            <div class="review-item-stars">${stars}</div>
                        </div>
                        <div class="review-item-text">${review.comment || 'Нет комментария'}</div>
                    </div>
                    ${profile.review_count > 1 ? `<div class="view-all-reviews"><span onclick="showAllReviews()">Смотреть все отзывы (${profile.review_count})</span></div>` : ''}
                `;
            }
        }
    }
}

window.openAdminStats = async function() {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile || !profile.university_id) {
        showError('Сначала выберите университет в настройках');
        return;
    }
    
    const institutes = await getInstitutes(profile.university_id);
    
    if (institutes.length === 0) {
        showError('Институты не найдены');
        return;
    }
    
    const container = document.getElementById('groupStatsContainer');
    
    container.innerHTML = `
        <div class="stats-container">
            <div class="stats-header">
                <div class="stats-title">Выберите институт</div>
                <div class="stats-subtitle">${profile.universities?.name || ''}</div>
            </div>
            <div class="stats-list">
                ${institutes.map(i => `
                    <div class="stats-item" onclick="selectInstituteForStats(${i.id}, '${i.name.replace(/'/g, "\\'")}')">
                        <div class="stats-item-name">${i.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('studentApp').style.display = 'none';
    document.getElementById('groupStatsApp').style.display = 'flex';
};

window.selectInstituteForStats = function(instituteId, instituteName) {
    statsSelection.instituteId = instituteId;
    statsSelection.instituteName = instituteName;
    statsSelection.eduType = null;
    statsSelection.course = null;
    statsSelection.groupId = null;
    
    const container = document.getElementById('courseTypeStatsContainer');
    
    container.innerHTML = `
        <div class="stats-container">
            <div class="stats-header">
                <div class="stats-title">${instituteName}</div>
                <div class="stats-subtitle">Выберите тип обучения и курс</div>
            </div>
            
            <div class="stats-course-section">
                <div class="stats-course-title">Бакалавриат</div>
                <div class="stats-course-buttons">
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Бакалавриат', 1)">1 курс</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Бакалавриат', 2)">2 курс</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Бакалавриат', 3)">3 курс</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Бакалавриат', 4)">4 курс</button>
                </div>
            </div>
            
            <div class="stats-course-section">
                <div class="stats-course-title">Аспирантура</div>
                <div class="stats-course-buttons">
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Аспирантура', 1)">1 год</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Аспирантура', 2)">2 год</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Аспирантура', 3)">3 год</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Аспирантура', 4)">4 год</button>
                </div>
            </div>
            
            <div class="stats-course-section">
                <div class="stats-course-title">Магистратура</div>
                <div class="stats-course-buttons">
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Магистратура', 1)">1 год</button>
                    <button class="stats-course-btn" onclick="selectStatsCourseType('Магистратура', 2)">2 год</button>
                </div>
            </div>
        </div>
    `;
    
    document.getElementById('groupStatsApp').style.display = 'none';
    document.getElementById('courseTypeStatsApp').style.display = 'flex';
};
window.selectStatsCourseType = async function(eduType, course) {
    statsSelection.eduType = eduType;
    statsSelection.course = course;
    
    const groups = await getGroupsByTypeAndCourse(eduType, course);
    
    if (groups.length === 0) {
        showError('Группы не найдены');
        return;
    }
    
    const container = document.getElementById('groupStatsContainer');
    
    container.innerHTML = `
        <div class="stats-container">
            <div class="stats-header">
                <div class="stats-title">${statsSelection.instituteName}</div>
                <div class="stats-subtitle">${eduType}, ${course} ${eduType === 'Бакалавриат' ? 'курс' : 'год'}</div>
            </div>
            <div class="stats-list">
                ${groups.map(g => `
                    <div class="stats-item" onclick="selectGroupForAdmin(${g.id}, '${g.name.replace(/'/g, "\\'")}')">
                        <div class="stats-item-name">${g.name}</div>
                    </div>
                `).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('courseTypeStatsApp').style.display = 'none';
    document.getElementById('groupStatsApp').style.display = 'flex';
};

window.selectGroupForAdmin = async function(groupId, groupName) {
    statsSelection.groupId = groupId;
    
    const students = await getStudentsByGroup(groupId);
    
    if (students.length === 0) {
        showError('В группе пока нет студентов');
        return;
    }
    
    const container = document.getElementById('groupStatsContainer');
    
    container.innerHTML = `
        <div class="stats-container">
            <div class="stats-header">
                <div class="stats-title">${groupName}</div>
                <div class="stats-subtitle">${statsSelection.eduType}, ${statsSelection.course} ${statsSelection.eduType === 'Бакалавриат' ? 'курс' : 'год'}</div>
            </div>
            <div class="stats-list">
                ${students.map(s => {
                    const fullName = `${s.last_name || ''} ${s.first_name || ''}`.trim() || s.nickname;
                    return `
                        <div class="stats-item" onclick="showStudentStats('${s.id}')">
                            <div class="stats-item-name">${fullName}</div>
                            <div class="stats-item-info">@${s.nickname}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
};

async function loadGroupStudents(groupId) {
    const students = await getStudentsByGroup(groupId);
    const container = document.getElementById('groupStatsContainer');
    
    if (!container) {
        showError('Контейнер для статистики не найден');
        return;
    }
    
    if (students.length === 0) {
        container.innerHTML = '<div style="padding:20px;text-align:center;color:#fff;">В группе пока нет студентов</div>';
    } else {
        container.innerHTML = `
            <div class="group-header">${students[0]?.groups?.name || 'Группа'}</div>
            <div class="students-list">
                ${students.map(s => `
                    <div class="student-card">
                        <div class="student-name">${s.nickname}</div>
                        <button class="stats-btn" onclick="showStudentStats('${s.id}')">Показать статистику</button>
                    </div>
                `).join('')}
            </div>
        `;
    }
    
    document.getElementById('adminApp').style.display = 'none';
    document.getElementById('groupStatsApp').classList.add('active');
}

window.showStudentStats = async function(studentId) {
    const student = await getStudentProfile(studentId);
    const lessons = await getStudentLessons(studentId);
    const reviews = await getAllUserReviews(studentId);
    
    if (!student) {
        showError('Студент не найден');
        return;
    }
    
    let roleText = 'Студент';
    if (student.user_type === 'teacher') roleText = 'Преподаватель';
    else if (student.user_type === 'admin') roleText = 'Администратор';
    else if (student.user_type === 'private') roleText = 'Частное лицо';
    
    const fullName = `${student.last_name || ''} ${student.first_name || ''}`.trim() || student.nickname;
    
    const container = document.getElementById('studentStatsContainer');
    
    container.innerHTML = `
        <div class="student-stats-profile">
            <div class="student-stats-header">
                <div class="student-stats-avatar">👤</div>
                <div class="student-stats-info">
                    <div class="student-stats-name">${fullName}</div>
                    <div class="student-stats-nick">@${student.nickname}</div>
                    <div class="student-stats-role">${roleText}${student.universities?.name ? ' ' + student.universities.name : ''}</div>
                </div>
            </div>
            
            <div class="student-stats-rating">Рейтинг: ${student.rating || '0.0'} (${student.review_count || 0} отзывов)</div>
            <div class="student-stats-coins">Скилл коинс: ${student.skill_coins || 0}</div>
            
            <div class="student-stats-skills">
                <div class="student-stats-skills-title">Могу обучить</div>
                <div class="student-stats-skills-list">
                    ${(student.skills_can_teach || []).map(s => `<span class="student-stats-skill-tag">${s}</span>`).join('') || '<span style="color:#999;">Не указано</span>'}
                </div>
            </div>
            
            ${reviews.length > 0 ? `
                <div class="student-stats-reviews-header">Отзывы (${reviews.length})</div>
                <div class="student-stats-reviews-list">
                    ${reviews.map(review => {
                        const stars = '★'.repeat(review.rating) + '☆'.repeat(5 - review.rating);
                        return `
                            <div class="student-stats-review-item">
                                <div class="student-stats-review-header">
                                    <div>
                                        <div class="student-stats-review-author">@${review.reviewer.nickname}</div>
                                        <div class="student-stats-review-role">${review.reviewer.user_type === 'teacher' ? 'Преподаватель' : 'Студент'} ${review.reviewer.universities?.name || ''}</div>
                                    </div>
                                    <div class="student-stats-review-stars">${stars}</div>
                                </div>
                                <div class="student-stats-review-text">${review.comment || 'Нет комментария'}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : ''}
            
            <div class="student-stats-lessons-header">История уроков</div>
            <div class="student-stats-lessons-list">
                ${lessons.length === 0 ? '<div style="padding:20px;text-align:center;color:#999;">Уроков пока нет</div>' : ''}
                ${lessons.map(l => {
                    const date = new Date(l.scheduled_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
                    const isTeacher = l.teacher_id === studentId;
                    const action = isTeacher ? `Провёл урок по ${l.skill}` : `Взял урок по ${l.skill}`;
                    return `
                        <div class="student-stats-lesson-item">
                            <span class="student-stats-lesson-date">${date}</span>
                            <span class="student-stats-lesson-action ${isTeacher ? 'teacher' : ''}">${action}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
    
    document.getElementById('groupStatsApp').style.display = 'none';
    document.getElementById('studentStatsApp').style.display = 'flex';
};

window.goBackToGroupStats = function() {
    document.getElementById('studentStatsApp').style.display = 'none';
    document.getElementById('groupStatsApp').style.display = 'flex';
};

window.goBackToCourseTypeSelection = function() {
    document.getElementById('groupStatsApp').style.display = 'none';
    document.getElementById('courseTypeStatsApp').style.display = 'flex';
};

window.goBackToInstituteSelection = function() {
    document.getElementById('courseTypeStatsApp').style.display = 'none';
    document.getElementById('groupStatsApp').style.display = 'flex';
};

window.goBackToGroupSelection = function() {
    document.getElementById('groupStatsApp').style.display = 'none';
    document.getElementById('studentApp').style.display = 'flex';
};

window.openSettings = function() {
    openSettingsApp();
};

window.closeSettings = function() {
    document.getElementById('settingsMenu').classList.remove('active');
};

window.openSettingsSelect = async function(type) {
    document.getElementById('settingsMenu').classList.remove('active');
    const content = document.getElementById('settingsSelectContent');
    
    if (type === 'univ') {
        const universities = await getUniversities();
        content.innerHTML = universities.map(u => `
            <div class="settings-select-item" onclick="selectUniversityInDB(${u.id})">${u.name}</div>
        `).join('');
    } else if (type === 'faculty') {
        const profile = await getCurrentProfile();
        if (profile && profile.university_id) {
            const institutes = await getInstitutes(profile.university_id);
            content.innerHTML = institutes.map(i => `
                <div class="settings-select-item" onclick="selectInstituteInDB(${i.id})">${i.name}</div>
            `).join('');
        } else {
            content.innerHTML = '<div style="padding:20px;text-align:center;">Сначала выберите университет</div>';
        }
    } else if (type === 'group') {
        const profile = await getCurrentProfile();
        if (profile && profile.institute_id) {
            const groups = await getGroups(profile.institute_id);
            content.innerHTML = groups.map(g => `
                <div class="settings-select-item" onclick="selectGroupInDB(${g.id})">${g.name} — ${g.type}, ${g.course}</div>
            `).join('');
        } else {
            content.innerHTML = '<div style="padding:20px;text-align:center;">Сначала выберите институт</div>';
        }
    }
    
    document.getElementById('settingsSelect').classList.add('active');
};

window.closeSettingsSelect = function() {
    document.getElementById('settingsSelect').classList.remove('active');
};

function showLoading(text = 'Загрузка...') {
    const loader = document.createElement('div');
    loader.id = 'globalLoader';
    loader.style.cssText = `
        position: fixed;
        top: 0; left: 0;
        width: 100%; height: 100%;
        background: rgba(255,255,255,0.9);
        backdrop-filter: blur(10px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 99999;
        font-size: 18px;
        color: var(--primary);
        font-weight: 600;
    `;
    loader.innerHTML = `<div class="loading"></div><div style="margin-left:15px;">${text}</div>`;
    document.body.appendChild(loader);
}

function hideLoading() {
    const loader = document.getElementById('globalLoader');
    if (loader) loader.remove();
}

document.addEventListener('DOMContentLoaded', () => {
    loadSkillsFromDB();
    
    document.getElementById('btnOpenLogin').addEventListener('click', () => { 
        openModal('loginModal'); 
        document.getElementById('loginEmail').focus(); 
    });
    document.getElementById('btnOpenRegister').addEventListener('click', () => { 
        openModal('registerModal');
        setTimeout(() => {
            document.getElementById('regLastName').focus();
        }, 300);
    });
    ['loginModal','registerModal','aboutModal','uniModal','roleModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => { 
            if (e.target.id === id) closeModal(id); 
        });
    });
    ['studentUnivModal','studentCourseModal','studentFacultyModal','studentGroupModal'].forEach(id => {
        document.getElementById(id).addEventListener('click', e => { 
            if (e.target.id === id) closeModal(id); 
        });
    });
    document.addEventListener('keydown', e => { 
        if (e.key === 'Escape') closeAllModals(); 
    });
});

let lastSeenInterval;
function startLastSeenTracker() {
    updateLastSeen();
    lastSeenInterval = setInterval(() => {
        updateLastSeen();
    }, 120000);
}

function stopLastSeenTracker() {
    if (lastSeenInterval) {
        clearInterval(lastSeenInterval);
    }
}

window.openSettingsApp = function() {
    const modal = document.getElementById('settingsApp');
    modal.style.display = 'flex';
    setTimeout(() => modal.classList.add('active'), 10);
};

window.closeSettingsApp = function() {
    const modal = document.getElementById('settingsApp');
    modal.classList.remove('active');
    setTimeout(() => modal.style.display = 'none', 300);
};


window.openSupportChat = function() {
    showError('Чат с поддержкой пока недоступен');
};

window.openWallet = async function() {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile) {
        showError('Профиль не загружен');
        return;
    }
    
    
    document.getElementById('walletBalance').textContent = profile.skill_coins || 0;
    
    
    const frozen = await getFrozenCoins();
    document.getElementById('walletFrozen').textContent = frozen;
    
    
    const transactions = await getUserTransactions();
    const container = document.getElementById('transactionsList');
    
    if (transactions.length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">История пуста</div>';
    } else {
        container.innerHTML = transactions.map(t => {
            const date = new Date(t.created_at).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
            const isPositive = t.amount > 0;
            const isFrozen = t.type === 'frozen';
            const amountClass = isFrozen ? 'frozen' : (isPositive ? 'positive' : 'negative');
            const amountSign = isPositive ? '+' : '';
            
            return `
                <div class="transaction-item">
                    <span class="transaction-date">${date}</span>
                    <span class="transaction-amount ${amountClass}">${amountSign}${t.amount}</span>
                    <span class="transaction-description">${t.description}</span>
                </div>
            `;
        }).join('');
    }
    
    openModal('walletModal');
};

window.buySubscription = function() {
    showError('Покупка подписки пока недоступна');
};

window.buyCoins = function() {
    showError('Покупка коинсов пока недоступна');
};


window.openEditProfile = async function() {
    const profile = dataCache.currentProfile || await getCurrentProfile();
    
    if (!profile) {
        showError('Профиль не загружен');
        return;
    }
    
    document.getElementById('editFirstName').value = profile.first_name || '';
    document.getElementById('editLastName').value = profile.last_name || '';
    document.getElementById('editNickname').value = profile.nickname || '';
    document.getElementById('editBio').value = profile.bio || '';
    
    editSelectedSkillsCan = profile.skills_can_teach || [];
    editSelectedSkillsWant = profile.skills_want_learn || [];
    
    showEditSkills('can');
    
    openModal('editProfileModal');
};


window.showEditSkills = function(tab) {
    editCurrentSkillTab = tab;
    
    document.getElementById('btnEditCan').classList.toggle('active', tab === 'can');
    document.getElementById('btnEditWant').classList.toggle('active', tab === 'want');
    
    if (tab === 'can') {
        document.getElementById('btnEditCan').style.background = 'var(--primary)';
        document.getElementById('btnEditCan').style.color = '#fff';
        document.getElementById('btnEditWant').style.background = 'rgba(100,141,229,0.2)';
        document.getElementById('btnEditWant').style.color = 'var(--primary)';
    } else {
        document.getElementById('btnEditWant').style.background = 'var(--primary)';
        document.getElementById('btnEditWant').style.color = '#fff';
        document.getElementById('btnEditCan').style.background = 'rgba(100,141,229,0.2)';
        document.getElementById('btnEditCan').style.color = 'var(--primary)';
    }
    
    
    renderEditSkillCategories();
    
    
    renderEditSelectedSkills();
};


function renderEditSkillCategories() {
    const container = document.getElementById('editSkillsContainer');
    const skillsFromDB = window.skillsFromDB;
    
    if (!skillsFromDB || Object.keys(skillsFromDB).length === 0) {
        container.innerHTML = '<div style="padding:40px;text-align:center;color:#999;">Загрузка навыков...</div>';
        return;
    }
    
    const categoryList = Object.keys(skillsFromDB);
    
    let html = categoryList.map(cat => {
        const skills = skillsFromDB[cat];
        const isSelected = skills.some(s => 
            (editCurrentSkillTab === 'can' ? editSelectedSkillsCan : editSelectedSkillsWant).includes(s)
        );
        const isExpanded = editExpandedCategory === cat;
        
        return `
            <div class="edit-skill-category">
                <div class="edit-skill-category-title" onclick="toggleEditCategory('${cat}')">
                    <span>${cat}</span>
                    <span style="font-size:12px;color:#999;">${skills.length} навыков${isSelected ? ' • ✓' : ''}</span>
                </div>
                ${isExpanded ? `
                    <div class="edit-skill-list">
                        ${skills.map(skill => {
                            const selected = (editCurrentSkillTab === 'can' ? editSelectedSkillsCan : editSelectedSkillsWant).includes(skill);
                            return `
                                <div class="edit-skill-item ${selected ? 'selected' : ''}" 
                                     onclick="toggleEditSkill('${skill.replace(/'/g, "\\'")}')">
                                    ${skill}
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
    
    container.innerHTML = html;
}


window.toggleEditCategory = function(cat) {
    if (editExpandedCategory === cat) {
        editExpandedCategory = null;
    } else {
        editExpandedCategory = cat;
    }
    renderEditSkillCategories();
};


window.toggleEditSkill = function(skill) {
    if (editCurrentSkillTab === 'can') {
        if (editSelectedSkillsCan.includes(skill)) {
            editSelectedSkillsCan = editSelectedSkillsCan.filter(s => s !== skill);
        } else {
            editSelectedSkillsCan.push(skill);
        }
    } else {
        if (editSelectedSkillsWant.includes(skill)) {
            editSelectedSkillsWant = editSelectedSkillsWant.filter(s => s !== skill);
        } else {
            editSelectedSkillsWant.push(skill);
        }
    }
    
    renderEditSkillCategories();
    renderEditSelectedSkills();
};


function renderEditSelectedSkills() {
    const container = document.getElementById('editSelectedSkillsList');
    const skills = editCurrentSkillTab === 'can' ? editSelectedSkillsCan : editSelectedSkillsWant;
    
    if (skills.length === 0) {
        container.innerHTML = '<span style="color:#999;font-size:13px;">Не выбрано</span>';
        return;
    }
    
    container.innerHTML = skills.map(skill => `
        <div class="edit-selected-skill-tag">
            ${skill}
            <span class="remove-skill" onclick="removeEditSkill('${skill.replace(/'/g, "\\'")}')">×</span>
        </div>
    `).join('');
}


window.removeEditSkill = function(skill) {
    if (editCurrentSkillTab === 'can') {
        editSelectedSkillsCan = editSelectedSkillsCan.filter(s => s !== skill);
    } else {
        editSelectedSkillsWant = editSelectedSkillsWant.filter(s => s !== skill);
    }
    
    renderEditSkillCategories();
    renderEditSelectedSkills();
};


window.uploadAvatar = function(input) {
    const file = input.files[0];
    if (!file) return;
    
    
    showSuccess('Аватарка загружена (функция в разработке)');
};

window.saveProfileChanges = async function() {
    const firstName = document.getElementById('editFirstName').value.trim();
    const lastName = document.getElementById('editLastName').value.trim();
    const nickname = document.getElementById('editNickname').value.trim();
    const bio = document.getElementById('editBio').value.trim();
    
    if (!firstName || !lastName || !nickname) {
        showError('Заполните все обязательные поля');
        return;
    }
    
    const btn = event.target;
    btn.disabled = true;
    btn.textContent = 'Сохранение...';
    
    try {
        const updates = {
            first_name: firstName,
            last_name: lastName,
            nickname: nickname,
            bio: bio,
            skills_can_teach: editSelectedSkillsCan,
            skills_want_learn: editSelectedSkillsWant
        };
        
        const success = await updateProfile(updates);
        
        if (success) {
            showSuccess('Профиль обновлён!');
            closeModal('editProfileModal');
            
            
            clearCache();
            await getCurrentProfile();
            
            // Обновляем текущую вкладку
            const currentTab = document.querySelector('.nav-item.active');
            if (currentTab) {
                const tabName = currentTab.dataset.tab;
                switchTab(tabName, currentTab);
            }
        } else {
            showError('Ошибка сохранения');
        }
    } catch (error) {
        showError('Ошибка: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить';
    }
};
