// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const { createTemplate, extractFunctions, loadTestsForFunction } = require('./assets/scripts/functions.js');


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

// handler to load the tests for the functions
// return the list of test cases from the map with the matching signature
ipcMain.handle('load-function-tests', async (event, fn) => {
    console.log("Function selected", fn);
    fnSelected = fn;
    console.log("Function in function store: ", fnSelected);
    return loadTestsForFunction(fn);
});

//checks when Electron has finished loading, then runs the function
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    //for macOS - app usually keeps running in the background
    // ensures app quits on windows/linux, and behaves normally on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
})