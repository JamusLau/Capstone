// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const { extractFunctions, createSignature, generateCasesForFunction } = require('./assets/scripts/functions.js');
const fs = require('fs');

// use to store reference of main window instance
let win;

//store reference for currently selected function
var fnSelected;
//store reference for currently selected test to delete
var testSelectedDelete;
//stores a copy of all the functions extracted from the files
const functionsExtracted = new Map();
// map to store all functions per script -> Map<script, Array<function>>
const scriptFunctionsMap = new Map();

// Saves all the created test cases for each function
// Format: Map<functionSignature, Set<FunctionTest>>
const fnCasesMap = new Map();

// store reference for test's user cases for each function
// eachFn should have an array of test objects
class FunctionTest {
    constructor(fnSignature, fnTestBody) {
        this.fnSignature = fnSignature;
        this.fnTestBody = fnTestBody;
    }
}

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
// [Description] Handler to create a signature by passing in the function name and file name
// [Parameters] name - Name of the function
//              file - Name of the file
// [Returns] Signature of the function
ipcMain.handle('create-signature', async (event, name, file) => {
    return createSignature(name, file);
});

// [IPCHandler]
// [Description] Handler to extract functions from the files
// [Parameters] files - Array of files to extract functions from
// [Returns] Array of functions extracted from the files
ipcMain.handle('get-functions', async (event, files) => {
    console.log("files received",files); 
    var fns = extractFunctions(files);
    fns.forEach(fn => {
        // adding to functionas extracted by creating signature and storing function
        var signature = createSignature(fn.name, fn.file);
        functionsExtracted.set(signature, fn);

        // adding to scriptFunctionsMap
        if (!scriptFunctionsMap.has(fn.file)) {
            scriptFunctionsMap.set(fn.file, [fn.name]);
        } else {
            scriptFunctionsMap.get(fn.file).push(fn.name);
        }
    });
    console.log("All functions extracted: ", functionsExtracted);
    console.log("Script functions map: ", scriptFunctionsMap);
    return functionsExtracted; // function in functions.js
});

// [IPCHandler]
// [Description] Handler to get all functions extracted from the files
// [Returns] All functions extracted from the files
ipcMain.handle('get-extracted-functions', async (event) => {
    return functionsExtracted;
})

// [IPCHandler]
// [Description] Handler to get currently selected function
// [Returns] Currently selected function (fnSelected)
ipcMain.handle('get-selected-function-signature', async (event) => {
    return fnSelected;
});

// [IPCHandler]
// [Description] Handler to get currently selected function
// [Returns] Currently selected function (fnSelected)
ipcMain.handle('get-selected-function', async (event) => {
    return functionsExtracted.get(fnSelected);
});

// [IPCHandler]
// [Description] Handler to get a function from the signature from functionsExtracted
// [Parameters] signature - Signature of the function to get
// [Returns] Function from functionsExtracted
ipcMain.handle('get-function-from-signature', async (event, signature) => {
    return functionsExtracted.get(signature);
});

// [IPCHandler]
// [Description] Stores a test created for a function in fnCasesMap
// [Parameters] fnSignature - Signature of the function the test is for
//              fnSignature - (selected.name + "@" + selected.file)
//              fnTestBody - Body of the test function
// [Returns] None
ipcMain.handle('store-function-test', async (event, fnSignature, fnTestBody) => {
    const obj = new FunctionTest(fnSignature, fnTestBody);
    if (!fnCasesMap.has(fnSignature)) {
        fnCasesMap.set(fnSignature, new Set([obj]));
    }
    else {
        fnCasesMap.get(fnSignature).add(obj);
    }
    // const obj = new FunctionTest(fnSignature, fnTestBody);
    // fnCasesMap.set(fnSignature, obj);
    console.log("Function test stored: ", obj);
})

// [IPCHandler]
// [Description] Sets the currently selected function with signature
// [Parameters] fn - Function to set as selected
// [Returns] None
ipcMain.handle('set-selected-function', async (event, fnSig) => {
    fnSelected = fnSig;
    console.log("Function selected: ", fnSelected);
})

// [IPCHandler]
// [Description] Sets the currently selected test to delete
// [Parameters] functionTest - Test (object) to set as selected to delete
// [Returns] None
ipcMain.handle('set-selected-test-delete', async(event, functionTest) => {
    testSelectedDelete = functionTest;
    console.log("Test selected to delete: ", testSelectedDelete);
})

// [IPCHandler]
// [Description] Deletes the currently selected test
// [Parameters] None
// [Returns] None
ipcMain.handle('delete-selected-test', async(event) => {
    fnCasesMap.get(testSelectedDelete.fnSignature).forEach(test => {
        if (test.fnTestBody === testSelectedDelete.fnTestBody) {
            fnCasesMap.get(testSelectedDelete.fnSignature).delete(test);
        }
    })
    console.log("Test deleted: ", testSelectedDelete);
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
    data += `const assert = require('assert');\n\n`;
    
    // writing the requires for each function at the top of the script
    scriptFunctionsMap.forEach((value, key) => {
        data += `const { ${value.join(', ')} } = require('../${key}');\n`;
    })
    data += `\n`;

    // writing the tests for each function
    fnCasesMap.forEach((value, key) => {
        value.forEach(test => {
            data += `//Test for: ${key}\n`;
            data += `${test.fnTestBody}\n\n`;
        })
    })
    fs.writeFileSync(outputFilePath, data, 'utf8');
    console.log("User tests saved to: ", outputFilePath);
})

// [IPCHandler]
// [Description] Loads tests from a file to fnCasesMap
// [Parameters] inputFilePath - Path to the file to load tests from
// [Returns] None
ipcMain.handle('load-tests-from-file', async (event, fileContent) => {
    
    fnCasesMap.clear();

    const lines = fileContent.split('\n');
    let testSig = ''; // to store the signature for the test
    let testBody = ''; // to store the body for the test

    // variables to keep track whether still in body
    let isInBody = false; // check whether still in body of test
    let testBodyParts = []; // to store parts of the body
    let braceCounter = 0; // to keep track of braces

    lines.forEach(line => {
        // capture the signature of the test
        if (line.startsWith('//Test for:')) {
            if (testSig) {
                testBody = '';
                testBodyParts = [];
            }
            testSig = line.replace('//Test for:', '').trim();
        } else if (line.startsWith('describe(')) { //capture the body
            isInBody = true; 
            testBodyParts.push(line); // push the line that is in the body into the parts
            braceCounter += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length; // check brace
        } else if (isInBody) { // if still in body, continue capture
            testBodyParts.push(line); // push the line that is in the body into the parts
            braceCounter += (line.match(/\(/g) || []).length - (line.match(/\)/g) || []).length; // check brace
            if (line.includes('});')) { // if meet closing brace, -=1 counter for brace
                braceCounter -= 1;
            }
            if (braceCounter === 0) { //completed reading the body
                testBodyParts.push("});");
                testBody = testBodyParts.join('\n');

                // Store the read data as function test object in map
                const obj = new FunctionTest(testSig, testBody);

                if (!fnCasesMap.has(testSig)) {
                    fnCasesMap.set(testSig, new Set([obj]));
                }
                else {
                    fnCasesMap.get(testSig).add(obj);
                }
                
                //reset values
                testSig = '';
                testBody = '';
                isInBody = false;
                testForValue = '';
                testBodyParts = [];
            }
        }
    })

    console.log("Tests loaded from file: ", fnCasesMap);
    
})

// [IPCHandler]
// [Description] Generates tests and saves them to a file
// [Parameters] outputFilePath - Path to save the file to
//              count - Number of tests to generate
// [Returns] None
ipcMain.handle('generate-and-save-tests', async (event, outputFilePath, count) => {
    console.log("Generate tests @" + outputFilePath + " count: " + count); 

    functionsExtracted.forEach((value, key) => {
        console.log("key: ", key);
        console.log("value: ", value);

        var cases = generateCasesForFunction(value, count);
    })
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