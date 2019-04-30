'use strict';
const fs = require('fs');
const romDir = './roms/';
const workingRomDir = './working_roms/';
var express = require('express');
var app = express();
//Allow loading of static files
// app.use(express.static(__dirname + ''));
app.use('/public', express.static(process.cwd() + '/public'));
app.use('/node_modules', express.static(process.cwd() + '/node_modules'));
//APIs defined from here on
//Search for roms and get filename
app.route('/api/getRomListByName/:romName')
    .get(function(req, res) {
        fs.readdir(workingRomDir, (err, files) => {
            if (!err) {
                files.forEach(file => {
                    var temp = file.toLowerCase();
                    if (temp.search(req.params.romName.toLowerCase()) >= 0) {
                        res.json({ 'rom': file });
                    }
                });
            }
        });
    });

app.route('/api/getPlayableRoms')
    .get(function(req, res) {
        var rom = {};
        var roms = [];
        fs.readdir(workingRomDir, (err, files) => {
            if (!err) {
                files.forEach(file => {
                    rom = {};
                    rom['name'] = file.split('.')[0];
                    rom['file'] = file;
                    roms.push(rom);
                });
                res.json({ roms: roms });
            }
        });
    });
//Load a rom requested through its file name
app.route('/api/getRomByFileName/:romFileName')
    .get(function(req, res) {
        var buffer = fs.readFileSync(workingRomDir + req.params.romFileName);
        res.json({ 'romData': buffer });
    });
app.route('/')
    .get(function(req, res) {
        res.sendFile(process.cwd() + '/public/home.html');
    });
app.route('/test')
    .get(function(req, res) {
        res.sendFile(process.cwd() + '/public/opt_test/index.html');
    });
app.route('*')
    .get(function(req, res) {
        res.redirect('/');
    });

//Start the node server
app.listen(8080, function() {
    console.log("server started successfully");
});
