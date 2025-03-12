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
    let newParams = [];
    var template =  
`describe('#${fnObject.name}(${fnObject.parameters})', function() {
    it('${fnObject.name} should return (value)', function() {
`
    fnObject.parameters.forEach(param => {
        template += `        const i${param} = newValue;\n`;
        newParams.push(`i${param}`);
    })

    template +=
`
        const result = ${fnObject.name}(${newParams});
        assert.equal(result, value);
    });
});`

    return template;
}

//creates an 'it' block for mocha unit testing using the function and types
//randomizes a value for each parameter + type for the function
//types here is the set of types from functionParamTypes
//Set([par1, "Number"], [par2, "String"], [par3, "Boolean"])
function createTemplateTestError(fnObject, types) {
    //to store the new argument names
    var newArgs = [];
    //to store the detected types
    var allTypes = [];
    //get all the type names of the function
    if (types) {
        types.forEach(type => {
            let i = `${type[1]}`;
            allTypes.push(i);
        });
    }
    //creating the initial header based on whether there are parameterss
    var template = types == null || types.length <= 0 ? 
`   
    it('${fnObject.name} should handle with no error', function() {
        let error = false;
` :
`   
    it('${fnObject.name} should handle ${allTypes} for ${fnObject.parameters}', function() {
        let error = false;
`
    //randomize types here and add line by line here
    let counter = 0;
    const diff = ['Number', 'String', 'Boolean', 'Null', 'Undefined', 'Array', 'Object', 'Date', 'Error', 'Map', 'Set'];

    types.forEach(type => {
        let t;
        if (type[1] == 'All') {
            t = diff[Math.floor(Math.random() * diff.length)];
        } else {
            t = `${type[1]}`;
        }

        let newName = `i${t}${counter}`;
        newArgs.push(newName);
        let value = RandomizeValue(t);
        switch(t) {
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
                template += `        let ${newName} = ${value}\n`;
                break;
            case 'Map':
                template += `        let ${newName} = new Map(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            case 'Set':
                template += `        let ${newName} = new Set(JSON.parse(${JSON.stringify(value)}));\n`;
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

//creates an 'it' block for mocha unit testing using the function and types
//creates an edge value for each parameter + type for the function
function createEdgeCaseTestError(fnObject, types) {
    var newArgs = [];
    //to store the detected types
    var allTypes = [];
    //get all the type names of the function
    if (types) {
        types.forEach(type => {
            let i = `${type[1]}`;
            allTypes.push(i);
        });
    }
    //setting the initial block depending on whether there are parameters
    var template = types == null || types.length <= 0 ? 
`   
    it('${fnObject.name} should handle with no error', function() {
        let error = false;
` :
`   
    it('${fnObject.name} should handle edge cases with ${allTypes} for ${fnObject.parameters}', function() {
        let error = false;
`
    //randomize types here and add line by line here
    let counter = 0;
    const diff = ['Number', 'String', 'Boolean', 'Null', 'Undefined', 'Array', 'Object', 'Date', 'Error', 'Map', 'Set'];

    types.forEach(type => {
        let t;
        if (type[1] == 'All') {
            t = diff[Math.floor(Math.random() * diff.length)];
        } else {
            t = `${type[1]}`;
        }

        let newName = `i${t}${counter}`;
        newArgs.push(newName);
        let value = EdgeValue(t);
        switch(t) {
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
                template += `        let ${newName} = ${value}\n`;
                break;
            case 'Map':
                template += `        let ${newName} = new Map(JSON.parse(${JSON.stringify(value)}));\n`;
                break;
            case 'Set':
                template += `        let ${newName} = new Set(JSON.parse(${JSON.stringify(value)}));\n`;
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
            for (let i = 0; i < count; i++) {
                let createdFn = createEdgeCaseTestError(fn, types);
                cases.push(createdFn);
            }
        }

        data += cases.join('\n');
        data += `\n});`;
    }
    return data;
}

//randomizes a value based on the type being passed in
//returns a randomized value based on the type
function RandomizeValue(type) {
    let value;
    switch (type) {
        case 'All':
            const types = ['Number', 'String', 'Boolean', 'Null', 'Undefined', 'Array', 'Object', 'Date', 'Error', 'Map', 'Set'];
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
            value = Math.random() < 0.33 ? `new Error('Generic error' + Math.random());` : 
                Math.random() < 0.5 ? `new TypeError('Type Error');` : `new ReferenceError('Reference Error');`;
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
        default:
            value = null;
            break;
    }
    return value;
}

//edges a value based on the type being passed in
//returns an edge value based on the type
function EdgeValue(type) {
    let edgeValue;
    switch (type) {
        case 'All':
            const types = ['Number', 'String', 'Boolean', 'Null', 'Undefined', 'Array', 'Object', 'Date', 'Error', 'Map', 'Set'];
            edgeValue = EdgeValue(types[Math.floor(Math.random() * types.length)]);
            break;
        case 'Number':
            edgeValue = Math.random() < 0.33 ? Number.MAX_SAFE_INTEGER : 
                Math.random() < 0.5 ?  Number.MIN_SAFE_INTEGER : NaN;
            break;
        case 'String':
            edgeValue = Math.random() < 0.33 ? '' : 
                Math.random() < 0.5 ? 'a'.repeat(1000000) : '   ';
            break;
        case 'Boolean':
            edgeValue = Math.random() < 0.5 ? true : 
                Math.random() < 0.5 ? false : 'invalid';
            break;
        case 'Null':
            edgeValue = null;
            break;
        case 'Undefined':
            edgeValue = null;
            break;
        case 'Array':
            edgeValue = Math.random() < 0.33 ? [] :
                Math.random() < 0.5 ? [Math.random()] : new Array(1000000).fill('edge');
            break;
        case 'Object':
            const cases = [
                {},                                     //Empty
                { key: { nestedKey: 'nestedValue' } },  //Nested Object
                { null: 'value' },                      //Null Key
                { key: [1, 2, 3] },                     //Array Value
                Object.create(Object.prototype),        //Prototype inheritence
                { __proto__: { key: 'value' } },        //MOdified proto chain
                { a: { b: {} }, b: { a: {} } },         //Circular reference
                { 'constructor': 'value' }              //Special Name
            ];
            edgeValue = cases[Math.floor(Math.random() * cases.length)];
            break;
        case 'Date':
            const dateCases = [
                new Date(),                 // Current
                new Date('2025-01-01'),     // Valid specific
                new Date('invalid date'),   // Invalid date string
                new Date('2024-02-29'),     // Leap year
                new Date('9999-12-31'),     // Maximum valid
                new Date('1000-01-01'),     // Minimum valid
                new Date('99999-12-31')     // Overflow
            ];
            edgeValue = dateCases[Math.floor(Math.random() * dateCases.length)].toISOString();
            break;
        case 'Error':
            const errorCases = [
                `new Error('Generic error');`,
                `new Error('Edge case error with stack trace');`
                `new Error();`,
                `new TypeError('Type Error');`,
                `new ReferenceError('Reference Error');`
            ];
            edgeValue = errorCases[Math.floor(Math.random() * errorCases.length)];
            break;
        case 'Map':
            const mapCases = [
                new Map(),                                              //Empty Map
                new Map([['key1', 'value1']]),                          //Map with one value
                new Map([[{}, 'value']]),                               // Map with non-primitive key
                (() => { 
                    const obj1 = {};
                    const obj2 = {};
                    obj1.obj2 = obj2;
                    obj2.obj1 = obj1;
                    return new Map([[obj1, obj2]]);
                })(),                                                   // Map with circular references
                new Map([[1, 'value1'], ['key2', 100], [false, {}]]),   // Map with mixed data types
                (() => {
                    const map = new Map();
                    for (let i = 0; i < 1000000; i++) map.set(i, i);    // Map with large number of entries
                    return map;
                })()
            ];
            edgeValue = mapCases[Math.floor(Math.random() * mapCases.length)];
            let mapArr = Array.from(edgeValue);
            edgeValue = mapArr;
            break;
        case 'Set':
            const setCases = [
                new Set(),                                      // Empty
                new Set([1, 2, 3]),                             // Set with unique values
                new Set([1, 'string', true, {}, new Date()]),   // Set with mixed data types
                new Set([NaN]),                                 // Set with NaN value
                new Set([{}]),                                  // Set with object as a value
                (() => { 
                    const obj1 = {};
                    obj1.ref = obj1;
                    return new Set([obj1]);                     // Set with circular references
                })(), 
                new Set([1, 1, 1]),                             // Set with duplicate values (should only store unique values)
                new Set([[]]),                                  // Set with an empty array as a value
                new Set([null, undefined, null])                // Set with mixed null/undefined values
            ];
            edgeValue = setCases[Math.floor(Math.random() * setCases.length)];
            let setArr = Array.from(edgeValue);
            edgeValue = setArr;
            break;
        default:
            edgeValue = null;
            break;
    }
    return edgeValue;
}
