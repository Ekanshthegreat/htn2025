// Demo file for showing performance issues with Sophia "Sass"
// Switch to Sophia mentor before typing this

// Inefficient nested loops
const users = [1,2,3,4,5,6,7,8,9,10];
const orders = [1,2,3,4,5,6,7,8,9,10];

for(let i = 0; i < users.length; i++) {
    for(let j = 0; j < orders.length; j++) {
        if(users[i] === orders[j]) {
            console.log("Match found");
        }
    }
}

// Synchronous file operation
const fs = require('fs');
const data = fs.readFileSync('./config.json', 'utf8');

// Magic numbers everywhere
setTimeout(() => {
    console.log("Delayed by 5000ms");
}, 5000);

const maxRetries = 3;
const timeout = 30000;
