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

const typeTestCases = [
    { input: 1, expected: 1, shouldThrow: false},                           //Number
    { input: 'hello', expected: 'hello', shouldThrow: false},               //String
    { input: true, expected: true, shouldThrow: false},                     //Boolean
    { input: null, expected: null, shouldThrow: false},                     //Null
    { input: undefined, expected: undefined, shouldThrow: false},           //Undefined
    { input: [], expected: [], shouldThrow: false},                         //Array
    { input: {}, expected: {}, shouldThrow: false},                         //Object
    { input: new Date(), expected: new Date(), shouldThrow: false},         //Date
    { input: new Error(), expected: new Error(), shouldThrow: false},       //Error
    { input: new Map(), expected: new Map(), shouldThrow: false},           //Map
    { input: new Set(), expected: new Set(), shouldThrow: false},           //Set
    { input: new WeakMap(), expected: new WeakMap(), shouldThrow: false},   //WeakMap
    { input: new WeakSet(), expected: new WeakSet(), shouldThrow: false},   //WeakSet
]

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
`describe('#${fnObject.name}()', function() {
    it('${fnObject.name} should return (value)', function() {
        const result = ${fnObject.name}(${fnObject.parameters});
        assert.equal(result, value);
    });
});`

    return template;
}

function createTemplateTestError(fnObject, args) {
    const template =  
`describe('#${fnObject.name}()', function() {
    it('${fnObject.name} should handle ${args} for ${fnObject.parameters}', function() {
        let error = false;
        try {
            const result = ${fnObject.name}(${args});
        } catch (error) {
            assert.equal(error.message, 'Error');
        }
        assert.equal(error, false);
    });
});`
    
    return template;
}


// create a signature for the function using name and file
function createSignature(name, file) {
    return name + "@" + file;
}

// for generating test cases for function
function generateCasesForFunction(fn, types, count) {
    //get the parameters from the function
    const cases = [];

    for (let i = 0; i < count; i++) {
        var newArgs = [];
        types.forEach(type => {
            // random the value in types, based on the type
            // push into newArgs
            // if the type is not in the types, push null
        })
        var createdFn = createTemplateTestError(fn, newArgs);
        cases.push(createdFn);
    }
}
