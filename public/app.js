document.addEventListener('DOMContentLoaded', () => {
    // Scroll handling for sticky header border
    const siteHeader = document.querySelector('.site-header');
    if (siteHeader) {
        window.addEventListener('scroll', () => {
            if (window.scrollY > 8) {
                siteHeader.classList.add('scrolled');
            } else {
                siteHeader.classList.remove('scrolled');
            }
        });
    }

    const waitlistForm = document.querySelector('.waitlist-form');
    const emailInput = document.getElementById('email-input');
    const waitlistButton = document.querySelector('.waitlist-form__button');
    const waitlistStatus = document.getElementById('waitlist-status');
    const emailErrorDiv = document.getElementById('email-error');

    // Email validation regex (per ticket description)
    const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function isValidEmail(email) {
        const trimmedEmail = email.trim();
        if (!trimmedEmail) {
            return false;
        }
        if (trimmedEmail.length > 254) { // Max length from API contract
            return false;
        }
        return EMAIL_REGEX.test(trimmedEmail);
    }

    function displayStatus(message, isError = false) {
        waitlistStatus.textContent = message;
        waitlistStatus.classList.remove('waitlist-status--positive', 'waitlist-status--negative');
        if (isError) {
            waitlistStatus.classList.add('waitlist-status--negative');
        } else {
            // Per context, 409 (already on list) is positive.
            // All other successful outcomes are positive.
            waitlistStatus.classList.add('waitlist-status--positive');
        }
        waitlistStatus.classList.add('waitlist-status--show');
    }

    function clearStatus() {
        waitlistStatus.textContent = '';
        waitlistStatus.classList.remove('waitlist-status--positive', 'waitlist-status--negative', 'waitlist-status--show');
    }

    function displayEmailError(message) {
        emailErrorDiv.textContent = message;
        emailInput.setAttribute('aria-invalid', 'true');
    }

    function clearEmailError() {
        emailErrorDiv.textContent = '';
        emailInput.removeAttribute('aria-invalid');
    }

    if (waitlistForm) {
        waitlistForm.addEventListener('submit', async (event) => {
            event.preventDefault();

            clearStatus();
            clearEmailError();

            const email = emailInput.value;
            if (!isValidEmail(email)) {
                displayEmailError('That does not look like an email address.');
                displayStatus('That does not look like an email address.', true);
                return;
            }

            waitlistButton.disabled = true;
            waitlistButton.textContent = 'Joining…';
            waitlistButton.setAttribute('aria-disabled', 'true');

            try {
                const response = await fetch('/api/waitlist', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email: email.trim().toLowerCase() }),
                });

                if (response.ok) { // 2xx status codes, though API contract only lists 201
                    if (response.status === 201) {
                        displayStatus('You are on the list. We will email you once.', false);
                        emailInput.value = '';
                        emailInput.blur(); // Remove focus from input
                        waitlistStatus.focus(); // Move focus to status message
                    }
                } else {
                    switch (response.status) {
                        case 409: // Already on list (API contract says 409, copy deck says positive message)
                            displayStatus('You are already on the list.', false); // This is a positive message per copy deck
                            break;
                        case 429:
                            displayStatus('Too many attempts. Try again in a minute.', true);
                            break;
                        case 400: // Invalid email, though client-side should catch most
                            // Attempt to parse server error for specific message, fall back to generic
                            const errorData = await response.json().catch(() => ({}));
                            if (errorData.error && errorData.error.code === 'INVALID_EMAIL') {
                                displayStatus('That does not look like an email address.', true);
                                displayEmailError('That does not look like an email address.');
                            } else {
                                displayStatus('Something went wrong. Try again shortly.', true);
                            }
                            break;
                        case 500: // Server error, store unavailable etc.
                        default:
                            displayStatus('Something went wrong. Try again shortly.', true);
                            break;
                    }
                }
            } catch (error) {
                console.error('Fetch error:', error);
                displayStatus('Something went wrong. Try again shortly.', true);
            } finally {
                waitlistButton.disabled = false;
                waitlistButton.textContent = 'Join the waitlist';
                waitlistButton.removeAttribute('aria-disabled');
            }
        });
    }
});
