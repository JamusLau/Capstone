const { ipcRenderer } = require('electron');

document.getElementById('scanButton').addEventListener('click', async () => {

    const inputElement = document.getElementById('directoryInput');

    if (inputElement.files.length === 0)
    {
        console.error("No directory selected");
        return;
    }

    console.log(inputElement.files);

    const allFiles = Array.from(inputElement.files).map(file => ({
        name: file.name,
        path: file.path,
        webkitRelativePath: file.webkitRelativePath
    }));
    console.log(allFiles);

    const functions = await ipcRenderer.invoke('get-functions', allFiles);

    console.log(functions);

    const functionsList = document.getElementById('functions-list');
    functionsList.innerHTML = '';

    functions.forEach(fn => {
        const fnContainer = document.createElement('div');
        fnContainer.classList.add('function-box');

        const fnHead = document.createElement('p');
        fnHead.textContent = `${fn.name} in ${fn.file}`;
        fnContainer.appendChild(fnHead);

        const fnBody = document.createElement('pre');
        fnBody.textContent = fn.body;
        fnContainer.appendChild(fnBody);

        functionsList.appendChild(fnContainer);
    });
});
