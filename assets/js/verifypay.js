async function verifyPayment(req, res, next) {
    try {
        const userId = req.session.userId; // Get UserID from session
        const [result] = await db.execute('SELECT payedFee FROM Players WHERE UserID = ?', [userId]);

        if (result.length === 0 || result[0].payedFee !== 1) {
            return res.status(403).send('Access denied. Payment not completed.');
        }

        next(); // Proceed if payment is verified
    } catch (error) {
        console.error('Error verifying payment:', error);
        res.status(500).send('Server error.');
    }
}