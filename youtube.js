const Youtube = {
	create_playlist: function (cookie, channel, title, desc)
	{
		request({
			url: "https://www.youtube.com/view_all_playlists?o=U&nv=1"
		}, function (error, response, body) {
			return { error: error, response: response, body: body };
		});

		// var data = request.jar();
		// var cookie_ary = cookie.split(";");
		// for (var i = 0; i < cookie_ary.length; i++)
		// {
		// 	var cookie = request.cookie(cookie_ary[i]);
		// 	data.setCookie(cookie, url);
		// };

		// request({
		// 	url: url,
		// 	jar: data
		// }, function (error, response, body) {
		// 	return {error: error, response: response, body: body};
		// });
	},

	update_playlist: function ()
	{

	},

	add_video_playlist: function (cookie, channel, playlist, video)
	{

	},

	get_view_playlist: function (cookie, playlist)
	{

	},

	video_in_playlist_die: function (cookie, playlist)
	{

	},

	del_playlist: function (cookie, playlist)
	{

	}
};