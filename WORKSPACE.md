# 💼 DK Workspace Management

The workspace feature allows you to manage multiple projects and modules with automated actions. Perfect for opening entire development environments with a single command.

## 🚀 Quick Start

### 1. Initialize Workspace Configuration

```bash
dk workspace init
# or
dk ws init
```

This creates a config file at:

- **Windows:** `%USERPROFILE%\.digicroz\dk\workspaces.config.json`
- **Mac/Linux:** `~/.digicroz/dk/workspaces.config.json`

### 2. Edit Configuration

```bash
dk workspace config
# Opens the config file in VS Code
```

### 3. Use Your Workspace

```bash
dk workspace
# or just
dk ws
```

## 📋 Available Commands

| Command               | Alias          | Description                    |
| --------------------- | -------------- | ------------------------------ |
| `dk workspace`        | `dk ws`        | Interactive workspace selector |
| `dk workspace init`   | `dk ws init`   | Initialize configuration       |
| `dk workspace config` | `dk ws config` | Open config in VS Code         |
| `dk workspace list`   | `dk ws list`   | List all workspaces            |

## 📝 Configuration Structure

```json
{
  "version": "1.0.0",
  "workspaces": [
    {
      "name": "My Project",
      "description": "Optional description",
      "color": "cyan",
      "modules": [
        {
          "name": "Frontend",
          "isIncludeByDefault": true,
          "path": "C:/projects/frontend",
          "defaultActionIndex": 0,
          "actions": [
            { "type": "open-in-vscode" },
            { "type": "run-command", "command": "npm install" }
          ]
        }
      ]
    }
  ]
}
```

## 🎯 Action Types

### 1. **open-in-vscode**

Opens the module path in VS Code.

```json
{ "type": "open-in-vscode" }
```

### 2. **run-command**

Runs a terminal command in the module directory.

```json
{
  "type": "run-command",
  "command": "npm install",
  "description": "Install dependencies"
}
```

**Examples:**

- `"command": "git pull"` - Pull latest changes
- `"command": "npm start"` - Start dev server
- `"command": "docker-compose up -d"` - Start containers

### 3. **run-script**

Executes a bash/PowerShell script.

```json
{
  "type": "run-script",
  "scriptPath": "./scripts/setup.sh",
  "description": "Run setup script"
}
```

### 4. **open-url**

Opens a URL in the default browser.

```json
{
  "type": "open-url",
  "url": "http://localhost:3000",
  "description": "Open app in browser"
}
```

### 5. **open-folder**

Opens the module folder in file explorer.

```json
{ "type": "open-folder" }
```

## 🎨 Workspace Colors

Available colors for UI theming:

- `cyan` (default)
- `green`
- `yellow`
- `blue`
- `magenta`
- `red`

## 💡 Usage Examples

### Example 1: Full Stack Development

```json
{
  "name": "E-Commerce App",
  "color": "cyan",
  "modules": [
    {
      "name": "React Frontend",
      "isIncludeByDefault": true,
      "path": "C:/projects/ecommerce/frontend",
      "defaultActionIndex": 0,
      "actions": [
        { "type": "open-in-vscode" },
        { "type": "run-command", "command": "git pull" },
        { "type": "run-command", "command": "npm install" },
        { "type": "run-command", "command": "npm start" },
        { "type": "open-url", "url": "http://localhost:3000" }
      ]
    },
    {
      "name": "Node.js Backend",
      "isIncludeByDefault": true,
      "path": "C:/projects/ecommerce/backend",
      "defaultActionIndex": 0,
      "actions": [
        { "type": "open-in-vscode" },
        { "type": "run-command", "command": "npm install" }
      ]
    }
  ]
}
```

### Example 2: Microservices

```json
{
  "name": "Microservices",
  "color": "green",
  "modules": [
    {
      "name": "API Gateway",
      "isIncludeByDefault": true,
      "path": "C:/projects/services/gateway",
      "defaultActionIndex": 0,
      "actions": [
        { "type": "open-in-vscode" },
        { "type": "run-command", "command": "git status" }
      ]
    },
    {
      "name": "Auth Service",
      "isIncludeByDefault": true,
      "path": "C:/projects/services/auth",
      "defaultActionIndex": 0,
      "actions": [{ "type": "open-in-vscode" }]
    }
  ]
}
```

## 🔄 Workflow

1. **Select Workspace** - Choose from your configured workspaces
2. **Choose Open Mode:**
   - **Open default modules** - Opens modules where `isIncludeByDefault: true`
   - **Open all modules** - Opens all modules
   - **Select manually** - Use checkboxes to choose (Space to toggle)
3. **Actions Execute Sequentially** - All actions run in the order defined

## ⚙️ Advanced Features

### Sequential Action Execution

Actions execute in order, allowing you to chain commands:

```json
"actions": [
  { "type": "open-in-vscode" },
  { "type": "run-command", "command": "git pull" },
  { "type": "run-command", "command": "npm install" },
  { "type": "run-command", "command": "npm start" }
]
```

### Git Integration

Add git commands to sync before opening:

```json
"actions": [
  { "type": "run-command", "command": "git fetch" },
  { "type": "run-command", "command": "git status" },
  { "type": "open-in-vscode" }
]
```

### Environment Setup

Run setup scripts automatically:

```json
"actions": [
  { "type": "run-script", "scriptPath": "./setup-env.sh" },
  { "type": "open-in-vscode" }
]
```

## 📤 Import/Export

### During Init

When running `dk workspace init`, you can choose to import an existing config:

1. Select "Import from another location"
2. Provide the path to your config file
3. Config is copied to the standard location

### Share Configurations

Share your `workspaces.config.json` file with your team to ensure everyone has the same setup.

## 🛡️ Best Practices

1. **Use Absolute Paths** - Avoid relative paths for better reliability
2. **Default Modules** - Set frequently used modules as default
3. **Descriptive Names** - Use clear module names
4. **Group Related** - Keep related modules in the same workspace
5. **Document Actions** - Add descriptions to actions
6. **Test Actions** - Verify commands work before adding

## 🐛 Troubleshooting

### Config Not Found

```bash
dk workspace init
```

### Can't Open VS Code

Ensure VS Code `code` command is in your PATH.

### Path Not Found

Verify all module paths exist and use absolute paths.

### Action Fails

Check that commands are valid for your OS and terminal.

## 🎯 Example Use Cases

- **Monorepo Management** - Open all packages at once
- **Microservices** - Start all services together
- **Full Stack Dev** - Frontend + Backend + DB tools
- **Multi-Repo Projects** - Manage related repositories
- **Client Projects** - Quick context switching between clients

---

See `workspaces.config.example.json` for a complete example configuration.
