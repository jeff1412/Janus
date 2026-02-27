async function simulateEmail() {
    const payload = {
        fromEmail: 'hilarioeddiea08@gmail.com',
        subject: 'Kitchen sink is leaking',
        bodyText: 'Hi, my kitchen sink has a constant drip and the cabinet underneath is getting wet. Please send someone to fix it. Thanks!'
    };

    try {
        const response = await fetch('http://localhost:3000/api/email-intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error:', err);
    }
}

simulateEmail();
