// Live coding demo - type this in real-time to show analysis
// Demonstrates real-time feedback as you code
class UserService {
    constructor() {
        this.users = [];
    }
    // Intentionally add issues as you type
    addUser(user) {
        if (user.name == "") { // Loose equality
            console.log("Invalid user"); // Console.log
            return;
        }
        this.users.push(user);
        // TODO: Add validation
    }
    // Show the mentor catching issues in real-time
    getUserById(id) {
        for (var i = 0; i < this.users.length; i++) { // var usage
            if (this.users[i].id == id) { // Loose equality
                return this.users[i];
            }
        }
    }
}
//# sourceMappingURL=live-demo.js.map