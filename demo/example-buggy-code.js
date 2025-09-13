// Demo file for AI Debugger Mentor - Intentionally contains common bugs
// This showcases how the AI mentor proactively identifies and explains issues

class UserManager {
    constructor() {
        this.users = [];
        this.activeUsers = new Map();
    }

    // Bug 1: Missing async/await - will cause issues
    addUser(userData) {
        const user = this.validateUser(userData);
        this.users.push(user);
        this.saveToDatabase(user); // This should be awaited
        return user.id;
    }

    // Bug 2: No error handling for undefined/null
    validateUser(userData) {
        if (userData.email.includes('@')) { // Will throw if email is undefined
            return {
                id: Math.random().toString(36),
                email: userData.email,
                name: userData.name,
                createdAt: new Date()
            };
        }
        throw new Error('Invalid email');
    }

    // Bug 3: Memory leak - not cleaning up event listeners
    activateUser(userId) {
        const user = this.users.find(u => u.id === userId);
        this.activeUsers.set(userId, user);
        
        // This creates a memory leak
        setInterval(() => {
            console.log(`User ${userId} is active`);
        }, 1000);
    }

    // Bug 4: Race condition potential
    async saveToDatabase(user) {
        // Simulated async operation
        return new Promise((resolve) => {
            setTimeout(() => {
                console.log('User saved:', user.email);
                resolve();
            }, Math.random() * 1000);
        });
    }

    // Bug 5: Inefficient algorithm - O(n) when could be O(1)
    getUserById(id) {
        return this.users.find(user => user.id === id); // Should use a Map for O(1) lookup
    }

    // Bug 6: Potential infinite loop
    processUserQueue() {
        let processing = true;
        while (processing) {
            const user = this.getNextUser();
            if (user) {
                this.processUser(user);
            }
            // Missing condition to set processing = false
        }
    }

    getNextUser() {
        return this.users.pop();
    }

    processUser(user) {
        console.log('Processing:', user.name);
    }
}

// Usage that will trigger various issues
const manager = new UserManager();

// This will cause the email undefined error
try {
    manager.addUser({ name: 'John' }); // Missing email
} catch (error) {
    console.error('Error:', error.message);
}

// This will work but has the async issue
manager.addUser({
    email: 'jane@example.com',
    name: 'Jane Doe'
});

// This will create memory leaks
manager.activateUser('user1');
manager.activateUser('user2');

// Performance issue demonstration
for (let i = 0; i < 1000; i++) {
    manager.addUser({
        email: `user${i}@example.com`,
        name: `User ${i}`
    });
}

// This will be slow due to O(n) lookup
console.time('lookup');
manager.getUserById('some-id');
console.timeEnd('lookup');
