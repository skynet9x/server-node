var canvas = document.getElementById('chartjs-analytic');
	canvas.width = "500px";
	canvas.height = "200px";
var colorChart = {
	bg: 'rgba(54, 162, 235, 0.2)',
	border: 'rgba(54, 162, 235, 1)'
};
var ctx = canvas.getContext('2d');
	
$.get("/analytic/overview", function (res) {
	var label = [];
	var views = [];
	var rowBg = [];
	var rowBorder = [];

	for (var x in res.r)
	{
		label.push(x);
		views.push(res.r[x]);
		rowBg.push(colorChart.bg);
		rowBorder.push(colorChart.border);
	};

	var myChart = new Chart(ctx, {
	    type: 'bar',
	    data: {
	        labels: label,
	        datasets: [{
	            label: '# Lượt xem',
	            data: views,
	            backgroundColor: rowBg,
	            borderColor: rowBorder,
	            borderWidth: 1
	        }]
	    },
	    options: {
	        scales: {
	            yAxes: [{
	                ticks: {
	                    beginAtZero: true
	                }
	            }]
	        }
	    }
	});
});
