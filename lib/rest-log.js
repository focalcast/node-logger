var path = require('path');
var express = require('express');
var basicAuth = require('basic-auth');

var auth = function (req, res, next) {
  function unauthorized(res) {
    res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
    return res.sendStatus(401);
  };

  var user = basicAuth(req);

  if (!user || !user.name || !user.pass) {
    return unauthorized(res);
  };

  if (user.name === 'focalcast' && user.pass === 'Narsys.2013') {
    return next();
  } else {
    return unauthorized(res);
  };
};

var createLogPath = (app)=>{
    app.use('/node/static', express.static(path.join(__dirname, './static')));
    app.set('view engine', 'jade');
    app.set('views', path.join(__dirname, './static/templates'));
    app.get('/node/log/', auth, (req,res,next)=>{
        let f = path.join(__dirname, '../logs/focalnode-debug.log');
        let log = require('fs').readFileSync(f).toString().split("\n");
        let parsed = [];
        for(let l in log){
            if(log[l].length > 1){
                let line = JSON.parse(log[l]);
                line.number = l;
                parsed.push(line);
            }
        }
        log = parsed;
        res.render('index', {log: log}, (error, html)=>{
            res.send(html);
        });
    });
};
module.exports = createLogPath;
