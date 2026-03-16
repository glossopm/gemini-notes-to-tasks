# Meeting Notes to Google Tasks Automation

![banner](assets/images/banner.png)

Automatically turns Gemini meeting-note emails into Google Tasks and sends a Google Chat notification — no manual copying required.

## 🚀 Features

| Feature | Detail |
|---|---|
| **Smart filtering** | Only captures action items that contain your name |
| **Weekend-aware due dates** | Fri / Sat / Sun emails → task due Monday; weekdays → due tomorrow |
| **Your timezone** | Uses your Google account timezone automatically (no USA default) |
| **Duplicate prevention** | Applies a Gmail label so the same email is never processed twice |
| **Google Chat summary** | Instant webhook notification listing every new task |
| **Secure** | No credentials or personal data in source code — all stored in Script Properties |

---

## ⚡ Quick Setup (Automated — ~5 minutes)

### 1. Create the Apps Script project

1. Go to [script.google.com](https://script.google.com) → **New project**.
2. Paste the contents of `Code.gs` into the editor (replace the default empty function).
3. Paste the contents of `appsscript.json` into the manifest  
   *(View → Show manifest file, then replace the contents)*.

### 2. Enable the Google Tasks API

In the left sidebar click **+** next to **Services** → find **Google Tasks API** → **Add**.

### 3. Add your webhook URL and name

Open `Code.gs`, find `setupEnvironment()`, and fill in:

```js
'MY_NAME'      : 'Your Name',   // As it appears in meeting notes (e.g. 'Alex')
'TASK_LIST_ID' : '@default',    // Change after running listTaskLists() if needed
'CHAT_WEBHOOK' : 'https://chat.googleapis.com/v1/spaces/...'
```

### 4. Run the one-time setup

In the Apps Script editor, select **`firstTimeSetup`** from the function dropdown and click **▶ Run**.

This single function will:
- Save your Script Properties
- Create the hourly trigger automatically
- Print all your Task Lists to the log (copy the ID for the list you want to use)

> **Tip:** If you want a specific task list instead of the default one, copy the ID from the log, update `TASK_LIST_ID` in `setupEnvironment()`, and run `setupEnvironment()` again.

### 5. Get your Google Chat Webhook URL

1. Open a Space in Google Chat.
2. Click the Space name → **Apps & integrations** → **Manage webhooks**.
3. Click **Add webhook**, give it a name (e.g. `Task Bot`), and copy the URL.
4. Paste it into the `CHAT_WEBHOOK` value in `setupEnvironment()` and run the function again.

---

## 🕐 Timezone

Due dates are computed using `Session.getScriptTimeZone()`, which reads the timezone configured in your Google account. No manual timezone setting is required.

If your tasks are showing up on the wrong day, verify your timezone at  
**Google Account → Personal info → General preferences → Country/region**.

---

## 📂 File Structure

```
Code.gs          — Main logic: Gmail scanning, Task creation, Chat notification, setup helpers
appsscript.json  — Manifest: enables the Google Tasks advanced service
```

### Functions at a glance

| Function | Purpose |
|---|---|
| `processMeetingNotes()` | Main function — run hourly via trigger |
| `addTask(title, meeting)` | Creates a task with a weekend-aware due date |
| `sendGoogleChatNotification(list)` | Posts a summary to Google Chat |
| `listTaskLists()` | Prints all task lists and their IDs to the log |
| `setupEnvironment()` | Saves your name, task list ID, and webhook to Script Properties |
| `setupTrigger()` | Creates (or replaces) the hourly trigger |
| `firstTimeSetup()` | Runs all three setup steps at once |

---

## 🛡️ Security

All sensitive values (`MY_NAME`, `TASK_LIST_ID`, `CHAT_WEBHOOK`) are stored exclusively in  
**Project Settings → Script Properties** and never committed to source control.