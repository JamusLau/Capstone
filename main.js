// entrypoint for Electron

//import electron
//app - Electron module for contrlling lifecycle of the application
//BrowserWindow - Create and manage browserwindows
const { app, BrowserWindow, ipcMain } = require('electron');
const { extractFunctions, createSignature, generateCasesForFunction } = require('./assets/scripts/functions.js');
const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');
const Mocha = require('mocha'),
      Suite = Mocha.Suite,
      Runner = Mocha.Runner,
      Test = Mocha.Test;

// use to store reference of main window instance
let win;

//store reference for currently selected function
var fnSelected;
//store reference for currently selected test to delete
var testSelectedDelete;
//  stores a copy of all the functions extracted from the files
//  Format: Map<functionSignature, function>
const functionsExtracted = new Map();
//  map to store all functions per script
//  Format: Map<scriptName, Array<functionName>>
const scriptFunctionsMap = new Map();
//  map to store all defined parameter types for each function -> Map<functionSignature, tuple[string, string]>
//  Format: Map<functionSignature, Set<Array[paramName, paramType]>
const functionParamTypes = new Map();
// map to store the min/max value of each function's parameter
// Format: Map<functionSignature, Map<paramName, Array[min, max]>
const fnMinMaxValueMap = new Map();

// Saves all the created test cases for each function
// Format: Map<functionSignature, Set<FunctionTest>>
const fnCasesMap = new Map();

//save type of generation for test cases
//supported: random, normalCurve
var generationType = 'random';

//save if edge cases are included
var edgeChecked = false;

//save number of count for generating cases
var generationCount = 0;

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

function createTestDir() {
    //check if filepath exists, if not create
    const testsDir = "./tests";
    fs.stat(testsDir, (err, stats) => {
        if (err) {
            if (err.code === 'ENOENT') {
                fs.mkdir(testsDir, { recursive: true }, (err) => {
                    if (err) {
                        console.log("Error creating directory: ", err);
                    }
                });
            }
        }
    })
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

        // adding to functionParamTypes
        if (fn.parameters.length > 0) {
            fn.parameters.forEach(param => {
                if (!functionParamTypes.has(signature)) {
                    functionParamTypes.set(signature, new Set([]));
                    functionParamTypes.get(signature).add([param, "All"]);
                } else {
                    functionParamTypes.get(signature).add([param, "All"]);
                }
            })
            console.log("Function param types: ", functionParamTypes);
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
});

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
});

// [IPCHandler]
// [Description] Sets the currently selected function with signature
// [Parameters] fn - Function to set as selected
// [Returns] None
ipcMain.handle('set-selected-function', async (event, fnSig) => {
    fnSelected = fnSig;
    console.log("Function selected: ", fnSelected);
});

// [IPCHandler]
// [Description] Sets the currently selected test to delete
// [Parameters] functionTest - Test (object) to set as selected to delete
// [Returns] None
ipcMain.handle('set-selected-test-delete', async(event, functionTest) => {
    testSelectedDelete = functionTest;
    console.log("Test selected to delete: ", testSelectedDelete);
});

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
});

// [IPCHandler]
// [Description] Retrieves all tests for a function from fnCasesMap
// [Parameters] fnSignature - Signature of the function to get tests for
//              fnSignature - (selected.name + "@" + selected.file)
// [Returns] Array of tests for the function
ipcMain.handle('get-tests-for-function', async (event, fnSignature) => {
    console.log("Function signature received: ", fnSignature);
    console.log("Function test found: ", fnCasesMap.get(fnSignature));
    return fnCasesMap.get(fnSignature);
});

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
});

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
    
});

// [IPCHandler]
// [Description] Sets the type of the param for a function
// [Parameters] fnSignature - Signature of the function to update
//              paramName - Name of the param to update
//              paramType - Type of the param to update
// [Returns] None
ipcMain.handle('set-function-param-types', async(event, fnSignature, paramName, paramType) => {
    console.log("Function param to update: ", fnSignature, paramName, paramType);
    functionParamTypes.get(fnSignature).forEach(param => {
        if (param[0] === paramName) {
            param[1] = paramType;
        }
    })
    console.log("Function param types updated: ", functionParamTypes);
});

// [IPCHandler]
// [Description] Gets the param types of the function
// [Parameters] fnSignature - Signature of the function to get the params of
// [Returns] None
ipcMain.handle('get-function-param-types', async(event, fnSignature) => {
    return functionParamTypes.get(fnSignature);
});

// [IPCHandler]
// [Description] Generates tests and saves them to a file
// [Parameters] outputFilePath - Path to save the file to
//              count - Number of tests to generate
// [Returns] None
ipcMain.handle('generate-and-save-tests', async (event, outputFilePath) => {
    console.log("Generate tests @" + outputFilePath + " count: " + generationCount); 

    // stores all the generated test cases
    // stores it in the describe block
    // each function has its own describe block
    var allCasesGenerated = [];

    // generates test cases for each function
    // based on the count and whether edge is included
    functionsExtracted.forEach((value, key) => {
        console.log("key: ", key);
        console.log("value: ", value);

        // get the types of the parameters for the function
        var types = functionParamTypes.get(key);
        var minmax = fnMinMaxValueMap.get(key);
        console.log("mainminxmax", minmax);
        // generates test cases based on the types, count and edge included (?)
        var cases = generateCasesForFunction(value, types, generationCount, generationType, minmax, edgeChecked);
        // add to all the generated test cases
        allCasesGenerated.push(cases);
    })

    //combine all the generated test cases and save to a file
    let data = '';
    data += `const assert = require('assert');\n\n`;
    // writing the requires for each function at the top of the script
    scriptFunctionsMap.forEach((value, key) => {
        data += `const { ${value.join(', ')} } = require('../${key}');\n`;
    })
    data += `\n`;
    data += allCasesGenerated.join('\n\n');
    fs.writeFileSync(outputFilePath, data, 'utf8');
    console.log("Tests generated and saved to: ", outputFilePath);
});

// [IPCHandler]
// [Description] Change generation type for test cases
// [Parameters] Type - random / normalCurve
ipcMain.handle('set-generation-type', async (event, type) => {
    if (type === 'random' || type === 'normalCurve') {
        generationType = type;
        console.log("Generation type changed to: ", generationType);
    } else {
        console.log("Invalid generation type: ", type);
    }
});

// [IPCHandler]
// [Description] Get generation type
// [Return] Generation type
ipcMain.handle('get-generation-type', async (event) => {
    return generationType;
});

// [IPCHandler]
// [Description] Change generation count for test cases
// [Parameters] count - number
ipcMain.handle('set-generation-count', async (event, count) => {
    generationCount = count;
    console.log("Generation count: ", generationCount);
});

// [IPCHandler]
// [Description] Get generation count
// [Return] Generation count
ipcMain.handle('get-generation-count', async (event) => {
    return generationCount;
});

// [IPCHandler]
// [Description] Set edge checked
// [Parameters] boolean - edge checked
ipcMain.handle('set-edge-checked', async (event, check) => {
    edgeChecked = check;
    console.log("Edge checked: ", edgeChecked);
});

// [IPCHandler]
// [Description] Get edge checked
// [Return] boolean
ipcMain.handle('get-edge-checked', async (event) => {
    return edgeChecked;
});

// [IPCHandler]
// [Description] Run mocha with all the tests in the tests folder
// [Returns] Results
ipcMain.handle('run-mocha', async (event) => {
    const mocha = new Mocha();
    var results = [];

    // Dynamically load test files
    const testDir = path.join(__dirname, 'tests');
    fs.readdirSync(testDir).filter(file => file.endsWith('.js')).forEach(file => {
        mocha.addFile(path.join(testDir, file));
    });

    //wait until mocha fully finishes
    await new Promise((resolve, reject) => {
        const runner = mocha.run((failures) => {
            resolve();
        });
        runner.on('test', (test) => {
            results.push({status: 'start', name: test.title});
        });
        runner.on('pass', (test) => {
            results.push({status: 'pass', name: test.title});
        });
        runner.on('fail', (test, err) => {
            results.push({status: 'fail', name: test.title, error: err.message});
        });
    });

    return results;
});

// [IPCHandler]
// [Description] Sets the min/max value of the function
// [Parameters] fnSignature - Signature of the function
//              value - Value to set
//              param - Parameter to set
//              which - min/max
// Format: Map<functionSignature, Map<paramName, Array[min, max]>
ipcMain.handle('update-min-max', async (event, fnSignature, value, param, which) => {
    if (which == 'min') {
        //has both fnsignature entry and param entry
        if (fnMinMaxValueMap.has(fnSignature) && fnMinMaxValueMap.get(fnSignature).has(param)) {
            fnMinMaxValueMap.get(fnSignature).set(param, [value, fnMinMaxValueMap.get(fnSignature).get(param)[1]]);
        } else if (fnMinMaxValueMap.has(fnSignature)) { //only fnsignature entry
            fnMinMaxValueMap.get(fnSignature).set(param, [value, undefined]);
        } else {
            fnMinMaxValueMap.set(fnSignature, new Map([[param, [value, undefined]]]));
        }
        console.log("Min value set: ", fnMinMaxValueMap.get(fnSignature));
    } else if (which == 'max') {
        if (fnMinMaxValueMap.has(fnSignature) && fnMinMaxValueMap.get(fnSignature).has(param)) {
            fnMinMaxValueMap.get(fnSignature).set(param, [fnMinMaxValueMap.get(fnSignature).get(param)[0], value]);
        } else if (fnMinMaxValueMap.has(fnSignature)) { //only fnsignature entry
            fnMinMaxValueMap.get(fnSignature).set(param, [undefined, value]);
        } else {
            fnMinMaxValueMap.set(fnSignature, new Map([[param, [undefined, value]]]));
        }
        console.log("Max value set: ", fnMinMaxValueMap.get(fnSignature));
    } else {
        console.log ("Unrecognized value when setting min/max!");
    }
});

// [IPCHandler]
// [Description] Gets the min/max value of a function signature
// [Returns] min/max in array [min, max]
ipcMain.handle('get-min-max', async (event, fnSignature) => {
    return fnMinMaxValueMap.get(fnSignature);
});

//checks when Electron has finished loading, then runs the function
app.whenReady().then(createWindow);
app.whenReady().then(createTestDir);

app.on('window-all-closed', () => {
    //for macOS - app usually keeps running in the background
    // ensures app quits on windows/linux, and behaves normally on macOS
    if (process.platform !== 'darwin') {
        app.quit();
    }
});