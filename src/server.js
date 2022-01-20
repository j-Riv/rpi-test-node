'use strict';

const express = require('express');
const path = require('path');

// Constants
const PORT = 3000;

// App
const app = express();
app.use('/public', express.static('public'))

app.get('/', (req, res) => {
    // res.send('Hello Friend...');
    res.sendFile('./views/index.html', { root: __dirname })
});

app.listen(PORT, function () {
    console.log(`Running on PORT: ${PORT}`);
});
