const { ipcRenderer } = require('electron');

const functionsList = document.getElementById('functions-list');
const functionSelected = document.getElementById('function-selected');
const functionTestList = document.getElementById('function-test-list');

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
    const template = `
    describe('${fnObject.name}()', () => {
        it('Description of ${fnObject.name}', () => {
            const result = ${fnObject.name}(${fnObject.parameters});
            expect(result).to.equal(value);  // Use Chai's expect() syntax
        });
    });`
    x.value = template;
}

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

// add listener to the scan button to scan the set filepath for all js files and functions
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
        // creates the div and adds a class to it to store each function
        const fnContainer = document.createElement('div');
        fnContainer.id = "function-box-div";
        fnContainer.classList.add('function-box');

        // creates a paragraph element to store the name of the function
        const fnHead = document.createElement('p');
        fnHead.textContent = `${fn.name} in ${fn.file}`;
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
                detail: fn //sends the function over to the functionTestList
            })
            functionTestList.dispatchEvent(event);
        })

        fnContainer.appendChild(btn);

        functionsList.appendChild(fnContainer);
    });
});

// adds listener to the selectedFunction div to receive the function selected by the user
// also to retrive the tests for that function from the map in the main process
// (event) will contain the details of the received function
// (event) contains (detail)(fn) => name, file, parameters, body, full
functionTestList.addEventListener('receiveTest', async function(event) {
    // reset the selected function and test list
    functionSelected.innerHTML = '';

    const fnContainer = document.createElement('div');
    fnContainer.id = "function-box-div";
    fnContainer.classList.add('function-box');

    // creates a paragraph element to store the name of the function
    const fnHead = document.createElement('p');
    fnHead.textContent = `${event.detail.name} in ${event.detail.file}`;
    fnContainer.appendChild(fnHead);

    // creates a pre element to store the body of the function
    const fnBody = document.createElement('pre');
    fnBody.textContent = event.detail.full;
    fnContainer.appendChild(fnBody);

    functionSelected.appendChild(fnContainer);

    // set the currently selected function in main
    await ipcRenderer.invoke('set-selected-function', event.detail);

    const newEvent = new CustomEvent('updateTestList', {
        detail: event.detail
    })
    functionTestList.dispatchEvent(newEvent);

})

// adds listener to the confirm add test button to add the test from the creator into the map
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
        detail: selected
    })
    //updates the list of tests
    functionTestList.dispatchEvent(event);
});

// adds listener to the function test list to update
// (event) will contain the details of the received function
// (event) contains (detail)(fn) => name, file, parameters, body, full
functionTestList.addEventListener('updateTestList', async function(event) {
    //reset the function test list
    functionTestList.innerHTML = '';

    // grabs all the selected function's tests from the map (if any)
    const tests = await ipcRenderer.invoke('get-tests-for-function', event.detail.name + "@" + event.detail.file);
    const arrTests = Array.from(tests);
    
    // creates a div and box containing each test created for the function
    arrTests.forEach(test => {
        const testContainer = document.createElement('div');
        testContainer.id = "test-box-div";
        testContainer.classList.add('test-box');
        
        const testBody = document.createElement('pre');
        console.log("update body: ", test.fnBody);
        testBody.textContent = test.fnBody;
        testContainer.appendChild(testBody);

        functionTestList.appendChild(testContainer);
    })
})