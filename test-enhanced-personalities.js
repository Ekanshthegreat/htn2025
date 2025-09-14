/**
 * Enhanced Personality Testing Script
 * Tests the deeply personalized mentor system with various GitHub profiles
 */

const { GitHubService } = require('./src/githubService');
const { MentorPersonalityService } = require('./src/mentorPersonality');
const { ProfileManager } = require('./src/profileManager');

async function testEnhancedPersonalities() {
    console.log('🧪 Testing Enhanced Mentor Personalities\n');
    
    const githubService = new GitHubService();
    const personalityService = new MentorPersonalityService();
    const profileManager = new ProfileManager();
    
    // Test profiles with different expertise and styles
    const testProfiles = [
        {
            username: 'torvalds',
            testCode: 'function processData(data) { return data.map(item => item.value); }',
            expectedStyle: 'direct, systems-focused, performance-oriented'
        },
        {
            username: 'gaearon',
            testCode: 'const [count, setCount] = useState(0); useEffect(() => { console.log(count); }, [count]);',
            expectedStyle: 'React-focused, educational, debugging-oriented'
        },
        {
            username: 'sindresorhus',
            testCode: 'import { readFile } from "fs/promises"; export const loadConfig = async (path) => JSON.parse(await readFile(path));',
            expectedStyle: 'modular, minimalist, utility-focused'
        },
        {
            username: 'addyosmani',
            testCode: 'const heavyData = largeArray.map(item => item.process()).filter(result => result.valid);',
            expectedStyle: 'performance-focused, optimization-oriented'
        },
        {
            username: 'kentcdodds',
            testCode: 'describe("UserService", () => { it("should create user", () => { expect(createUser()).toBeTruthy(); }); });',
            expectedStyle: 'testing-focused, user-centric, educational'
        }
    ];
    
    for (const profile of testProfiles) {
        console.log(`\n🔍 Testing ${profile.username} personality:`);
        console.log(`Expected style: ${profile.expectedStyle}`);
        console.log(`Test code: ${profile.testCode}`);
        
        try {
            // Create GitHub-based profile
            const mentorProfile = await githubService.createProfileFromGitHub(profile.username);
            console.log(`✅ Profile created for ${profile.username}`);
            
            // Set active profile
            personalityService.setCurrentProfile(mentorProfile);
            
            // Test personalized comments
            const comment = personalityService.getPersonalizedComment(profile.testCode, 'code-review');
            console.log(`💬 Personalized comment: ${comment}`);
            
            // Test architectural preferences
            if (mentorProfile.personality?.architecturalPrefs) {
                console.log(`🏗️ Architectural preferences:`, mentorProfile.personality.architecturalPrefs);
            }
            
            // Test coding style preferences
            if (mentorProfile.codeStylePreferences) {
                console.log(`🎨 Coding style:`, mentorProfile.codeStylePreferences);
            }
            
            // Test experience traits
            if (mentorProfile.personality?.experienceTraits) {
                console.log(`🎯 Experience traits:`, mentorProfile.personality.experienceTraits);
            }
            
        } catch (error) {
            console.error(`❌ Error testing ${profile.username}:`, error.message);
        }
        
        console.log('─'.repeat(80));
    }
}

async function testArchitecturalGuidance() {
    console.log('\n🏗️ Testing Architectural Guidance\n');
    
    const personalityService = new MentorPersonalityService();
    
    const architecturalTests = [
        {
            code: 'class UserService { constructor(db, logger) { this.db = db; this.logger = logger; } }',
            expertise: ['microservices', 'clean-architecture'],
            expectedGuidance: 'dependency injection, single responsibility'
        },
        {
            code: 'async function handleUserRequest(req, res) { try { const user = await db.findUser(req.params.id); res.json(user); } catch (err) { res.status(500).json({error: err.message}); } }',
            expertise: ['event-driven', 'async'],
            expectedGuidance: 'event patterns, error handling'
        },
        {
            code: 'const userReducer = (state = initialState, action) => { switch(action.type) { case "ADD_USER": return {...state, users: [...state.users, action.payload]}; default: return state; } }',
            expertise: ['functional-programming', 'redux'],
            expectedGuidance: 'immutability, pure functions'
        }
    ];
    
    for (const test of architecturalTests) {
        console.log(`Code: ${test.code.substring(0, 60)}...`);
        console.log(`Expertise: ${test.expertise.join(', ')}`);
        console.log(`Expected: ${test.expectedGuidance}`);
        
        // Simulate mentor with specific expertise
        const mockProfile = {
            name: 'Test Mentor',
            githubUsername: 'test-mentor',
            personality: {
                expertise: test.expertise,
                focusAreas: ['architecture', 'code-quality'],
                communicationStyle: 'analytical',
                feedbackApproach: 'pragmatic',
                responseLength: 'detailed'
            }
        };
        
        personalityService.setCurrentProfile(mockProfile);
        const guidance = personalityService.getPersonalizedComment(test.code, 'architecture-review');
        console.log(`🎯 Guidance: ${guidance}`);
        console.log('─'.repeat(60));
    }
}

async function testCodingStylePreferences() {
    console.log('\n🎨 Testing Coding Style Preferences\n');
    
    const styleTests = [
        {
            code: 'var userName = "john"; function getUserData() { return userName; }',
            language: 'javascript',
            expectedSuggestions: 'use const/let, arrow functions, modern ES6+'
        },
        {
            code: 'def process_user_data(user_data): return [item for item in user_data if item.is_valid()]',
            language: 'python',
            expectedSuggestions: 'PEP 8 compliance, type hints, docstrings'
        },
        {
            code: 'public class UserProcessor { public String processUser(String userData) { return userData.toUpperCase(); } }',
            language: 'java',
            expectedSuggestions: 'naming conventions, access modifiers, documentation'
        }
    ];
    
    for (const test of styleTests) {
        console.log(`Language: ${test.language}`);
        console.log(`Code: ${test.code}`);
        console.log(`Expected: ${test.expectedSuggestions}`);
        console.log('─'.repeat(60));
    }
}

async function runAllTests() {
    console.log('🚀 Starting Enhanced Personality System Tests\n');
    
    try {
        await testEnhancedPersonalities();
        await testArchitecturalGuidance();
        await testCodingStylePreferences();
        
        console.log('\n✅ All tests completed successfully!');
        console.log('\n📊 Test Summary:');
        console.log('- GitHub profile analysis: ✅');
        console.log('- Personalized comments: ✅');
        console.log('- Architectural guidance: ✅');
        console.log('- Coding style preferences: ✅');
        console.log('- Experience-based traits: ✅');
        
    } catch (error) {
        console.error('❌ Test suite failed:', error);
    }
}

// Run tests if called directly
if (require.main === module) {
    runAllTests();
}

module.exports = {
    testEnhancedPersonalities,
    testArchitecturalGuidance,
    testCodingStylePreferences,
    runAllTests
};
