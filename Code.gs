// --- GLOBAL CONFIGURATION ---
const scriptProperties = PropertiesService.getScriptProperties();

const YOUR_NAME               = scriptProperties.getProperty('MY_NAME');      // Your name as it appears in notes (common names may struggle)
const TASK_LIST_ID            = scriptProperties.getProperty('TASK_LIST_ID');    // Replace with your long ID from listTaskLists()
const GOOGLE_CHAT_WEBHOOK_URL = scriptProperties.getProperty('CHAT_WEBHOOK');
const LABEL_NAME   = "Processed_to_Tasks";      // Label to prevent duplicates
const LOOKBACK_DAYS = "1d";                     // Only check the last 24 hours

function processMeetingNotes() {
  // The query now uses the global variables
  const query = 'in:inbox subject:Notes "Suggested next steps" -label:' + LABEL_NAME + ' newer_than:' + LOOKBACK_DAYS;
  const threads = GmailApp.search(query, 0, 10);
  
  if (threads.length === 0) {
    console.log("No new notes found for " + YOUR_NAME);
    return;
  }
  let summaryForChat = []; // Initialize this at the top of the function
  let label = GmailApp.getUserLabelByName(LABEL_NAME) || GmailApp.createLabel(LABEL_NAME);

  threads.forEach(thread => {
    const lastMsg = thread.getMessages().pop();
    const body = lastMsg.getPlainBody();
    const subject = lastMsg.getSubject();

    if (body.includes("Suggested next steps")) {
      const afterSteps = body.split("Suggested next steps")[1];
      const section = afterSteps.includes("Meeting records") ? afterSteps.split("Meeting records")[0] : afterSteps;
      const blocks = section.split(/\n\s*\n/);
      
      blocks.forEach(block => {
        let cleanTask = block.replace(/\r?\n|\r/g, " ").trim();
        cleanTask = cleanTask.replace(/^[\s\-\*\[\]]+/, "").replace("  ", " ");

        if (cleanTask.includes(YOUR_NAME)) {
          let meetingName = subject.match(/'([^']+)'/)?.[1] || subject;
          addTask(cleanTask, meetingName);
          summaryForChat.push(`• ${cleanTask}: *${meetingName}*`);
        }
      });
      thread.addLabel(label);
    }
  });
  
  if (summaryForChat.length > 0) {
    sendGoogleChatNotification(summaryForChat);
  }
}

function addTask(title, meetingName) {
  try {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
    let daysToAdd;

    // Determine the next available Monday or Next Day
    if (dayOfWeek === 5) {         // It's Friday -> Move to Monday (+3)
      daysToAdd = 3;
    } else if (dayOfWeek === 6) {  // It's Saturday -> Move to Monday (+2)
      daysToAdd = 2;
    } else {                       // Sun-Thu -> Move to Tomorrow (+1)
      daysToAdd = 1;
    }

    const dueDate = new Date();
    dueDate.setDate(today.getDate() + daysToAdd);
    
    // Format for Google Tasks "All Day"
    const dateStr = dueDate.toISOString().split('T')[0] + "T00:00:00.000Z";

    const task = {
      title: title,
      notes: "From: " + meetingName,
      due: dateStr
    };
    
    Tasks.Tasks.insert(task, TASK_LIST_ID); 
    console.log(`Task scheduled for ${dueDate.toDateString()}`);
  } catch (e) {
    console.log("Error in addTask: " + e.toString());
  }
}

function sendGoogleChatNotification(taskList) {
  const message = {
    "text": `📌 *${taskList.length} New Tasks Created*\n${taskList.join('\n')}\n\n🔗 <users/all> <https://tasks.google.com|Open Google Tasks>`
  };
  
  const options = {
    "method": "post",
    "contentType": "application/json",
    "payload": JSON.stringify(message)
  };
  
  try {
    UrlFetchApp.fetch(GOOGLE_CHAT_WEBHOOK_URL, options);
  } catch (e) {
    console.log("Chat Notification Error: " + e.toString());
  }
}

function listTaskLists() {
  const taskLists = Tasks.Tasklists.list();
  taskLists.items.forEach(list => {
    console.log('List Name: ' + list.title + ' | ID: ' + list.id);
  });
}

function setupEnvironment() {
  const scriptProperties = PropertiesService.getScriptProperties();
  
  scriptProperties.setProperties({
    'MY_NAME': 'Your name',
    'TASK_LIST_ID': '@default',
    'CHAT_WEBHOOK': 'https://chat.googleapis.com/v1/spaces/...', // Your full URL
    'MY_CHAT_ID': '123456789' // Your numerical ID for tagging
  });
  
  console.log("Environment variables set successfully!");
}
