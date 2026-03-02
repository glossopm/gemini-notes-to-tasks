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
  const query = `in:inbox subject:Notes "Suggested next steps" -label:${LABEL_NAME} newer_than:${LOOKBACK_DAYS}`;
  const threads = GmailApp.search(query, 0, 10);

  if (threads.length === 0) {
    console.log('No new meeting notes found for ' + YOUR_NAME);
    return;
  }

  const label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);
  const summaryForChat = [];

  threads.forEach(thread => {
    const lastMsg = thread.getMessages().pop();
    const body    = lastMsg.getPlainBody();
    const subject = lastMsg.getSubject();

    if (!body.includes('Suggested next steps')) return;

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
//           Edit the values below, then run this function once
function setupEnvironment() {
  PropertiesService.getScriptProperties().setProperties({
    'MY_NAME'      : 'Your Name',             // As it appears in meeting notes
    'TASK_LIST_ID' : '@default',              // Or paste the ID from listTaskLists()
    'CHAT_WEBHOOK' : 'https://chat.googleapis.com/v1/spaces/SPACE_ID/messages?key=...'
  });
  console.log('Script Properties saved. Run listTaskLists() to find your Task List ID.');
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

// Run all three setup steps at once (listTaskLists output will help you fill in TASK_LIST_ID)
function firstTimeSetup() {
  setupEnvironment();
  setupTrigger();
  listTaskLists();
}
