// background.js

const MAX_CONTENT_HEIGHT = 750; // Max desired height for the *content* area
const WINDOW_CHROME_HEIGHT_BUFFER = 50; // Extra space for title bar, borders etc.
const INITIAL_WINDOW_HEIGHT = MAX_CONTENT_HEIGHT + WINDOW_CHROME_HEIGHT_BUFFER; // Start at max height

// --- Date Parsing Functions (Using CURRENT Year) ---
function parseDueDateCurrentYear(dateString) {
    if (!dateString || dateString === 'No Due Date') { return null; }
    const today = new Date(); const currentYear = today.getFullYear();
    const lowerCaseDate = dateString.toLowerCase().trim();
    let parsedDate = null;
    if (lowerCaseDate === 'today') { parsedDate = new Date(today); }
    else if (lowerCaseDate === 'tomorrow') { parsedDate = new Date(today); parsedDate.setDate(today.getDate() + 1); }
    else if (lowerCaseDate === 'yesterday') { parsedDate = new Date(today); parsedDate.setDate(today.getDate() - 1); }
    else {
        const dateStringWithoutYear = dateString.replace(/,?\s*\d{4}$/, '');
        const tempDate = new Date(dateStringWithoutYear);
        if (!isNaN(tempDate.getTime())) { parsedDate = tempDate; }
        else { const tempDateWithYear = new Date(dateString); if (!isNaN(tempDateWithYear.getTime())) { parsedDate = tempDateWithYear; } }
    }
    if (parsedDate && !isNaN(parsedDate.getTime())) { parsedDate.setFullYear(currentYear); return parsedDate; }
    // console.warn(`Could not reliably parse date string: "${dateString}"`); // Removed log
    return null;
}
function formatDueDateDeltaCurrentYear(dueDateString) {
    const dueDate = parseDueDateCurrentYear(dueDateString); if (!dueDate) { return ""; }
    const today = new Date(); today.setHours(0, 0, 0, 0); dueDate.setHours(0, 0, 0, 0);
    const diffTime = dueDate.getTime() - today.getTime(); const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays === 0) { return "(Due today)"; } else if (diffDays > 0) { return `(Due in ${diffDays} day${diffDays !== 1 ? 's' : ''})`; }
    else { const overdueDays = Math.abs(diffDays); return `(${overdueDays} day${overdueDays !== 1 ? 's' : ''} overdue)`; }
}
// --- End Date Functions ---


// --- Main Message Listener ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    // --- Handler for Popup Window Creation ---
    if (message.action === "createPopup") {
        // Basic validation
        if (!message.data || typeof message.data.editorContentHTML !== 'string' || !Array.isArray(message.data.linkPillsData) || typeof message.data.width !== 'number') {
             // Keep essential error response for debugging if creation fails
             sendResponse({ success: false, error: "Invalid or missing popup data fields" });
             return false;
        }

        const { editorContentHTML, width, activeTabLabel, accountName, headerAccountName, headerSidenavTitle, headerDueDate, linkPillsData } = message.data;

        try {
            // --- Processing: Ticket, Date Delta, Title, Header ---
            const ticketRegex = /\b(\d{6})\b/; const ticketNumber = editorContentHTML.match(ticketRegex)?.[1] || null;
            const dueDateDeltaString = formatDueDateDeltaCurrentYear(headerDueDate);
            const safePopupWindowTitle = `${activeTabLabel || 'Notes'} for ${accountName || 'Unknown Account'}`.replace(/</g, '<').replace(/>/g, '>');
            let ticketButtonHtml = ''; if (ticketNumber) { const ticketUrl = `https://vendasta.zendesk.com/agent/tickets/${ticketNumber}`; ticketButtonHtml = `<a href="${ticketUrl}" target="_blank" rel="noopener noreferrer" class="header-ticket-button">Open Ticket (${ticketNumber})</a>`; }
            let linkPillsHtml = ''; if (linkPillsData.length > 0) { linkPillsHtml = `<div class="header-pills-container">`; linkPillsData.forEach(pill => { const safeText = pill.text.replace(/</g, '<').replace(/>/g, '>').replace(/"/g, '"'); const safeHref = pill.href.replace(/"/g, '"'); linkPillsHtml += `<a href="${safeHref}" target="_blank" rel="noopener noreferrer" class="header-link-pill" title="${safeHref}">${safeText}</a>`; }); linkPillsHtml += `</div>`; }
            const safeHeaderAccountName = headerAccountName.replace(/</g, '<').replace(/>/g, '>');
            const safeHeaderSidenavTitle = headerSidenavTitle.replace(/</g, '<').replace(/>/g, '>');
            const safeHeaderDueDate = headerDueDate.replace(/</g, '<').replace(/>/g, '>');
            const headerHtml = `<div class="header-content"><h1>${safeHeaderAccountName}</h1><h2>${safeHeaderSidenavTitle}</h2><h3>${safeHeaderDueDate ? `Due: ${safeHeaderDueDate}` : 'No Due Date'}${dueDateDeltaString ? `<span class="due-date-delta">${dueDateDeltaString}</span>` : ''}</h3>${ticketButtonHtml ? `<div class="header-button-row">${ticketButtonHtml}</div>` : ''}${linkPillsHtml}</div><hr />`;

            // --- Construct Full Popup HTML (with embedded resize script) ---
            const popupHtml = `
                <!DOCTYPE html>
                <html>
                <head>
                    <title>${safePopupWindowTitle}</title>
                    <meta charset="UTF-8">
                    <style>
                        /* Basic Reset & Body */ body { margin: 0; padding: 0; font-family: system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen,Ubuntu,Cantarell,"Fira Sans","Droid Sans","Helvetica Neue",sans-serif; background-color: rgba(25, 25, 25, 0.9); color: #e0e0e0; height: 100vh; box-sizing: border-box; overflow: hidden; }
                        /* --- Content Wrapper --- */ .ws-popout-modal { padding: 20px; border-radius: 5px; font-size: 14px; line-height: 1.6; box-shadow: 0 4px 12px rgba(0,0,0,.5); height: 100%; /* Fill the window height */ overflow-y: auto; /* Scroll if content overflows */ box-sizing: border-box; }
                        /* Header */ .ws-popout-modal .header-content h1 { font-size: 1.6em; margin: 0 0 0.1em 0; color: #fff; font-weight: 600; } .ws-popout-modal .header-content h2 { font-size: 1.3em; margin: 0 0 0.2em 0; color: #bdbdbd; font-weight: 500; } .ws-popout-modal .header-content h3 { font-size: 1.1em; margin: 0 0 0.5em 0; color: #9e9e9e; font-weight: 400; display: inline-block; } .ws-popout-modal .due-date-delta { margin-left: 8px; font-style: italic; opacity: .8; white-space: nowrap; } .ws-popout-modal .header-button-row { margin-top: 10px; margin-bottom: 8px; } .ws-popout-modal .header-ticket-button { display: inline-block; cursor: pointer; border: none; background-color: #5a5a5a; color: #e0e0e0; font-size: 12px; font-weight: 500; padding: 5px 10px; border-radius: 3px; text-decoration: none; transition: background-color .15s ease, color .15s ease; line-height: 1; text-align: center; user-select: none; } .ws-popout-modal .header-ticket-button:hover { background-color: #777; color: #fff; }
                        /* Pills */ .ws-popout-modal .header-pills-container { margin-top: 10px; margin-bottom: 5px; display: flex; flex-wrap: wrap; gap: 8px; } .ws-popout-modal .header-link-pill { max-width: 150px; display: inline-block; padding: 4px 12px; border-radius: 15px; background-color: #388E3C; color: #f0f0f0; font-size: 11px; font-weight: 500; line-height: 1.4; text-decoration: none; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; border: 1px solid rgba(255,255,255,.1); transition: .15s ease; user-select: none; cursor: pointer; } .ws-popout-modal .header-link-pill:hover { max-width: 200px; background-color: #4CAF50; box-shadow: 0 1px 3px rgba(0,0,0,.3); color: #fff; }
                        /* Separator */ .ws-popout-modal hr { border: none; border-top: 1px solid rgba(255,255,255,.15); margin: 1.2em 0 1.5em 0; }
                        /* Notes */ .ws-popout-modal .notes-content p { margin: 0 0 1em 0; } .ws-popout-modal .notes-content a { color: #61dafb; text-decoration: none; transition: color .2s ease, text-decoration .2s ease; } .ws-popout-modal .notes-content a:hover { color: #8dffff; text-decoration: underline; } /* ... other notes styles ... */ .ws-popout-modal .notes-content h1, .ws-popout-modal .notes-content h2, .ws-popout-modal .notes-content h3 { margin-top: 1.5em; margin-bottom: .7em; font-weight: 600; line-height: 1.3; color: #fff; } .ws-popout-modal .notes-content code { font-family: Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace; background-color: rgba(255,255,255,.1); padding: 2px 5px; border-radius: 3px; font-size: .9em; color: #f5f5f5; word-break: break-word; } .ws-popout-modal .notes-content pre { font-family: Consolas,Monaco,'Andale Mono','Ubuntu Mono',monospace; background-color: rgba(0,0,0,.3); border: 1px solid rgba(255,255,255,.1); padding: 15px; border-radius: 4px; overflow-x: auto; font-size: .9em; line-height: 1.4; margin-bottom: 1em; } .ws-popout-modal .notes-content pre code { background-color: transparent; padding: 0; border-radius: 0; }
                        /* Scrollbar */ .ws-popout-modal::-webkit-scrollbar { width: 8px; } .ws-popout-modal::-webkit-scrollbar-track { background: rgba(0,0,0,.2); border-radius: 4px; } .ws-popout-modal::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,.3); border-radius: 4px; border: 2px solid transparent; background-clip: content-box; } .ws-popout-modal::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,.5); }
                    </style>
                </head>
                <body>
                    <div class="ws-popout-modal" id="modal-content"> <!-- ID for script -->
                        ${headerHtml}
                        <div class="notes-content">
                           ${editorContentHTML}
                        </div>
                    </div>

                    <!-- Embedded resize script -->
                    <script>
                        requestAnimationFrame(() => {
                            const contentDiv = document.getElementById('modal-content');
                            if (contentDiv) {
                                const measuredContentHeight = contentDiv.scrollHeight;
                                const maxAllowedContentHeight = ${MAX_CONTENT_HEIGHT};
                                const chromeBuffer = ${WINDOW_CHROME_HEIGHT_BUFFER};
                                let desiredWindowHeight = Math.min(measuredContentHeight, maxAllowedContentHeight) + chromeBuffer;
                                // desiredWindowHeight = Math.max(200, desiredWindowHeight); // Optional minimum height
                                chrome.runtime.sendMessage({ action: 'resizeWindowHeight', desiredHeight: desiredWindowHeight }, response => {
                                    if (chrome.runtime.lastError) {} /* Handle error silently if needed */
                                });
                            }
                        });
                    </script>
                    <!-- Note link script -->
                    <script>
                        document.addEventListener('DOMContentLoaded', () => {
                            const links = document.querySelectorAll('.ws-popout-modal .notes-content a');
                            links.forEach(link => { if (link.href && (link.protocol === 'http:' || link.protocol === 'https:')) { link.target = '_blank'; link.rel = 'noopener noreferrer'; } });
                        });
                    </script>
                </body>
                </html>`;

            // --- Create Window ---
            let dataUri;
            dataUri = 'data:text/html;charset=utf-8,' + encodeURIComponent(popupHtml);

            chrome.windows.create({
                url: dataUri, type: 'popup', width: width, height: INITIAL_WINDOW_HEIGHT, focused: true
            }, (newWindow) => {
                if (chrome.runtime.lastError) { sendResponse({ success: false, error: `Window creation failed: ${chrome.runtime.lastError.message}` }); }
                else if (newWindow) { sendResponse({ success: true, windowId: newWindow.id }); }
                else { sendResponse({ success: false, error: "Unknown window creation issue" }); }
            });

            return true; // Keep port open

        } catch (error) {
             sendResponse({ success: false, error: `Processing error: ${error.message}` });
             return false;
        }

    } // --- End createPopup handler ---


    // --- Handler for Resize Request ---
    else if (message.action === 'resizeWindowHeight') {
        const windowId = sender?.tab?.windowId;
        const desiredHeight = message.desiredHeight;

        if (!windowId || typeof desiredHeight !== 'number' || desiredHeight <= WINDOW_CHROME_HEIGHT_BUFFER) {
             return false; // Invalid request
        }
        const roundedHeight = Math.round(desiredHeight);

        chrome.windows.get(windowId, (currentWindow) => {
            if (chrome.runtime.lastError || !currentWindow) { return; } // Error or window closed

            if (currentWindow.height !== roundedHeight) {
                chrome.windows.update(windowId, { height: roundedHeight }, (updatedWindow) => {
                     if (chrome.runtime.lastError) {} // Handle error silently if needed
                });
            }
        });
        return false; // No response needed

    } // --- End resizeWindowHeight handler ---

    else {
        // Unknown action
        return false;
    }

}); // End listener

// --- Optional: Install Listener ---
chrome.runtime.onInstalled.addListener(details => {
    // Initial setup on install/update can go here if needed
});