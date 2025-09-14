// AST Processing & Proactive Debugger Demo
// This file is designed to test AST analysis and proactive debugging features
// Each section targets specific AST patterns and analysis capabilities

console.log("🚀 Starting AST & Proactive Debugger Demo");

// ===== SECTION 1: AST COMPLEXITY ANALYSIS =====
// These patterns should trigger complexity warnings

function complexFunction(data, options, callback, errorHandler, validator, transformer) {
    if (data && options && callback && errorHandler && validator && transformer) {
        if (data.length > 0) {
            if (options.validate) {
                if (validator(data)) {
                    if (options.transform) {
                        if (transformer) {
                            for (let i = 0; i < data.length; i++) {
                                for (let j = 0; j < data[i].items.length; j++) {
                                    if (data[i].items[j].active) {
                                        callback(transformer(data[i].items[j]));
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
}

// ===== SECTION 2: PERFORMANCE ANTI-PATTERNS =====
// Should trigger performance-related AST analysis

class DataProcessor {
    constructor() {
        this.data = [];
        this.cache = {};
    }
    
    // O(n²) nested loops - should be detected by AST
    findDuplicates(items) {
        const duplicates = [];
        for (let i = 0; i < items.length; i++) {
            for (let j = i + 1; j < items.length; j++) {
                if (items[i].id === items[j].id) {
                    duplicates.push(items[i]);
                }
            }
        }
        return duplicates;
    }
    
    // Inefficient array operations
    processLargeDataset(dataset) {
        let result = [];
        dataset.forEach(item => {
            result = result.concat([item.processed]); // Inefficient concatenation
        });
        return result;
    }
    
    // Memory leak pattern
    startPolling() {
        setInterval(() => {
            this.fetchData();
        }, 1000); // No cleanup mechanism
    }
}

// ===== SECTION 3: ASYNC/PROMISE PATTERNS =====
// Should trigger async-related analysis

async function problematicAsyncCode() {
    // Missing await - should be caught by AST
    const data = fetchUserData();
    console.log(data.name); // Will log Promise object
    
    // Promise chain that could be async/await
    return fetchUserData()
        .then(user => fetchUserPosts(user.id))
        .then(posts => posts.filter(p => p.published))
        .then(published => published.map(p => p.title))
        .catch(error => console.error(error));
}

function fetchUserData() {
    return new Promise(resolve => {
        setTimeout(() => resolve({ id: 1, name: 'John' }), 100);
    });
}

function fetchUserPosts(userId) {
    return new Promise(resolve => {
        setTimeout(() => resolve([
            { id: 1, title: 'Post 1', published: true },
            { id: 2, title: 'Post 2', published: false }
        ]), 100);
    });
}

// ===== SECTION 4: ERROR HANDLING PATTERNS =====
// Should trigger error handling analysis

function riskyOperations() {
    // No try-catch for risky operations
    const data = JSON.parse(localStorage.getItem('userData'));
    const result = data.items.map(item => item.value.toUpperCase());
    return result;
}

function improperErrorHandling() {
    try {
        const risky = performRiskyOperation();
        return risky.data;
    } catch (e) {
        console.log('Error occurred'); // Swallowing error details
        return null;
    }
}

// ===== SECTION 5: VARIABLE DECLARATION PATTERNS =====
// Should trigger scope and declaration analysis

function scopeIssues() {
    var globalLeak = 'should be let/const';
    
    for (var i = 0; i < 5; i++) {
        setTimeout(() => {
            console.log(i); // Classic closure issue
        }, 100);
    }
    
    if (true) {
        var hoisted = 'this gets hoisted';
    }
    console.log(hoisted); // Works but bad practice
}

// ===== SECTION 6: FUNCTION PATTERNS =====
// Should trigger function-related analysis

// Arrow function that could be regular function
const processData = (data) => {
    console.log(this.context); // 'this' binding issue in arrow function
    return data.map(item => item.value);
};

// Function with too many responsibilities
function doEverything(user, posts, comments, likes, shares, analytics) {
    validateUser(user);
    processPosts(posts);
    moderateComments(comments);
    calculateEngagement(likes, shares);
    generateReport(analytics);
    sendNotifications(user);
    updateDatabase(user, posts, comments);
    logActivity(user.id);
}

// ===== SECTION 7: OBJECT/ARRAY PATTERNS =====
// Should trigger data structure analysis

const userManager = {
    users: [],
    
    // Mutating arrays directly
    addUser(user) {
        this.users.push(user); // Direct mutation
        this.users.sort((a, b) => a.name.localeCompare(b.name)); // Sorting on every add
    },
    
    // Inefficient search
    findUser(id) {
        return this.users.find(u => u.id === id); // Linear search every time
    },
    
    // Object property access without checks
    getUserEmail(userId) {
        const user = this.findUser(userId);
        return user.profile.contact.email; // Potential null reference
    }
};

// ===== SECTION 8: CONDITIONAL COMPLEXITY =====
// Should trigger conditional complexity analysis

function complexConditionals(user, permissions, settings, context) {
    if (user && user.active && user.verified && 
        permissions && permissions.read && permissions.write &&
        settings && settings.enabled && settings.public &&
        context && context.secure && context.authenticated &&
        (user.role === 'admin' || user.role === 'moderator') &&
        (permissions.level > 5 || user.experience > 1000) &&
        new Date().getHours() > 9 && new Date().getHours() < 17) {
        return true;
    }
    return false;
}

// ===== SECTION 9: RESOURCE MANAGEMENT =====
// Should trigger resource management analysis

class ResourceManager {
    constructor() {
        this.connections = [];
        this.timers = [];
        this.listeners = [];
    }
    
    createConnection() {
        const conn = new WebSocket('ws://example.com');
        this.connections.push(conn);
        // No cleanup method provided
    }
    
    startTimer() {
        const timer = setInterval(() => {
            console.log('Timer tick');
        }, 1000);
        this.timers.push(timer);
        // No way to clear timers
    }
    
    addListener() {
        const handler = () => console.log('Event fired');
        document.addEventListener('click', handler);
        this.listeners.push(handler);
        // No removeEventListener
    }
}

// ===== SECTION 10: TYPE COERCION ISSUES =====
// Should trigger type-related analysis

function typeProblems(input) {
    if (input == null) { // Should use ===
        return 'empty';
    }
    
    if (input == 0) { // Loose equality
        return 'zero';
    }
    
    const result = input + ''; // Implicit string conversion
    return result.length > 10 ? 'long' : 'short';
}

// ===== DEMO EXECUTION =====
// This section should trigger real-time analysis as you uncomment lines

console.log("Demo ready - uncomment sections below to test real-time analysis:");

// Uncomment these one by one to test real-time proactive debugging:

// complexFunction([], {}, () => {}, () => {}, () => {}, () => {});

// const processor = new DataProcessor();
// processor.findDuplicates([{id: 1}, {id: 2}, {id: 1}]);

// problematicAsyncCode();

// riskyOperations();

// scopeIssues();

// const manager = new ResourceManager();
// manager.createConnection();

console.log("🎯 AST & Proactive Debugger Demo Complete");
