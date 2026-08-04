// ============================================================
// Verify.js — ABVP Tamil Nadu Membership Verification
// Reads membership ID/email/docId from URL, queries Firestore, shows result
// ============================================================

(function () {
    'use strict';

    // DOM Elements
    const loadingState = document.getElementById('loading-state');
    const noIdState = document.getElementById('no-id-state');
    const validState = document.getElementById('valid-state');
    const invalidState = document.getElementById('invalid-state');

    // Parse ID from URL parameter
    const urlParams = new URLSearchParams(window.location.search);
    const searchId = urlParams.get('id');

    function showState(stateEl) {
        [loadingState, noIdState, validState, invalidState].forEach(el => {
            if (el) el.classList.add('hidden');
        });
        if (stateEl) stateEl.classList.remove('hidden');
    }

    async function verifyMembership() {
        if (!searchId || searchId.trim() === '') {
            showState(noIdState);
            return;
        }

        const cleanId = searchId.trim().toLowerCase();

        try {
            // Index-independent query across members collection
            const snapshot = await db.collection('members').get();
            let foundMember = null;

            snapshot.forEach(doc => {
                const data = doc.data();
                const memId = (data.membershipId || '').toLowerCase();
                const memEmail = (data.email || '').toLowerCase();
                const docId = doc.id.toLowerCase();

                if (memId === cleanId || memEmail === cleanId || docId === cleanId) {
                    foundMember = data;
                }
            });

            if (!foundMember) {
                document.getElementById('invalid-reason').textContent = 'No registration record was found for this code or URL. Please verify the QR code.';
                showState(invalidState);
                return;
            }

            // Check member status
            if (foundMember.status === 'pending_review') {
                document.getElementById('invalid-reason').textContent = 'This membership application has been submitted and is currently pending review/approval by the Admin.';
                showState(invalidState);
                return;
            }

            if (foundMember.status === 'rejected') {
                document.getElementById('invalid-reason').textContent = foundMember.rejectionReason
                    ? `This registration was rejected by Admin. Reason: ${foundMember.rejectionReason}`
                    : 'This membership registration was rejected by Admin.';
                showState(invalidState);
                return;
            }

            if (foundMember.status !== 'active') {
                document.getElementById('invalid-reason').textContent = 'This membership status is invalid or inactive.';
                showState(invalidState);
                return;
            }

            // Check validity date for active members
            const today = new Date();
            let isExpired = false;

            if (foundMember.validUntil) {
                const validUntilDate = foundMember.validUntil.toDate ? foundMember.validUntil.toDate() : new Date(foundMember.validUntil);
                if (today > validUntilDate) {
                    isExpired = true;
                    document.getElementById('invalid-reason').textContent = `This membership expired on ${formatDate(validUntilDate)}.`;
                }
            }

            if (isExpired) {
                showState(invalidState);
                return;
            }

            // Member is active and valid! Populate verified state
            const elName = document.getElementById('v-name');
            const elInst = document.getElementById('v-institution');
            const elInstName = document.getElementById('v-institution-name');
            const elCourse = document.getElementById('v-course-details');
            const elDistrict = document.getElementById('v-district');
            const elPhoto = document.getElementById('v-photo');
            const elSince = document.getElementById('v-since');
            const elValidity = document.getElementById('v-validity');
            const elStatus = document.getElementById('v-validity-status');

            if (elName) elName.textContent = foundMember.fullName || 'N/A';
            if (elInst) elInst.textContent = foundMember.institutionType || 'N/A';
            if (elInstName) elInstName.textContent = foundMember.institutionName || foundMember.collegeName || 'N/A';
            if (elCourse) elCourse.textContent = foundMember.courseDetails || 'N/A';
            if (elDistrict) elDistrict.textContent = foundMember.district || 'N/A';

            if (foundMember.photoBase64 && elPhoto) {
                elPhoto.src = foundMember.photoBase64;
                elPhoto.style.display = 'inline-block';
            } else if (elPhoto) {
                elPhoto.style.display = 'none';
            }

            if (elValidity && foundMember.validUntil) {
                const validUntilDate = foundMember.validUntil.toDate ? foundMember.validUntil.toDate() : new Date(foundMember.validUntil);
                elValidity.textContent = formatDate(validUntilDate);
            }

            if (elStatus) {
                elStatus.textContent = 'Active / Valid';
                elStatus.style.color = '#10B981';
                elStatus.style.fontWeight = 'bold';
            }

            if (elSince) {
                if (foundMember.reviewedAt) {
                    elSince.textContent = formatDate(foundMember.reviewedAt);
                } else if (foundMember.createdAt) {
                    elSince.textContent = formatDate(foundMember.createdAt);
                } else {
                    elSince.textContent = 'N/A';
                }
            }

            showState(validState);

        } catch (err) {
            console.error('Verification error:', err);
            document.getElementById('invalid-reason').textContent = 'An error occurred while verifying the membership. Please try again.';
            showState(invalidState);
        }
    }

    function formatDate(ts) {
        if (!ts) return 'N/A';
        try {
            const d = ts.toDate ? ts.toDate() : new Date(ts);
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

    // Run verification on page load
    verifyMembership();
})();
