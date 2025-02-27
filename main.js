// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const { createTemplate, extractFunctions } = require('./assets/scripts/functions.js');
const fs = require('fs');

// use to store reference of main window instance
let win;

//store reference for currently selected function
var fnSelected;

// store reference for test's user cases for each function
// eachFn should have an array of test objects
class FunctionTest {
    constructor(fnSignature, fnBody) {
        this.fnSignature = fnSignature;
        this.fnBody = fnBody;
    }
}

// Saves all the created test cases for each function
// Format: Map<functionSignature, Set<FunctionTest>>
const fnCasesMap = new Map();

//creates a new window
function createWindow() {
    win = new BrowserWindow({
        width: 1600,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    //load file that contains the content and layout of the app's GUI
    win.loadFile('index.html'); 

    win.on('closed', () => {
        win = null;
    });
}

// [IPCHandler]
// [Description] Handler to extract functions from the files
// [Parameters] files - Array of files to extract functions from
// [Returns] Array of functions extracted from the files
ipcMain.handle('get-functions', async (event, files) => {
    console.log("files received",files); 
    return extractFunctions(files); // function in functions.js
});

// [IPCHandler]
// [Description] Handler to get currently selected function
// [Returns] Currently selected function (fnSelected)
ipcMain.handle('get-selected-function', async (event) => {
    return fnSelected;
});

// [IPCHandler]
// [Description] Stores a test created for a function in fnCasesMap
// [Parameters] fnSignature - Signature of the function the test is for
//              fnSignature - (selected.name + "@" + selected.file)
//              fnBody - Body of the test function
// [Returns] None
ipcMain.handle('store-function-test', async (event, fnSignature, fnBody) => {
    const obj = new FunctionTest(fnSignature, fnBody);
    if (!fnCasesMap.has(fnSignature)) {
        fnCasesMap.set(fnSignature, new Set([obj]));
    }
    else {
        fnCasesMap.get(fnSignature).add(obj);
    }
    // const obj = new FunctionTest(fnSignature, fnBody);
    // fnCasesMap.set(fnSignature, obj);
    console.log("Function test stored: ", obj);
})

// [IPCHandler]
// [Description] Sets the currently selected function
// [Parameters] fn - Function to set as selected
// [Returns] None
ipcMain.handle('set-selected-function', async (event, fn) => {
    fnSelected = fn;
    console.log("Function selected: ", fnSelected);
})

// [IPCHandler]
// [Description] Retrieves all tests for a function from fnCasesMap
// [Parameters] fnSignature - Signature of the function to get tests for
//              fnSignature - (selected.name + "@" + selected.file)
// [Returns] Array of tests for the function
ipcMain.handle('get-tests-for-function', async (event, fnSignature) => {
    console.log("Function signature received: ", fnSignature);
    console.log("Function test found: ", fnCasesMap.get(fnSignature));
    return fnCasesMap.get(fnSignature);
})

// [IPCHandler]
// [Description] Saves all tests in fnCasesMap to a file
// [Parameters] outputFilePath - Path to save the file to
// [Returns] None
ipcMain.handle('save-tests-to-file', async (event, outputFilePath) => {
    let data = '';
    fnCasesMap.forEach((value, key) => {
        value.forEach(test => {
            data += `//Test for: ${key}\n`;
            data += `${test.fnBody}\n\n`;
        })
    })
    fs.writeFileSync(outputFilePath, data, 'utf8');
    console.log("User tests saved to: ", outputFilePath);
})

// [IPCHandler]
// [Description] Loads tests from a file to fnCasesMap
// [Parameters] inputFilePath - Path to the file to load tests from
// [Returns] None
ipcMain.handle('load-tests-from-file', async (event, inputFilePath) => {
    fnCasesMap.clear();
})

// [IPCHandler]
// [Description] Generates tests and saves them to a file
// [Parameters] outputFilePath - Path to save the file to
//              count - Number of tests to generate
// [Returns] None
ipcMain.handle('generate-and-save-tests', async (event, outputFilePath, count) => {
    console.log("Generate tests @" + outputFilePath + " count: " + count);  
})

//checks when Electron has finished loading, then runs the function
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    //for macOS - app usually keeps running in the background
    // ensures app quits on windows/linux, and behaves normally on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
})