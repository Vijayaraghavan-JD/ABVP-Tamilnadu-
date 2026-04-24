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
    const institutionType = document.getElementById('institutionType');
    const feeAmount = document.getElementById('fee-amount');
    const qrContainer = document.getElementById('qr-container');
    const paymentRefInput = document.getElementById('paymentRef');
    const submitBtn = document.getElementById('submit-btn');
    const photoInput = document.getElementById('photoInput');
    const photoPreview = document.getElementById('photoPreview');
    const membershipForm = document.getElementById('membership-form');
    const mainContent = document.getElementById('main-content');
    const cardView = document.getElementById('card-view');
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    const toastIcon = document.getElementById('toast-icon');
    const yearSpan = document.getElementById('year');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');

    // Status check elements
    const statusEmailInput = document.getElementById('statusEmail');
    const checkStatusBtn = document.getElementById('checkStatusBtn');
    const statusResult = document.getElementById('status-result');

    // Set current year
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();

    // Compressed photo data URL (set on upload)
    let compressedPhotoData = '';

    // ── Navbar Scrolled & Mobile Menu ────────────────────────────
    window.addEventListener('scroll', () => {
        if (window.scrollY > 50) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
    });

    mobileMenuBtn.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        const spans = mobileMenuBtn.querySelectorAll('span');
        if (navLinks.classList.contains('active')) {
            spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
            spans[1].style.opacity = '0';
            spans[2].style.transform = 'rotate(-45deg) translate(7px, -6px)';
        } else {
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        }
    });

    // Close mobile menu on link click
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.addEventListener('click', () => {
            navLinks.classList.remove('active');
            const spans = mobileMenuBtn.querySelectorAll('span');
            spans[0].style.transform = 'none';
            spans[1].style.opacity = '1';
            spans[2].style.transform = 'none';
        });
    });

    // ── Hero Carousel ───────────────────────────────────────────
    let currentSlide = 0;
    const slideCount = slides.length;
    const slideInterval = 5000;

    function nextSlide() {
        slides[currentSlide].classList.remove('active');
        currentSlide = (currentSlide + 1) % slideCount;
        slides[currentSlide].classList.add('active');
    }

    if (slideCount > 0) {
        setInterval(nextSlide, slideInterval);
    }

    // ── Dynamic Fee Calculator ──────────────────────────────────
    const feeMap = {
        'school': { display: '₹2', value: 2 },
        'college': { display: '₹5', value: 5 },
        'teacher': { display: '₹100', value: 100 }
    };

    institutionType.addEventListener('change', (e) => {
        const type = e.target.value;
        if (feeMap[type]) {
            feeAmount.textContent = feeMap[type].display;
            qrContainer.classList.add('active');
        }
        validateForm();
    });

    // ── Photo Upload Preview ────────────────────────────────────
    photoInput.addEventListener('change', async function (e) {
        const file = e.target.files[0];
        if (file) {
            try {
                // Compress the image for Firestore storage
                compressedPhotoData = await compressImage(file, 400, 500, 0.7);
                photoPreview.src = compressedPhotoData;
                photoPreview.classList.remove('hidden');
                document.getElementById('card-photo').src = compressedPhotoData;
            } catch (err) {
                console.error('Image compression error:', err);
                // Fallback: use raw FileReader
                const reader = new FileReader();
                reader.onload = function (event) {
                    compressedPhotoData = event.target.result;
                    photoPreview.src = compressedPhotoData;
                    photoPreview.classList.remove('hidden');
                    document.getElementById('card-photo').src = compressedPhotoData;
                };
                reader.readAsDataURL(file);
            }
            validateForm();
        }
    });

    // ── Payment Reference Validation ────────────────────────────
    paymentRefInput.addEventListener('input', validateForm);

    function validateForm() {
        const hasInstitution = institutionType.value !== '';
        const hasPaymentRef = paymentRefInput.value.trim().length >= 3;
        const hasPhoto = compressedPhotoData !== '';

        submitBtn.disabled = !(hasInstitution && hasPaymentRef && hasPhoto);
    }

    // ── Loading Overlay ─────────────────────────────────────────
    function showLoading(message) {
        loadingText.textContent = message || 'Processing...';
        loadingOverlay.classList.remove('hidden');
    }

    function hideLoading() {
        loadingOverlay.classList.add('hidden');
    }

    // ── Toast Notification ──────────────────────────────────────
    function showToast(message, type = 'success') {
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

    // ── Form Submission → Firestore ─────────────────────────────
    membershipForm.addEventListener('submit', async function (e) {
        e.preventDefault();

        const email = document.getElementById('email').value.trim().toLowerCase();
        const paymentRef = paymentRefInput.value.trim();

        if (!compressedPhotoData) {
            showToast('Please upload a photo', 'error');
            return;
        }

        if (!paymentRef || paymentRef.length < 3) {
            showToast('Please enter a valid payment reference number', 'error');
            return;
        }

        showLoading('Checking for existing registration...');

        try {
            // Check for duplicate email
            const existingQuery = await db.collection('members')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                hideLoading();
                showToast('This email is already registered. Use "Check Status" to view your registration.', 'error');
                return;
            }

            showLoading('Submitting your registration...');

            const type = institutionType.value;
            const fee = feeMap[type] ? feeMap[type].value : 0;

            // Calculate validity: Valid until May 31st of next academic year
            const today = new Date();
            const currentYear = today.getFullYear();
            const currentMonth = today.getMonth(); // 0-11, so 5 = June

            let validUntilDate;
            if (currentMonth >= 5) { // June to December
                // Valid until May 31st of next year
                validUntilDate = new Date(currentYear + 1, 4, 31); // Month is 0-indexed, so 4 = May
            } else { // January to May
                // Valid until May 31st of current year
                validUntilDate = new Date(currentYear, 4, 31);
            }

            // Build member document
            const memberData = {
                fullName: document.getElementById('fullName').value.trim(),
                email: email,
                phone: document.getElementById('phone').value.trim(),
                district: document.getElementById('district').value.trim(),
                institutionType: type,
                gender: document.getElementById('gender').value,
                bloodGroup: document.getElementById('bloodGroup').value.trim() || 'N/A',
                photoBase64: compressedPhotoData,
                feeAmount: fee,
                paymentRef: paymentRef,
                status: 'pending_review',
                membershipId: null,
                rejectionReason: null,
                reviewedBy: null,
                reviewedAt: null,
                validUntil: firebase.firestore.Timestamp.fromDate(validUntilDate),
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            };

            // Save to Firestore
            await db.collection('members').add(memberData);

            hideLoading();
            showToast('Registration submitted successfully! Your application is under review.');

            // Reset form
            membershipForm.reset();
            photoPreview.classList.add('hidden');
            photoPreview.src = '';
            compressedPhotoData = '';
            qrContainer.classList.remove('active');
            feeAmount.textContent = '₹0';
            submitBtn.disabled = true;

            // Scroll to status check section
            setTimeout(() => {
                document.getElementById('status-check').scrollIntoView({ behavior: 'smooth' });
            }, 2000);

        } catch (err) {
            hideLoading();
            console.error('Registration error:', err);
            showToast('Registration failed. Please try again.', 'error');
        }
    });

    // ── Status Check ────────────────────────────────────────────
    checkStatusBtn.addEventListener('click', checkRegistrationStatus);
    statusEmailInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkRegistrationStatus();
    });

    async function checkRegistrationStatus() {
        const email = statusEmailInput.value.trim().toLowerCase();

        if (!email || !email.includes('@')) {
            showToast('Please enter a valid email address', 'error');
            return;
        }

        checkStatusBtn.disabled = true;
        checkStatusBtn.textContent = 'Checking...';

        try {
            const snapshot = await db.collection('members')
                .where('email', '==', email)
                .limit(1)
                .get();

            if (snapshot.empty) {
                showStatusResult('not_found');
                checkStatusBtn.disabled = false;
                checkStatusBtn.textContent = 'Check Status';
                return;
            }

            const member = snapshot.docs[0].data();
            showStatusResult(member.status, member);

        } catch (err) {
            console.error('Status check error:', err);
            showToast('Error checking status. Please try again.', 'error');
        }

        checkStatusBtn.disabled = false;
        checkStatusBtn.textContent = 'Check Status';
    }

    function showStatusResult(status, member = null) {
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
                        <span class="sdv">${member.fullName}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Institution</span>
                        <span class="sdv" style="text-transform:capitalize">${member.institutionType}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Registered On</span>
                        <span class="sdv">${member.createdAt ? formatDate(member.createdAt) : 'N/A'}</span>
                    </div>
                    <div class="status-detail-item">
                        <span class="sdl">Payment Ref</span>
                        <span class="sdv">${member.paymentRef || 'N/A'}</span>
                    </div>
                    ${member.membershipId ? `
                    <div class="status-detail-item full-width">
                        <span class="sdl">Membership ID</span>
                        <span class="sdv membership-id-highlight">${member.membershipId}</span>
                    </div>` : ''}
                </div>
            `;
        }

        if (config.showCard && member) {
            html += `
                <button class="btn btn-primary" onclick="showMembershipCard()" style="margin-top:20px;">
                    View & Download Membership Card
                </button>
            `;

            // Pre-populate card data for when button is clicked
            window._activeMember = member;
        }

        html += '</div>';
        statusResult.innerHTML = html;
    }

    // ── Show Membership Card (for active members) ───────────────
    window.showMembershipCard = function () {
        const member = window._activeMember;
        if (!member) return;

        // Populate card
        document.getElementById('card-name').textContent = member.fullName;
        document.getElementById('card-institution').textContent = member.institutionType;
        document.getElementById('card-district').textContent = member.district;
        document.getElementById('card-email').textContent = member.email;
        document.getElementById('card-gender').textContent = member.gender;
        document.getElementById('card-blood').textContent = member.bloodGroup || 'N/A';
        document.getElementById('card-phone').textContent = member.phone;
        document.getElementById('card-id').textContent = member.membershipId || 'N/A';

        // Photo
        if (member.photoBase64) {
            document.getElementById('card-photo').src = member.photoBase64;
        }

        // Generate QR Code for verification
        const qrContainer = document.getElementById('card-qr-code');
        qrContainer.innerHTML = ''; // Clear previous
        if (member.membershipId) {
            const verifyUrl = window.location.origin + window.location.pathname.replace('index.html', '') + 'verify.html?id=' + encodeURIComponent(member.membershipId);
            new QRCode(qrContainer, {
                text: verifyUrl,
                width: 80,
                height: 80,
                colorDark: '#000080',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        }

        // Switch to card view
        mainContent.classList.add('hidden');
        cardView.classList.remove('hidden');
        window.scrollTo(0, 0);
    };

    // ── Download Membership Card ────────────────────────────────
    const downloadImgBtn = document.getElementById('download-img-btn');
    const downloadPdfBtn = document.getElementById('download-pdf-btn');
    const cardToRender = document.getElementById('membership-card-render');

    downloadImgBtn.addEventListener('click', () => {
        downloadCardAsImage();
    });

    downloadPdfBtn.addEventListener('click', () => {
        downloadCardAsPdf();
    });

    async function downloadCardAsImage() {
        const originalText = downloadImgBtn.innerHTML;
        downloadImgBtn.innerHTML = 'Generating...';
        downloadImgBtn.disabled = true;

        try {
            const canvas = await html2canvas(cardToRender, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
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
        const originalText = downloadPdfBtn.innerHTML;
        downloadPdfBtn.innerHTML = 'Generating PDF...';
        downloadPdfBtn.disabled = true;

        try {
            const canvas = await html2canvas(cardToRender, {
                scale: 2,
                useCORS: true,
                backgroundColor: '#ffffff',
                logging: false
            });

            const { jsPDF } = window.jspdf;

            // Card dimensions (approximately 8.5" x 5.4" for standard card)
            const imgWidth = 210; // A4 width in mm
            const imgHeight = (canvas.height * imgWidth) / canvas.width;

            const pdf = new jsPDF({
                orientation: 'landscape',
                unit: 'mm',
                format: [210, 148] // A5 landscape
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

    returnBtn.addEventListener('click', () => {
        membershipForm.reset();
        photoPreview.classList.add('hidden');
        photoPreview.src = '';
        compressedPhotoData = '';
        qrContainer.classList.remove('active');
        feeAmount.textContent = '₹0';
        submitBtn.disabled = true;

        cardView.classList.add('hidden');
        mainContent.classList.remove('hidden');
        window.scrollTo(0, 0);
    });

    // ── Smooth Scrolling ────────────────────────────────────────
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;

            const targetElement = document.querySelector(targetId);

            if (targetElement && !mainContent.classList.contains('hidden')) {
                e.preventDefault();
                targetElement.scrollIntoView({ behavior: 'smooth' });
            }
        });
    });

})();
