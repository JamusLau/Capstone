const { ipcRenderer } = require('electron');

const functionsList = document.getElementById('functions-list');
const functionSelected = document.getElementById('function-selected');
const functionTestList = document.getElementById('function-test-list');

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
        path: file.path,
        webkitRelativePath: file.webkitRelativePath,
    }));
    console.log(allFiles);

    // sends the files to the main process using an ipc call to get all the functions
    const functions = await ipcRenderer.invoke('get-functions', allFiles);

    console.log(functions);

    // getting the fuction list on the page
    functionsList.innerHTML = '';

    // creates a div for each function detected, and adds the name, file and body of the function
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
                detail: fn
            })
            functionTestList.dispatchEvent(event);
        })

        fnContainer.appendChild(btn);

        functionsList.appendChild(fnContainer);
    });
});

functionTestList.addEventListener('receiveTest', function(event) {
    // reset the selected function and test list
    functionTestList.innerHTML = '';
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

    // loads the tests for this function
    ipcRenderer.invoke('load-function-tests', event.detail);
})
