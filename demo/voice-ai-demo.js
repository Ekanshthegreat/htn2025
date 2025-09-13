// AI Debugger Mentor - VAPI Voice AI Demo
// This file demonstrates the voice-powered debugging capabilities

class BuggyCalculator {
    constructor() {
        this.history = [];
        this.precision = 2;
    }

    // Bug 1: Division by zero not handled
    divide(a, b) {
        const result = a / b;
        this.history.push(`${a} / ${b} = ${result}`);
        return result;
    }

    // Bug 2: Infinite recursion potential
    factorial(n) {
        if (n === 0) return 1;
        return n * this.factorial(n - 1); // Missing negative number check
    }

    // Bug 3: Array mutation issue
    processNumbers(numbers) {
        numbers.sort(); // Mutates original array
        return numbers.map(n => n * 2);
    }

    // Bug 4: Async/await misuse
    async fetchData(url) {
        try {
            const response = fetch(url); // Missing await
            return response.json(); // This will fail
        } catch (error) {
            console.log("Error occurred"); // Poor error handling
        }
    }

    // Bug 5: Memory leak potential
    startTimer() {
        setInterval(() => {
            console.log("Timer tick");
        }, 1000); // No way to stop the timer
    }
}

// Demo usage that will trigger various issues
const calculator = new BuggyCalculator();

// This will cause division by zero
console.log(calculator.divide(10, 0));

// This will cause stack overflow with negative numbers
console.log(calculator.factorial(-5));

// This will mutate the original array
const numbers = [3, 1, 4, 1, 5];
console.log(calculator.processNumbers(numbers));
console.log("Original array:", numbers); // Array is now sorted!

// This will fail due to missing await
calculator.fetchData("https://api.example.com/data");

// This starts a timer that can't be stopped
calculator.startTimer();

/* 
Voice Commands to try with AI Mentor:
- "Explain this function" (while cursor is on any method)
- "Find the bug in my code"
- "How can I optimize this?"
- "Suggest some tests for this"
- "What's wrong with the divide method?"
- "Help me fix the factorial function"
- "Explain the async function issue"
*/
