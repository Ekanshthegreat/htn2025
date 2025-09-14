// AI Mentor Feature Test File
// This file contains various code patterns to test personalized mentor suggestions
// Hover over different elements to see how GitHub-based mentors provide unique advice

// =============================================================================
// VARIABLE DECLARATIONS - Test different scoping and naming patterns
// =============================================================================

// Old-style variable declaration (should trigger var warnings)
var oldStyleVariable = "This should trigger mentor advice about using let/const";

// Modern variable declarations
const CONSTANT_VALUE = 42;
let mutableVariable = "This is better";

// Short variable names (should trigger naming advice)
let x = 10;
let i = 0;
let temp = {};

// Better variable names
const userAccountBalance = 1000;
const isUserAuthenticated = true;
const databaseConnectionString = "mongodb://localhost:27017";

// =============================================================================
// FUNCTION DECLARATIONS - Test different function patterns
// =============================================================================

// Traditional function declaration
function calculateTotalPrice(items, taxRate) {
    let total = 0;
    for (let item of items) {
        total += item.price;
    }
    return total * (1 + taxRate);
}

// Arrow function
const processUserData = (userData) => {
    return userData.map(user => ({
        ...user,
        fullName: `${user.firstName} ${user.lastName}`
    }));
};

// Async function without proper error handling (should trigger advice)
async function fetchUserProfile(userId) {
    const response = await fetch(`/api/users/${userId}`);
    const data = await response.json();
    return data;
}

// Better async function with error handling
async function fetchUserProfileSafely(userId) {
    try {
        const response = await fetch(`/api/users/${userId}`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Failed to fetch user profile:', error);
        throw error;
    }
}

// Long function that should trigger complexity warnings
function complexDataProcessor(data, options, filters, transformations, validations) {
    // This function is intentionally long to trigger mentor advice
    let processedData = data;
    
    if (options.enableFiltering) {
        processedData = processedData.filter(item => {
            return filters.every(filter => {
                if (filter.type === 'range') {
                    return item[filter.field] >= filter.min && item[filter.field] <= filter.max;
                } else if (filter.type === 'exact') {
                    return item[filter.field] === filter.value;
                } else if (filter.type === 'contains') {
                    return item[filter.field].includes(filter.value);
                }
                return true;
            });
        });
    }
    
    if (options.enableTransformations) {
        processedData = processedData.map(item => {
            let transformedItem = { ...item };
            transformations.forEach(transform => {
                if (transform.type === 'uppercase') {
                    transformedItem[transform.field] = transformedItem[transform.field].toUpperCase();
                } else if (transform.type === 'lowercase') {
                    transformedItem[transform.field] = transformedItem[transform.field].toLowerCase();
                } else if (transform.type === 'multiply') {
                    transformedItem[transform.field] *= transform.factor;
                }
            });
            return transformedItem;
        });
    }
    
    if (options.enableValidations) {
        processedData = processedData.filter(item => {
            return validations.every(validation => {
                if (validation.type === 'required') {
                     return item[validation.field] !== null && item[validation.field] !== undefined;
                } else if (validation.type === 'minLength') {
                    return item[validation.field].length >= validation.minLength;
                } else if (validation.type === 'maxLength') {
                    return item[validation.field].length <= validation.maxLength;
                }
                return true;
            });
        });
    }
    
    return processedData;
}

// =============================================================================
// CLASS DECLARATIONS - Test OOP patterns
// =============================================================================

// Simple class
class User {
    constructor(name, email) {
        this.name = name;
        this.email = email;
    }
    
    getDisplayName() {
        return this.name;
    }
}

// Class with inheritance
class AdminUser extends User {
    constructor(name, email, permissions) {
        super(name, email);
        this.permissions = permissions;
    }
    
    hasPermission(permission) {
        return this.permissions.includes(permission);
    }
}

// Class with many methods (should trigger complexity advice)
class DataManager {
    constructor() {
        this.data = [];
        this.cache = new Map();
        this.observers = [];
    }
    
    addData(item) { this.data.push(item); }
    removeData(id) { this.data = this.data.filter(item => item.id !== id); }
    updateData(id, updates) { /* implementation */ }
    findData(predicate) { return this.data.find(predicate); }
    filterData(predicate) { return this.data.filter(predicate); }
    sortData(compareFn) { return [...this.data].sort(compareFn); }
    cacheResult(key, value) { this.cache.set(key, value); }
    getCachedResult(key) { return this.cache.get(key); }
    clearCache() { this.cache.clear(); }
    addObserver(observer) { this.observers.push(observer); }
    removeObserver(observer) { /* implementation */ }
    notifyObservers(event) { this.observers.forEach(obs => obs(event)); }
    exportData() { return JSON.stringify(this.data); }
    importData(jsonData) { this.data = JSON.parse(jsonData); }
    validateData() { /* implementation */ }
    transformData(transformer) { return this.data.map(transformer); }
}

// =============================================================================
// IMPORT/EXPORT PATTERNS - Test module architecture
// =============================================================================

// Many imports (should trigger dependency advice)
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { Router, Route, Switch, Link, useHistory, useParams } from 'react-router-dom';
import { connect, useSelector, useDispatch } from 'react-redux';
import axios from 'axios';
import lodash from 'lodash';
import moment from 'moment';
import uuid from 'uuid';
import classnames from 'classnames';

// CommonJS require (should trigger ES modules advice)
const fs = require('fs');
const path = require('path');
const util = require('util');

// =============================================================================
// REACT PATTERNS - Test React-specific advice
// =============================================================================

// React functional component with hooks
function UserProfile({ userId }) {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Missing dependency array (should trigger React advice)
    useEffect(() => {
        fetchUser(userId).then(setUser);
    });
    
    // Correct useEffect with dependencies
    useEffect(() => {
        setLoading(true);
        fetchUser(userId)
            .then(setUser)
            .finally(() => setLoading(false));
    }, [userId]);
    
    if (loading) return <div>Loading...</div>;
    if (!user) return <div>User not found</div>;
    
    return (
        <div>
            <h1>{user.name}</h1>
            <p>{user.email}</p>
        </div>
    );
}

// Class component (should trigger migration advice for React experts)
class OldUserProfile extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            user: null,
            loading: true
        };
    }
    
    componentDidMount() {
        this.fetchUser();
    }
    
    fetchUser = () => {
        // Implementation
    }
    
    render() {
        return <div>Old style component</div>;
    }
}

// =============================================================================
// ASYNC/AWAIT PATTERNS - Test async advice
// =============================================================================

// Promise chains (should trigger async/await advice)
function fetchUserDataOldStyle(userId) {
    return fetch(`/api/users/${userId}`)
        .then(response => response.json())
        .then(user => {
            return fetch(`/api/users/${userId}/posts`);
        })
        .then(response => response.json())
        .then(posts => {
            return { user, posts };
        })
        .catch(error => {
            console.error('Error:', error);
        });
}

// Multiple async operations (should trigger Promise.all advice)
async function fetchUserAndPosts(userId) {
    const user = await fetchUser(userId);
    const posts = await fetchUserPosts(userId);
    const comments = await fetchUserComments(userId);
    return { user, posts, comments };
}

// Better parallel execution
async function fetchUserAndPostsOptimized(userId) {
    const [user, posts, comments] = await Promise.all([
        fetchUser(userId),
        fetchUserPosts(userId),
        fetchUserComments(userId)
    ]);
    return { user, posts, comments };
}

// =============================================================================
// PERFORMANCE PATTERNS - Test performance advice
// =============================================================================

// Chained array methods (should trigger performance advice)
const processLargeDataset = (data) => {
    return data
        .filter(item => item.active)
        .map(item => ({ ...item, processed: true }))
        .filter(item => item.score > 50)
        .map(item => item.name)
        .sort();
};

// Inefficient DOM manipulation
function updateUIInefficiently(items) {
    const container = document.getElementById('container');
    container.innerHTML = ''; // Clears everything
    
    items.forEach(item => {
        const element = document.createElement('div');
        element.innerHTML = `<span>${item.name}</span>`;
        container.appendChild(element); // Multiple DOM operations
    });
}

// =============================================================================
// SECURITY PATTERNS - Test security advice
// =============================================================================

// Potential XSS vulnerability
function displayUserContent(content) {
    document.getElementById('content').innerHTML = content; // Dangerous!
}

// Eval usage (should trigger security warnings)
function executeUserCode(code) {
    return eval(code); // Very dangerous!
}

// Better approach
function displayUserContentSafely(content) {
    document.getElementById('content').textContent = content; // Safe
}

// =============================================================================
// TESTING PATTERNS - Test testing advice
// =============================================================================

// Functions without tests (should trigger testing advice)
function calculateDiscount(price, discountPercent) {
    return price * (1 - discountPercent / 100);
}

function validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// =============================================================================
// DEBUGGING PATTERNS - Test debugging advice
// =============================================================================

// Debugging function (console.log statements removed for production)
function debugFunction(data) {
    const processed = data.map(item => {
        return item * 2;
    });
    
    return processed;
}

// =============================================================================
// TYPE PATTERNS - Test TypeScript advice (if TypeScript mentor)
// =============================================================================

// Any types (should trigger TypeScript advice if using TypeScript mentor)
function processAnyData(data) {
    return data.someProperty;
}

// Better typing (for TypeScript mentors)
function processUserDataTyped(data) {
    // TypeScript mentors will suggest proper typing here
    return `${data.name} (${data.email})`;
}

// =============================================================================
// INSTRUCTIONS FOR TESTING
// =============================================================================

/*
To test the personalized mentor features:

1. Create different GitHub-based mentor profiles:
   - Try usernames like: torvalds, gaearon, sindresorhus, addyosmani
   - Each will have different expertise and focus areas

2. Hover over different code elements:
   - Variable declarations (var, let, const)
   - Function declarations and calls
   - Class definitions
   - Import statements
   - React hooks (useState, useEffect)
   - Async/await patterns

3. Look for personalized advice that includes:
   - Mentor's name and expertise area
   - Specific advice based on their GitHub analysis
   - Different tones (encouraging, direct, analytical, pragmatic)
   - References to their actual technologies and focus areas

4. Compare suggestions between different mentors:
   - A React expert (like gaearon) will give React-specific advice
   - A performance expert will focus on optimization
   - A testing advocate will suggest adding tests
   - A security expert will highlight potential vulnerabilities

5. Test with different file complexities:
   - Simple files should get encouraging advice
   - Complex files should get refactoring suggestions
   - Files with many dependencies should get architecture advice
*/

export { 
    calculateTotalPrice, 
    processUserData, 
    User, 
    AdminUser,
    UserProfile,
    fetchUserAndPostsOptimized 
};
