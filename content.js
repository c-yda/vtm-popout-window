// content.js

function setupPopout() {
    const containerSelector = '.notes-section mat-tab-group';
    const containerElement = document.querySelector(containerSelector);

    if (containerElement) {
        if (containerElement.querySelector('.notes-popout-button')) {
            return;
        }

        const currentPosition = window.getComputedStyle(containerElement).position;
        if (currentPosition !== 'relative' && currentPosition !== 'absolute' && currentPosition !== 'fixed') {
            containerElement.style.position = 'relative';
        }

        const popoutButton = document.createElement('button');
        popoutButton.textContent = 'Pop out notes';
        popoutButton.className = 'notes-popout-button'; // Style via styles.css
        popoutButton.style.position = 'absolute';
        popoutButton.style.bottom = '5px';
        popoutButton.style.left = '5px';
        popoutButton.style.zIndex = '999';
        containerElement.appendChild(popoutButton);

        popoutButton.addEventListener('click', (event) => {
            event.stopPropagation();

            // --- 1. Get Editor Element & Content ---
            const editorSelector = '.mat-mdc-tab-body-active .ck.ck-content.ck-editor__editable';
            const editorElement = containerElement.querySelector(editorSelector);
            if (!editorElement) {
                // Keep essential user feedback
                alert('Could not find the active editor content to pop out. Make sure the correct tab is selected.');
                return;
            }
            const editorContentHTML = editorElement.innerHTML;

            // --- 2. Parse Links within Editor Element ---
            const linksInEditor = editorElement.querySelectorAll('a');
            const linkPillsData = [];
            linksInEditor.forEach(link => {
                const href = link.getAttribute('href');
                if (href && (href.startsWith('http:') || href.startsWith('https:'))) {
                    let text = link.textContent?.trim();
                     if (!text) {
                         try {
                             const url = new URL(href);
                             text = url.hostname + (url.pathname.length > 1 ? '/...' : '');
                         } catch (e) { text = href; }
                     }
                    linkPillsData.push({ href: href, text: text });
                }
            });

            // --- 3. Get Window Title Parts ---
            const activeTabLabelSelector = '.mdc-tab--active .mdc-tab__text-label';
            const accountNameTitleSelector = 'a.account-name-title';
            const activeTabLabelElement = document.querySelector(activeTabLabelSelector);
            const accountNameTitleElement = document.querySelector(accountNameTitleSelector);
            const activeTabLabel = activeTabLabelElement?.textContent?.trim() || 'Notes';
            const accountNameForTitle = accountNameTitleElement?.textContent?.trim() || 'Unknown Account';

            // --- 4. Get Header Summary Parts ---
            const headerAccountSelector = 'app-task-details a.account-name-title';
            const headerSidenavSelector = 'mat-sidenav span.title';
            const headerDueDateSelector = 'app-task-details .due-date .date-text';
            const headerAccountElement = document.querySelector(headerAccountSelector);
            const headerSidenavElement = document.querySelector(headerSidenavSelector);
            const headerDueDateElement = document.querySelector(headerDueDateSelector);
            const headerAccountName = headerAccountElement?.textContent?.trim() || 'Account N/A';
            const headerSidenavTitle = headerSidenavElement?.textContent?.trim() || 'Section N/A';
            const headerDueDate = headerDueDateElement?.textContent?.trim() || 'No Due Date';

            // --- 5. Calculate Width ---
            const rect = containerElement.getBoundingClientRect();
            const calculatedWidth = Math.round(rect.width) + 20;
            const width = Math.max(600, calculatedWidth);
            // Height is determined by background script

            // --- 6. Send Message ---
            chrome.runtime.sendMessage(
                {
                    action: "createPopup",
                    data: {
                        editorContentHTML: editorContentHTML,
                        width: width,
                        activeTabLabel: activeTabLabel,
                        accountName: accountNameForTitle,
                        headerAccountName: headerAccountName,
                        headerSidenavTitle: headerSidenavTitle,
                        headerDueDate: headerDueDate,
                        linkPillsData: linkPillsData
                    }
                },
                (response) => {
                    // Minimal error handling (can be removed if not desired)
                    if (chrome.runtime.lastError) {
                        // Optionally log or alert, but removing logs as requested
                        // console.error("CS: Error sending message:", chrome.runtime.lastError.message);
                    } else if (response && !response.success) {
                        // console.error("CS: Background reported error:", response.error);
                    }
                }
            );
        }); // End click listener

    } // End if containerElement
} // End setupPopout

// --- Initial Setup & Observer ---
setupPopout();
const observer = new MutationObserver((mutationsList, observer) => {
    const containerElement = document.querySelector('.notes-section mat-tab-group');
    if (containerElement && !containerElement.querySelector('.notes-popout-button')) {
        setupPopout();
    }
});
observer.observe(document.body, { childList: true, subtree: true });
window.addEventListener('unload', () => { if (observer) observer.disconnect(); });