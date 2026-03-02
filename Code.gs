// --- GLOBAL CONFIGURATION ---
// Values are stored in Project Settings > Script Properties (never hardcoded here)
const YOUR_NAME               = PropertiesService.getScriptProperties().getProperty('MY_NAME');
const TASK_LIST_ID            = PropertiesService.getScriptProperties().getProperty('TASK_LIST_ID');
const GOOGLE_CHAT_WEBHOOK_URL = PropertiesService.getScriptProperties().getProperty('CHAT_WEBHOOK');

const LABEL_NAME    = 'Processed_to_Tasks'; // Gmail label used to prevent reprocessing
const LOOKBACK_DAYS = '1d';                 // Only scan emails from the last 24 hours

// ---------------------------------------------------------------------------
// MAIN FUNCTION — run this on a time-based trigger (e.g. every hour)
// ---------------------------------------------------------------------------
function processMeetingNotes() {
  if (!YOUR_NAME || !TASK_LIST_ID || !GOOGLE_CHAT_WEBHOOK_URL) {
    console.error('Missing required Script Properties. Run setupEnvironment() first (MY_NAME, TASK_LIST_ID, CHAT_WEBHOOK).');
    return;
  }

  const query = `in:inbox subject:Notes "Suggested next steps" -label:${LABEL_NAME} newer_than:${LOOKBACK_DAYS}`;
  const threads = GmailApp.search(query, 0, 10);

  if (threads.length === 0) {
    console.log('No new meeting notes found for ' + YOUR_NAME);
    return;
  }

  const label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  const summaryForChat = [];

  threads.forEach(thread => {
    const messages = thread.getMessages();
    let targetMsg = null;
    let body = '';

    // Find the newest message in the thread that contains "Suggested next steps"
    // (Gmail searches threads, so a reply/forward may be the newest but lack the section)
    for (let i = messages.length - 1; i >= 0; i--) {
      const candidateBody = messages[i].getPlainBody();
      if (candidateBody && candidateBody.includes('Suggested next steps')) {
        targetMsg = messages[i];
        body = candidateBody;
        break;
      }
    }

    if (!targetMsg) return;

    const subject = targetMsg.getSubject();

    // Extract only the action-items section (between the two known headings)
    const afterSteps = body.split('Suggested next steps')[1];
    const section    = afterSteps.includes('Meeting records')
      ? afterSteps.split('Meeting records')[0]
      : afterSteps;

    // Each paragraph-separated block is one action item
    section.split(/\n\s*\n/).forEach(block => {
      // Collapse line breaks and strip leading bullets / whitespace
      let task = block.replace(/\r?\n|\r/g, ' ').trim();
      task = task.replace(/^[\s\-*\[\]]+/, '').replace(/  +/g, ' ');

      if (task && task.includes(YOUR_NAME)) {
        // Pull the meeting name from between single quotes in the subject, or use the full subject
        const meetingName = subject.match(/'([^']+)'/)?.[1] || subject;
        addTask(task, meetingName);
        summaryForChat.push(`• ${task}: *${meetingName}*`);
      }
    });

    thread.addLabel(label);
  });

  if (summaryForChat.length > 0) {
    sendGoogleChatNotification(summaryForChat);
  }
}

// ---------------------------------------------------------------------------
// Create a Google Task with a weekend-aware due date
// Due dates are calculated in the script owner's timezone (from account settings)
// ---------------------------------------------------------------------------
function addTask(title, meetingName) {
  try {
    const timeZone   = Session.getScriptTimeZone();
    const now        = new Date();
    const dayOfWeek  = parseInt(Utilities.formatDate(now, timeZone, 'u'), 10); // 1=Mon … 7=Sun

    // Skip weekends: tasks from Fri/Sat/Sun are all due the following Monday
    const daysToAdd = (dayOfWeek === 5) ? 3   // Friday
                    : (dayOfWeek === 6) ? 2   // Saturday
                    : (dayOfWeek === 7) ? 1   // Sunday
                    :                     1;  // Mon–Thu → due tomorrow

    const dueDate    = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
    const dueDateStr = Utilities.formatDate(dueDate, timeZone, 'yyyy-MM-dd');

    Tasks.Tasks.insert(
      { title, notes: 'From meeting: ' + meetingName, due: dueDateStr + 'T00:00:00.000Z' },
      TASK_LIST_ID
    );

    console.log(`Task "${title}" scheduled for ${dueDateStr} (${timeZone})`);
  } catch (e) {
    console.error('Error creating task: ' + e.toString());
  }
}

// ---------------------------------------------------------------------------
// Post a summary message to Google Chat via webhook
// ---------------------------------------------------------------------------
function sendGoogleChatNotification(taskList) {
  const text = `📌 *${taskList.length} New Task${taskList.length > 1 ? 's' : ''} Created*\n`
             + taskList.join('\n')
             + '\n\n🔗 <https://tasks.google.com|Open Google Tasks>';

  try {
    UrlFetchApp.fetch(GOOGLE_CHAT_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text })
    });
  } catch (e) {
    console.error('Chat notification error: ' + e.toString());
  }
}

// ---------------------------------------------------------------------------
// SETUP HELPERS — run these once during initial configuration
// ---------------------------------------------------------------------------

// Step 1 — Print all task lists so you can copy the right TASK_LIST_ID
function listTaskLists() {
  Tasks.Tasklists.list().items.forEach(list => {
    console.log(`List: "${list.title}" | ID: ${list.id}`);
  });
}

// Step 2 — Store your personal settings as Script Properties
//           Edit the values below, then run this function once.
//           Re-running this function will only fill in keys that are not yet set.
function setupEnvironment() {
  const props    = PropertiesService.getScriptProperties();
  const existing = props.getProperties();
  const defaults = {
    'MY_NAME'      : 'Your Name',             // As it appears in meeting notes
    'TASK_LIST_ID' : '@default',              // Or paste the ID from listTaskLists()
    'CHAT_WEBHOOK' : 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=...'
  };

  // Only write keys that are not already set, so existing config is never overwritten
  const missing = Object.fromEntries(
    Object.entries(defaults).filter(([key]) => !existing[key])
  );

  if (Object.keys(missing).length > 0) {
    props.setProperties(missing);
    console.log('Script Properties initialized: ' + Object.keys(missing).join(', '));
  } else {
    console.log('All Script Properties already set — no changes made.');
  }
}

// Step 3 — Create the hourly trigger automatically (run once; removes any existing trigger first)
function setupTrigger() {
  // Remove existing triggers for processMeetingNotes to avoid duplicates
  ScriptApp.getProjectTriggers()
    .filter(t => t.getHandlerFunction() === 'processMeetingNotes')
    .forEach(t => ScriptApp.deleteTrigger(t));

  ScriptApp.newTrigger('processMeetingNotes')
    .timeBased()
    .everyHours(1)
    .create();

  console.log('Hourly trigger created for processMeetingNotes.');
}

// Runs all setup steps at once. Safe to rerun — existing Script Properties are never overwritten.
function firstTimeSetup() {
  setupEnvironment();
  setupTrigger();
  listTaskLists();
}
