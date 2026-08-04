// ============================================================
// script.js — ABVP Tamil Nadu Member Portal
// Handles registration, Firestore storage, status check,
// membership card generation, and QR code
// ============================================================

(function () {
    'use strict';

    // ── DOM Elements ────────────────────────────────────────────
    const navbar = document.getElementById('navbar');
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const navLinks = document.getElementById('nav-links');
    const slides = document.querySelectorAll('.carousel-slide');

    // Registration Form Elements
    const membershipForm = document.getElementById('membership-form');
    const institutionType = document.getElementById('institutionType');
    const submitBtn = document.getElementById('submit-btn');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    const phoneInput = document.getElementById('phone');

    // Views & Overlay Elements
    const mainContent = document.getElementById('main-content');
    const cardView = document.getElementById('card-view');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    const yearSpan = document.getElementById('year');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // Status Check Elements
    const statusEmailInput = document.getElementById('statusEmail');
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    const statusResult = document.getElementById('status-result');

    // Set current year in footer
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // Compressed photo base64
    let compressedPhotoData = '';

    // ── Restrict Phone Input (Numbers only, Max 10 digits) ────────
    if (phoneInput) {
        phoneInput.addEventListener('input', function () {
            this.value = this.value.replace(/[^0-9]/g, '').slice(0, 10);
        });
    }

    // ── Navbar Scrolled & Mobile Menu Toggle ──────────────────────
    window.addEventListener('scroll', () => {
        if (navbar) {
            if (window.scrollY > 50) {
                navbar.classList.add('scrolled');
            } else {
                navbar.classList.remove('scrolled');
            }
        }
    });

    if (mobileMenuBtn && navLinks) {
        mobileMenuBtn.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            const spans = mobileMenuBtn.querySelectorAll('span');
            if (navLinks.classList.contains('active')) {
                if (spans[0]) spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
                if (spans[1]) spans[1].style.opacity = '0';
                if (spans[2]) spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
            } else {
                if (spans[0]) spans[0].style.transform = 'none';
                if (spans[1]) spans[1].style.opacity = '1';
                if (spans[2]) spans[2].style.transform = 'none';
            }
        });

        document.querySelectorAll('.nav-links a').forEach(link => {
            link.addEventListener('click', () => {
                navLinks.classList.remove('active');
                const spans = mobileMenuBtn.querySelectorAll('span');
                if (spans[0]) spans[0].style.transform = 'none';
                if (spans[1]) spans[1].style.opacity = '1';
                if (spans[2]) spans[2].style.transform = 'none';
            });
        });
    }

    // ── Hero Carousel ───────────────────────────────────────────
    let currentSlide = 0;
    const slideCount = slides ? slides.length : 0;
    const slideInterval = 5000;

    function nextSlide() {
        if (!slides || slides.length === 0) return;
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slideCount;
        slides[currentSlide].classList.add('active');
    }

    if (slideCount > 0) {
        setInterval(nextSlide, slideInterval);
    }

    // ── Photo Upload Preview & Base64 Compression ───────────────
    function compressImageFile(file, maxDimension = 500, quality = 0.7) {
        return new Promise((resolve, reject) => {
            if (!file) return resolve('');

            const reader = new FileReader();
            reader.onload = function (e) {
                const img = new Image();
                img.onload = function () {
                    try {
                        let width = img.width || 300;
                        let height = img.height || 300;

                        if (width > maxDimension || height > maxDimension) {
                            if (width > height) {
                                height = Math.round((height * maxDimension) / width);
                                width = maxDimension;
                            } else {
                                width = Math.round((width * maxDimension) / height);
                                height = maxDimension;
                            }
                        }

                        const canvas = document.createElement('canvas');
                        canvas.width = width;
                        canvas.height = height;
                        const ctx = canvas.getContext('2d');
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, width, height);
                        ctx.drawImage(img, 0, 0, width, height);

                        const dataUrl = canvas.toDataURL('image/jpeg', quality);
                        resolve(dataUrl);
                    } catch (err) {
                        console.warn('Canvas compression fallback:', err);
                        resolve(e.target.result);
                    }
                };
                img.onerror = function () {
                    // Fallback to raw base64 dataUrl if canvas image object load fails
                    resolve(e.target.result);
                };
                img.src = e.target.result;
            };
            reader.onerror = function (err) {
                console.error('FileReader error:', err);
                reject(new Error('Failed to read image file'));
            };
            reader.readAsDataURL(file);
        });
    }

    async function ensureSmallPhotoData(file, currentBase64) {
        let photoData = currentBase64;
        if (file) {
            try {
                photoData = await compressImageFile(file, 500, 0.7);
            } catch (err) {
                console.warn('Compression retry:', err);
            }
        }
        return photoData;
    }

    if (photoInput) {
        photoInput.addEventListener('change', async function (e) {
            const file = e.target.files[0];
            if (file) {
                try {
                    compressedPhotoData = await compressImageFile(file, 500, 0.7);
                    if (photoPreview) {
                        photoPreview.src = compressedPhotoData;
                        photoPreview.classList.remove('hidden');
                    }
                    const cardPhotoEl = document.getElementById('card-photo');
                    if (cardPhotoEl) cardPhotoEl.src = compressedPhotoData;
                } catch (err) {
                    console.error('Image upload error:', err);
                    showToast('Failed to process image. Please try another image.', 'error');
                }
            }
        });
    }

    // ── Loading Overlay Helper ──────────────────────────────────
    function showLoading(message) {
        if (loadingText) loadingText.textContent = message || 'Processing...';
        if (loadingOverlay) loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        if (loadingOverlay) loadingOverlay.classList.add('hidden');
    }

    // ── Toast Notification Helper ───────────────────────────────
    function showToast(message, type = 'success') {
        if (!toast || !toastMessage || !toastIcon) return;
        toastMessage.textContent = message;
        toastIcon.textContent = type === 'success' ? '✓' : '✕';
        toastIcon.className = 'toast-icon ' + (type === 'success' ? 'success-icon' : 'error-icon');

        toast.classList.remove('hidden');
        void toast.offsetWidth;
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.classList.add('hidden'), 500);
        }, 4000);
    }

    // ── Registration Form Submission → Firestore ────────────────
    if (membershipForm) {
        membershipForm.addEventListener('submit', async function (e) {
            e.preventDefault();

            const fullName = document.getElementById('fullName').value.trim();
            const email = document.getElementById('email').value.trim().toLowerCase();
            const phone = document.getElementById('phone').value.trim();
            const district = document.getElementById('district').value.trim();
            const type = institutionType ? institutionType.value : '';
            const instName = document.getElementById('institutionName').value.trim();
            const course = document.getElementById('courseDetails').value.trim();
            const gender = document.getElementById('gender').value;
            const blood = document.getElementById('bloodGroup').value.trim();

            const uploadedFile = photoInput && photoInput.files ? photoInput.files[0] : null;
            if (!compressedPhotoData && uploadedFile) {
                try {
                    compressedPhotoData = await compressImageFile(uploadedFile, 500, 0.7);
                } catch (err) {
                    console.warn('Fast photo compression error:', err);
                }
            }

            if (!compressedPhotoData) {
                showToast('Please upload your photo', 'error');
                return;
            }

            if (phone.length !== 10) {
                showToast('Please enter a valid 10-digit mobile number', 'error');
                return;
            }

            showLoading('Submitting your registration...');

            try {
                // Fast email check using indexed single-field query with fallback
                let alreadyRegistered = false;
                try {
                    const checkSnap = await db.collection('members').where('email', '==', email).limit(1).get();
                    if (!checkSnap.empty) {
                        alreadyRegistered = true;
                    }
                } catch (e) {
                    // Fallback to full fetch if index query encounters any restriction
                    const snapshot = await db.collection('members').get();
                    snapshot.forEach(doc => {
                        const data = doc.data();
                        if (data.email && data.email.toLowerCase() === email) {
                            alreadyRegistered = true;
                        }
                    });
                }

                if (alreadyRegistered) {
                    hideLoading();
                    showToast('This email is already registered. Use "Check Status" to view your registration.', 'error');
                    return;
                }

                // Academic year validity date (May 31st)
                const today = new Date();
                const currentYear = today.getFullYear();
                const currentMonth = today.getMonth();

                let validUntilDate;
                if (currentMonth >= 5) { // June to December
                    validUntilDate = new Date(currentYear + 1, 4, 31);
                } else { // January to May
                    validUntilDate = new Date(currentYear, 4, 31);
                }

                // Member document schema matching Firestore & Admin Panel
                const memberData = {
                    fullName: fullName,
                    email: email,
                    phone: phone,
                    district: district,
                    institutionType: type,
                    institutionName: instName,
                    collegeName: instName,
                    courseDetails: course,
                    gender: gender,
                    bloodGroup: blood || 'N/A',
                    photoBase64: compressedPhotoData,
                    status: 'pending_review',
                    membershipId: null,
                    rejectionReason: null,
                    reviewedBy: null,
                    reviewedAt: null,
                    validUntil: firebase.firestore.Timestamp.fromDate(validUntilDate),
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                };

                // Fast add to Firestore collection
                await db.collection('members').add(memberData);

                hideLoading();
                showToast('Registration submitted successfully! Your application is under review by Admin.', 'success');

                // Reset form & photo preview
                membershipForm.reset();
                if (photoPreview) {
                    photoPreview.classList.add('hidden');
                    photoPreview.src = '';
                }
                compressedPhotoData = '';

                // Scroll down to Check Status section after 1.5 seconds
                setTimeout(() => {
                    const statusSec = document.getElementById('status-check');
                    if (statusSec) statusSec.scrollIntoView({ behavior: 'smooth' });
                }, 1500);

            } catch (err) {
                hideLoading();
                console.error('Registration error:', err);
                showToast('Registration failed: ' + (err.message || 'Please try again'), 'error');
            }
        });
    }

    // ── Check Registration Status ───────────────────────────────
    if (checkStatusBtn) {
        checkStatusBtn.addEventListener('click', checkRegistrationStatus);
    }
    if (statusEmailInput) {
        statusEmailInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') checkRegistrationStatus();
        });
    }

    async function checkRegistrationStatus() {
        const email = statusEmailInput ? statusEmailInput.value.trim().toLowerCase() : '';

        if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        if (checkStatusBtn) {
            checkStatusBtn.disabled = true;
            checkStatusBtn.textContent = 'Checking...';
        }

        try {
            // Index-independent query matching all documents
            const snapshot = await db.collection('members').get();
            let foundMember = null;

            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.email && data.email.toLowerCase() === email) {
                    foundMember = data;
                }
            });

            if (!foundMember) {
                showStatusResult('not_found');
            } else {
                showStatusResult(foundMember.status, foundMember);
            }

        } catch (err) {
            console.error('Status check error:', err);
            showToast('Error checking status: ' + (err.message || 'Please try again'), 'error');
        }

        if (checkStatusBtn) {
            checkStatusBtn.disabled = false;
            checkStatusBtn.textContent = 'Check Status';
        }
    }

    function showStatusResult(status, member = null) {
        if (!statusResult) return;
        statusResult.classList.remove('hidden');

        const statusConfig = {
            'not_found': {
                icon: '🔍',
                badge: 'not-found',
                badgeText: 'Not Found',
                title: 'No Registration Found',
                description: 'No registration was found for this email address. Please register using the form above.',
                showCard: false
            },
            'pending_review': {
                icon: '⏳',
                badge: 'pending',
                badgeText: 'Pending Review',
                title: 'Registration Under Review',
                description: 'Your registration has been submitted and is currently being reviewed by the admin. You will be notified once it is approved.',
                showCard: false
            },
            'active': {
                icon: '✅',
                badge: 'active',
                badgeText: 'Active Member',
                title: 'Membership Active!',
                description: 'Congratulations! Your membership has been approved. You can view and download your membership card below.',
                showCard: true
            },
            'rejected': {
                icon: '❌',
                badge: 'rejected',
                badgeText: 'Rejected',
                title: 'Registration Rejected',
                description: member && member.rejectionReason
                    ? `Your registration was rejected. Reason: ${member.rejectionReason}. You may re-register after addressing the issue.`
                    : 'Your registration was rejected. Please contact ABVP Tamil Nadu for more information.',
                showCard: false
            }
        };

        const config = statusConfig[status] || statusConfig['not_found'];

        let html = `
            <div class="status-result-inner">
                <div class="status-icon-large">${config.icon}</div>
                <span class="status-badge badge-${config.badge}">${config.badgeText}</span>
                <h3>${config.title}</h3>
                <p>${config.description}</p>
        `;

        if (member && status !== 'not_found') {
            html += `
                <div class="status-details-grid">
                    <div class="status-detail-item">
                        <span class="sdl">Name</span>
                        <span class="sdv">${escHtml(member.fullName)}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Institution Type</span>
                        <span class="sdv" style="text-transform:capitalize">${escHtml(member.institutionType)}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Institution Name</span>
                        <span class="sdv">${escHtml(member.institutionName || member.collegeName || 'N/A')}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Course Details</span>
                        <span class="sdv">${escHtml(member.courseDetails || 'N/A')}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Registered On</span>
                        <span class="sdv">${member.createdAt ? formatDate(member.createdAt) : 'N/A'}</span>
                    </div>
                </div>
            `;
        }

        if (config.showCard && member) {
            html += `
                <button class="btn btn-primary" onclick="showMembershipCard()" style="margin-top:20px;">
                    View & Download Membership Card
                </button>
            `;

            window._activeMember = member;
        }

        html += '</div>';
        statusResult.innerHTML = html;
    }

    function formatDate(timestamp) {
        if (!timestamp) return 'N/A';
        try {
            const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
            return date.toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch (e) {
            return 'N/A';
        }
    }

    // ── Show Membership Card (for active members) ───────────────
    window.showMembershipCard = function () {
        const member = window._activeMember;
        if (!member) return;

        const elName = document.getElementById('card-name');
        const elInst = document.getElementById('card-institution');
        const elDist = document.getElementById('card-district');
        const elEmail = document.getElementById('card-email');
        const elGender = document.getElementById('card-gender');
        const elBlood = document.getElementById('card-blood');
        const elPhone = document.getElementById('card-phone');
        const elId = document.getElementById('card-id');

        if (elName) elName.textContent = member.fullName;
        if (elInst) elInst.textContent = member.institutionName || member.collegeName || member.institutionType;
        if (elDist) elDist.textContent = member.district;
        if (elEmail) elEmail.textContent = member.email;
        if (elGender) elGender.textContent = member.gender;
        if (elBlood) elBlood.textContent = member.bloodGroup || 'N/A';
        if (elPhone) elPhone.textContent = member.phone;
        if (elId) elId.textContent = member.membershipId || member.email || '';

        const elPhoto = document.getElementById('card-photo');
        const photoBox = document.querySelector('.member-photo-box');
        if (member.photoBase64) {
            if (elPhoto) elPhoto.src = member.photoBase64;
            if (photoBox) {
                photoBox.style.backgroundImage = `url("${member.photoBase64}")`;
                photoBox.style.backgroundSize = 'cover';
                photoBox.style.backgroundPosition = 'center';
                photoBox.style.backgroundRepeat = 'no-repeat';
            }
        }

        const qrContainer = document.getElementById('card-qr-code');
        if (qrContainer) {
            qrContainer.innerHTML = '';
            const lookupKey = member.membershipId || member.email;
            if (lookupKey && typeof QRCode !== 'undefined') {
                const verifyUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'verify.html?id=' + encodeURIComponent(lookupKey);
                new QRCode(qrContainer, {
                    text: verifyUrl,
                    width: 80,
                    height: 80,
                    colorDark: '#000080',
                    colorLight: '#ffffff',
                    correctLevel: QRCode.CorrectLevel.M
                });
            }
        }

        if (mainContent) mainContent.classList.add('hidden');
        if (cardView) cardView.classList.remove('hidden');
        window.scrollTo(0, 0);
    };

    // ── Download Membership Card ────────────────────────────────
    const downloadImgBtn = document.getElementById('download-img-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const cardToRender = document.getElementById('membership-card-render');

    if (downloadImgBtn) {
        downloadImgBtn.addEventListener('click', () => {
            downloadCardAsImage();
        });
    }

    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', () => {
            downloadCardAsPdf();
        });
    }

    function setupClonedCardForDownload(clonedDoc) {
        const clonedCard = clonedDoc.getElementById('membership-card-render');
        if (clonedCard) {
            clonedCard.style.width = '900px';
            clonedCard.style.height = '506.25px';
            clonedCard.style.maxWidth = 'none';
            clonedCard.style.transform = 'none';
        }
        const clonedPhotoBox = clonedDoc.querySelector('.member-photo-box');
        const clonedPhotoImg = clonedDoc.getElementById('card-photo');
        if (clonedPhotoBox && clonedPhotoImg && clonedPhotoImg.src) {
            clonedPhotoBox.style.backgroundImage = `url("${clonedPhotoImg.src}")`;
            clonedPhotoBox.style.backgroundSize = 'cover';
            clonedPhotoBox.style.backgroundPosition = 'center';
            clonedPhotoBox.style.backgroundRepeat = 'no-repeat';
            clonedPhotoImg.style.display = 'none';
        }
    }

    async function downloadCardAsImage() {
        if (!downloadImgBtn || !cardToRender) return;
        const originalText = downloadImgBtn.innerHTML;
        downloadImgBtn.innerHTML = 'Generating...';
        downloadImgBtn.disabled = true;

        try {
            const canvas = await html2canvas(cardToRender, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1000,
                onclone: setupClonedCardForDownload
            });
            const imgData = canvas.toDataURL('image/png');
            const link = document.createElement('a');
            link.download = 'ABVP-Membership-Card.png';
            link.href = imgData;
            link.click();

            showToast('Card downloaded as image!', 'success');
            downloadImgBtn.innerHTML = originalText;
            downloadImgBtn.disabled = false;
        } catch (err) {
            console.error("Error generating card image:", err);
            showToast('Error generating card image. Please try again.', 'error');
            downloadImgBtn.innerHTML = originalText;
            downloadImgBtn.disabled = false;
        }
    }

    async function downloadCardAsPdf() {
        if (!downloadPdfBtn || !cardToRender) return;
        const originalText = downloadPdfBtn.innerHTML;
        downloadPdfBtn.innerHTML = 'Generating PDF...';
        downloadPdfBtn.disabled = true;

        try {
            const canvas = await html2canvas(cardToRender, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false,
                windowWidth: 1000,
                onclone: setupClonedCardForDownload
            });

            const { jsPDF } = window.jspdf;

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [210, 148]
            });

            const imgData = canvas.toDataURL('image/png');
            pdf.addImage(imgData, 'PNG', 10, 10, 190, (190 * canvas.height) / canvas.width);
            pdf.save('ABVP-Membership-Card.pdf');

            showToast('Card downloaded as PDF!', 'success');
            downloadPdfBtn.innerHTML = originalText;
            downloadPdfBtn.disabled = false;
        } catch (err) {
            console.error("Error generating PDF:", err);
            showToast('Error generating PDF. Please try again.', 'error');
            downloadPdfBtn.innerHTML = originalText;
            downloadPdfBtn.disabled = false;
        }
    }

    // ── Return to Home ──────────────────────────────────────────
    const returnBtn = document.getElementById('return-btn');

    if (returnBtn) {
        returnBtn.addEventListener('click', () => {
            if (membershipForm) membershipForm.reset();
            if (photoPreview) {
                photoPreview.classList.add('hidden');
                photoPreview.src = '';
            }
            compressedPhotoData = '';

            if (cardView) cardView.classList.add('hidden');
            if (mainContent) mainContent.classList.remove('hidden');
            window.scrollTo(0, 0);
        });
    }

    // ── Smooth Scrolling ────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement && mainContent && !mainContent.classList.contains('hidden')) {
                e.preventDefault();
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

    function escHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

})();
