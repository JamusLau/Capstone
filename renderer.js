const { ipcRenderer } = require('electron');

const functionsList = document.getElementById('functions-list');
const functionSelected = document.getElementById('function-selected');
const functionTestList = document.getElementById('function-test-list');
const testSelectedDelete = document.getElementById('test-selected-delete');
const generationFnTypesDiv = document.getElementById('types-for-function');
const { createTemplate } = require('./assets/scripts/functions.js');

// function to show the creator box and button
async function showCreator() {
    var x = document.getElementById("test-creator-box");
    var y = document.getElementById("confirmAddTestBtn");
    if (x.style.display === "none") {
        x.style.display = "block";
    }

    if (y.style.display === "none") {
        y.style.display = "block";
    }

    const fnObject = await ipcRenderer.invoke('get-selected-function');
    console.log("show creator:", fnObject);
    const template = createTemplate(fnObject);
    x.value = template;
}

// function to hide the creator box and button
function hideCreator() {
    var x = document.getElementById("test-creator-box");
    var y = document.getElementById("confirmAddTestBtn");
    if (x.style.display === "block") {
        x.style.display = "none";
    }

    if (y.style.display === "block") {
        y.style.display = "none";
    }
}

// Add listener to the scan button to scan the set filepath for all js files and functions
document.getElementById('scanButton').addEventListener('click', async () => {
    // gets the input field on the page
    const inputElement = document.getElementById('inputDirectoryInput');

    // checks if there is a valid filepath selected
    if (inputElement.files.length === 0)
    {
        console.error("No directory selected");
        return;
    }

    console.log(inputElement.files);

    // maps the files to an array of objects with the name, path, and webkitRelativePath
    const allFiles = Array.from(inputElement.files).map(file => ({
        name: file.name,
        path: __dirname + "\\" + file.webkitRelativePath,
        webkitRelativePath: file.webkitRelativePath,
    }));
    console.log(allFiles);

    // sends the files to the main process using an ipc call to get all the functions
    const functions = await ipcRenderer.invoke('get-functions', allFiles);

    console.log(functions);

    // getting the fuction list on the page
    functionsList.innerHTML = '';

    // creates a div for each function detected, and adds the name, file and body of the function
    // each (fn) contains => name, file, parameters, body, full
    functions.forEach(fn => {
        //get a signature for the function
        const signature = fn.name + "@" + fn.file;

        // creates the div and adds a class to it to store each function
        const fnContainer = document.createElement('div');
        fnContainer.id = "function-box-div";
        fnContainer.classList.add('function-box');

        // creates a paragraph element to store the name of the function
        const fnHead = document.createElement('p');
        fnHead.textContent = signature;
        fnContainer.appendChild(fnHead);

        // creates a pre element to store the body of the function
        const fnBody = document.createElement('pre');
        fnBody.textContent = fn.full;
        fnContainer.appendChild(fnBody);

        // creates a button element for user to select the function
        // after user selects the function, an ipc call is made to send the function to the main processs
        // the main process will then load the tests for that function
        var btn = document.createElement('button');
        btn.textContent = "Select";
        btn.addEventListener('click', async () => {
            const event = new CustomEvent('receiveTest', {
                detail: signature //sends the signature over to the functionTestList
            })
            functionTestList.dispatchEvent(event);
        })

        fnContainer.appendChild(btn);

        functionsList.appendChild(fnContainer);
    });
});

// Adds listener to the functionTestList div to receive the function selected by the user
// Also to retrive the tests for that function from the map in the main process
// (event) will contain the details of the received function
// (event) contains (detail)(fn) => name, file, parameters, body, full
functionTestList.addEventListener('receiveTest', async function(event) {
    // reset the selected function
    functionSelected.innerHTML = '';
    
    // set the currently selected function in main
    await ipcRenderer.invoke('set-selected-function', event.detail);

    //gets the function form main process using the signature
    const fn = await ipcRenderer.invoke('get-selected-function');
    console.log("Function received: ", fn);

    // Setting selected function here------------------------
    const fnContainer = document.createElement('div');
    fnContainer.id = "function-box-div";
    fnContainer.classList.add('function-box');

    // creates a paragraph element to store the name of the function
    const fnHead = document.createElement('p');
    fnHead.textContent = event.detail;
    fnContainer.appendChild(fnHead);

    // creates a pre element to store the body of the function
    const fnBody = document.createElement('pre');
    fnBody.textContent = fn.full;
    fnContainer.appendChild(fnBody);

    functionSelected.appendChild(fnContainer);
    // ------------------------------------------------------

    //updates and retrives all user tests created for the selected function
    const newEvent = new CustomEvent('updateTestList', {
        detail: event.detail
    })
    functionTestList.dispatchEvent(newEvent);

})

// Adds listener to the function test list to update
// (event) will contain the details of the received function
// (event) contains (detail)(fn) => name, file, parameters, body, full
functionTestList.addEventListener('updateTestList', async function(event) {
    //reset the function test list
    functionTestList.innerHTML = '';

    // grabs all the selected function's tests from the map (if any)
    const tests = await ipcRenderer.invoke('get-tests-for-function', event.detail);
    const arrTests = Array.from(tests);
    
    // creates a div and box containing each test created for the function
    arrTests.forEach(test => {
        const testContainer = document.createElement('div');
        testContainer.id = "test-box-div";
        testContainer.classList.add('test-box');
        
        const testBody = document.createElement('pre');
        console.log("update body: ", test.fnTestBody);
        testBody.textContent = test.fnTestBody;
        testContainer.appendChild(testBody);

        // creates a button for user to select the test to mark for deletion
        // stores the entire test as part of the button as body will need to be compared
        var btn = document.createElement('button');
        btn.textContent = "Select";
        btn.addEventListener('click', async () => {
            const event = new CustomEvent('setForDelete', {
                detail: test //sends the actual test as part of the event
            })
            testSelectedDelete.dispatchEvent(event);
        })
        testContainer.appendChild(btn);

        functionTestList.appendChild(testContainer);
    })
})

// Adds listener to set the test selected for deletion
testSelectedDelete.addEventListener('setForDelete', async function(event) {
    testSelectedDelete.innerHTML = '';

    // Set test to delete on the main process
    await ipcRenderer.invoke('set-selected-test-delete', event.detail);

    // Setting to display the test currently selected for deletion here------
    const fnContainer = document.createElement('div');
    fnContainer.id = "function-box-div";
    fnContainer.classList.add('function-box');

    // creates a pre element to store the body of the function
    const fnTestBody = document.createElement('pre');
    fnTestBody.textContent = event.detail.fnTestBody;
    fnContainer.appendChild(fnTestBody);

    testSelectedDelete.appendChild(fnContainer);
    // ----------------------------------------------------------------------
})

// Adds listener to the confirm add test button to add the test from the creator into the map
document.getElementById('confirmAddTestBtn').addEventListener('click', async () => {
    // hides the creator box
    hideCreator();
    // gets the body from the text box
    const userTest = document.getElementById('test-creator-box').value;
    // gets the currently selected function
    const selected = await ipcRenderer.invoke('get-selected-function');
    // creates a signature for the function
    const signature = selected.name + "@" + selected.file;
    // stores the function using the signature and the body
    await ipcRenderer.invoke('store-function-test', signature, userTest);

    //event to update the list
    const event = new CustomEvent('updateTestList', {
        detail: signature
    })
    //updates the list of tests
    functionTestList.dispatchEvent(event);
})

// Adds listener to the button to confirm deletion of the selected test
document.getElementById('deleteTestBtn').addEventListener('click', async () => {
    testSelectedDelete.innerHTML = '';

    // Call delete of the selected test on the main process
    await ipcRenderer.invoke('delete-selected-test');

    // Refresh the test list by getting the current function selected
    const curFn = await ipcRenderer.invoke('get-selected-function-signature');
    const event = new CustomEvent('updateTestList', {
        detail: curFn
    })
    functionTestList.dispatchEvent(event);
})

// Adds listener to the button to save the user tests to a file
document.getElementById("saveUserTestsBtn").addEventListener('click', async () => {
    // gets the user file name input
    var fileName = document.getElementById('userTestFileName').value;
    //if empty sets default
    if (fileName == "" || fileName == null) {
        fileName = "UserTests";
    }
    //invoke function to save tests to file
    ipcRenderer.invoke('save-tests-to-file', "./test/" + fileName + ".js");
})

// Adds listener to check any change to file input for user tests
document.getElementById("testFileInput").addEventListener('change', async () => {
    //gets the file and stores the file content
    const fileInput = document.getElementById("testFileInput");
    const file = fileInput.files[0];

    if (file) {
        const reader = new FileReader();

        reader.onload = async function(event) {
            const fileContent = event.target.result;
            await ipcRenderer.invoke('load-tests-from-file', fileContent);

            // Refresh the test list by getting the current function selected
            const curFn = await ipcRenderer.invoke('get-selected-function-signature');
            const updateEvent = new CustomEvent('updateTestList', {
                detail: curFn
            })
            functionTestList.dispatchEvent(updateEvent);
        };

        reader.onerror = function(error) {
            console.error('Error reading file: ', error);
        };

        reader.readAsText(file, 'UTF-8');
    }
})

// Adds listener to the button to generate and save tests
document.getElementById("generateTestBtn").addEventListener('click', async () => {
    //gets the file name from input
    var fileName = document.getElementById('generatedTestFileName').value;
    //gets the count from input
    var count = document.getElementById('generationCount').value;
    //sets default if file name is empty
    if (fileName == "" || fileName == null) {
        fileName = "GeneratedTests";
    }
    //sets default if count is empty
    if (count == "" || count == null) {
        count = 0;
    }
    //invoke function to generate and save tests to file
    ipcRenderer.invoke('generate-and-save-tests', "./test/" + fileName + ".js", count);
})