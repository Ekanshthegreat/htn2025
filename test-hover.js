// Test file to demonstrate hover suggestions
// Hover over different elements to see personality-based suggestions

function calculateTotal(items) {
    let total = 0;
    for (let i = 0; i < items.length; i++) {
        total += items[i].price;
    }
    return total;
}

class ShoppingCart {
    constructor() {
        this.items = [];
    }
    
    async fetchUserData() {
        const response = await fetch('/api/user');
        return response.json();
    }
}

// Try hovering over:
// - 'function' keyword (architecture suggestions)
// - 'class' keyword (architecture suggestions) 
// - 'async' keyword (architecture suggestions)
// - Variable names (styling suggestions)
// - Lines with different quote styles (styling suggestions)

const message = "Hello World";  // Double quotes - styling suggestion based on mentor preference
const anotherMessage = 'Hello Again';  // Single quotes

import { someModule } from './module';  // Import statement - architecture suggestion
