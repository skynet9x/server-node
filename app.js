const express = require('express')
const moment = require('moment')
const moment_timezone = require('moment-timezone')
const disk = require('check-disk-space')
const os 	= require('os-utils')
const port = 3000
const server = require('http').createServer()
const io = require('socket.io')(server)
const port_io = 3001
const JsonStorage = require(`@geofreak/json-storage`)
const store = new JsonStorage(`${__dirname}/storage`)
const fs = require('fs')
const request = require('request')
const fileUpload = require('express-fileupload')
const http = require('http')
const https = require('https')
const fetch = require('fetch')

const bodyParser = require('body-parser')
const privateKey = fs.readFileSync('key.pem');
const certificate = fs.readFileSync('cert.pem');
const credentials = {key: privateKey, cert: certificate};
const app = express();


app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));
app.use(express.json());       // to support JSON-encoded bodies
app.use(express.urlencoded());


const storeModel = {
	group: { 
		dir: "group", 
		clumn: {
			name: "",
			count: "",
			avatar: "",
			createdAt: ""
		},
		
		find: function (name)
		{
			return store.getSync(storeModel.group.dir, name)
		},

		all: function ()
		{
			var groups = [];
	  		store.forEachSync(storeModel.group.dir, (json, file) => {
	  			groups.push(json);
	  		});
	  		return groups;
		},

		create: function (data)
		{
			return store.setSync(storeModel.group.dir, data.name, data);
		}
	},
	channel: {
		dir: "channel", 
		clumn: {
			name: "",
			channel_id: "",
			avatar: "",
			playlist_count: 0,
			playlists: [],
			createdAt: "date",
			keyword: "",
			max_day: 2,
			max_total: 100,
			delay: 3600 * 2,
			length_video: 20
		},
		find: function (channel)
		{
			return store.getSync(storeModel.channel.dir, channel);
		},
		all: function ()
		{
			var channels = [];
	  		store.forEachSync(storeModel.channel.dir, (json, file) => {
	  			channels.push(json);
	  		});
	  		return channels;
		}
	},
};

app.use(express.static('public'))
app.use(fileUpload({
    createParentPath: true,
    limits: { 
        fileSize: 2 * 1024 * 1024 * 1024 //2MB max file(s) size
    },
}));
app.set('view engine', 'ejs')
app.engine('ejs', require('ejs').__express)

// Global //

var timeoutProxy = 125;
var thisProxy = "";
var dateGetProxy = 0;
var lastKey = "";
var useProxyCount = 0;

async function updateCPUs ()
{
	os.cpuUsage(function(v) {
		var path = os.platform() === 'win32' ? 'C:' : '/';
		disk(path).then((diskSpace) => {
		    io.emit("os_server", {
	    		cpu: v, 
	    		ram_use: (os.totalmem() - os.freemem()), 
	    		ram_total: os.totalmem(), 
	    		disk_use: (diskSpace.size - diskSpace.free), 
	    		disk_total: diskSpace.size 
		    });
		});
	});
};

io.on('connection', client => {
  	client.on('event', data => { /* … */ });
  	client.on('disconnect', () => { /* … */ });
});

setInterval(function() {
	updateCPUs();
}, 1000);

function getRndInteger(min, max) {
  return Math.floor(Math.random() * (max - min) ) + min;
};

app.get('/proxy/check', (req, res) =>
{
	// request({
	// 	url: "http://proxy.tinsoftsv.com/api/changeProxy.php?key="+ req.query.key +"&location=0",
	// 	method: "GET"
	// }, function (error, response, body) {
		
	// 	var data = JSON.parse(response.body);
	// 	if (typeof data.proxy != "undefined")
	// 	{
	// 		request({
	// 			url: "https://ipinfo.io/",
	// 			method: "GET",
	// 			proxy: "http://"+ data.proxy
	// 		}, function (error, request, body) {
	// 			res.json(SON.parse(response.body));
	// 		});
	// 	} else {
	// 		request({
	// 			url: "http://proxy.tinsoftsv.com/api/getProxy.php?key="+ req.query.key,
	// 			method: "GET"
	// 		}, function (error, response, body) {
	// 			var data = JSON.parse(response.body);
	// 			request({
	// 				url: "https://ipinfo.io/",
	// 				method: "GET",
	// 				proxy: "http://"+ data.proxy
	// 			}, function (error, response, body) {
	// 				res.json(JSON.parse(response.body));
	// 			});
	// 		});
	// 	};
	// });

	request({
		url: "https://ipinfo.io/",
		method: "GET",
		proxy: "http://"+ req.query.proxy
	}, function (error, response, body) {
		if (error == null)
			res.json(JSON.parse(response.body));
		else 
			res.json({ error: { msg: "proxy not connect" } });
	});
});

app.get('/', (req, res) => {
  	res.render('index');
});

// Group Router //
app.get('/group/get', (req, res) => {
	var data = storeModel.group.all();
	return res.json(data);
});

app.post('/group/update', (req, res) => {
	
});

app.put('/group/create', (req, res) => {
	if (req.body.name != "")
	{
		storeModel.group.create(req.body);
		io.emit("group_create",req.body);
	};
	res.json(req.body);
});

app.delete('/group/del', (req, res) => {
	var pathFile = "./storage/group/"+ req.body.name + ".json";
	fs.unlink(pathFile, function (err) {
	  if (err) {
	  	console.log('File fail!');
	  } else {
	  	console.log('File deleted!');
	  	store.forEachSync("channel", (json, file) => {
			if (json.group == req.body.name)
				fs.unlinkSync("./storage/channel/"+ json.channel + ".json");
		});
	  };
	});
	
	res.json({ del: true });
});

// Keyword Router //
app.get('/keyword/get', (req, res) => {
	var keywords = [];
	store.forEachSync("keyword", (json, file) => {
		json.keyword = [];
		keywords.push(json);
	});
	res.json(keywords);
});

app.put('/keyword/upload', (req, res) => {
	let keyword = req.files.keyword;
  	var buffer = new Buffer.from(keyword.data)
  	var lists = buffer.toString("utf8").split("\n");
  	store.setSync("keyword", req.body.name, {
  		name: req.body.name,
  		keyword: lists
  	});

	res.json({
		name: keyword.name,
	    mimetype: keyword.mimetype,
	    size: keyword.size 
	});
});

app.delete('/keyword/del', (req, res) => {
	var pathFile = "./storage/keyword/"+ req.body.name + ".json";

	fs.unlink(pathFile, function (err) {
	  if (err)
	  	console.log(err);
	  else
	  	console.log('File deleted!');
	});
	res.json({ del: true, pathFile: pathFile});
});

// Channel Router //
app.get('/channel/detail/:channelId', (req, res) => {
	var channel = store.getSync(storeModel.channel.dir, req.params.channelId);
	res.json(channel);
});

app.get('/channel/get', (req, res) => {
	var channels = [];
	store.forEachSync("channel", (json, file) => {
		if (json.group == req.query.group)
		{
			if (req.query.status == "all")
			{
				channels.push(json);
			} else {
				if (json.status == req.query.status)
				{
					channels.push(json);
				};
			};
		};
	});
	res.json(channels);
});

app.post('/channel/update/option/playlist', (req, res) => {
	var channel = store.getSync(storeModel.channel.dir, req.body.channel);
	channel.playlist_option = {
		create_delay: req.body.create_delay,
		max_total: req.body.max_total,
		max_day: req.body.max_day,
		start: req.body.start,
		keyword: req.body.keyword,
		count_video: req.body.count_video,
		proxy: {
			type: req.body.type_proxy,
			key: req.body.key,
			proxy: req.body.proxy,
		},
		videos: req.body.videos,
		info: {
			type_desc: req.body.type_desc,
			desc_content: req.body.desc_content
		}
	};
	
	store.setSync("channel", channel.channel, channel);
	res.json(channel);
});

app.post('/channel/update/playlist/start', (req, res) => {
	var channel = store.getSync(storeModel.channel.dir, req.body.channel);
	if (typeof channel.playlist_option.start != "undefined")
	{
		channel.playlist_option.start = '1';
		store.setSync("channel", channel.channel, channel);
	};
	res.json({update: channel});
});

app.post('/channel/update/playlist/stop', (req, res) => {
	var channel = store.getSync(storeModel.channel.dir, req.body.channel);
	if (typeof channel.playlist_option.start != "undefined")
	{
		channel.playlist_option.start = '0';
		store.setSync("channel", channel.channel, channel);
	};
	res.json({update: channel});
});

app.put('/channel/create', (req, res) => {
	var data = {
		channel: req.body.channel,
		cookie: req.body.cookie,
		status: "---",
		group: req.body.group
	};

	// check live //
	var status = "die";
	var keyAPi = "AIzaSyA_ONHofV_6Y_Ri6FBS3v3lXfwnb2-lt38";
	var pageToken = "";
	var boolGetPll = true;
	var TotalPll = 0;
	var dataPlaylist = [];
	function getPLL() {
		if (boolGetPll)
		{
			getDataPlaylistByChannel(data.channel, keyAPi, pageToken, function (boolStatus, response) {
				if (response.error)
				{ 	
					if (response.error.message == "Channel not found." || response.error.message == "The channel specified in the <code>channelId</code> parameter has been suspended.")
					{
						status = "die";
						boolGetPll = false;
					} else {
						console.log(response.error.message);
					};
					getPLL();
				} else {
					status = "live"; 
					TotalPll = response.pageInfo.totalResults;
					data.count_playlist = TotalPll;
					pageToken = (response.nextPageToken) ? response.nextPageToken : (boolGetPll=false);
					for(var i = 0; i < response.items.length; i++)
					{
						dataPlaylist.push(response.items[i]);
						store.setSync("playlist", response.items[i].id, response.items[i]);
					};
					getPLL();
				};
			});
		} else {
			data.status = status;
			res.json(req.body);
			store.setSync("channel", data.channel, data);
		};
	};
	getPLL();
});

app.delete('/channel/del', (req, res) => {
	var pathFile = "./storage/channel/"+ req.body.channel + ".json";

	fs.unlink(pathFile, function (err) {
	  if (err)
	  	console.log(err);
	  else
	  	console.log('File deleted!');
	});
	res.json({ del: true, pathFile: pathFile});
});

app.get('/playlist/data', (req, res) => {
	var playlists = [];
	var channel = req.query.channel;
	store.forEachSync("playlist", (json, file) => {
		if (typeof channel != undefined)
		{
			if (json.snippet.channelId == channel)
				playlists.push(json);
		} else {
			playlists.push(json);
		};
	});
	res.json(playlists);
});

app.post('/playlist/create', (req, res) => {
	var videos = (req.body.videos) ? req.body.videos : "";
	var playlistID = req.body.playlist;
	var dataPlaylist = store.getSync("playlist", playlistID);
	var dataChannel = store.getSync("channel", dataPlaylist.snippet.channelId);
	var cookie = dataChannel.cookie;

	playlistModel.create("test", "dev test", videos, cookie, 
	function (status, data)
	{
		if (status)
		{
			detailPlaylistById(data.playlist, keyAPi,
			function (boolStatus, _data)
			{
				if (boolStatus)
				{
					store.setSync("playlist", _data.items[0].id, _data.items[0]);
					dataChannel.count_playlist += 1;
					store.setSync("channel", channel, dataChannel);
				};
			});
		};

		res.json({
			status: status,
			data: data
		});
	});
});

app.post('/playlist/add/video', (req, res) => {
	var playlistID = req.body.playlist;
	var video = req.body.video;

	var dataPlaylist = store.getSync("playlist", playlistID);
	var dataChannel = store.getSync("channel", dataPlaylist.snippet.channelId);
	var cookie = dataChannel.cookie;

	playlistModel.addVideo(playlistID, video, cookie, 
	function (error, response, body)
	{
		res.json({
			error: error,
			response: response,
			body: body
		});
	});
});

app.get('/playlist/update/daily', (req, res) => {
	var playlists = [];
	store.forEachSync("playlist", (json, file) => {
		playlists.push(json);
	});

	res.json(playlists);
});

app.get('/playlist/info', (req, res) => {
	var playlist = req.query.playlist;
	if (fs.existsSync("./storage/playlist/"+ playlist + ".json")) {
		var data = store.getSync("playlist", playlist);
		res.json(data);
		// playlistModel.getView(playlist, function (error, request, body) 
		// {
		// 	if (error)
		// 	{ 
		// 		data.views = 0;
		// 		data.view_date = moment().format("x");
		// 		data.status = "die";
		// 	} else {
		// 		var tmp = body.match(/\"simpleText\":\"([0-9\,]+) (views|lượt xem)\"/);
		// 		var views = (tmp) ? tmp[1].replace(",", "") : 0;
		// 		data.views = views;
		// 		data.view_date = moment().format("x");
		// 		data.view_avg = (views/ moment().diff(moment(data.snippet.publishedAt), 'days'));
		// 		data.status = "live";
		// 	};
			
		// 	store.setSync("playlist", playlist, data);
			
		// });
	} else {
		res.json({
			error: {
				msg: "playlist không tồn tại"
			}
		});
	};
});

app.get('/search/video', (req, res) => {
	var keyword = req.query.keyword;
	searchVideo(keyword, 189, "", "", [],
	function (video)
	{
		res.json({
			video: video
		});
	});
});

app.get('/info/video', (req, res) => {
	var video = req.query.video;
	getProxyByKey("TLeFJpB3MNd3ecfpXhrMUPE4uSWDSajqoYyRO5", function (proxy)
	{
		request({
			url: "https://www.youtube.com/get_video_info?html5=1&video_id=" + video,
			method: "GET",
			proxy: "http://" + proxy
		}, function (error, response, body) {
			var data = StringToJObject(body);
			var player_response = JSON.parse(decodeURIComponent(data.player_response));
			res.json(player_response);
		});
	});
});

// Logs //
app.get('/log/channel', (req, res) => {
	var name = "Channel";
	if (fs.existsSync("./storage/log/"+ name + ".json") == true)
	{
		var data = store.getSync("log", name);
		res.json({
			data: data.data
		});
	} else {
		res.json({
			data: []
		});
	};
});

app.get('/log/playlist', (req, res) => {
	var name = "playlist";
	if (fs.existsSync("./storage/log/"+ name + ".json") == true)
	{
		var data = store.getSync("log", name);
		res.json({
			data: data.data
		});
	} else {
		res.json({
			data: []
		});
	};
});

app.get('/analytic/overview', (req, res) => {
	var data = {};
	if (fs.existsSync("./storage/analytic/playlist.json"))
	{
		data = store.getSync("analytic", "playlist");
	};

	res.json({
		r: data
	});
});

var addLogsArray = function (ary, text, max)
{
	if (ary.length >= max)
	{
		for (var i = 0; i < ary.length; i++)
		{
			if (i < (ary.length-1))
			{
				ary[i] = ary[i+1];
			} else {
				ary[i] = text;
			};
		};
	} else {
		ary.push(text);
	};

	return ary;
};

function addLog(type, text, max)
{
	// text = moment().format("yyyy-M-DD HH:mm:ss") + " > "+ text;
	var log = { last_data: moment().format("x"), data: [] };
	if (fs.existsSync("./storage/log/"+ type + ".json"))
	{
		var log = store.getSync("log", type);
	};
	log.data = addLogsArray(log.data, {
		date: moment_timezone().tz("Asia/Ho_Chi_Minh").format("yyyy-M-DD HH:mm:ss"),
		msg: text
	}, max);

	store.setSync("log", type, log);
	io.emit("log_message", {
		type: type, 
		data: {
			date: moment_timezone().tz("Asia/Ho_Chi_Minh").format("yyyy-M-DD HH:mm:ss"),
			msg: text
		}
    });
};

app.get('/log/playlist', (req, res) => {
	
});


function JobPlaylistUpdate() 
{
	var delay = 3600 * 24 * 1000;
	var playlist = false;
	store.forEachSync("playlist", (item, file) => {
		if (item.snippet.publishedAt && (parseInt(moment(item.snippet.publishedAt).format("x")) + delay) <  parseInt(moment().format("x")))
		{
			if (typeof item.date_update_video == "undefined")
			{
				if (!playlist)
					playlist = item;
			} else 
			if ((parseInt(item.date_update_video) + delay) <  parseInt(moment().format("x"))) {
				if (!playlist)
					playlist = item;
			};
		};
	});

	if (playlist)
	{
		var channel = store.getSync("channel", playlist.snippet.channelId);
		if (channel.playlist_option.proxy.type == "key")
		{
			var key = channel.playlist_option.proxy.key;
			getProxyByKey(ItemChannel.playlist_option.proxy.key,
			function (proxy) {
				searchVideo(keyword, 30, 1, proxy, [], 
				function (videos) 
				{

				});
			});
		};
	} else {
		setTimeout(function () 
		{
			JobPlaylistUpdate();
		}, 20 * 1000);
	};
};
// JobPlaylistUpdate();


function StringToJObject(str)
{
	var data = {};
    var tmp = str.split('&');
    for (var i = 0; i < tmp.length; i++)
    {
        var tmp2 = tmp[i].split('=');
        if (tmp2.length >= 2)
            data[tmp2[0]] = tmp2[1];
    };
    return data;
};

// Run Create Playlist //
function JobPlaylistCreate()
{
	var ItemChannel = false;
	try {
	    store.forEachSync("channel", (json, file) => {
			if (json.playlist_option && typeof json.playlist_option.start != "undefined")
			{
				if ( json.playlist_option.start == "1" && json.status == "live" && parseInt(json.playlist_option.max_total) > parseInt(json.count_playlist) )
				{
					if ( typeof json.date_last_create_playlist == "undefined" || ((parseInt(json.date_last_create_playlist) + (parseInt(json.playlist_option.create_delay) * 1000)) < parseInt(moment().format("x"))))
					{
						if (!ItemChannel) {
							ItemChannel = json;
						};
					};
				};
			};
		});
	} catch (err) {
	    console.log(err);
	};
	
	if (ItemChannel)
	{
		var cookie = ItemChannel.cookie.replace("\r", "");
		var keywordData = store.getSync("keyword", ItemChannel.playlist_option.keyword);
		var keyword = keywordData.keyword[Math.floor((Math.random() * (keywordData.keyword.length-1)))].replace(/\\r|,/, "");
		if (ItemChannel.playlist_option.proxy.type == "key")
		{
			getProxyByKey(ItemChannel.playlist_option.proxy.key,
			function (proxy) {
				if (proxy == null)
				{
					console.log("-- Proxy null --");
					setTimeout(function () { JobPlaylistCreate(); }, 20 * 1000);
				} else {

					var countVideo = 0;
					if (typeof ItemChannel.playlist_option.count_video != "undefined")
					{
						if ( ItemChannel.playlist_option.count_video.match(/\[(\d+)\-(\d+)\]/i) != null)
						{
							var tmp = ItemChannel.playlist_option.count_video.match(/\[(\d+)\-(\d+)\]/i);
							countVideo = getRndInteger(parseInt(tmp[1]), parseInt(tmp[2]));
						} else {
							countVideo = parseInt(ItemChannel.playlist_option.count_video);
						};
					} else {
						countVideo = getRndInteger(50, 200);
					};

					searchVideo(keyword, countVideo, "", proxy, [], 
					function (videos) 
					{
						if (videos.length > 0)
						{
							console.log("res video: "+ videos.length);
							playlistModel.proxy = proxy;
							var m = videos[Math.floor((Math.random() * (videos.length-1)))];
							detailInfoVideo(m, proxy,
							function (videoDetail) {
								console.log("--video detail--");
								if (videoDetail == false)
								{
									console.log("-- end --");
									setTimeout(function () { JobPlaylistCreate(); }, 1000);
								} else {
									var title = videoDetail.title.replace(/\+/g, " ");
									var desc = videoDetail.shortDescription.replace(/\+/g, " ");

									if (typeof ItemChannel.playlist_option.info != "undefined")
									{
										switch(ItemChannel.playlist_option.info.type_desc)
										{
											case "custom":
													desc = (ItemChannel.playlist_option.info.desc_content) ? ItemChannel.playlist_option.info.desc_content : "";
												break;
											case "append":
													desc = ItemChannel.playlist_option.info.desc_content + "\n" + desc; 
												break;
											case "prepend":
													desc = desc + "\n" + ItemChannel.playlist_option.info.desc_content;
												break;
										};
									};

									if (typeof ItemChannel.playlist_option.videos != "undefined" && ItemChannel.playlist_option.videos.length > 0)
									{
										for (var i = 0; i < ItemChannel.playlist_option.videos.length; i++)
										{
											var tmp = videos[parseInt(ItemChannel.playlist_option.videos[i].index)-1];
											videos[parseInt(ItemChannel.playlist_option.videos[i].index)-1] = ItemChannel.playlist_option.videos[i].video;
											videos.push(tmp);
										};
									};

									console.log("--create pll--");
									playlistModel.create(title, encodeURIComponent(desc), videos, cookie, 
									function (status, data)
									{
										console.log(data);
										if (status)
										{
											detailPlaylistById(data.playlist, "AIzaSyA_ONHofV_6Y_Ri6FBS3v3lXfwnb2-lt38",
											function (boolStatus, _data)
											{
												if (boolStatus)
												{
													_data.items[0].keyword = keyword;
													store.setSync("playlist", _data.items[0].id, _data.items[0]);
												};

												playlistModel.setAvatar(data.playlist, m, cookie);
												ItemChannel.count_playlist += 1;
												ItemChannel.date_last_create_playlist = moment().format("x");
												store.setSync("channel", ItemChannel.channel, ItemChannel);
												addLog("playlist", `Success Create Playlist <a href="https://www.youtube.com/playlist?list=`+ data.playlist +`" target="_blank" style="color: #fff;">`+ title +`</a>`,30);
												io.emit("create_playlist", {
										    		channel: ItemChannel.channel, 
										    		date_create: ItemChannel.date_last_create_playlist,
										    		count_playlist: ItemChannel.count_playlist,
										    		status: ItemChannel.status
											    });
												console.log("-- end --");
												setTimeout(function () { JobPlaylistCreate(); }, 1000);
											});
										} else {
											if (data.code == 401)
											{
												ItemChannel.status = "warning";
												addLog("Channel", `[Warning] Channel <a href="https://www.youtube.com/channel/`+ ItemChannel.channel +`" target="_blank" style="color: #fff;">`+ ItemChannel.channel +`</a>`,30);

											} else {
												ItemChannel.date_last_create_playlist = moment().format("x");
											};
											store.setSync("channel", ItemChannel.channel, ItemChannel);

											io.emit("create_playlist", {
									    		channel: ItemChannel.channel, 
									    		date_create: ItemChannel.date_last_create_playlist,
									    		count_playlist: ItemChannel.count_playlist,
									    		status: ItemChannel.status
										    });

											console.log("-- end --");
											setTimeout(function () { JobPlaylistCreate(); }, 1000);
										};
									});
								};
							});
						} else {
							console.log("-- end --");
							setTimeout(function () { JobPlaylistCreate(); }, 1000);
						};
					});
				};
				
			});
		};
	} else {
		setTimeout(function () { JobPlaylistCreate(); }, 20 * 1000);
	};
};
JobPlaylistCreate();

function getProxyByKey(key, callback)
{
	lastKey = key;
	if (dateGetProxy == 0)
	{
		request({
			url: "http://proxy.tinsoftsv.com/api/getProxy.php?key="+ key,
			timeout: 20 * 1000,
			method: "GET"
		}, function (error, response, body) {
			var data = JSON.parse(response.body);
			if (typeof data.proxy != "undefined")
			{
				thisProxy = data.proxy;
				dateGetProxy = moment().format("X");
				callback(data.proxy);
			} else {
				request({
					url: "http://proxy.tinsoftsv.com/api/changeProxy.php?key="+ key +"&location=0",
					timeout: 20 * 1000,
					method: "GET"
				}, function (error, response, body) {
					var data = JSON.parse(body);
					if (typeof data.proxy != "undefined")
					{
						thisProxy = data.proxy;
						dateGetProxy = moment().format("X");
						useProxyCount = 0;
						callback(data.proxy);
					} else {
						dateGetProxy = moment().format("X");
						callback(null);
					};
				});
			};
		});
	} else {
		if (timeoutProxy - (moment().format("X") - dateGetProxy) <= 0)
		{
			request({
				url: "http://proxy.tinsoftsv.com/api/changeProxy.php?key="+ key +"&location=0",
				timeout: 20 * 1000,
				method: "GET"
			}, function (error, response, body) {
				var data = JSON.parse(body);
				if (typeof data.proxy != "undefined")
				{
					thisProxy = data.proxy;
					dateGetProxy = moment().format("X");
					useProxyCount = 0;
					callback(data.proxy);
				} else {
					request({
						url: "http://proxy.tinsoftsv.com/api/getProxy.php?key="+ key,
						timeout: 20 * 1000,
						method: "GET"
					}, function (error, response, body) {
						var data = JSON.parse(response.body);
						if (typeof data.proxy != "undefined")
						{
							thisProxy = data.proxy;
							dateGetProxy = moment().format("X");
							callback(data.proxy);
						} else {
							callback(null);
						};
					});
				};
			});
		} else {

			console.log("-- Timeout proxy [pending "+ (timeoutProxy - (moment().format("X") - dateGetProxy)) +"s] --");
			setTimeout(function ()
			{
				getProxyByKey(key, callback);
			}, (timeoutProxy - (moment().format("X") - dateGetProxy)) * 1000);
		};
	};
};

function changeProxyKey(callback)
{
	request({
		url: "http://proxy.tinsoftsv.com/api/changeProxy.php?key="+ lastKey +"&location=0",
		timeout: 20 * 1000,
		method: "GET"
	}, function (error, response, body) {
		if (error == null)
		{
			var data = JSON.parse(body);
			if (data.proxy)
			{
				thisProxy = data.proxy;
				dateGetProxy = moment().format("x");
				timeoutProxy = parseInt(data.timeout * 1000);
				playlistModel.proxy = data.proxy;
			};
		};
	});
};

function searchVideo(keyword, length, page, proxy, videos, callback)
{
	console.log(keyword);
	console.log("max - "+ length);
	console.log("proxy: "+ proxy);
	request({
		url: "https://docs.google.com/picker/pvr?hl=en_US&xtoken=AL7Jy1wV--xTMZsfw3xX4kXr4g0ynIGjsA%3A1605107316620&origin=https%3A%2F%2Fwww.youtube.com&hostId=yt-addtoplaylist",
		method: "POST",
		timeout: 20 * 1000,
		headers: {
			cookie: "CONSENT=YES+VN.en+202008; __Secure-3PSID=2wekK4uMK5ps3H8A8xN94z-hLEKstlkcrvgL3CRQmk3w5B7zWjWh9RohQXMFaEQGPFCb8w.; __Secure-3PAPISID=owgsZwAeYu5nX47v/ANi9jsLPHqncP87fl; ANID=AHWqTUmA-pgURkorvZOs0AIETwCy4ZIop0VlIKYvYfh4FIFwW3M2ID5-XHSZgyI9; 1P_JAR=2020-11-11-14; NID=204=byNucNoNXpOdGwN6B2hWpKjaQ4ERNcpMbWTTCnFjxzc8p7xcUoK4YPjVdw9WqBn_4vQsM7Td2yHhoq0PXI3EvSUURHHXx0VAr54jui72G-wf3K4pVwk50pN-YD4Jap2lHTkVCLrrHqxiHzpFQayuJF-e4Te-Loz3evtQG83t2REXgNfNwtbLw41FwRVGsR0Z0ENt4x_PFL763on6OxKNRhL-hhNsSb9XCoL-aACRzvHjSyKUFyLkba054jxs8nqIZCtpeITslYtaCKP6tuJtjqatBF3COwxTwEfwB2re8ILptdwEuK95IsyvOf4p; __Secure-3PSIDCC=AJi4QfElkf4XJ0jJc3ecPKmSuKd-AiZAgzXvgeu3uNyK6Yws1EqdTFGZGjMqBxNPURQ-kXPPLA",
			"x-client-data": "CIm2yQEIpLbJAQjEtskBCKmdygEIq8fKAQj1x8oBCOnIygEItMvKAQikzcoBCNvVygEI8JfLAQiYmssBCMKaywEYi8HKAQ==",
			"Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
			"user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/86.0.4240.193 Safari/537.36",
			origin: "https://docs.google.com",
			"x-same-domain": "explorer",
			referer: "https://docs.google.com/picker?protocol=gadgets&origin=https%3A%2F%2Fwww.youtube.com&hostId=yt-addtoplaylist&hl=en_US&title=Add%20video%20to%20playlist&multiselectEnabled=true&st=000770F20343C31AC65CABEBDB50B436532515874679AE46B0%3A%3A1605107313223&selectButtonLabel=Add%20videos&relayUrl=https%3A%2F%2Fwww.youtube.com%2Ffavicon.ico&nav=((%22video-search%22%2Cnull%2C%7B%22site%22%3A%22youtube.com%22%7D)%2C(%22url%22%2Cnull%2C%7B%22type%22%3A%22video%22%2C%22site%22%3A%22youtube.com%22%7D)%2C(%22youtube%22))&rpcService=biz5o6g6jy66&rpctoken=aluhobgf66pa"
		},
		proxy: "http://"+ proxy,
		body: "start=0&numResults=50&sort=3&desc=true&q="+ encodeURIComponent(keyword) +"&cursor="+ page +"&service=youtube&type=search&options=%7B%22safe%22%3A%22active%22%7D&token=jXvm23UBAAA.6N9FN0ciOzb4ISCvFt8jgQ.RMEiyRUqAzjGLO3W9DOeGg&version=4&app=2&clientUser=08695222365465007717&subapp=5&authuser=0"
	}, function (error, response, body) {
		console.log("proxy: "+ proxy + " -- done");
		if (error == null)
		{
			var _body = JSON.parse(response.body.replace("&&&START&&&", ""));
			var data = _body.response.docs;
			data.forEach(item => {
				if (videos.length < length)
					videos.push(item.id);
			});
			
			if (length > videos.length)
			{
				searchVideo(keyword, length, _body.response.cursor, proxy, videos, callback);
			} else {
				callback(videos);
			};
		} else {
			callback([]);
		};
	});
};

function detailInfoVideo(video, proxy, callback)
{
	request({
		url: "https://www.youtube.com/get_video_info?html5=1&video_id=" + video,
		method: "GET",
		timeout: 20 * 1000,
		proxy: 	"http://" + proxy
	}, function (error, response, body) {
		if (error == null)
		{
			var data = StringToJObject(body);
			var player_response = JSON.parse(decodeURIComponent(data.player_response));
			callback(player_response.videoDetails);
		} else {
			callback(false);
		};
	});
};

const playlistModel = {
	proxy: "",

	create: function (title, desc, videos, cookie, callback)
	{
		request({
			url: "https://www.youtube.com/view_all_playlists?o=U&nv=1",
			method: "GET",
			timeout: 20 * 1000,
			headers: {
				cookie: cookie
			},
			proxy: "http://"+ playlistModel.proxy
		}, function (error, response, body) {
			console.log("-- get page Pll");
			if (error == null)
			{
				var XSRF_TOKEN = body.match(/'XSRF_TOKEN': \"(.+?)\"/i);
					XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
				if (XSRF_TOKEN == null)
				{
					XSRF_TOKEN = body.match(/"XSRF_TOKEN": \"(.+?)\"/i);
					XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
				};

				if (XSRF_TOKEN == null)
				{
					callback(false, { code: 401, msg: "Cookie waring..." });
				} else {
					request({
						url: "https://www.youtube.com/playlist_ajax?action_create_playlist=1",
						headers: { cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
						method: "POST",
						timeout: 20 * 1000,
						form: { video_ids: videos.join(','), source_playlist_id: "", n: title, p: "public", session_token: XSRF_TOKEN },
						json: false,
						proxy: "http://"+ playlistModel.proxy
					}, function (error, response, body) {
						console.log("-- Create PLL Res");
						if (error == null)
						{
							var dataPlaylist = JSON.parse(body);
							if (typeof dataPlaylist.result != "undefined" && dataPlaylist.result.playlistId)
							{
								request({
									url: "https://www.youtube.com/playlist?list=" + dataPlaylist.result.playlistId,
									method: "GET",
									timeout: 20 * 1000,
									headers: { cookie: cookie },
									proxy: "http://"+ playlistModel.proxy
								}, function (error, response, body) {
									console.log("-- GET PLL Res");
									if (error == null)
									{
										var XSRF_TOKEN = body.match(/\"XSRF_TOKEN\":\"(.+?)\"/i);
										var clickTrackingParams = body.match(/\"clickTrackingParams\":\"(.+?)\"/i);
										var csn = body.match(/\"csn\":\"(.+?)\"/i);

										XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
										clickTrackingParams = ((clickTrackingParams) ? clickTrackingParams[1] : clickTrackingParams);
										csn = ((csn) ? csn[1] : csn);

										if (desc != "")
										{
											request({
												url: "https://www.youtube.com/service_ajax?name=playlistEditEndpoint",
												headers: { cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
												method: "POST",
												proxy: "http://"+ playlistModel.proxy,
												body: "sej=%7B%22clickTrackingParams%22%3A%22" + clickTrackingParams + "%22%2C%22commandMetadata%22%3A%7B%22webCommandMetadata%22%3A%7B%22url%22%3A%22%2Fservice_ajax%22%2C%22sendPost%22%3Atrue%7D%7D%2C%22playlistEditEndpoint%22%3A%7B%22playlistId%22%3A%22" + dataPlaylist.result.playlistId + "%22%2C%22actions%22%3A%5B%7B%22action%22%3A%22ACTION_SET_PLAYLIST_DESCRIPTION%22%2C%22playlistDescription%22%3A%22" + desc + "%20%22%7D%5D%7D%7D&csn=" + csn + "&session_token=" + XSRF_TOKEN
											}, function (error, response, body) {
												if (callback)
													callback(true, { playlist:  dataPlaylist.result.playlistId });
											});
										} else {
											callback(true, { playlist:  dataPlaylist.result.playlistId });
										};
									} else {
										callback(false, { code: 400, msg: "Get page playlist new fail" });
									};
								});
							} else {
								callback(false, { code: 400, msg: "Create Playlist fail" });
							};
						} else {
							callback(false, { code: 400, msg: "Create Playlist fail" });
						};
					});
				};
			} else {
				callback(false, { code: 400, msg: "GET page Playlist list fail" });
			};
		});
	},

	setAvatar: function (playlistID, video, cookie, callback)
	{
		request({
			url: "https://www.youtube.com/playlist?list=" + playlistID,
			method: "GET",
			headers: { cookie: cookie },
			timeout: 20 * 1000,
			proxy: "http://"+ playlistModel.proxy
		}, function (error, response, body) {
			if (error==null)
			{
				var XSRF_TOKEN = body.match(/\"XSRF_TOKEN\":\"(.+?)\"/i);
				var clickTrackingParams = body.match(/\"clickTrackingParams\":\"(.+?)\"/i);
				var csn = body.match(/\"csn\":\"(.+?)\"/i);

				XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
				clickTrackingParams = ((clickTrackingParams) ? clickTrackingParams[1] : clickTrackingParams);
				csn = ((csn) ? csn[1] : csn);

				request({
					url: "https://www.youtube.com/service_ajax?name=playlistEditEndpoint",
					headers: { cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
					method: "POST",
					timeout: 20 * 1000,
					proxy: "http://"+ playlistModel.proxy,
					body: "sej=%7B%22clickTrackingParams%22%3A%22" + clickTrackingParams + "%22%2C%22commandMetadata%22%3A%7B%22webCommandMetadata%22%3A%7B%22url%22%3A%22%2Fservice_ajax%22%2C%22sendPost%22%3Atrue%7D%7D%2C%22playlistEditEndpoint%22%3A%7B%22playlistId%22%3A%22"+ playlistID + "%22%2C%22actions%22%3A%5B%7B%22thumbnailVideoId%22%3A%22" + video + "%22%2C%22action%22%3A%22ACTION_SET_PLAYLIST_THUMBNAIL%22%7D%5D%7D%7D&csn=" + csn + "&session_token=" + XSRF_TOKEN
				}, function (error, response, body) {
					if (callback)
						callback(error, response, body);
				});
			} else {
				if (callback)
					callback(false);
			};
			
		});
	},

	delete: function (playlistID, cookie, callback)
	{
		request({
			url: "https://www.youtube.com/playlist?list=" + playlistID,
			method: "GET",
			timeout: 20 * 1000,
			headers: { cookie: cookie }
		}, function (error, response, body) {
			var XSRF_TOKEN = response.body.match(/\"XSRF_TOKEN\":\"(.+?)\"/i);
			var clickTrackingParams = response.body.match(/\"clickTrackingParams\":\"(.+?)\"/i);
			var csn = response.body.match(/\"csn\":\"(.+?)\"/i);

			XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
			clickTrackingParams = ((clickTrackingParams) ? clickTrackingParams[1] : clickTrackingParams);
			csn = ((csn) ? csn[1] : csn);

			request({
				url: "https://www.youtube.com/service_ajax?name=deletePlaylistEndpoint",
				headers: { cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
				method: "POST",
				timeout: 20 * 1000,
				body: "sej=%7B%22clickTrackingParams%22%3A%22" + clickTrackingParams + "%22%2C%22commandMetadata%22%3A%7B%22webCommandMetadata%22%3A%7B%22url%22%3A%22%2Fservice_ajax%22%2C%22sendPost%22%3Atrue%2C%22apiUrl%22%3A%22%2Fyoutubei%2Fv1%2Fplaylist%2Fdelete%22%7D%7D%2C%22deletePlaylistEndpoint%22%3A%7B%22playlistId%22%3A%22" + playlistID + "%22%7D%7D&csn=" + csn + "&session_token=" + XSRF_TOKEN
			}, function (error, response, body) {
				callback(error, response, body);
			});
		});
	},

	addVideo: function(playlistID, video, cookie, callback)
	{
		request({
			url: "https://www.youtube.com/playlist?list=" + playlistID,
			method: "GET",
			timeout: 20 * 1000,
			headers: { cookie: cookie }
		}, function (error, response, body) {
			if (error==null)
			{
				var XSRF_TOKEN = body.match(/\"XSRF_TOKEN\":\"(.+?)\"/i);
				XSRF_TOKEN = ((XSRF_TOKEN) ? XSRF_TOKEN[1] : XSRF_TOKEN);
				
				request({
					url: "https://www.youtube.com/playlist_edit_service_ajax?action_add_video=1",
					headers: { cookie: cookie, "Content-Type": "application/x-www-form-urlencoded" },
					method: "POST",
					timeout: 20 * 1000,
					body: "video_id=" + video + "&video_access_token=&playlist_id=" + playlistID + "&session_token=" + XSRF_TOKEN
				}, function (error, response, body) {
					if (error != null) {
						callback(false, error);
					} else {
						callback(true, body);
					};
				});
			} else {
				callback(false, error);
			};
		});
	},

	getView: function (playlistID, callback)
	{
		request({
			url: "https://www.youtube.com/playlist?list=" + playlistID,
			method: "GET",
			timeout: 20 * 1000,
		}, function (error, response, body) {
			callback(error, response, body);
		});
	}
};

const youtubeData = {
	search: function ()
	{

	}
};

// Update Analytic Playlist daily //
function pushViewChartData(date, view)
{
	var data = {};
	if (fs.existsSync("./storage/analytic/playlist.json"))
	{
		data = store.getSync("analytic", "playlist");
	};
	
	if (typeof data[date] == "undefined")
	{
		data[date] = parseInt(view);
	} else {
		data[date] += parseInt(view);
	};

	store.setSync("analytic", "playlist", data);
};

function updateAnalyticPlaylistDaily()
{
	var day2 = 2 * 3600 * 24 * 1000;
	var day1 = 1 * 3600 * 24 * 1000;
	var playlists = [];

	if (fs.existsSync("./storage/playlist/"))
	{
		store.forEachSync("playlist", (item, file) => {
			if (( (typeof item.status  == "undefined") || (typeof item.status  != "undefined" && item.status == 'live') ) && item.snippet.publishedAt && (parseInt(moment(item.snippet.publishedAt).format("x")) + day2) <  parseInt(moment().format("x")))
			{
				if (typeof item.date_update_view == "undefined")
				{
					playlists.push(item);
				} else 
				if ((parseInt(item.date_update_view) + day1) <  parseInt(moment().format("x"))) {
					playlists.push(item);
				};
			};
		});
	};

	
	if (playlists.length)
	{
		var i = 0;
		function loop()
		{	
			if (i < playlists.length)
			{
				var playlist = playlists[i];
					playlistModel.getView(playlist.id, function (error, response, body) {
					if (error)
					{ 
						playlist.date_update_view = moment().format("x");
						playlist.status = "die";
					} else {
						var tmp = body.match(/\"simpleText\":\"([0-9\,]+) (views|lượt xem)\"/);
						var views = (tmp) ? tmp[1].replace(",", "") : 0;

						var views_day = (typeof playlist.views == "undefined") ? views : ( parseInt(views) - parseInt(playlist.views) );

						playlist.views = views;
						playlist.date_update_view = moment().format("x");
						playlist.view_avg = (views/ moment().diff(moment(playlist.snippet.publishedAt), 'days'));
						playlist.status = "live";

						var dateView = {};
							dateView[moment_timezone().tz("Asia/Ho_Chi_Minh").format("yyyy-M-DD")] = views_day;

						if (typeof playlist.analytics == "undefined")
						{
							playlist.analytics = [dateView];
						} else {
							playlist.analytics.push(dateView);
						};
						pushViewChartData(moment_timezone().tz("Asia/Ho_Chi_Minh").format("yyyy-M-DD"), views_day);
					};

					store.setSync("playlist", playlist.id, playlist);

					i++;
					loop();
				});
			} else {
				setTimeout(function () {
					updateAnalyticPlaylistDaily();
				}, 1000 * 60);
			};
		};

		loop();
		
	} else {
		setTimeout(function () {
			updateAnalyticPlaylistDaily();
		}, 1000 * 60);
	};
};
updateAnalyticPlaylistDaily();

function getDataPlaylistByChannel(channel, keyAPi, pageToken = "", callback)
{
  	request({
    	url: "https://www.googleapis.com/youtube/v3/playlists?part=snippet&channelId="+ channel +"&maxResults=50&key="+ keyAPi +"&pageToken="+ pageToken,
    	method: "GET"
  	}, function (error, response, body) {
	   	if (error) {
	   		if (callback)
				callback(false, body)
	   	} else {
	   		if (callback)
				callback(true, JSON.parse(body))
	   	};
  	});
};

function detailPlaylistById(playlsitID, keyAPi, callback)
{
	request({
    	url: "https://www.googleapis.com/youtube/v3/playlists?part=snippet&id="+ playlsitID +"&key="+ keyAPi,
    	method: "GET"
  	}, function (error, response, body) {
	   	if (error != null) {
	   		if (callback)
				callback(false, body)
	   	} else {
	   		if (callback)
				callback(true, JSON.parse(body))
	   	};
  	});
};

// app.listen(port, () => {
//   console.log(`Example app listening at http://localhost:${port}`)
// });

var httpServer = http.createServer(app);
var httpsServer = https.createServer(credentials, app);

httpServer.listen(port);
httpsServer.listen(3443);

// Socket IO //
server.listen(port_io);