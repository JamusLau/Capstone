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

//store reference for test's user cases
let fnCases = [];

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

// handler to load the tests for the functions
ipcMain.handle('load-function-tests', async (event, fn) => {
    console.log("Function selected", fn);
    fnSelected = fn;
    console.log("Function in function store: ", fn);
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