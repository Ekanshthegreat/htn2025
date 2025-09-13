// Demo file for showing code style issues with Marcus "The Hammer"
// Type this slowly to demonstrate real-time analysis

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
