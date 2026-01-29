#!/usr/bin/env node

const fs = require('fs').promises;
const path = require('path');
const readline = require('readline');

const defaultConfig = {
    baseUrl: 'https://api.data-crypt.com/api/v1.3',
    tokenUrl: 'https://identity.data-crypt.com/connect/token',
    flow: 'client_credentials',
    scope: 'api.Master'
};

try {
    require('dotenv').config();
} catch (e) {
}

const config = {
    baseUrl: process.env.baseUrl || defaultConfig.baseUrl,
    tokenUrl: process.env.tokenUrl || defaultConfig.tokenUrl,
    flow: process.env.flow || defaultConfig.flow,
    scope: process.env.scope || defaultConfig.scope
};

console.log('Configuration loaded:');
console.log(`  Base URL: ${config.baseUrl}`);
console.log(`  Token URL: ${config.tokenUrl}`);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question) {
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            resolve(answer);
        });
    });
}

process.on('SIGINT', () => {
    console.log('\nProcess interrupted by user');
    rl.close();
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\nProcess terminated');
    rl.close();
    process.exit(0);
});

async function getToken() {
    try {
        const key = await askQuestion('Enter API key: ');
        const secret = await askQuestion('Enter API secret: ');
        
        const tokenResponse = await fetch(config.tokenUrl, {
            method: "POST",
            headers: {
                "Content-type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
                grant_type: config.flow,
                scope: config.scope,
                client_id: key,
                client_secret: secret,
            }),
        });

        const tokenJson = await tokenResponse.json();
        return tokenJson.access_token;
    } catch (err) {
        return err;
    }
}

async function createJSON(fieldsToClear) {
    try {
        console.log('createJSON: Starting...');
        console.log('createJSON: Reading inputData.txt...');
        
        const inputData = await fs.readFile('inputData.txt', 'utf8');
        const ids = inputData
            .split(/\r?\n/)
            .map(id => id.trim())
            .filter(id => id.length > 0);

        console.log(`createJSON: Found ${ids.length} IDs`);

        if (ids.length === 0) {
            throw new Error('No IDs found in inputData.txt');
        }

        console.log('createJSON: Creating batches...');
        const batches = [];
        for (let i = 0; i < ids.length; i += 100) {
            const batchIds = ids.slice(i, i + 100);
            
            const items = batchIds.map(id => {
                const fields = {};
                fieldsToClear.forEach(field => {
                    fields[field] = null;
                });

                return {
                    id: id,
                    fields: fields
                };
            });

            batches.push({ items: items });
        }

        console.log(`createJSON: Writing ${batches.length} batches to jsonToPost.json...`);
        await fs.writeFile('jsonToPost.json', JSON.stringify(batches, null, 2));
        console.log(`Created ${batches.length} batches with ${ids.length} total IDs`);
        return batches;
        
    } catch (error) {
        console.error('Error creating JSON:', error);
        throw error;
    }
}

async function sendBatchRequest(batch, authToken) {
    try {
        const response = await fetch(`${config.baseUrl}/contacts/update`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${authToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(batch)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('API Error Response:', errorText);
            throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }

        const result = await response.json();
        return result;
        
    } catch (error) {
        console.error('Error sending batch request:', error);
        throw error;
    }
}

async function sendAllRequests(authToken) {
    try {
        await fs.mkdir('results', { recursive: true });
        
        const jsonContent = await fs.readFile('jsonToPost.json', 'utf8');
        const batches = JSON.parse(jsonContent);
        
        console.log(`Processing ${batches.length} batches...`);
        
        const results = [];
        
        for (let i = 0; i < batches.length; i++) {
            const batch = batches[i];
            console.log(`Sending batch ${i + 1}/${batches.length} with ${batch.items.length} items`);
            
            try {
                const result = await sendBatchRequest(batch, authToken);
                
                const responseFile = path.join('results', `batch_${i + 1}_response.json`);
                await fs.writeFile(responseFile, JSON.stringify(result, null, 2));
                
                results.push({ batch: i + 1, status: 'success', result });
                console.log(`Batch ${i + 1} completed successfully - response saved to ${responseFile}`);
                
                if (i < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 100));
                }
                
            } catch (error) {
                const errorFile = path.join('results', `batch_${i + 1}_error.json`);
                await fs.writeFile(errorFile, JSON.stringify({
                    error: error.message,
                    batch: batch,
                    timestamp: new Date().toISOString()
                }, null, 2));
                
                results.push({ batch: i + 1, status: 'error', error: error.message });
                console.error(`Batch ${i + 1} failed: ${error.message} - error saved to ${errorFile}`);
            }
        }

        const successful = results.filter(r => r.status === 'success').length;
        const failed = results.filter(r => r.status === 'error').length;
        
        console.log(`\nSummary: ${successful} successful, ${failed} failed batches`);
        
        return results;
        
    } catch (error) {
        console.error('Error in sendAllRequests:', error);
        throw error;
    }
}

async function main() {
    try {
        console.log('Field Nuller - Clear fields from contacts\n');
        console.log('IMPORTANT: Ensure your contact IDs are in inputData.txt (one ID per line)\n');
        
        const authToken = await getToken();
        console.log('Token retrieved successfully\n');
        
        const fieldsInput = await askQuestion('Enter field names to clear (comma-separated): ');
        
        if (!fieldsInput || fieldsInput.trim() === '') {
            console.error('Error: At least one field name must be provided');
            process.exit(1);
        }
        
        const fieldsToClear = fieldsInput.split(',').map(field => field.trim()).filter(field => field.length > 0);
        
        if (fieldsToClear.some(field => !field || field.trim() === '')) {
            console.error('Error: Field names cannot be empty');
            process.exit(1);
        }
        
        console.log(`\nFields to clear: ${fieldsToClear.join(', ')}`);
        
        const confirm = await askQuestion('\nContinue? (y/n): ');
        console.log(`User entered: "${confirm}"`);
        
        if (confirm.toLowerCase() !== 'y') {
            console.log('Operation cancelled');
            process.exit(0);
        }
        
        console.log('Starting field clearing process...\n');
        console.log('About to call createJSON...');
        
        const batches = await createJSON(fieldsToClear);
        console.log('JSON creation completed');
        
        const results = await sendAllRequests(authToken);
        console.log('All requests completed');
        
        console.log('\nProcess completed successfully!');
        process.exit(0);
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

main();
