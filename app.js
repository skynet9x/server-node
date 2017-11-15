
var express = require('express')
var app = express()

app.get('/', function (req, res) {
  res.send('Hello World')
});

app.get('/api', function (req, res) {

	res.setHeader('Content-Type', 'application/json');

	var data = {
		version: "0.0.0.1",
		author: "skynet"
	};


	res.send(JSON.stringify(data));
});

app.set('port', (process.env.PORT || 4000));

app.listen(app.get('port'), function ()
{
	console.log('Node app is running on port', app.get('port'));
});