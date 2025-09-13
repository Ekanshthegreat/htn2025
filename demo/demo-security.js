// Demo file for showing security issues with Alex "Sunshine"
// Switch to Alex mentor before typing this

// Security vulnerabilities
const password = "admin123";
const apiKey = "sk-1234567890abcdef";

function loginUser(username, userPassword) {
    const query = "SELECT * FROM users WHERE username = '" + username + "' AND password = '" + userPassword + "'";
    
    // Dangerous eval usage
    const result = eval("processUser(" + username + ")");
    
    return result;
}

// TODO: Implement proper authentication
