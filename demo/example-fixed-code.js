// Demo file showing AI Mentor's suggested fixes
// This demonstrates how the AI mentor guides developers to better code

class UserManager {
    constructor() {
        this.users = [];
        this.userMap = new Map(); // O(1) lookup optimization
        this.activeUsers = new Map();
        this.intervalIds = new Map(); // Track intervals for cleanup
    }

    // Fixed: Proper async/await handling
    async addUser(userData) {
        try {
            const user = this.validateUser(userData);
            this.users.push(user);
            this.userMap.set(user.id, user); // Add to map for fast lookup
            await this.saveToDatabase(user); // Properly awaited
            return user.id;
        } catch (error) {
            console.error('Failed to add user:', error.message);
            throw error;
        }
    }

    // Fixed: Proper null/undefined checking
    validateUser(userData) {
        // Input validation with clear error messages
        if (!userData) {
            throw new Error('User data is required');
        }
        
        if (!userData.email || typeof userData.email !== 'string') {
            throw new Error('Valid email is required');
        }
        
        if (!userData.email.includes('@')) {
            throw new Error('Invalid email format');
        }

        if (!userData.name || typeof userData.name !== 'string') {
            throw new Error('Valid name is required');
        }

        return {
            id: Math.random().toString(36),
            email: userData.email.toLowerCase().trim(),
            name: userData.name.trim(),
            createdAt: new Date()
        };
    }

    // Fixed: Proper cleanup to prevent memory leaks
    activateUser(userId) {
        const user = this.userMap.get(userId);
        if (!user) {
            throw new Error(`User with id ${userId} not found`);
        }

        this.activeUsers.set(userId, user);
        
        // Store interval ID for later cleanup
        const intervalId = setInterval(() => {
            console.log(`User ${userId} is active`);
        }, 1000);
        
        this.intervalIds.set(userId, intervalId);
    }

    // New: Proper cleanup method
    deactivateUser(userId) {
        this.activeUsers.delete(userId);
        
        const intervalId = this.intervalIds.get(userId);
        if (intervalId) {
            clearInterval(intervalId);
            this.intervalIds.delete(userId);
        }
    }

    // Fixed: Added proper error handling and retry logic
    async saveToDatabase(user) {
        const maxRetries = 3;
        let retries = 0;

        while (retries < maxRetries) {
            try {
                // Simulated async operation with potential failure
                return new Promise((resolve, reject) => {
                    setTimeout(() => {
                        if (Math.random() > 0.1) { // 90% success rate
                            console.log('User saved:', user.email);
                            resolve();
                        } else {
                            reject(new Error('Database connection failed'));
                        }
                    }, Math.random() * 1000);
                });
            } catch (error) {
                retries++;
                if (retries === maxRetries) {
                    throw new Error(`Failed to save user after ${maxRetries} attempts: ${error.message}`);
                }
                // Exponential backoff
                await new Promise(resolve => setTimeout(resolve, Math.pow(2, retries) * 1000));
            }
        }
    }

    // Fixed: O(1) lookup using Map
    getUserById(id) {
        return this.userMap.get(id);
    }

    // Fixed: Proper loop termination condition
    processUserQueue() {
        let processing = true;
        let processedCount = 0;
        const maxProcessing = 100; // Safety limit

        while (processing && processedCount < maxProcessing) {
            const user = this.getNextUser();
            if (user) {
                this.processUser(user);
                processedCount++;
            } else {
                processing = false; // No more users to process
            }
        }

        if (processedCount >= maxProcessing) {
            console.warn('Reached maximum processing limit');
        }
    }

    getNextUser() {
        return this.users.pop();
    }

    processUser(user) {
        console.log('Processing:', user.name);
        // Add actual processing logic here
    }

    // New: Cleanup method for proper resource management
    destroy() {
        // Clear all intervals
        for (const intervalId of this.intervalIds.values()) {
            clearInterval(intervalId);
        }
        this.intervalIds.clear();
        this.activeUsers.clear();
        this.userMap.clear();
        this.users.length = 0;
    }

    // New: Batch operations for better performance
    async addUsers(userDataArray) {
        const results = [];
        const errors = [];

        // Process in batches to avoid overwhelming the system
        const batchSize = 10;
        for (let i = 0; i < userDataArray.length; i += batchSize) {
            const batch = userDataArray.slice(i, i + batchSize);
            const batchPromises = batch.map(async (userData, index) => {
                try {
                    const userId = await this.addUser(userData);
                    return { index: i + index, userId, success: true };
                } catch (error) {
                    return { index: i + index, error: error.message, success: false };
                }
            });

            const batchResults = await Promise.allSettled(batchPromises);
            batchResults.forEach(result => {
                if (result.status === 'fulfilled') {
                    if (result.value.success) {
                        results.push(result.value);
                    } else {
                        errors.push(result.value);
                    }
                } else {
                    errors.push({ error: result.reason.message, success: false });
                }
            });
        }

        return { results, errors };
    }
}

// Improved usage with proper error handling
async function demonstrateImprovedUsage() {
    const manager = new UserManager();

    try {
        // This will now handle the missing email gracefully
        await manager.addUser({ name: 'John' });
    } catch (error) {
        console.error('Expected error caught:', error.message);
    }

    try {
        // This will work properly with async handling
        const userId = await manager.addUser({
            email: 'jane@example.com',
            name: 'Jane Doe'
        });
        console.log('User added successfully:', userId);

        // Activate user (with proper cleanup capability)
        manager.activateUser(userId);

        // Later, properly deactivate to prevent memory leaks
        setTimeout(() => {
            manager.deactivateUser(userId);
        }, 5000);

    } catch (error) {
        console.error('Unexpected error:', error.message);
    }

    // Demonstrate batch processing for better performance
    const testUsers = Array.from({ length: 100 }, (_, i) => ({
        email: `user${i}@example.com`,
        name: `User ${i}`
    }));

    try {
        console.time('batch-add');
        const { results, errors } = await manager.addUsers(testUsers);
        console.timeEnd('batch-add');
        console.log(`Successfully added ${results.length} users, ${errors.length} errors`);

        // Fast O(1) lookup
        console.time('lookup');
        const user = manager.getUserById(results[0]?.userId);
        console.timeEnd('lookup');
        console.log('Found user:', user?.name);

    } catch (error) {
        console.error('Batch operation failed:', error.message);
    }

    // Proper cleanup
    manager.destroy();
}

// Run the demonstration
demonstrateImprovedUsage();
