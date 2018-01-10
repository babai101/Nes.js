'use strict';
const fs = require('fs');
const romDir = './roms/';
var express = require('express');
var app = express();
//Allow loading of static files
app.use(express.static(__dirname + ''));

//APIs defined from here on
//Search for roms and get filename
app.route('/api/getRomListByName/:romName')
    .get(function(req, res) {
        fs.readdir(romDir, (err, files) => {
            if (!err) {
                files.forEach(file => {
                    var temp = file.toLowerCase();
                    if (temp.search(req.params.romName.toLowerCase()) >= 0) {
                        res.json({ 'rom': file });
                        return;
                    }
                });
            }
        });
    });

//Load a rom requested through its file name
app.route('/api/getRomByFileName/:romFileName')
    .get(function(req, res) {
        var buffer = fs.readFileSync(romDir + req.params.romFileName);
        res.json({ 'romData': buffer });
    });

//Start the node server
app.listen(8080, function() {
    console.log("server started successfully");
});
