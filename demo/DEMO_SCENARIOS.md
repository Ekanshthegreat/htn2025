# AI Debugger Mentor - Demo Scenarios

## 🎯 **Demo Overview**
Show off the real-time analysis with mentor personalities by demonstrating different code quality issues and how each mentor responds uniquely.

---

## 📋 **Demo Script**

### **Setup (30 seconds)**
1. Open VS Code with the AI Debugger Mentor extension
2. Show the mentor dropdown with three personalities
3. Start with **Marcus "The Hammer"** selected

---

## 🔥 **Scenario 1: Code Style Issues (Marcus - Brutal)**

**File:** `demo-code-style.js`

```javascript
// Type this code slowly to show real-time analysis
var userName = "john"
var userAge = 25
var isActive = true

function getUserInfo(){
    console.log("Getting user info...")
    if(userName == "john"){
        console.log("User found")
        return {name:userName,age:userAge,active:isActive}
    }
}

// TODO: Add error handling
```

**Expected Marcus Responses:**
- `"Marcus 'The Hammer' Thompson: 'var'? Did you time travel from 2010? Use 'let' or 'const' like a professional! Stop making rookie mistakes!"`
- `"Marcus 'The Hammer' Thompson: Console.log? Really? What is this, amateur hour? Use a proper logging framework! Stop making rookie mistakes!"`
- `"Marcus 'The Hammer' Thompson: Loose equality (==)? That's how bugs are born. Use === and save yourself the headache! Stop making rookie mistakes!"`
- `"Marcus 'The Hammer' Thompson: TODO/FIXME comment found - consider addressing this Stop making rookie mistakes!"`

---

## 😏 **Scenario 2: Performance Issues (Sophia - Sarcastic)**

**Switch to Sophia, then create:** `demo-performance.js`

```javascript
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
```

**Expected Sophia Responses:**
- `"Sophia 'Sass' Rodriguez: Oh look, another 'TODO'... Nested loops detected - consider optimizing algorithm complexity Maybe actually do it this time?"`
- `"Sophia 'Sass' Rodriguez: Oh look, another 'TODO'... Consider using async file operations to avoid blocking Maybe actually do it this time?"`
- `"Sophia 'Sass' Rodriguez: Oh look, another 'TODO'... Consider extracting magic number to a named constant Maybe actually do it this time?"`

---

## 🌟 **Scenario 3: Security Issues (Alex - Positive)**

**Switch to Alex, then create:** `demo-security.js`

```javascript
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
```

**Expected Alex Responses:**
- `"Alex 'Sunshine' Chen: Great job adding a TODO! Potential hardcoded credential - use environment variables You're making excellent progress!"`
- `"Alex 'Sunshine' Chen: Great job adding a TODO! Potential SQL injection - use parameterized queries You're making excellent progress!"`
- `"Alex 'Sunshine' Chen: Great job adding a TODO! Avoid eval() - security risk and performance issue You're making excellent progress!"`

---

## 🎨 **Scenario 4: Interactive Features Demo**

**File:** `demo-interactive.js`

```javascript
// Good code to show positive feedback
const users = [];

async function fetchUsers() {
    try {
        const response = await fetch('/api/users');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch users:', error);
        throw error;
    }
}

// Demonstrate suggestion application
const result = users.find(user => user.id === 123);
```

**Demo Actions:**
1. Show typing indicator while mentor "thinks"
2. Click on suggestions to apply them
3. Copy code snippets
4. Dismiss warnings
5. Show mentor transition animations

---

## 🚀 **Scenario 5: Live Coding Demo**

**Create:** `live-demo.ts`

```typescript
// Start typing this live to show real-time analysis
interface User {
    id: number;
    name: string;
    email: string;
}

class UserService {
    private users: User[] = [];
    
    // Intentionally add issues as you type
    addUser(user) {  // Missing type annotation
        if(user.name == "") {  // Loose equality
            console.log("Invalid user");  // Console.log
            return;
        }
        
        this.users.push(user);
        // TODO: Add validation
    }
    
    // Show the mentor catching issues in real-time
    getUserById(id) {
        for(var i = 0; i < this.users.length; i++) {  // var usage
            if(this.users[i].id == id) {  // Loose equality
                return this.users[i];
            }
        }
    }
}
```

**Demonstrate:**
- Real-time diagnostics appearing as you type
- Different severity levels (Error, Warning, Info, Hint)
- Mentor personality in diagnostic messages
- Quick fixes and suggestions

---

## 🎭 **Personality Comparison Demo**

**Use the same problematic code with each mentor:**

```javascript
var x = 5;
if (x == 5) {
    console.log("Found it!");
}
// TODO: Fix this
```

**Show how each mentor responds differently:**

**Marcus:** Harsh, direct, technically accurate
- "What kind of amateur leaves TODO comments lying around like breadcrumbs?"

**Sophia:** Witty, sarcastic, clever
- "Oh look, another 'TODO'... Maybe actually do it this time?"

**Alex:** Enthusiastic, positive, encouraging  
- "Great job adding a TODO! You're making excellent progress!"

---

## 📊 **Demo Talking Points**

### **Real-Time Analysis Features:**
- ✅ Code style violations (indentation, semicolons, line length)
- ✅ Bug detection (null access, loose equality, deprecated patterns)
- ✅ Performance issues (nested loops, blocking operations)
- ✅ Security vulnerabilities (SQL injection, eval, hardcoded secrets)
- ✅ Best practices (TODOs, magic numbers, empty catches)

### **Mentor Personalities:**
- 💀 **Marcus**: Brutal honesty for thick-skinned developers
- 😏 **Sophia**: Sarcastic wit for developers who appreciate humor
- 🌟 **Alex**: Positive encouragement for confidence building

### **Interactive Features:**
- 🎯 Apply suggestions directly to code
- 📋 Copy code snippets with one click
- 🔄 Smooth mentor transitions
- ⚡ Real-time typing indicators
- 🎨 Personality-specific visual effects

---

## 🎬 **Demo Flow (5 minutes)**

1. **Introduction** (30s) - Show extension overview
2. **Marcus Demo** (90s) - Brutal feedback on messy code
3. **Sophia Demo** (90s) - Sarcastic analysis of performance issues
4. **Alex Demo** (90s) - Positive encouragement on security fixes
5. **Live Coding** (60s) - Real-time analysis as you type
6. **Wrap-up** (30s) - Highlight key features and benefits

**Key Message:** "Turn code review from a chore into an engaging conversation with AI mentors that match your learning style!"
