# Meeting Notes to Google Tasks Automation

This script monitors Gmail for meeting notes, extracts action items assigned to a specific user, creates Google Tasks, and sends a notification to Google Chat.

## 🚀 Features
- **Smart Filtering:** Only picks up tasks assigned to your name.
- **Weekend Aware:** Tasks created on Friday/Saturday/Sunday are automatically due on Monday.
- **Google Chat Integration:** Sends a desktop notification with a summary of all new tasks.
- **GitHub Ready:** Uses Script Properties to hide sensitive Webhook URLs and personal data.

## 🛠️ Setup Instructions

### 1. Google Apps Script Configuration
1. Open your project in [Google Apps Script](https://script.google.com/).
2. Click on the **Project Settings** (gear icon ⚙️).
3. Scroll down to **Script Properties** and add the following:
   - `MY_NAME`: Your name as it appears in meeting notes (e.g., `Malik`).
   - `TASK_LIST_ID`: Set to `@default` or your specific Task List ID.
   - `CHAT_WEBHOOK`: The Incoming Webhook URL from your Google Chat Space.

### 2. Enable Services
In the Apps Script editor, click the **+** next to **Services** in the left sidebar and add:
- **Google Tasks API**

### 3. Google Chat Webhook
1. Open a Space in Google Chat.
2. Click the Space name -> **Apps & integrations** -> **Webhooks**.
3. Add a name (e.g., "Task Bot") and copy the URL into your Script Properties.

### 4. Set the Trigger
1. Click the **Triggers** (clock icon ⏰) in the left sidebar.
2. Click **Add Trigger**.
3. Choose `processMeetingNotes` as the function to run.
4. Select **Time-driven** -> **Hour timer** -> **Every hour**.

## 📂 File Structure
- `Code.gs`: Contains the main logic for Gmail scanning and Task creation.
- `appsscript.json`: Manifest file (ensure Tasks API is enabled here).

## 🛡️ Security
This repository does **not** contain any private Webhook URLs or personal identifiers. All sensitive data is handled via Google Apps Script's internal `PropertiesService`.