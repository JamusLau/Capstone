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

//types here is the set of types from functionParamTypes
//Set([par1, "Number"], [par2, "String"], [par3, "Boolean"])
function createTemplateTestError(fnObject, types) {
    var newArgs = [];
    var template = types == null || types.length <= 0 ? 
`   
    it('${fnObject.name} should handle with no error', function() {
        let error = false;
` :
`   
    it('${fnObject.name} should handle ${types} for ${fnObject.parameters}', function() {
        let error = false;
`
    //randomize types here and add line by line here
    let counter = 0;
    types.forEach(type => {
        let newName = `i${type[1]}${counter}`;
        newArgs.push(newName);
        let value = RandomizeValue(type[1]);
        switch(type[1]) {
            case 'Number':
                template += `        let ${newName} = ${value};\n`;
                break;
            case 'String':
                template += `        let ${newName} = '${value}';\n`;
                break;
            case 'Boolean':
                template += `        let ${newName} = ${value};\n`;
                break;
            case 'Null':
                template += `        let ${newName} = ${value};\n`;
                break;
            case 'Undefined':
                template += `        let ${newName} = ${value};\n`;
                break;
            case 'Array':
                template += `        let ${newName} = ${JSON.stringify(value)};\n`;
                break;
            case 'Object':
                template += `        let ${newName} = ${JSON.stringify(value)};\n`;
                break;
            case 'Date':
                template += `        let ${newName} = new Date("${value}");\n`;
                break;
            case 'Error':
                template += `        let ${newName} = new Error('${value}');\n`;
                break;
            case 'Map':
                template += `        let ${newName} = new Map(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            case 'Set':
                template += `        let ${newName} = new Set(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            case 'WeakMap':
                template += `        let ${newName} = new WeakMap(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            case 'WeakSet':
                template += `        let ${newName} = new WeakSet(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            default:
                template += `        let ${newName} = ${value};\n`;
                break;
        }
        counter++;
    });
    console.log("newargs", newArgs);
    template += 
`
        try {
            const result = ${fnObject.name}(${newArgs});
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
// fn - the function to generate cases for
// types - contains the types for the parameters
//         Set([par1, "Number"], [par2, "String"], [par3, "Boolean"])
// count - the number of test cases to generate
// edge - whether to generate edge cases
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
            let createdFn = createTemplateTestError(fn, types); //create case based on new values
            cases.push(createdFn); //add the created test case
        }
        
        //if edge case is enabled, add edge case
        if (edge) {
            let createdFn = createTemplateTestError(fn, types);
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
            const startDate = new Date(1925, 0, 1);
            const endDate = new Date();
            const randomTimestamp = startDate.getTime() + Math.random() * (endDate.getTime() - startDate.getTime());
            value = new Date(randomTimestamp).toISOString();
            break;
        case 'Error':
            value = `Random error: ` + Math.random();
            break;
        case 'Map':
            value = new Map();
            const mapSize = Math.floor(Math.random() * 5); // Random map size
            for (let i = 0; i < mapSize; i++) {
                const key = (Math.random() + 1).toString(36).substring(7); // Random key as string
                value.set(key, RandomizeValue('All')); // Set random value
            }
            let mapArr = Array.from(value);
            value = mapArr;
            break;
        case 'Set':
            value = new Set();
            const setSize = Math.floor(Math.random() * 5); // Random set size
            for (let i = 0; i < setSize; i++) {
                value.add(RandomizeValue('All'));
            }
            let setArr = Array.from(value);
            value = setArr;
            break;
        case 'WeakMap':
            value = new WeakMap();
            const weakMapSize = Math.floor(Math.random() * 5); // Random weakMap size
            for (let i = 0; i < weakMapSize; i++) {
                let objKey = {}; // WeakMap only accepts objects as keys
                value.set(objKey, RandomizeValue('All'));
            }
            let weakMapArr = Array.from(value);
            value = weakMapArr;
            break;
        case 'WeakSet':
            value = new WeakSet();
            const weakSetSize = Math.floor(Math.random() * 5); // Random weakSet size
            for (let i = 0; i < weakSetSize; i++) {
                value.add({}); // WeakSet only accepts objects
            }
            let weakSetArr = Array.from(value);
            value = weakSetArr;
            break;
        default:
            value = null;
            break;
    }
    return value;
}

function EdgeValue(type) {
    switch (type) {
        case 'All':
            break;
        case 'Number':
            return Math.random() < 0.33 ? Number.MAX_SAFE_INTEGER : 
                Math.random() < 0.5 ?  Number.MIN_SAFE_INTEGER : NaN;
        case 'String':
            return Math.random() < 0.33 ? '' : 
                Math.random() < 0.5 ? 'a'.repeat(1000000) : '   ';
        case 'Boolean':
            return Math.random() < 0.5 ? true : 
                Math.random() < 0.5 ? false : 'invalid';
        case 'Null':
            return null;
        case 'Undefined':
            return undefined;
        case 'Array':
            return Math.random() < 0.33 ? [] :
                Math.random() < 0.5 ? [Math.random()] : new Array(1000000).fill('edge');
        case 'Object':
            return Math.random() < 0.33 ? {} : 
                Math.random() < 0.5 ? { key1: 'value' } : { key1: { nestedKey: 'nestedValue' }, key2: 'value' };
        case 'Date':
            return Math.random() < 0.33 ? new Date() :
                Math.random() < 0.5 ? new Date('1900-01-01') : new Date('invalid date');
        case 'Error':
            return Math.random() < 0.5 ? new Error('Generic error') : new Error('Edge case error with stack trace');
        case 'Map':
            const map = new Map();
            return Math.random() < 0.33 ? map :
                Math.random() < 0.5 ? map.set('key1', 'value1') : map.set({}, new Date());
        case 'Set':
            return Math.random() < 0.33 ? new Set() :
                Math.random() < 0.5 ? new Set([1]) : new Set([1, 2, 3, 'edge']);
        case 'WeakMap':
            const weakMap = new WeakMap();
            return Math.random() < 0.5 ? weakMap.set({}, 'value') : weakMap.set(Object.create(null), 'edge');
        case 'WeakSet':
            const weakSet = new WeakSet();
            return weakSet.add({}) || weakSet.add(Object.create(null));
        default:
            value = null;
            break;
    }
}
