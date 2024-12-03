const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars').engine;
const fs = require('fs');
const clientSessions = require('client-sessions');
const randomString = require('randomstring'); // Import randomstring

// Initialize the Express application
const app = express();
app.use(express.static('public')); // Serving static files
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

// Setting up the session with client-sessions
app.use(
    clientSessions({
        cookieName: 'session',
        secret: 'webbank_secure_session', // Secret for encryption
        duration: 30 * 60 * 1000, // 30 minutes session duration
        activeDuration: 5 * 60 * 1000, // 5 minutes session extension
    })
);

// Set up Handlebars as the template engine
app.engine(
    'hbs',
    exphbs({
        defaultLayout: 'main',
        extname: '.hbs',
        partialsDir: path.join(__dirname, '/views/partials'), // Set up partials directory
    })
);
app.set('view engine', 'hbs');

// Utility functions for file handling
const loadAccounts = () => JSON.parse(fs.readFileSync('./accounts.json'));
const saveAccounts = (data) =>
    fs.writeFileSync('./accounts.json', JSON.stringify(data, null, 4));

// Middleware to check authentication
const isAuthenticated = (req, res, next) => {
    if (req.session && req.session.user) return next();
    res.redirect('/');  // Redirect to login page if not authenticated
};

// Route to render the login page
app.get('/', (req, res) => res.render('login'));

// Route to handle login
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Authentication logic here
    if (!isValidUser(username, password)) {
        return res.render('login', { errorMessage: 'Invalid username or password' });
    }

    req.session.user = { username };  // Store the user in the session
    res.redirect('/banking');
});

// Function to validate user credentials (mocked for simplicity)
const isValidUser = (username, password) => {
    // Replace with actual user validation logic
    return username === 'test' && password === 'password123';
};

// Route to log out
app.get('/logout', isAuthenticated, (req, res) => {
    req.session.reset();  // Reset the session to log out
    res.redirect('/');     // Redirect to the login page
});


// Banking page
app.get('/banking', isAuthenticated, (req, res) => {
    res.render('banking', {
        username: req.session.user.username,
    });
});

// Handle banking actions
app.post('/banking-action', isAuthenticated, (req, res) => {
    const { action, accountNumber } = req.body;
    const accounts = loadAccounts();

    if (action === 'balance') {
        res.redirect(`/balance?accountNumber=${accountNumber}`);
    } else if (action === 'deposit') {
        res.redirect(`/deposit?accountNumber=${accountNumber}`);
    } else if (action === 'withdraw') {
        res.redirect(`/withdrawal?accountNumber=${accountNumber}`);
    } else if (action === 'open') {
        res.redirect('/open-account');
    } else {
        res.render('banking', { message: 'Invalid action.' });
    }
});

// Account balance page
app.get('/balance', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    const accounts = loadAccounts();

    if (!accounts[accountNumber]) {
        return res.render('banking', { message: 'Account not found.' });
    }

    res.render('balance', {
        accountNumber,
        accountType: accounts[accountNumber].accountType,
        balance: accounts[accountNumber].accountBalance,
    });
});

// Deposit page
app.get('/deposit', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    res.render('deposit', { accountNumber });
});

app.post('/deposit-action', isAuthenticated, (req, res) => {
    const { accountNumber, amount } = req.body;
    const accounts = loadAccounts();

    if (!accounts[accountNumber]) {
        return res.render('banking', { message: 'Account not found.' });
    }

    if (isNaN(amount) || parseFloat(amount) <= 0) {
        return res.render('deposit', { errorMessage: 'Invalid deposit amount.' });
    }

    accounts[accountNumber].accountBalance += parseFloat(amount);
    saveAccounts(accounts);

    res.redirect('/banking');
});

// Withdrawal page
app.get('/withdrawal', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    res.render('withdrawal', { accountNumber });
});

app.post('/withdraw-action', isAuthenticated, (req, res) => {
    const { accountNumber, amount } = req.body;
    const accounts = loadAccounts();

    if (!accounts[accountNumber]) {
        return res.render('banking', { message: 'Account not found.' });
    }

    const withdrawalAmount = parseFloat(amount);
    const accountBalance = accounts[accountNumber].accountBalance;

    if (isNaN(amount) || withdrawalAmount <= 0) {
        return res.render('withdrawal', {
            accountNumber,
            errorMessage: 'Invalid withdrawal amount.',
        });
    }

    if (withdrawalAmount > accountBalance) {
        return res.render('withdrawal', {
            accountNumber,
            errorMessage: 'Insufficient funds.',
        });
    }

    accounts[accountNumber].accountBalance -= withdrawalAmount;
    saveAccounts(accounts);

    res.redirect('/banking');
});

// Open account page
app.get('/open-account', isAuthenticated, (req, res) => res.render('openAccount'));

app.post('/open-account-action', isAuthenticated, (req, res) => {
    const accounts = loadAccounts();
    const newAccountId = randomString.generate(7); // Generate a random 7-character string for the account ID
    accounts.lastID = newAccountId;

    accounts[newAccountId] = {
        accountType: req.body.accountType || 'Savings',
        accountBalance: parseFloat(req.body.initialDeposit) || 0,
        accountHolderName: req.body.accountName,
    };

    saveAccounts(accounts);
    res.redirect('/banking');
});

// Start server
const port = process.env.PORT || 4000;
app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
