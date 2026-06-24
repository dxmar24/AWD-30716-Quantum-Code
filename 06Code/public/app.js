const enrollmentForm = document.querySelector('#enrollmentForm');
const formStatus = document.querySelector('#formStatus');

if (enrollmentForm) {
  enrollmentForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    formStatus.textContent = '';
    const body = Object.fromEntries(new FormData(enrollmentForm).entries());

    try {
      const response = await fetch('/api/v1/enrollment-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error('Request was not accepted');
      enrollmentForm.reset();
      formStatus.textContent = 'Enrollment request registered.';
    } catch (error) {
      formStatus.textContent = 'The request could not be registered.';
    }
  });
}
