// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const { createTemplate, extractFunctions } = require('./assets/scripts/functions.js');
const fs = require('fs');

// use to store reference of main window instance
let win;

//store reference for selected function
var fnSelected;

// store reference for test's user cases for each function
// eachFn should have an array of test objects
class FunctionTest {
    constructor(fnSignature, fnBody) {
        this.fnSignature = fnSignature;
        this.fnBody = fnBody;
    }
}
// fnCasesMap.set("signature", FunctionTest object)
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

//ipc command to handle ipc calls from renderer.js
// handler to extract functions from the files
ipcMain.handle('get-functions', async (event, files) => {
    console.log("files received",files); 
    return extractFunctions(files);
});

//ipc command to get currently selected function
ipcMain.handle('get-selected-function', async (event) => {
    return fnSelected;
});

//stores a test created for a function
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

//set the selected function
ipcMain.handle('set-selected-function', async (event, fn) => {
    fnSelected = fn;
    console.log("Function selected: ", fnSelected);
})

// get all tests from the map matching the signature
ipcMain.handle('get-tests-for-function', async (event, fnSignature) => {
    console.log("Function signature received: ", fnSignature);
    console.log("Function test found: ", fnCasesMap.get(fnSignature));
    return fnCasesMap.get(fnSignature);
})

ipcMain.handle('save-tests-to-file', async (event, outputFilePath) => {

})

ipcMain.handle('load-tests-from-file', async (event, inputFilePath) => {
    
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