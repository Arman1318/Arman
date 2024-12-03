// Import required modules
const express = require('express');
const path = require('path');
const exphbs = require('express-handlebars').engine;
const fs = require('fs');
const clientSessions = require('client-sessions');

// Initializing the Express application
const app = express();
app.use(express.static('public')); // Serving the static files from the "public" folder

// Setting up the middleware
app.use(express.static(path.join(__dirname, 'public'))); // Serving static assets
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded form data

// Setting up the session with client-sessions
app.use(clientSessions({
    cookieName: "session", // The Name of the cookie to be set on client-side
    secret: "webbank_secure_session", // Secret key for encryption
    duration: 30 * 60 * 1000, // Session duration (30 minutes)
}));

// Setting up the Handlebars as the template engine
app.engine('hbs', exphbs({ defaultLayout: 'main', extname: '.hbs' }));
app.set('view engine', 'hbs');

// Helper functions is used to load and save account data from JSON file
const loadAccounts = () => JSON.parse(fs.readFileSync('./accounts.json'));
const saveAccounts = (data) => fs.writeFileSync('./accounts.json', JSON.stringify(data, null, 4));

// Authentication middleware is used to protect routes
function isAuthenticated(req, res, next) {
    if (req.session && req.session.user) {
        return next(); // User is authenticated, proceed to the next middleware
    }
    res.redirect('/'); // Redirect to login if not authenticated
}


// Route to render the login page
app.get('/', (req, res) => res.render('login'));

// Route to handle login form submission
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    req.session.user = { username }; // Save user in session after login (add real authentication as needed)
    res.redirect('/banking');
});

// Protected route to render banking options
app.get('/banking', isAuthenticated, (req, res) => {
    res.render('banking', { username: req.session.user.username });
});

// Route to handle actions from the banking page
app.post('/banking-action', isAuthenticated, (req, res) => {
    const { action, accountNumber } = req.body;
    const accounts = loadAccounts();
    
    // Checking if the account is existing or not
    if (!accounts[accountNumber]) {
        return res.render('banking', { message: "Account not found" });
    }
    
    // Redirecting based on selected actions
    if (action === "balance") {
        res.redirect(`/balance?accountNumber=${accountNumber}`);
    } else if (action === "deposit") {
        res.redirect(`/deposit?accountNumber=${accountNumber}`);
    } else if (action === "withdraw") {
        res.redirect(`/withdrawal?accountNumber=${accountNumber}`);
    } else if (action === "open") {
        res.redirect('/open-account');
    }
});

// this is the Route to view account balance
app.get('/balance', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    const accounts = loadAccounts();
    const account = accounts[accountNumber];
    
    // Render balance view or error message if account is not found
    if (!account) return res.render('banking', { message: "Account not found" });
    res.render('balance', { accountNumber, accountType: account.accountType, balance: account.accountBalance });
});

// Route to render the deposit page
app.get('/deposit', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    res.render('deposit', { accountNumber });
});

// Route to handle deposit action
app.post('/deposit-action', isAuthenticated, (req, res) => {
    const { accountNumber, amount } = req.body;
    const accounts = loadAccounts();
    
    // Verifying account existing before proceeding with deposit
    if (!accounts[accountNumber]) return res.render('banking', { message: "Account not found" });
    accounts[accountNumber].accountBalance += parseFloat(amount); // Update balance
    saveAccounts(accounts); // Saving updated accounts to file for Data
    res.redirect('/banking');
});

// Route to render the withdrawal page
app.get('/withdrawal', isAuthenticated, (req, res) => {
    const { accountNumber } = req.query;
    res.render('withdrawal', { accountNumber });
});

// Route to handle withdrawal action
app.post('/withdraw-action', isAuthenticated, (req, res) => {
    const { accountNumber, amount } = req.body;
    const accounts = loadAccounts();

    // Checking if the account is existing 
    if (!accounts[accountNumber]) return res.render('banking', { message: "Account not found" });

    const withdrawalAmount = parseFloat(amount);
    const accountBalance = accounts[accountNumber].accountBalance;

    // Checking if one has the sufficient funds or not and if not will get the error message
    if (withdrawalAmount > accountBalance) {
        return res.render('withdrawal', {
            accountNumber,
            insufficientFunds: true,
            errorMessage: 'Insufficient funds. Please enter a lower amount.'
        });
    }

    accounts[accountNumber].accountBalance -= withdrawalAmount; // Deduct withdrawal amount
    saveAccounts(accounts); // Saving changes to accounts
    res.redirect('/banking');
});

// Route to display the open account (sign-up) page
app.get('/open-account', (req, res) => res.render('openAccount'));

// Route to handle the form submission from the open account page
app.post('/open-account-action', isAuthenticated, (req, res) => {
    const accounts = loadAccounts();

    // Generate new account ID by incrementing the lastID in the accounts file
    const newAccountId = (parseInt(accounts.lastID) + 1).toString().padStart(7, '0');
    accounts.lastID = newAccountId;
    
    // Add new account details
    accounts[newAccountId] = {
        accountType: req.body.accountType || "Savings",
        accountBalance: parseFloat(req.body.initialDeposit) || 0,
        accountHolderName: req.body.accountName
    };
    saveAccounts(accounts); // Save updated accounts to file
    res.redirect('/banking');
});

// Server setup to listen on specified port
const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Server running on http://localhost:${port}`));
