// ============================================================
// admin.js — ABVP Tamil Nadu Admin Dashboard
// Google Auth, RBAC, member management, analytics, approvals
// ============================================================

(function () {
    'use strict';

    // ── State ───────────────────────────────────────────────────
    let currentUser = null;
    let currentRole = null;
    let allMembers = [];
    let currentMemberDocId = null; // For modal actions
    let unsubscribeMembers = null; // Firestore listener

    // ── DOM References ──────────────────────────────────────────
    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');
    const loginError = document.getElementById('login-error');
    const loginLoading = document.getElementById('login-loading');
    const googleSignInBtn = document.getElementById('google-signin-btn');

    // ── Google Sign-In ──────────────────────────────────────────
    window.signInWithGoogle = async function () {
        googleSignInBtn.disabled = true;
        loginError.classList.add('hidden');
        loginLoading.classList.remove('hidden');

        try {
            const result = await auth.signInWithPopup(googleProvider);
            // Auth state observer will handle the rest
        } catch (err) {
            console.error('Sign-in error:', err);
            loginError.textContent = err.message || 'Sign-in failed. Please try again.';
            loginError.classList.remove('hidden');
            loginLoading.classList.add('hidden');
            googleSignInBtn.disabled = false;
        }
    };

    // ── Auth State Observer ─────────────────────────────────────
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            loginLoading.classList.remove('hidden');
            loginError.classList.add('hidden');

            try {
                // Seed super admin if first time
                await seedSuperAdmin(user);

                // Check RBAC
                const { isAdmin, role } = await checkAdminRole(user.email);

                if (!isAdmin) {
                    // Not an admin - sign out and show error
                    await auth.signOut();
                    loginError.textContent = 'Access denied. Your account is not authorized as an admin.';
                    loginError.classList.remove('hidden');
                    loginLoading.classList.add('hidden');
                    googleSignInBtn.disabled = false;
                    return;
                }

                // Authorized admin
                currentUser = user;
                currentRole = role;
                showDashboard();

            } catch (err) {
                console.error('Auth check error:', err);
                loginError.textContent = 'Error verifying admin access. Please try again.';
                loginError.classList.remove('hidden');
                loginLoading.classList.add('hidden');
                googleSignInBtn.disabled = false;
            }
        } else {
            // Not signed in
            currentUser = null;
            currentRole = null;
            showLoginScreen();
        }
    });

    // ── Sign Out ────────────────────────────────────────────────
    window.signOutAdmin = async function () {
        if (unsubscribeMembers) {
            unsubscribeMembers();
            unsubscribeMembers = null;
        }
        await auth.signOut();
    };

    // ── Show/Hide Screens ───────────────────────────────────────
    function showLoginScreen() {
        loginScreen.classList.remove('hidden');
        dashboard.classList.add('hidden');
        loginLoading.classList.add('hidden');
        googleSignInBtn.disabled = false;
    }

    function showDashboard() {
        loginScreen.classList.add('hidden');
        dashboard.classList.remove('hidden');

        // Set admin info
        document.getElementById('admin-avatar').src = currentUser.photoURL || '';
        document.getElementById('admin-name').textContent = currentUser.displayName || currentUser.email;
        document.getElementById('admin-role').textContent = currentRole;

        // Show admin management for super_admin
        if (currentRole === 'super_admin') {
            document.getElementById('admin-mgmt-nav').style.display = 'flex';
        }

        // Start listening to members
        startMembersListener();

        // Load admin list if super_admin
        if (currentRole === 'super_admin') {
            loadAdminsList();
        }

        // Setup filters
        setupFilters();
    }

    // ── Sidebar Navigation ──────────────────────────────────────
    window.switchSection = function (sectionId, navEl) {
        // Hide all sections
        document.querySelectorAll('.dashboard-section').forEach(s => s.classList.add('hidden'));
        // Show target
        document.getElementById('section-' + sectionId).classList.remove('hidden');

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        if (navEl) navEl.classList.add('active');

        // Close mobile sidebar and overlay
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('active');
    };

    window.toggleSidebar = function () {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) {
            const isOpen = sidebar.classList.toggle('open');
            if (overlay) {
                if (isOpen) {
                    overlay.classList.add('active');
                } else {
                    overlay.classList.remove('active');
                }
            }
        }
    };

    // ── Members Listener (Real-time with Fallback) ──────────────
    function startMembersListener() {
        const handleMembersSnapshot = (snapshot) => {
            allMembers = [];
            snapshot.forEach(doc => {
                allMembers.push({ id: doc.id, ...doc.data() });
            });

            // Client-side sort by createdAt descending for consistent order across browsers
            allMembers.sort((a, b) => {
                const getMs = (val) => {
                    if (!val) return 0;
                    if (val.toMillis) return val.toMillis();
                    if (val.seconds) return val.seconds * 1000;
                    const parsed = new Date(val).getTime();
                    return isNaN(parsed) ? 0 : parsed;
                };
                return getMs(b.createdAt) - getMs(a.createdAt);
            });

            updateAnalytics();
            renderRecentTable();
            renderMembersTable();
            renderPendingList();
        };

        const fallbackSimpleQuery = () => {
            console.warn('Falling back to direct collection query without orderBy');
            db.collection('members').onSnapshot(handleMembersSnapshot, (err) => {
                console.error('Fallback members snapshot error:', err);
                // Last-ditch one-time fetch if snapshot listener has browser permission/network issues
                db.collection('members').get().then(handleMembersSnapshot).catch(e => {
                    console.error('Direct members fetch error:', e);
                });
            });
        };

        try {
            unsubscribeMembers = db.collection('members')
                .orderBy('createdAt', 'desc')
                .onSnapshot(handleMembersSnapshot, (err) => {
                    console.warn('Ordered query onSnapshot error, executing fallback:', err);
                    fallbackSimpleQuery();
                });
        } catch (e) {
            console.warn('startMembersListener exception:', e);
            fallbackSimpleQuery();
        }
    }

    // ── Analytics ───────────────────────────────────────────────
    function updateAnalytics() {
        const total = allMembers.length;
        const pending = allMembers.filter(m => m.status === 'pending_review').length;
        const active = allMembers.filter(m => m.status === 'active').length;
        const rejected = allMembers.filter(m => m.status === 'rejected').length;

        const genderCounts = { male: 0, female: 0, other: 0 };
        allMembers.forEach(m => {
            if (genderCounts.hasOwnProperty(m.gender)) {
                genderCounts[m.gender]++;
            }
        });

        document.getElementById('stat-total').textContent = total;
        document.getElementById('stat-pending').textContent = pending;
        document.getElementById('stat-active').textContent = active;
        document.getElementById('stat-rejected').textContent = rejected;
        document.getElementById('stat-gender-ratio').textContent =
            `${genderCounts.male} / ${genderCounts.female} / ${genderCounts.other}`;

        // Update pending badge
        document.getElementById('pending-badge').textContent = pending;
        document.getElementById('pending-badge').style.display = pending > 0 ? 'inline-block' : 'none';
    }

    // ── Recent Table (Overview) ─────────────────────────────────
    function renderRecentTable() {
        const tbody = document.getElementById('recent-table-body');
        if (!tbody) return;
        const recent = allMembers.slice(0, 10);

        if (recent.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="empty-row">No registrations yet</td></tr>';
            return;
        }

        tbody.innerHTML = recent.map(m => {
            try {
                return `
                    <tr>
                        <td style="text-transform:capitalize">${escHtml(m.fullName || 'N/A')}</td>
                        <td>${escHtml(m.email || 'N/A')}</td>
                        <td style="text-transform:capitalize">${escHtml(m.institutionType || 'N/A')}</td>
                        <td><span class="status-badge status-${m.status}">${statusLabel(m.status)}</span></td>
                        <td>${formatDate(m.createdAt)}</td>
                        <td><button class="btn-view btn-remove-recent" onclick="removeMember('${m.id}', '${escHtml(m.fullName || '')}')" title="Remove">✕ Remove</button></td>
                    </tr>
                `;
            } catch (err) {
                console.error('Error rendering recent table row:', err);
                return '';
            }
        }).join('');
    }

    // ── All Members Table ───────────────────────────────────────
    function renderMembersTable(filter = null) {
        const tbody = document.getElementById('members-table-body');
        if (!tbody) return;
        let members = filter ? filter : allMembers;

        if (members.length === 0) {
            tbody.innerHTML = '<tr><td colspan="11" class="empty-row">No members found</td></tr>';
            return;
        }

        tbody.innerHTML = members.map(m => {
            try {
                let validityStatus = '-';
                if (m.validUntil) {
                    const validUntilDate = m.validUntil.toDate ? m.validUntil.toDate() : new Date(m.validUntil);
                    const today = new Date();
                    validityStatus = today > validUntilDate ?
                        `<span style="color:red; font-weight:bold;">Expired</span>` :
                        `<span style="color:green; font-weight:bold;">Valid</span>`;
                }

                return `
                    <tr>
                        <td><img src="${m.photoBase64 || ''}" alt="" class="table-photo"></td>
                        <td style="text-transform:capitalize">${escHtml(m.fullName || 'N/A')}</td>
                        <td style="font-size:0.8rem">${escHtml(m.email || 'N/A')}</td>
                        <td>${escHtml(m.phone || 'N/A')}</td>
                        <td style="text-transform:capitalize">${escHtml(m.institutionType || 'N/A')}</td>
                        <td style="text-transform:capitalize">${escHtml(m.collegeName || '-')}</td>
                        <td style="text-transform:capitalize">${escHtml(m.district || '-')}</td>
                        <td><span class="status-badge status-${m.status}">${statusLabel(m.status)}</span></td>
                        <td style="font-size:0.8rem">${formatDate(m.validUntil)}</td>
                        <td>${validityStatus}</td>
                        <td><button class="btn-view" onclick="openMemberModal('${m.id}')">View</button></td>
                    </tr>
                `;
            } catch (err) {
                console.error('Error rendering member table row:', err);
                return '';
            }
        }).join('');
    }

    // ── Pending List ────────────────────────────────────────────
    function renderPendingList() {
        const container = document.getElementById('pending-list');
        const pending = allMembers.filter(m => m.status === 'pending_review');

        if (pending.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-state-icon">🎉</div>
                    <p>No pending approvals! All caught up.</p>
                </div>
            `;
            return;
        }

        container.innerHTML = pending.map(m => `
            <div class="pending-card">
                <div class="pending-card-header">
                    <img src="${m.photoBase64 || ''}" alt="" class="pending-card-photo">
                    <div>
                        <div class="pending-card-name">${escHtml(m.fullName)}</div>
                        <div class="pending-card-email">${escHtml(m.email)}</div>
                    </div>
                </div>
                <div class="pending-card-details">
                    <div class="pcd-item">
                        <span class="pcd-label">Type</span>
                        <span class="pcd-value">${escHtml(m.institutionType)}</span>
                    </div>
                    <div class="pcd-item">
                        <span class="pcd-label">College/School</span>
                        <span class="pcd-value">${escHtml(m.collegeName || '-')}</span>
                    </div>
                    <div class="pcd-item">
                        <span class="pcd-label">Course</span>
                        <span class="pcd-value">${escHtml(m.courseDetails || '-')}</span>
                    </div>
                    <div class="pcd-item">
                        <span class="pcd-label">District</span>
                        <span class="pcd-value">${escHtml(m.district)}</span>
                    </div>
                </div>
                <div class="pending-card-actions">
                    <button class="btn-action btn-approve" onclick="openMemberModal('${m.id}')">Review & Approve</button>
                </div>
            </div>
        `).join('');
    }

    // ── Member Modal ────────────────────────────────────────────
    window.openMemberModal = function (docId) {
        const member = allMembers.find(m => m.id === docId);
        if (!member) return;

        currentMemberDocId = docId;

        // Populate modal
        document.getElementById('modal-photo').src = member.photoBase64 || '';
        document.getElementById('modal-name').textContent = member.fullName;
        
        const badge = document.getElementById('modal-status-badge');
        badge.textContent = statusLabel(member.status);
        badge.className = 'status-badge status-' + member.status;

        document.getElementById('modal-email').textContent = member.email;
        document.getElementById('modal-phone').textContent = member.phone;
        document.getElementById('modal-institution').textContent = member.institutionType;
        document.getElementById('modal-college-name').textContent = member.collegeName || 'N/A';
        document.getElementById('modal-course').textContent = member.courseDetails || 'N/A';
        document.getElementById('modal-district').textContent = member.district;
        document.getElementById('modal-gender').textContent = member.gender;
        document.getElementById('modal-blood').textContent = member.bloodGroup || 'N/A';
        document.getElementById('modal-created').textContent = member.createdAt ? formatDate(member.createdAt) : 'N/A';

        // Reviewed by
        const reviewRow = document.getElementById('modal-reviewed-row');
        if (member.reviewedBy) {
            reviewRow.style.display = '';
            document.getElementById('modal-reviewed-by').textContent = member.reviewedBy;
        } else {
            reviewRow.style.display = 'none';
        }

        // Rejection reason
        const rejRow = document.getElementById('modal-rejection-row');
        if (member.rejectionReason) {
            rejRow.style.display = '';
            document.getElementById('modal-rejection-reason').textContent = member.rejectionReason;
        } else {
            rejRow.style.display = 'none';
        }

        // Show actions only for pending members
        const actions = document.getElementById('modal-actions');
        if (member.status === 'pending_review') {
            actions.classList.remove('hidden');
            document.getElementById('rejection-reason').value = '';

            // Set default validity date to May 31st of next year
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0-11, so 5 = June

            let defaultValidUntil;
            if (currentMonth >= 5) { // June to December
                defaultValidUntil = new Date(currentYear + 1, 4, 31); // May 31 next year
            } else { // January to May
                defaultValidUntil = new Date(currentYear, 4, 31); // May 31 current year
            }

            const dateString = defaultValidUntil.toISOString().split('T')[0];
            document.getElementById('validity-date').value = dateString;
        } else {
            actions.classList.add('hidden');

            // Display validity info if already set
            if (member.validUntil) {
                const validUntilDate = member.validUntil.toDate ? member.validUntil.toDate() : new Date(member.validUntil);
                const validRow = document.createElement('div');
                validRow.className = 'modal-detail-row';
                validRow.innerHTML = `
                    <span class="modal-detail-label">Valid Until:</span>
                    <span class="miv">${formatDate(validUntilDate)}</span>
                `;
                document.getElementById('modal-rejection-row').parentNode.insertBefore(validRow, document.getElementById('modal-rejection-row').nextSibling);
            }
        }

        // Show modal
        document.getElementById('member-modal').classList.remove('hidden');
        document.body.style.overflow = 'hidden';
    };

    window.closeMemberModal = function (e) {
        if (e && e.target !== e.currentTarget) return;
        document.getElementById('member-modal').classList.add('hidden');
        document.body.style.overflow = '';
        currentMemberDocId = null;
    };

    // ── Approve Member ──────────────────────────────────────────
    window.approveMember = async function () {
        if (!currentMemberDocId) return;

        const member = allMembers.find(m => m.id === currentMemberDocId);
        const validityDateInput = document.getElementById('validity-date').value;

        if (!validityDateInput) {
            showAdminToast('Please select a validity date.');
            return;
        }

        const btn = document.getElementById('btn-approve-member');
        btn.disabled = true;
        btn.textContent = 'Approving...';

        try {
            // Convert validity date to Firestore Timestamp
            const validityDate = new Date(validityDateInput);
            validityDate.setHours(23, 59, 59, 999); // Set to end of day

            // Generate sequential membership ID
            const membershipId = await generateMembershipId();

            await db.collection('members').doc(currentMemberDocId).update({
                status: 'active',
                membershipId: membershipId,
                validUntil: firebase.firestore.Timestamp.fromDate(validityDate),
                reviewedBy: currentUser.email,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            // Send automatic approval notifications (Email + SMS/WhatsApp)
            if (member) {
                sendApprovalNotifications(member);
            }

            closeMemberModal();
            showAdminToast('Member approved! Notification sent to ' + (member ? member.fullName : 'member'));

        } catch (err) {
            console.error('Approval error:', err);
            showAdminToast('Error approving member. Check console.');
        }

        btn.disabled = false;
        btn.textContent = '✓ Approve & Activate';
    };

    // ── Send Automatic Approval Notifications (Email + SMS/WhatsApp) ──────
    async function sendApprovalNotifications(member) {
        if (!member) return;

        const downloadLink = window.location.origin + window.location.pathname.replace('admin.html', '') + 'index.html#status-check';
        const memberName = member.fullName || 'Member';
        const phone = (member.phone || '').replace(/[^0-9]/g, '');

        const messageText = `Dear ${memberName}, Congratulations! Your ABVP Membership has been approved successfully. Download your Membership Card here: ${downloadLink} - ABVP Tamilnadu`;

        // 1. Email Notification
        if (member.email) {
            sendApprovalEmail(member);
        }

        // 2. Fast2SMS API Gateway (If API Key is provided)
        if (phone.length >= 10 && window.FAST2SMS_API_KEY) {
            try {
                await fetch('https://www.fast2sms.com/dev/bulkV2', {
                    method: 'POST',
                    headers: {
                        'authorization': window.FAST2SMS_API_KEY,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        route: 'q',
                        message: messageText,
                        language: 'english',
                        flash: 0,
                        numbers: phone.slice(-10)
                    })
                });
                console.log('Background SMS sent via Fast2SMS to:', phone);
            } catch (smsErr) {
                console.warn('Fast2SMS gateway status:', smsErr);
            }
        }

        // 3. WhatsApp 1-Click Messaging
        if (phone.length >= 10) {
            const cleanPhone = phone.length === 10 ? '91' + phone : phone;
            const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;
            setTimeout(() => {
                window.open(waUrl, '_blank');
            }, 300);
        }
    }

    async function sendApprovalEmail(member) {
        if (!member || !member.email) return;

        const downloadLink = window.location.origin + window.location.pathname.replace('admin.html', '') + 'index.html#status-check';
        const memberName = member.fullName || 'Member';

        const subject = "ABVP Tamil Nadu — Membership Approved!";
        const bodyMessage = `Dear ${memberName},\n\nCongratulations!\n\nYour ABVP Membership has been approved successfully.\n\nYou can download your Membership Card using the link below.\n\nDownload Card:\n${downloadLink}\n\nRegards,\nABVP Tamilnadu`;

        let sentViaEmailJS = false;

        if (typeof emailjs !== 'undefined' && window.EMAILJS_PUBLIC_KEY && window.EMAILJS_SERVICE_ID && window.EMAILJS_TEMPLATE_ID) {
            try {
                emailjs.init(window.EMAILJS_PUBLIC_KEY);
                await emailjs.send(
                    window.EMAILJS_SERVICE_ID,
                    window.EMAILJS_TEMPLATE_ID,
                    {
                        to_name: memberName,
                        to_email: member.email,
                        download_link: downloadLink,
                        message: bodyMessage
                    }
                );
                sentViaEmailJS = true;
                console.log('Approval email sent via EmailJS to:', member.email);
            } catch (err) {
                console.warn('EmailJS error, falling back to mailto:', err);
            }
        }

        // Fallback: If EmailJS is not configured or failed, open mail client pre-filled with the exact message
        if (!sentViaEmailJS) {
            const mailtoUrl = `mailto:${encodeURIComponent(member.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyMessage)}`;
            window.open(mailtoUrl, '_blank');
        }
    }

    // ── Reject Member ───────────────────────────────────────────
    window.rejectMember = async function () {
        if (!currentMemberDocId) return;

        const reason = document.getElementById('rejection-reason').value.trim();

        const btn = document.getElementById('btn-reject-member');
        btn.disabled = true;
        btn.textContent = 'Rejecting...';

        try {
            await db.collection('members').doc(currentMemberDocId).update({
                status: 'rejected',
                rejectionReason: reason || 'No reason provided',
                reviewedBy: currentUser.email,
                reviewedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            closeMemberModal();
            showAdminToast('Member registration rejected.');

        } catch (err) {
            console.error('Rejection error:', err);
            showAdminToast('Error rejecting member. Check console.');
        }

        btn.disabled = false;
        btn.textContent = '✕ Reject';
    };

    // ── Generate Sequential Membership ID ───────────────────────
    async function generateMembershipId() {
        const counterRef = db.collection('counters').doc('membershipId');

        return db.runTransaction(async (transaction) => {
            const counterDoc = await transaction.get(counterRef);

            let newCount;
            if (!counterDoc.exists) {
                newCount = 1;
                transaction.set(counterRef, { current: 1 });
            } else {
                newCount = (counterDoc.data().current || 0) + 1;
                transaction.update(counterRef, { current: newCount });
            }

            // Format: ABVP-TN-000001
            return 'ABVP-TN-' + String(newCount).padStart(6, '0');
        });
    }

    // ── Filters ─────────────────────────────────────────────────
    function setupFilters() {
        const searchInput = document.getElementById('search-members');
        const statusFilter = document.getElementById('filter-status');
        const typeFilter = document.getElementById('filter-type');

        function applyFilters() {
            const search = searchInput.value.trim().toLowerCase();
            const status = statusFilter.value;
            const type = typeFilter.value;

            let filtered = [...allMembers];

            if (search) {
                filtered = filtered.filter(m =>
                    (m.fullName || '').toLowerCase().includes(search) ||
                    (m.email || '').toLowerCase().includes(search) ||
                    (m.district || '').toLowerCase().includes(search) ||
                    (m.collegeName || '').toLowerCase().includes(search) ||
                    (m.courseDetails || '').toLowerCase().includes(search) ||
                    (m.phone || '').includes(search) ||
                    (m.membershipId || '').toLowerCase().includes(search)
                );
            }

            if (status !== 'all') {
                filtered = filtered.filter(m => m.status === status);
            }

            if (type !== 'all') {
                filtered = filtered.filter(m => m.institutionType === type);
            }

            renderMembersTable(filtered);
        }

        searchInput.addEventListener('input', applyFilters);
        statusFilter.addEventListener('change', applyFilters);
        typeFilter.addEventListener('change', applyFilters);
    }

    // ── CSV Export ───────────────────────────────────────────────
    window.exportCSV = function () {
        if (allMembers.length === 0) {
            showAdminToast('No data to export.');
            return;
        }

        const headers = ['Name', 'Email', 'Phone', 'Institution Type', 'College/School Name', 'Course Details', 'District', 'Gender', 'Blood Group', 'Status', 'Registered On'];

        const rows = allMembers.map(m => [
            m.fullName || '',
            m.email || '',
            m.phone || '',
            m.institutionType || '',
            m.collegeName || '',
            m.courseDetails || '',
            m.district || '',
            m.gender || '',
            m.bloodGroup || '',
            m.status || '',
            m.createdAt ? formatDate(m.createdAt) : ''
        ]);

        let csv = headers.join(',') + '\n';
        rows.forEach(row => {
            csv += row.map(cell => '"' + String(cell).replace(/"/g, '""') + '"').join(',') + '\n';
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = 'ABVP-Members-' + new Date().toISOString().slice(0, 10) + '.csv';
        link.click();

        showAdminToast('CSV exported successfully!');
    };

    // ── Admin Management (RBAC) ─────────────────────────────────
    async function loadAdminsList() {
        try {
            const snapshot = await db.collection('admins').get();
            const tbody = document.getElementById('admins-table-body');

            if (snapshot.empty) {
                tbody.innerHTML = '<tr><td colspan="5" class="empty-row">No admins found</td></tr>';
                return;
            }

            tbody.innerHTML = '';
            snapshot.forEach(doc => {
                const a = doc.data();
                const isSelf = doc.id === currentUser.email;

                tbody.innerHTML += `
                    <tr>
                        <td>${escHtml(doc.id)}</td>
                        <td><span class="status-badge ${a.role === 'super_admin' ? 'status-active' : 'status-pending_review'}">${a.role}</span></td>
                        <td>${escHtml(a.addedBy || 'system')}</td>
                        <td>${a.addedAt ? formatDate(a.addedAt) : 'N/A'}</td>
                        <td>${isSelf ? '<em>You</em>' : `<button class="btn-view" style="color:var(--danger);border-color:var(--danger);" onclick="removeAdmin('${doc.id}')">Remove</button>`}</td>
                    </tr>
                `;
            });
        } catch (err) {
            console.error('Load admins error:', err);
        }
    }

    window.addNewAdmin = async function () {
        const emailInput = document.getElementById('new-admin-email');
        const roleSelect = document.getElementById('new-admin-role');
        const email = emailInput.value.trim().toLowerCase();
        const role = roleSelect.value;

        if (!email || !email.includes('@')) {
            showAdminToast('Please enter a valid email address.');
            return;
        }

        try {
            // Check if already exists
            const existing = await db.collection('admins').doc(email).get();
            if (existing.exists) {
                showAdminToast('This email is already an admin.');
                return;
            }

            await db.collection('admins').doc(email).set({
                email: email,
                role: role,
                displayName: '',
                addedBy: currentUser.email,
                addedAt: firebase.firestore.FieldValue.serverTimestamp()
            });

            emailInput.value = '';
            showAdminToast('Admin added: ' + email);
            loadAdminsList();

        } catch (err) {
            console.error('Add admin error:', err);
            showAdminToast('Error adding admin. Check console.');
        }
    };

    window.removeAdmin = async function (email) {
        if (!confirm('Are you sure you want to remove ' + email + ' as admin?')) return;

        try {
            await db.collection('admins').doc(email).delete();
            showAdminToast('Admin removed: ' + email);
            loadAdminsList();
        } catch (err) {
            console.error('Remove admin error:', err);
            showAdminToast('Error removing admin. Check console.');
        }
    };

    // ── Helper Functions ────────────────────────────────────────
    function formatDate(ts) {
        if (!ts) return 'N/A';
        try {
            let d;
            if (ts.toDate && typeof ts.toDate === 'function') {
                d = ts.toDate();
            } else if (ts.seconds) {
                d = new Date(ts.seconds * 1000);
            } else {
                d = new Date(ts);
            }
            if (isNaN(d.getTime())) return 'N/A';
            return d.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return 'N/A';
        }
    }

    function statusLabel(status) {
        const labels = {
            'pending_review': 'Pending',
            'active': 'Active',
            'rejected': 'Rejected'
        };
        return labels[status] || status;
    }

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function showAdminToast(message) {
        const toast = document.getElementById('admin-toast');
        document.getElementById('admin-toast-msg').textContent = message;
        toast.classList.remove('hidden');

        setTimeout(() => {
            toast.classList.add('hidden');
        }, 4000);
    }

    // ── Remove Member (from Recent Registrations) ─────────────
    window.removeMember = async function (docId, memberName) {
        if (!confirm('Are you sure you want to remove "' + memberName + '"? This action cannot be undone.')) return;

        try {
            await db.collection('members').doc(docId).delete();
            showAdminToast('Member "' + memberName + '" removed successfully.');
        } catch (err) {
            console.error('Remove member error:', err);
            showAdminToast('Error removing member. Check console.');
        }
    };

    // ── Keyboard Shortcuts ──────────────────────────────────────
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeMemberModal();
        }
    });

})();
