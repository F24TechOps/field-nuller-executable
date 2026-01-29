# Field Nuller - Standalone Version

A standalone executable for clearing specified fields from contacts in the data-crypt API.

## Building the Executable

1. Install dependencies:
```bash
npm install
```

2. Build the executable:
```bash
npm run build
```

This will create executables in the `dist/` folder for:
- Linux (field-nuller-linux)
- Windows (field-nuller-win.exe) 
- macOS (field-nuller-macos)

## Usage

### Development Mode
```bash
npm start
```

### Production Mode (after building)
```bash
./dist/field-nuller-linux  # Linux
./dist/field-nuller-win.exe  # Windows
./dist/field-nuller-macos  # macOS
```

## Setup

1. Configure environment variables in `.env`:
- `baseUrl` - API base URL (should be `https://api.data-crypt.com/api/v1.3`)
- `tokenUrl` - OAuth token URL
- `flow` - OAuth flow (client_credentials)
- `scope` - OAuth scope

2. Add contact IDs to `inputData.txt` (one ID per line)

## Features

- **Standalone**: No Node.js installation required for end users
- **Interactive**: Prompts for API credentials and field selection
- **Cross-platform**: Builds for Linux, Windows, and macOS
- **Secure**: Credentials entered interactively, not stored

## Process Flow

1. **Authentication**: Prompts for credentials and gets OAuth token
2. **Field Selection**: User specifies which fields to clear
3. **Confirmation**: Shows selected fields and asks for confirmation
4. **JSON Creation**: Creates batches of 100 contacts with fields set to `null`
5. **API Requests**: Sends batches to `/contacts/update` endpoint
6. **Results**: Saves API responses to `results/` folder

## Output Files

- `jsonToPost.json` - Batched request data
- `results/batch_{number}_response.json` - Successful API responses
- `results/batch_{number}_error.json` - Failed requests with error details
