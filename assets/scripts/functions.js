const fs = require('fs');
const path = require('path');
const acorn = require('acorn');
const walk = require('acorn-walk');

// Mocha for testing
const Mocha = require('mocha'),
      Suite = Mocha.Suite,
      Runner = Mocha.Runner,
      Test = Mocha.Test;

module.exports = { createTemplate, extractFunctions, createSignature, generateCasesForFunction };

// function to extract functions from files
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
                    const fullfn = code.slice(node.start, node.end);
                    functions.push({
                        name: node.id.name,
                        file: filePath,
                        parameters: node.params.map(param => param.name),
                        body: code.slice(node.body.start, node.body.end),
                        full: fullfn
                    });
                },
                FunctionExpression(node) {
                    const fullfn = code.slice(node.start, node.end);
                    if (node.id) {
                        functions.push({
                            name: node.id.name,
                            file: filePath,
                            parameters: node.params.map(param => param.name),
                            body: code.slice(node.body.start, node.body.end),
                            full: fullfn
                        });
                    }
                },
                ArrowFunctionExpression(node) {
                    // For arrow functions (optional)
                    const fullfn = code.slice(node.start, node.end);
                    if (node.id) {
                        functions.push({
                            name: node.id.name,
                            file: filePath,
                            parameters: node.params.map(param => param.name),
                            body: code.slice(node.body.start, node.body.end),
                            full: fullfn
                        });
                    }
                }
            })
        }
    })

    console.log(functions);
    return functions;
}

// fnObject parameters can be directly accessed
// name, file, parameters, body, full (function)
// describe('add()', () => {
//     it('Description of add', () => {
//         const result = add(1, 2);
//         expect(result).to.equal(3); 
//     });
// });
function createTemplate(fnObject)
{
    const template =  
`describe('#${fnObject.name}(${fnObject.parameters})', function() {
    it('${fnObject.name} should return (value)', function() {
        const result = ${fnObject.name}(${fnObject.parameters});
        assert.equal(result, value);
    });
});`

    return template;
}

function createTemplateTestError(fnObject, args) {
    const template =  
`   
    it('${fnObject.name} should handle ${args} for ${fnObject.parameters}', function() {
        let error = false;
        try {
            const result = ${fnObject.name}(${args});
        } catch (error) {
            assert.equal(error.message, 'Error');
        }
        assert.equal(error, false);
    });`
    
    return template;
}

// create a signature for the function using name and file
function createSignature(name, file) {
    return name + "@" + file;
}

// for generating test cases for function
function generateCasesForFunction(fn, types, count, edge) {
    //get the parameters from the function
    let data = '';
    let cases = [];

    // since function doesn't have parameters, just need to call and check if it works
    if (types == null || types.length <= 0) {
        data += `describe('#${fn.name}(${fn.parameters})', function() {`;
        var createdFn = createTemplateTestError(fn, []);
        data += createdFn;
        data += `\n});`;
    } else { 
        //if function has parameters, randomize parameters and call the function
        //add the describe starter into the data
        // this is for each function
        data += `describe('#${fn.name}(${fn.parameters})', function() {`;
        //create the 'it' test cases based on the count
        for (let i = 0; i < count; i++) {
            var newArgs = []; //to store the new arguments that has been randomized
            types.forEach(type => { //for each parameter, get a new random value based on type
                newArgs.push(RandomizeValue(type[1]));
            })
            let createdFn = createTemplateTestError(fn, newArgs); //create case based on new values
            cases.push(createdFn); //add the created test case
        }
        
        //if edge case is enabled, add edge case
        if (edge) {
            var edgeArgs = [];
            types.forEach(type => {
                edgeArgs.push(EdgeValue(type[1]));
            })
            let createdFn = createTemplateTestError(fn, edgeArgs);
            data += createdFn;
        }

        data += cases.join('\n');
        data += `\n});`;
    }
    return data;
}

function RandomizeValue(type) {
    let value;
    switch (type) {
        case 'All':
            const types = ['Number', 'String', 'Boolean', 'Null', 'Undefined', 'Array', 'Object', 'Date', 'Error', 'Map', 'Set', 'WeakMap', 'WeakSet'];
            value = RandomizeValue(types[Math.floor(Math.random() * types.length)]);
            break;
        case 'Number':
            value = Math.floor(Math.random() * 1000);
            break;
        case 'String':
            value = (Math.random() + 1).toString(36).substring(7);
            break;
        case 'Boolean':
            value = Math.random() < 0.5;
            break;
        case 'Null':
            value = null;
            break;
        case 'Undefined':
            value = undefined;
            break;
        case 'Array':
            const arrayLength = Math.floor(Math.random() * 10); // Random array length
            value = Array.from({ length: arrayLength }, () => RandomizeValue('All'));
            break;
        case 'Object':
            value = {};
            const objLength = Math.floor(Math.random() * 5); // Random object size
            for (let i = 0; i < objLength; i++) {
                const key = (Math.random() + 1).toString(36).substring(7); // Random key
                value[key] = RandomizeValue('All');
            }
            break;
        case 'Date':
            value = new Date(Math.floor(Math.random() * Date.now()));
            break;
        case 'Error':
            value = new Error('Random error: ' + Math.random());
            break;
        case 'Map':
            value = new Map();
            const mapSize = Math.floor(Math.random() * 5); // Random map size
            for (let i = 0; i < mapSize; i++) {
                value.set(Math.random().toString(36).substring(7), RandomizeValue('All'));
            }
            break;
        case 'Set':
            value = new Set();
            const setSize = Math.floor(Math.random() * 5); // Random set size
            for (let i = 0; i < setSize; i++) {
                value.add(RandomizeValue('All'));
            }
            break;
        case 'WeakMap':
            value = new WeakMap();
            const weakMapSize = Math.floor(Math.random() * 5); // Random weakMap size
            for (let i = 0; i < weakMapSize; i++) {
                let objKey = {}; // WeakMap only accepts objects as keys
                value.set(objKey, RandomizeValue('All'));
            }
            break;
        case 'WeakSet':
            value = new WeakSet();
            const weakSetSize = Math.floor(Math.random() * 5); // Random weakSet size
            for (let i = 0; i < weakSetSize; i++) {
                value.add({}); // WeakSet only accepts objects
            }
            break;
        default:
            value = null;
            break;
    }
    return value;
}

function EdgeValue(type) {
    let value;
    switch (type) {
        case 'All':
            break;
        case 'Number':
            break;
        case 'String':
            break;
        case 'Boolean':
            break;
        case 'Null':
            break;
        case 'Undefined':
            break;
        case 'Array':
            break;
        case 'Object':
            break;
        case 'Date':
            break;
        case 'Error':
            break;
        case 'Map':
            break;
        case 'Set':
            break;
        case 'WeakMap':
            break;
        case 'WeakSet':
            break;
        default:
            value = null;
            break;
    }
    return value;
}
