// ============================================================
// Verify.js — ABVP Tamil Nadu Membership Verification
// Reads membership ID from URL, queries Firestore, shows result
// ============================================================

(function () {
    'use strict';

    // DOM Elements
    const loadingState = document.getElementById('loading-state');
    const noIdState = document.getElementById('no-id-state');
    const validState = document.getElementById('valid-state');
    const invalidState = document.getElementById('invalid-state');

    // Parse membership ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const membershipId = urlParams.get('id');

    /**
     * Show a specific state, hide all others
     */
    function showState(stateEl) {
        [loadingState, noIdState, validState, invalidState].forEach(el => {
            el.classList.add('hidden');
        });
        stateEl.classList.remove('hidden');
    }

    /**
     * Verify membership against Firestore
     */
    async function verifyMembership() {
        if (!membershipId || membershipId.trim() === '') {
            showState(noIdState);
            return;
        }

        try {
            // Query Firestore for active member with this membership ID
            const snapshot = await db.collection('members')
                .where('membershipId', '==', membershipId.trim())
                .where('status', '==', 'active')
                .limit(1)
                .get();

            if (snapshot.empty) {
                showState(invalidState);
                return;
            }

            // Found a valid active member
            const member = snapshot.docs[0].data();

            // Check validity date
            const today = new Date();
            let isValid = true;
            let validityStatus = 'Valid';
            let validityClass = 'validity-valid';

            if (member.validUntil) {
                const validUntilDate = member.validUntil.toDate ? member.validUntil.toDate() : new Date(member.validUntil);
                if (today > validUntilDate) {
                    isValid = false;
                    validityStatus = 'Expired';
                    validityClass = 'validity-expired';
                }
            }

            // If expired, show invalid state instead
            if (!isValid) {
                document.getElementById('invalid-reason').textContent = `This membership expired on ${formatDate(member.validUntil)}`;
                showState(invalidState);
                return;
            }

            // Populate the valid state
            document.getElementById('v-name').textContent = member.fullName || 'N/A';
            document.getElementById('v-institution').textContent = member.institutionType || 'N/A';
            document.getElementById('v-district').textContent = member.district || 'N/A';
            document.getElementById('v-id').textContent = member.membershipId;

            // Validity information
            if (member.validUntil) {
                const validUntilDate = member.validUntil.toDate ? member.validUntil.toDate() : new Date(member.validUntil);
                document.getElementById('v-validity').textContent = formatDate(validUntilDate);
                document.getElementById('v-validity-status').textContent = validityStatus;
                document.getElementById('v-validity-status').className = `validity-badge ${validityClass}`;
            }

            // Photo
            const photoEl = document.getElementById('v-photo');
            if (member.photoBase64) {
                photoEl.src = member.photoBase64;
            } else {
                photoEl.style.display = 'none';
            }

            // Member since date
            const sinceEl = document.getElementById('v-since');
            if (member.reviewedAt) {
                sinceEl.textContent = formatDate(member.reviewedAt);
            } else if (member.createdAt) {
                sinceEl.textContent = formatDate(member.createdAt);
            } else {
                sinceEl.textContent = 'N/A';
            }

            showState(validState);

        } catch (err) {
            console.error('Verification error:', err);
            showState(invalidState);
        }
    }

    // Run verification on page load
    verifyMembership();
})();
