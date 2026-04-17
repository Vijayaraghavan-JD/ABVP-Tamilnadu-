// DOM Elements
const navbar = document.getElementById('navbar');
const mobileMenuBtn = document.getElementById('mobile-menu-btn');
const navLinks = document.getElementById('nav-links');
const slides = document.querySelectorAll('.carousel-slide');
const institutionType = document.getElementById('institutionType');
const feeAmount = document.getElementById('fee-amount');
const qrContainer = document.getElementById('qr-container');
const paymentConfirm = document.getElementById('paymentConfirm');
const submitBtn = document.getElementById('submit-btn');
const photoInput = document.getElementById('photoInput');
const photoPreview = document.getElementById('photoPreview');
const membershipForm = document.getElementById('membership-form');
const mainContent = document.getElementById('main-content');
const cardView = document.getElementById('card-view');
const toast = document.getElementById('toast');
const yearSpan = document.getElementById('year');

// Set current year
if (yearSpan) yearSpan.textContent = new Date().getFullYear();

// --- Navbar Scrolled & Mobile Menu ---
window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
        navbar.classList.add('scrolled');
    } else {
        navbar.classList.remove('scrolled');
    }
});

mobileMenuBtn.addEventListener('click', () => {
    navLinks.classList.toggle('active');
    // Optional: animate hamburger into an X
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

// --- Hero Carousel ---
let currentSlide = 0;
const slideCount = slides.length;
const slideInterval = 5000; // 5 seconds

function nextSlide() {
    slides[currentSlide].classList.remove('active');
    currentSlide = (currentSlide + 1) % slideCount;
    slides[currentSlide].classList.add('active');
}

if (slideCount > 0) {
    setInterval(nextSlide, slideInterval);
}

// --- Dynamic Fee Calculator ---
const feeMap = {
    'school': '₹2',
    'college': '₹5',
    'teacher': '₹100'
};

institutionType.addEventListener('change', (e) => {
    const type = e.target.value;
    if (feeMap[type]) {
        feeAmount.textContent = feeMap[type];
        qrContainer.classList.add('active');
        
        // Reset checkbox when fee changes
        paymentConfirm.checked = false;
        submitBtn.disabled = true;
    }
});

// --- Photo Upload Preview ---
let uploadedImageSrc = '';

photoInput.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function(event) {
            uploadedImageSrc = event.target.result;
            photoPreview.src = uploadedImageSrc;
            photoPreview.classList.remove('hidden');
            
            // Set it in the hidden card view immediately too
            document.getElementById('card-photo').src = uploadedImageSrc;
        };
        reader.readAsDataURL(file);
    }
});

// --- Payment Checkbox Validation ---
paymentConfirm.addEventListener('change', function() {
    // Only allow checking if a fee category is selected
    if (institutionType.value === '') {
        alert('Please select if you are a School, College, or Teacher first.');
        this.checked = false;
        return;
    }

    
    if (this.checked) {
        submitBtn.disabled = false;
    } else {
        submitBtn.disabled = true;
    }
});

// --- Form Submission & Card Generation ---
membershipForm.addEventListener('submit', function(e) {
    e.preventDefault();
    
    // 1. Validate Payment Checkbox again (just in case)
    if (!paymentConfirm.checked) {
        alert("Please confirm the payment by checking the box.");
        return;
    }

    // 2. Fetch data to populate card
    document.getElementById('card-name').textContent = document.getElementById('fullName').value;
    document.getElementById('card-institution').textContent = document.getElementById('institutionType').options[document.getElementById('institutionType').selectedIndex].text;
    document.getElementById('card-district').textContent = document.getElementById('district').value;
    document.getElementById('card-email').textContent = document.getElementById('email').value;
    
    // Safety check for gender dropdown (it's required so it should have a value)
    const genderSelect = document.getElementById('gender');
    document.getElementById('card-gender').textContent = genderSelect.options[genderSelect.selectedIndex].text;
    
    document.getElementById('card-blood').textContent = document.getElementById('bloodGroup').value || 'N/A';
    document.getElementById('card-phone').textContent = document.getElementById('phone').value;
    
    // Generate a random ID NO.
    const ranId = "ABVP" + Math.floor(100000 + Math.random() * 900000);
    document.getElementById('card-id').textContent = ranId;
    
    // Show Toast
    showToast();
    
    // Switch views
    setTimeout(() => {
        mainContent.classList.add('hidden');
        cardView.classList.remove('hidden');
        window.scrollTo(0, 0);
    }, 1500); // Wait for toast to be seen before jumping
});

// --- Toast Notification ---
function showToast() {
    toast.classList.remove('hidden');
    // Force reflow
    void toast.offsetWidth;
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 500);
    }, 3000);
}

// --- Download Membership Card ---
const downloadBtn = document.getElementById('download-btn');
const cardToRender = document.getElementById('membership-card-render');

downloadBtn.addEventListener('click', () => {
    // Change text to show loading state
    const originalText = downloadBtn.innerHTML;
    downloadBtn.innerHTML = 'Generating...';
    downloadBtn.disabled = true;
    
    html2canvas(cardToRender, {
        scale: 2, // Higher quality
        useCORS: true, // For loading external images (like the bg)
        backgroundColor: null
    }).then(canvas => {
        // Create download link
        const imgData = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = 'ABVP-Membership-Card.png';
        link.href = imgData;
        link.click();
        
        // Reset button
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    }).catch(err => {
        console.error("Error generating card image:", err);
        alert("There was an issue generating the card image. Please try again.");
        downloadBtn.innerHTML = originalText;
        downloadBtn.disabled = false;
    });
});

// --- Return to Home ---
const returnBtn = document.getElementById('return-btn');

returnBtn.addEventListener('click', () => {
    // Reset form
    membershipForm.reset();
    photoPreview.classList.add('hidden');
    photoPreview.src = '';
    qrContainer.classList.remove('active');
    feeAmount.textContent = '₹0';
    submitBtn.disabled = true;
    
    // Switch views
    cardView.classList.add('hidden');
    mainContent.classList.remove('hidden');
    window.scrollTo(0, 0);
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        const targetId = this.getAttribute('href');
        if (targetId === '#') return;
        
        const targetElement = document.querySelector(targetId);
        
        if (targetElement && !mainContent.classList.contains('hidden')) {
            e.preventDefault();
            targetElement.scrollIntoView({
                behavior: 'smooth'
            });
        }
    });
});
