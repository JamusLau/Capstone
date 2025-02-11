// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

// use to store reference of main window instance
let win;

//creates a new window
function createWindow() {
    win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        }
    });

    win.loadFile('index.html'); //load file that contains the content and layout of the app's GUI

    win.on('closed', () => {
        win = null;
    });
}

ipcMain.handle('get-functions', async (event, files) => {
    console.log("files received",files); 
    return extractFunctions(files);
});

function extractFunctions(files) {
    const arr = Array.from(files);
    let functions = [];
    console.log(arr);

    //loop through all files
    arr.forEach(file => {
        const filePath = file.webkitRelativePath;
        console.log(filePath);

        if (file.name.endsWith('.js')) {
            //read the js file
            const code = fs.readFileSync(filePath, 'utf8');

            //parse code to use the AST using acorn
            const ast = acorn.parse(code, {ecmaVersion: 2020});

            //traversing the ast tree to find the function declarations
            walk.simple(ast, {
                FunctionDeclaration(node) {
                    functions.push({
                        name: node.id.name,
                        file: filePath,
                        parameters: node.params.map(param => param.name),
                        body: code.slice(node.body.start, node.body.end)
                    });
                },
                FunctionExpression(node) {
                    if (node.id) {
                        functions.push({
                            name: node.id.name,
                            file: filePath,
                            parameters: node.params.map(param => param.name),
                            body: code.slice(node.body.start, node.body.end)
                        });
                    }
                },
                ArrowFunctionExpression(node) {
                    // For arrow functions (optional)
                    if (node.id) {
                        functions.push({
                            name: node.id.name,
                            file: filePath,
                            parameters: node.params.map(param => param.name),
                            body: code.slice(node.body.start, node.body.end)
                        });
                    }
                }
            })
        }
    })

    console.log(functions);
    return functions;
}

//checks when Electron has finished loading, then runs the function
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    //for macOS - app usually keeps running in the background
    // ensures app quits on windows/linux, and behaves normally on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
})