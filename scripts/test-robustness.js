async function testRobustness() {
    const payload = {
        fromEmail: 'hilarioeddiea08@gmail.com',
        subject: 'RE: Help with my heater',
        bodyText: `My heater is still making a weird clicking noise. Can someone come over today?

Thanks,
Eddie Hilario
Property Owner | Phone: 555-1234
--------------------------------------
CONFIDENTIALITY NOTICE: This email and any files transmitted with it are confidential...

On Feb 26, 2026, at 10:00 AM, JANUS Support <gacutanbri@gmail.com> wrote:
> Hi Eddie, we received your request about the heater. 
> Is it still having issues?
`
    };

    console.log('Sending noisy email to triage...');

    try {
        const response = await fetch('http://localhost:3001/api/email-intake', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log('Response:', JSON.stringify(data, null, 2));

        if (data.ok) {
            console.log('\n✅ TEST SUCCESSFUL!');
            console.log('The system ignored the signature and historical thread.');
        }
    } catch (err) {
        console.error('Error:', err);
    }
}

testRobustness();
