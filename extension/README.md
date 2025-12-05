# Danny Chrome Extension

A Chrome side panel extension that shows your tasks and lets you chat with Danny from any webpage.

## Installation

### Development Mode

1. Open Chrome and go to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select this `extension/` folder
5. The Danny icon should appear in your toolbar

### Generate Icons

The extension needs PNG icons. You can generate them from the SVG using a tool like ImageMagick:

```bash
cd extension/icons

# Using ImageMagick
convert icon.svg -resize 16x16 icon16.png
convert icon.svg -resize 32x32 icon32.png
convert icon.svg -resize 48x48 icon48.png
convert icon.svg -resize 128x128 icon128.png

# Or using rsvg-convert (librsvg)
rsvg-convert -w 16 -h 16 icon.svg > icon16.png
rsvg-convert -w 32 -h 32 icon.svg > icon32.png
rsvg-convert -w 48 -h 48 icon.svg > icon48.png
rsvg-convert -w 128 -h 128 icon.svg > icon128.png
```

Alternatively, use an online tool like [CloudConvert](https://cloudconvert.com/svg-to-png) or create them manually.

## Configuration

### Set Danny URL

By default, the extension connects to `http://localhost:3001` for development.

For production:
1. Click the Danny extension icon to open the side panel
2. If it can't connect, click "Configure URL"
3. Enter your Vercel deployment URL (e.g., `https://danny-tasks.vercel.app`)

The URL is stored in Chrome's local storage.

### API Key

The API key is configured in the web app itself (not the extension). Once you set it in the settings screen, it's stored in the browser's localStorage and persists across sessions.

## Usage

1. Click the Danny icon in your Chrome toolbar
2. The side panel opens on the right side of your browser
3. View your tasks filtered by view (Today, This Week, High Priority, etc.)
4. Click a task to see details and mark it complete
5. Use the chat input at the bottom to talk to Danny

## Features

- **Side Panel**: Stays open as you browse different pages
- **Task Views**: Switch between Today, This Week, High Priority, and All Tasks
- **Task Details**: Click any task to see full details, description, and metadata
- **Complete Tasks**: Mark tasks done with optional time tracking
- **Chat with Danny**: Natural language task management

## Troubleshooting

### "Couldn't connect" error

1. Make sure the Danny server/web app is running
2. Check the URL configuration
3. Ensure CORS is enabled on the server (it is by default)

### Extension not loading

1. Make sure you generated the PNG icon files
2. Check the Chrome developer console for errors
3. Try reloading the extension from `chrome://extensions/`

### Side panel doesn't open

1. Make sure you clicked "Load unpacked" and selected the correct folder
2. Check that manifest.json is valid (no syntax errors)
3. The `sidePanel` permission must be present in the manifest

