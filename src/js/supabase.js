const SUPABASE_URL = 'https://lsmrxgwcihxclqhycrmb.supabase.co';
const SUPABASE_KEY = 'sb_publishable_wOYmUlMZjg_bDzHT134JeQ_ZulSRrKm';

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const dataCache = {
    skills: null,
    universities: null,
    currentUser: null,
    currentProfile: null,
    allUsers: null,
    userProfiles: {},
    uniMap: null
};

function clearUsersCache() {
    dataCache.allUsers = null;
    dataCache.userProfiles = {};
}

function updateProfileCache(updates) {
    if (dataCache.currentProfile) {
        dataCache.currentProfile = { ...dataCache.currentProfile, ...updates };
    }
    dataCache.allUsers = null;
}

async function registerUser(email, password, nickname, user_type = 'student', firstName = '', lastName = '') {
    try {
        const { data: signUpData, error: signUpError } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nickname: nickname,
                    user_type: user_type,
                    first_name: firstName,
                    last_name: lastName
                }
            }
        });
        
        if (signUpError) {
            if (signUpError.message.includes('already registered')) {
                return { success: false, error: 'Этот email уже зарегистрирован' };
            }
            if (signUpError.message.includes('password')) {
                return { success: false, error: 'Пароль должен быть не менее 6 символов' };
            }
            return { success: false, error: signUpError.message };
        }
        
        await new Promise(resolve => setTimeout(resolve, 300));
        
        for (let i = 0; i < 3; i++) {
            const { data: signInData, error: signInError } = await supabaseClient.auth.signInWithPassword({
                email: email,
                password: password
            });
            
            if (!signInError && signInData.user) {
                dataCache.currentUser = null;
                dataCache.currentProfile = null;
                return { success: true, user: signInData.user };
            }
            
            await new Promise(resolve => setTimeout(resolve, 200));
        }
        
        return { success: true, user: signUpData.user, warning: 'Не удалось автоматически войти. Попробуйте войти вручную.' };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function loginUser(email, password) {
    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email,
            password: password
        });
        
        if (error) {
            return { success: false, error: error.message };
        }
        
        return { success: true, user: data.user };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

async function getCurrentUser() {
    if (dataCache.currentUser) {
        return dataCache.currentUser;
    }
    
    const { data: { user } } = await supabaseClient.auth.getUser();
    dataCache.currentUser = user;
    return user;
}

async function getCurrentProfile() {
    if (dataCache.currentProfile) {
        return dataCache.currentProfile;
    }
    
    const user = await getCurrentUser();
    if (!user) return null;
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            *,
            universities(name),
            institutes(name),
            groups(name, type, course)
        `)
        .eq('id', user.id)
        .single();
    
    if (error) {
        return null;
    }
    
    dataCache.currentProfile = data;
    return data;
}

async function logout() {
    await supabaseClient.auth.signOut();
    dataCache.currentUser = null;
    dataCache.currentProfile = null;
}

async function getUniversities() {
    if (dataCache.universities) {
        return dataCache.universities;
    }
    
    const { data, error } = await supabaseClient
        .from('universities')
        .select('*')
        .order('name');
    
    if (error) {
        return [];
    }
    
    dataCache.universities = data;
    
    dataCache.uniMap = {};
    data.forEach(uni => {
        dataCache.uniMap[uni.id] = uni.name;
    });
    
    return data;
}

async function getInstitutes(universityId) {
    const { data, error } = await supabaseClient
        .from('institutes')
        .select('*')
        .eq('university_id', universityId)
        .order('name');
    
    if (error) {
        return [];
    }
    return data;
}

async function getGroups(instituteId) {
    const { data, error } = await supabaseClient
        .from('groups')
        .select('*')
        .eq('institute_id', instituteId)
        .order('name');
    
    if (error) {
        return [];
    }
    return data;
}

async function getGroupsByTypeAndCourse(eduType, course) {
    const { data, error } = await supabaseClient
        .from('groups')
        .select('*')
        .eq('type', eduType)
        .eq('course', course)
        .order('name');
    
    if (error) {
        return [];
    }
    return data;
}

async function getSkillsList() {
    const { data, error } = await supabaseClient
        .from('skills_list')
        .select('*')
        .order('category')
        .order('skill_name');
    
    if (error) {
        return [];
    }
    return data;
}

async function getSkillsByCategory() {
    const skills = await getSkillsList();
    const grouped = {};
    skills.forEach(skill => {
        if (!grouped[skill.category]) {
            grouped[skill.category] = [];
        }
        grouped[skill.category].push(skill.skill_name);
    });
    return grouped;
}

async function updateProfile(updates) {
    const user = await getCurrentUser();
    if (!user) {
        return false;
    }
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .update(updates)
        .eq('id', user.id)
        .select();
    
    if (error) {
        showError('Ошибка сохранения: ' + error.message);
        return false;
    }
    
    if (dataCache.currentProfile) {
        dataCache.currentProfile = { ...dataCache.currentProfile, ...updates };
    }
    
    return true;
}

async function selectUniversityInDB(universityId) {
    return await updateProfile({ university_id: universityId });
}

async function selectInstituteInDB(instituteId) {
    return await updateProfile({ institute_id: instituteId });
}

async function selectGroupInDB(groupId) {
    return await updateProfile({ group_id: groupId });
}

async function saveSkillsToProfile(skillsWant, skillsCan) {
    return await updateProfile({
        skills_want_learn: skillsWant,
        skills_can_teach: skillsCan
    });
}

window.updateLastSeen = async function() {
    const user = await getCurrentUser();
    if (!user) return false;
    
    const { error } = await supabaseClient
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', user.id);
    
    if (error) {
        return false;
    }
    
    return true;
}

window.isUserOnline = function(lastSeen) {
    if (!lastSeen) return false;
    
    const now = new Date();
    const lastSeenDate = new Date(lastSeen);
    const diffMinutes = (now - lastSeenDate) / (1000 * 60);
    
    return diffMinutes < 5;
}

let isLoadingUsers = false;
let usersLoadPromise = null;

async function getAllUsersForSearch() {
    if (dataCache.allUsers && dataCache.allUsers.length > 0) {
        return dataCache.allUsers;
    }
    
    if (isLoadingUsers && usersLoadPromise) {
        return await usersLoadPromise;
    }
    
    try {
        isLoadingUsers = true;
        
        usersLoadPromise = (async () => {
            const currentUser = await getCurrentUser();
            
            if (!currentUser) {
                isLoadingUsers = false;
                return [];
            }
            
            const { data, error } = await supabaseClient
                .from('profiles')
                .select(`
                    id, nickname, first_name, last_name, user_type,
                    is_connected_to_university, university_id,
                    skills_can_teach, skills_want_learn,
                    rating, review_count, last_seen
                `)
                .neq('user_type', 'admin')
            
            if (error) {
                isLoadingUsers = false;
                usersLoadPromise = null;
                return [];
            }
            
            if (!data) {
                isLoadingUsers = false;
                usersLoadPromise = null;
                return [];
            }
            
            const filtered = data.filter(user => user.id !== currentUser.id);
            
            dataCache.allUsers = filtered;
            isLoadingUsers = false;
            usersLoadPromise = null;
            
            return filtered;
        })();
        
        return await usersLoadPromise;
    } catch (err) {
        isLoadingUsers = false;
        usersLoadPromise = null;
        return [];
    }
}

async function getUserByNickname(nickname) {
    if (dataCache.userProfiles[nickname]) {
        return dataCache.userProfiles[nickname];
    }
    
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            id, nickname, first_name, last_name, bio, user_type,
            is_connected_to_university, skill_coins,
            skills_can_teach, skills_want_learn,
            rating, review_count, last_seen,
            education_type, course,
            universities(name), institutes(name)
        `)
        .eq('nickname', nickname)
        .single();
    
    if (error) {
        return null;
    }
    
    dataCache.userProfiles[nickname] = data;
    return data;
}

async function getUserReviews(userId, limit = 1) {
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`
            *,
            reviewer:reviewer_id(
                id,
                nickname,
                first_name,
                last_name,
                user_type,
                universities(name)
            )
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);
    
    if (error) {
        return [];
    }
    
    return data;
}

async function getAllUserReviews(userId) {
    const { data, error } = await supabaseClient
        .from('reviews')
        .select(`
            *,
            reviewer:reviewer_id(
                id,
                nickname,
                first_name,
                last_name,
                user_type,
                universities(name)
            )
        `)
        .eq('reviewed_id', userId)
        .order('created_at', { ascending: false });
    
    if (error) {
        return [];
    }
    
    return data;
}

async function getStudentsByGroup(groupId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            id,
            nickname,
            first_name,
            last_name,
            bio,
            user_type,
            rating,
            skills_can_teach,
            skills_want_learn,
            skill_coins,
            groups(name, type, course)
        `)
        .eq('group_id', groupId);
    
    if (error) {
        return [];
    }
    return data;
}

async function getStudentLessons(studentId) {
    const { data, error } = await supabaseClient
        .from('lessons')
        .select(`
            *,
            teacher:teacher_id(nickname),
            student:student_id(nickname)
        `)
        .or(`teacher_id.eq.${studentId},student_id.eq.${studentId}`)
        .order('scheduled_at', { ascending: false });
    
    if (error) {
        return [];
    }
    return data;
}

async function getStudentProfile(studentId) {
    const { data, error } = await supabaseClient
        .from('profiles')
        .select(`
            *,
            universities(name),
            institutes(name),
            groups(name, type, course)
        `)
        .eq('id', studentId)
        .single();
    
    if (error) {
        return null;
    }
    return data;
}

async function loadUniversitiesToModal() {
    const universities = await getUniversities();
    const studentUnivModal = document.querySelector('#studentUnivModal .faculty-list');
    
    if (studentUnivModal && universities.length > 0) {
        studentUnivModal.innerHTML = universities.map(u => `
            <div class="faculty-item" onclick="selectUniversityFromDB(${u.id}, '${u.name.replace(/'/g, "\\'")}')">
                ${u.name}
            </div>
        `).join('');
    }
}

async function loadInstitutesToModal(universityId) {
    const institutes = await getInstitutes(universityId);
    const facultyModal = document.querySelector('#studentFacultyModal .faculty-list');
    if (facultyModal && institutes.length > 0) {
        facultyModal.innerHTML = institutes.map(i => `
            <div class="faculty-item" onclick="selectInstituteFromDB(${i.id}, '${i.name.replace(/'/g, "\\'")}')">
                ${i.name}
            </div>
        `).join('');
    }
    return institutes;
}

async function loadSkillsFromDB() {
    if (window.skillsFromDB && Object.keys(window.skillsFromDB).length > 0) {
        return window.skillsFromDB;
    }
    
    try {
        const skills = await getSkillsByCategory();
        window.skillsFromDB = skills;
        return skills;
    } catch (error) {
        return {};
    }
}

window.selectUniversityFromDB = async function(universityId, universityName) {
    await selectUniversityInDB(universityId);
    
    const profile = await getCurrentProfile();
    
    if (profile && profile.user_type === 'admin') {
        closeModal('studentUnivModal');
        setTimeout(() => {
            showSuccess('Регистрация завершена!');
            setTimeout(() => {
                closeAllModals();
                document.getElementById('welcomeScreen').style.display = 'none';
                document.querySelector('.logo-small').style.display = 'none';
                document.getElementById('studentApp').classList.add('active');
                switchTab('notif', document.querySelector('.nav-item[data-tab="notif"]'));
            }, 1000);
        }, 350);
    } else {
        await loadInstitutesToModal(universityId);
        studentGo('studentFacultyModal');
    }
};

window.selectInstituteFromDB = async function(instituteId, instituteName) {
    await selectInstituteInDB(instituteId);
    closeModal('studentFacultyModal');
    setTimeout(() => openModal('studentCourseModal'), 300);
};

document.addEventListener('DOMContentLoaded', async () => {
    await loadUniversitiesToModal();
    
    const user = await getCurrentUser();
    if (user) {
        window.currentUserId = user.id;
        await getCurrentProfile();
    }
});

async function getIncomingRequests() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];
    
    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select('id, sender_id, skill, scheduled_date, scheduled_time, message, created_at')
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
    
    if (error || !requests || requests.length === 0) {
        return [];
    }
    
    const senderIds = [...new Set(requests.map(r => r.sender_id))];
    
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name, user_type, universities(name)')
        .in('id', senderIds);
    
    const profileMap = {};
    profiles?.forEach(p => {
        profileMap[p.id] = p;
    });
    
    const requestsWithSender = requests.map(req => ({
        ...req,
        sender: profileMap[req.sender_id] || null
    }));
    
    return requestsWithSender;
}

async function getMySentRequests() {
    const currentUser = await getCurrentUser();
    
    const { data, error } = await supabaseClient
        .from('requests')
        .select(`
            *,
            receiver:receiver_id(
                id,
                nickname,
                first_name,
                last_name,
                user_type,
                universities(name)
            )
        `)
        .eq('sender_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        return [];
    }
    
    return data;
}

async function acceptRequestInDB(requestId, senderId) {
    try {
        const { data, error } = await supabaseClient
            .rpc('deduct_coins_on_accept', {
                p_request_id: requestId,
                p_sender_id: senderId,
                p_coins_amount: 5
            });
        
        if (error) {
            throw error;
        }
        
        if (!data || !data.success) {
            const errorMsg = data?.error || 'Неизвестная ошибка';
            throw new Error(errorMsg);
        }
        
        if (typeof clearCache === 'function') {
            clearCache();
        }
        
        return true;
    } catch (error) {
        throw error;
    }
}

async function rejectRequestInDB(requestId) {
    const { error } = await supabaseClient
        .from('requests')
        .update({ status: 'rejected', updated_at: new Date().toISOString() })
        .eq('id', requestId);
    
    if (error) throw error;
    return true;
}

async function getPendingLessonConfirmations() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];
    
    const now = new Date();
    const tenMinutesAgo = new Date(now.getTime() - 10 * 60 * 1000);
    
    const { data: requests, error } = await supabaseClient
        .from('requests')
        .select('id, sender_id, receiver_id, skill, scheduled_date, scheduled_time')
        .eq('status', 'accepted')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`);
    
    if (error || !requests) return [];
    
    const pendingRequests = requests.filter(req => {
        const lessonDateTime = new Date(`${req.scheduled_date}T${req.scheduled_time}`);
        return lessonDateTime <= tenMinutesAgo;
    });
    
    const requestIds = pendingRequests.map(r => r.id);
    if (requestIds.length === 0) return [];
    
    const { data: reviews } = await supabaseClient
        .from('lesson_reviews')
        .select('request_id, mentor_rating, student_rating')
        .in('request_id', requestIds);
    
    const reviewMap = {};
    reviews?.forEach(r => {
        reviewMap[r.request_id] = r;
    });
    
    const pendingConfirmations = pendingRequests.filter(req => {
        const review = reviewMap[req.id];
        if (!review) return true;
        
        const isMentor = req.receiver_id === currentUser.id;
        if (isMentor) {
            return review.mentor_rating === null;
        } else {
            return review.student_rating === null;
        }
    });
    
    const otherUserIds = [...new Set(
        pendingConfirmations.map(req => 
            req.sender_id === currentUser.id ? req.receiver_id : req.sender_id
        )
    )];
    
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name')
        .in('id', otherUserIds);
    
    const profileMap = {};
    profiles?.forEach(p => {
        profileMap[p.id] = p;
    });
    
    return pendingConfirmations.map(req => ({
        ...req,
        otherUser: profileMap[req.sender_id === currentUser.id ? req.receiver_id : req.sender_id],
        isMentor: req.receiver_id === currentUser.id
    }));
}

async function confirmLesson(requestId, rating) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Не авторизован');
    
    const { data, error } = await supabaseClient
        .rpc('confirm_lesson', {
            p_request_id: requestId,
            p_user_id: currentUser.id,
            p_rating: rating
        });
    
    if (error) throw error;
    if (!data || !data.success) {
        throw new Error(data?.error || 'Ошибка подтверждения');
    }
    
    return data;
}

async function getUserChats() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];
    
    const { data: requests } = await supabaseClient
        .from('requests')
        .select('id, sender_id, receiver_id, skill, status')
        .or(`sender_id.eq.${currentUser.id},receiver_id.eq.${currentUser.id}`)
        .order('created_at', { ascending: false });
    
    if (!requests || requests.length === 0) return [];
    
    const otherUserIds = [...new Set(
        requests.map(req => 
            req.sender_id === currentUser.id ? req.receiver_id : req.sender_id
        )
    )];
    
    const { data: profiles } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name, user_type')
        .in('id', otherUserIds);
    
    const profileMap = {};
    profiles?.forEach(p => {
        profileMap[p.id] = p;
    });
    
    const requestIds = requests.map(r => r.id);
    const { data: messages } = await supabaseClient
        .from('messages')
        .select('request_id, content, created_at, sender_id')
        .in('request_id', requestIds)
        .order('created_at', { ascending: false });
    
    const messagesByRequest = {};
    messages?.forEach(msg => {
        if (!messagesByRequest[msg.request_id]) {
            messagesByRequest[msg.request_id] = [];
        }
        messagesByRequest[msg.request_id].push(msg);
    });
    
    const { data: unreadData } = await supabaseClient
        .from('messages')
        .select('request_id', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false)
        .in('request_id', requestIds);
    
    const unreadByRequest = {};
    unreadData?.forEach(msg => {
        unreadByRequest[msg.request_id] = (unreadByRequest[msg.request_id] || 0) + 1;
    });
    
    const chats = requests.map(req => {
        const otherUserId = req.sender_id === currentUser.id ? req.receiver_id : req.sender_id;
        const isMentor = req.receiver_id === currentUser.id;
        const reqMessages = messagesByRequest[req.id] || [];
        const lastMessage = reqMessages.length > 0 ? reqMessages[0] : null;
        
        return {
            request: req,
            otherUser: profileMap[otherUserId] || null,
            lastMessage: lastMessage,
            unreadCount: unreadByRequest[req.id] || 0,
            canWrite: isMentor || req.status === 'accepted',
            isMentor: isMentor
        };
    });
    
    return chats;
}

async function getChatMessages(requestId) {
    const { data, error } = await supabaseClient
        .from('messages')
        .select('*')
        .eq('request_id', requestId)
        .order('created_at', { ascending: true });
    
    if (error) {
        return [];
    }
    
    return data;
}

async function sendMessage(requestId, receiverId, content) {
    const currentUser = await getCurrentUser();
    
    const { data, error } = await supabaseClient
        .from('messages')
        .insert({
            request_id: requestId,
            sender_id: currentUser.id,
            receiver_id: receiverId,
            content: content,
            is_read: false
        })
        .select();
    
    if (error) {
        return null;
    }
    
    return data[0];
}

async function markMessagesAsRead(requestId, userId) {
    const { error } = await supabaseClient
        .from('messages')
        .update({ is_read: true })
        .eq('request_id', requestId)
        .eq('receiver_id', userId)
        .eq('is_read', false);
    
    if (error) {
        return false;
    }
    
    return true;
}

async function getUnreadMessagesCount() {
    const currentUser = await getCurrentUser();
    
    const { count, error } = await supabaseClient
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('is_read', false);
    
    if (error) return 0;
    return count || 0;
}

async function getPendingRequestsCount() {
    const currentUser = await getCurrentUser();
    
    const { count, error } = await supabaseClient
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('receiver_id', currentUser.id)
        .eq('status', 'pending');
    
    if (error) return 0;
    return count || 0;
}

async function getMyScheduledLessons() {
    const currentUser = await getCurrentUser();
    
    if (!currentUser) {
        return [];
    }
    
    const { data: allRequests, error: allError } = await supabaseClient
        .from('requests')
        .select('id, sender_id, receiver_id, skill, status, scheduled_date, scheduled_time')
        .eq('sender_id', currentUser.id);
    
    if (allError) {
        return [];
    }
    
    const acceptedRequests = allRequests?.filter(r => r.status === 'accepted') || [];
    
    if (acceptedRequests.length === 0) {
        return [];
    }
    
    const mentorIds = [...new Set(acceptedRequests.map(r => r.receiver_id))];
    
    const { data: mentors } = await supabaseClient
        .from('profiles')
        .select('id, nickname, first_name, last_name, user_type, universities(name)')
        .in('id', mentorIds);
    
    const mentorMap = {};
    mentors?.forEach(m => {
        mentorMap[m.id] = m;
    });
    
    const lessons = acceptedRequests.map(req => ({
        ...req,
        receiver: mentorMap[req.receiver_id] || null
    }));
    
    lessons.sort((a, b) => {
        const dateA = new Date(`${a.scheduled_date}T${a.scheduled_time || '00:00'}`);
        const dateB = new Date(`${b.scheduled_date}T${b.scheduled_time || '00:00'}`);
        return dateA - dateB;
    });
    
    return lessons;
}

async function canLeaveReview(reviewedUserId) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return { canReview: false, requestId: null };
    
    const { data: requests } = await supabaseClient
        .from('requests')
        .select('id, sender_id, receiver_id, status')
        .or(`and(sender_id.eq.${currentUser.id},receiver_id.eq.${reviewedUserId}),and(sender_id.eq.${reviewedUserId},receiver_id.eq.${currentUser.id})`)
        .eq('status', 'completed');
    
    if (!requests || requests.length === 0) {
        return { canReview: false, requestId: null };
    }
    
    const { data: existingReview } = await supabaseClient
        .from('reviews')
        .select('id')
        .eq('request_id', requests[0].id)
        .eq('reviewer_id', currentUser.id)
        .single();
    
    if (existingReview) {
        return { canReview: false, requestId: null };
    }
    
    return { canReview: true, requestId: requests[0].id };
}

async function submitReview(requestId, reviewedUserId, rating, comment) {
    const currentUser = await getCurrentUser();
    if (!currentUser) throw new Error('Не авторизован');
    
    const { data, error } = await supabaseClient
        .from('reviews')
        .insert({
            request_id: requestId,
            reviewer_id: currentUser.id,
            reviewed_id: reviewedUserId,
            rating: rating,
            comment: comment
        })
        .select();
    
    if (error) throw error;
    
    await supabaseClient.rpc('calculate_user_rating', { p_user_id: reviewedUserId });
    
    return data[0];
}

async function getUserTransactions() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return [];
    
    const { data, error } = await supabaseClient
        .from('transactions')
        .select('*')
        .eq('user_id', currentUser.id)
        .order('created_at', { ascending: false });
    
    if (error) {
        return [];
    }
    
    return data || [];
}

async function addTransaction(amount, type, description) {
    const currentUser = await getCurrentUser();
    if (!currentUser) return null;
    
    const { data, error } = await supabaseClient
        .from('transactions')
        .insert({
            user_id: currentUser.id,
            amount: amount,
            type: type,
            description: description
        })
        .select();
    
    if (error) return null;
    return data[0];
}

async function getFrozenCoins() {
    const currentUser = await getCurrentUser();
    if (!currentUser) return 0;
    
    const { count, error } = await supabaseClient
        .from('requests')
        .select('*', { count: 'exact', head: true })
        .eq('sender_id', currentUser.id)
        .eq('status', 'pending');
    
    if (error) return 0;
    return (count || 0) * 5;
}
