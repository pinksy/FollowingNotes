var MutationObserver = window.MutationObserver || window.WebKitMutationObserver;
if (MutationObserver === undefined){
  console.error("Unsupported Chrome version");
  alert("Your version of Chrome does not support the FollowingNotes extension.\n\nPlease disable the extension, or upgrade to Chrome 18+");
}

var contentsLength = 0;
var debugging = false;
var debugLevel = 1; // 1 = minimum, 2 = detailed, 3 = full;
var storage = chrome.storage.sync;
var url = "";
var user;

function debug(level, message){
  if(debugging){
    if(debugLevel >= level){
      console.log(message);
    }
  }
}

// Convenience function
function disableSaveButton(saveButton){
  saveButton.setAttribute('disabled','disabled');
  saveButton.className = "btn primary-btn disabled";
}

// Return the number of chars in a note. Count CR/LF as one char.
function getCount(notesTextArea){
  var count = notesTextArea.innerText.length;
  if(notesTextArea.innerHTML.substr((notesTextArea.innerHTML.length - 4), 4) == "<br>"){
    count--;
  }
  return count;
}

// Highlight characters > 140 chars
function highlightOverspill(notesTextArea){

  var underspill = notesTextArea.innerText.substring(0, 140);
  var overspill = notesTextArea.innerText.substring(140, notesTextArea.innerText.length);
  debug(3, "overspill = " + overspill);
  notesTextArea.innerText = underspill;

  // Highlight overspill
  var em = document.createElement("em");
  em.innerText = overspill;
  em.style.background = "#fcc";
  em.style.fontStyle = "normal";
  notesTextArea.appendChild(em);

  // Move cursor to end
  var range = document.createRange();
  range.selectNodeContents(em);
  range.collapse(false);
  var selection = window.getSelection();
  selection.removeAllRanges();
  selection.addRange(range);
}

// Create a note element and associated controls and events for a followed user
function createNote(content){

  // Get followed username
  var followedUser = content.parentElement.getAttribute("data-screen-name");

  // Create a closure for each content so that the correct contents are available at the time of any associated event
  var closure = (function(followedUser, content){
    return function(){

      var key = user + "." + followedUser;

      storage.get(key, function(data){

        // Nodes (but not their events) seem to be cached between page clicks. Drop and recreate.
        if(content.childElementCount > 2){

          debug(3, "Removing old nodes for " + followedUser);

          // Remove notes element
          content.removeChild(content.lastChild);

          // Remove save button and character-counter span
          var btnGroup = content.previousElementSibling;
          btnGroup.removeChild(btnGroup.lastChild);

          // Remove dropdownMenu item element
          var dropdownMenu = content.previousElementSibling.firstElementChild.lastElementChild;
          var firstDivider = dropdownMenu.getElementsByClassName("dropdown-divider")[0];
          dropdownMenu.removeChild(firstDivider.previousElementSibling);
        }

        // Recreate nodes. Ignore the content element that has no children.
        if(content.childElementCount === 2){

          debug(3, "Creating new nodes for " + followedUser);

          // Create notes element

          var notesDiv = document.createElement("div");
          notesDiv.style.display = "none";
          notesDiv.style.backgroundImage = "url(" + chrome.extension.getURL('note.png') + ")";
          notesDiv.className = "notesDiv";
          notesDiv.innerHTML = "&nbsp;"; // lazy hack

          var notesTextAreaContainer = document.createElement("div");
          notesTextAreaContainer.className = "notesTextAreaContainer";

          var notesTextArea = document.createElement("div");
          notesTextArea.setAttribute('contenteditable',true);
          notesTextArea.setAttribute('spellcheck',true);
          notesTextArea.style.display = "table-cell";
          notesTextArea.style.fontSize = "16px";
          notesTextArea.style.padding = "6px 10px 5px";
          notesTextArea.style.backgroundColor = "rgba(0, 0, 0, 0)";
          notesTextArea.style.border = "none";
          notesTextArea.style.webkitBoxShadow = "none";
          notesTextArea.style.overflow = "hidden";
          notesTextArea.className = "notesTextArea";

          // Create save button and character-counter span

          var notesControlDiv = document.createElement("div");
          notesControlDiv.style.display = "none";
          notesControlDiv.style.textAlign = "right";
          notesControlDiv.style.marginTop = "5px";

          var charCounterSpan = document.createElement("span");
          charCounterSpan.innerHTML = "140";
          charCounterSpan.style.display = "inline-block";
          charCounterSpan.style.marginRight = "5px";
          charCounterSpan.className = "tweet-counter";
          notesControlDiv.appendChild(charCounterSpan);

          var saveButton = document.createElement("button");
          saveButton.innerHTML = "Save";
          saveButton.style.display = "inline-block";
          saveButton.setAttribute('disabled','disabled');
          saveButton.className = "btn primary-btn disabled";
          notesControlDiv.appendChild(saveButton);

          var btnGroup = content.previousElementSibling;
          btnGroup.appendChild(notesControlDiv);

          // Create dropdownMenu list item element

          var addNotesDropdownItem = document.createElement("li");
          addNotesDropdownItem.style.display = "block";
          addNotesDropdownItem.className = "dropdown-link pretty-link";
          var dropdownMenu = content.previousElementSibling.firstElementChild.lastElementChild;
          var firstDivider = dropdownMenu.getElementsByClassName("dropdown-divider")[0];
          dropdownMenu.insertBefore(addNotesDropdownItem, firstDivider);

          // Set properties of elements depending on saved data
          if(typeof data[key] != "undefined"){
            notesTextArea.innerHTML = data[key];
            charCounterSpan.innerHTML = (140 - getCount(notesTextArea));
            notesDiv.style.display = "block";
            notesControlDiv.style.display = "block";
            addNotesDropdownItem.innerHTML = "Remove notes";
          }
          else{
            addNotesDropdownItem.innerHTML = "Add notes";
            notesTextArea.innerHTML = "Click to start.";
          }

          // Commit elements to DOM
          notesTextAreaContainer.appendChild(notesTextArea);
          notesDiv.appendChild(notesTextAreaContainer);
          content.appendChild(notesDiv);

          // Register dropdown item click event
          /**
          * NB, twitter's boot.js file has a function called "withUserActions", which handles clicks in this dropdown by list-item class name...											
          * Because the new list-item is not defined in the userActionClassesToEvents property of the object passed to this.defaultAttrs							
          * ...it cannot find a handler function for this list-item, 
          * ...and an "Uncaught TypeError: Cannot read property '0' of undefined" error is raised when clicked
          * How can this error be suppressed?
          **/
          addNotesDropdownItem.addEventListener("click", function(){	

            // Reset the save button
            disableSaveButton(saveButton);

            // Toggle note content/display
            if(notesDiv.style.display === "none"){
              debug(2, "Add clicked");

              notesDiv.style.display = "block";
              notesControlDiv.style.display = "block";
              charCounterSpan.innerHTML = "140";
              addNotesDropdownItem.innerHTML = "Remove notes";
            }
            else{
              debug(2, "Remove clicked");
              storage.remove(key, function(){
                debug(1, "Removed notes for " + key);

                notesDiv.style.display = "none";
                notesControlDiv.style.display = "none";
                addNotesDropdownItem.innerHTML = "Add notes";
                notesTextArea.innerHTML = "Click to start.";
              });
            }
          }, false);	

          // Register default note click event
          notesTextArea.addEventListener("click", function(){
            storage.get(key, function(data){
              if(typeof data[key] == "undefined"){
                notesTextArea.innerHTML = "";
              }
            });
          }, false);

          // Register save button click event
          saveButton.addEventListener("click", function(){
            var note = {};
            note[user + "." + followedUser] = notesTextArea.innerHTML;
            storage.set(note, function(){
              debug(1, "Stored notes for " + key + ": " + notesTextArea.innerHTML);

              // Reset the save button
              disableSaveButton(saveButton);
            });
          }, false);

          // Register note data entry event
          notesTextArea.addEventListener("input", function(){

            // Re-enable save button
            saveButton.removeAttribute('disabled');
            saveButton.className = "btn primary-btn";

            // Count characters
            var count = getCount(notesTextArea);
            charCounterSpan.innerHTML = (140 - count);

            if(count <= 0){
              storage.remove(key, function(){
                debug(1, "Removed notes for " + key);

                disableSaveButton(saveButton);
              });
            }

            if(count > 140){
              disableSaveButton(saveButton);
              highlightOverspill(notesTextArea);
            }
          }, false);

          // Register paste event
          notesTextArea.addEventListener("paste", function(data){
            data.preventDefault();

            // TODO Handle pasting - convert rich text to plain text

            alert("Sorry, pasting is not supported just yet.");
          }, false);
        }
      });			
    }
  })(followedUser, content);

  closure();
}

// Check to see if we are on the /following page and if more followed users have been appended
function checkPage(){

  // Reset contentsLength when switching pages
  if(document.URL != url){
    contentsLength = 0;
  }

  // Get a list of content elements
  var contents = document.querySelectorAll(".content");

  // Prepare to act if switching pages or contents.length increases
  if(document.URL != url || contents.length > contentsLength){

    // Reset markers
    if(document.URL != url){
      debug(1, "URL changed");
      url = document.URL;
    }
    else{
      debug(2, "contentsLength = " + contentsLength + ", contents.length = " + contents.length);
      contentsLength = contents.length;
    }

    // We have entered a new page, or its content.lenth has increased. Now only act if we are on the /following page.
    if(document.URL.indexOf("twitter.com/following") > -1){

      debug(1, "Processing /following page");

      // Get logged-in username
      user = document.title.substring(document.title.indexOf('(') + 1, document.title.indexOf(')'));

      for(var i = 0; i < contentsLength; i++){

        var content = contents[i];
        var grandParent = content.parentNode.parentNode.nodeName;

        // Some content elements sit outside the list. Only act on those in the list.
        if(grandParent === 'LI'){
          createNote(content);
        }
      }
      debug(1, contentsLength + " notes created");
    }
  }
}

/**
*
* Main
*
**/

// Fire immediately (manifest is set to fire on document_end)
checkPage();

// Register a MutationObserver for further DOM changes
var observer = new MutationObserver(function(mutations, observer){
  checkPage();
});
observer.observe(document, {
  subtree: true,
  attributes: true
});